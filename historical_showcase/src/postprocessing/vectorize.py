"""
Postprocessing and GeoJSON Vectorization Module for Sentinel-1 SAR Oil Spill Segmentation.
Extracts connected oil-slick regions from full-scene binary masks, filters noise components,
applies GeoTIFF affine spatial transformation to convert pixel coordinates into geographic WGS84 [lon, lat],
and computes morphological geometric properties (area, perimeter, axes, eccentricity, orientation, centroid)
strictly compatible with the PRD §7.1 schema.
"""

import math
import re
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import cv2

try:
    import tifffile
    HAS_TIFFFILE = True
except ImportError:
    HAS_TIFFFILE = False


def utm_to_latlon(easting: float, northing: float, zone: int = 16, northern_hemisphere: bool = True) -> Tuple[float, float]:
    """
    Convert UTM projected coordinates (Easting, Northing) to WGS84 Geographic (Latitude, Longitude) in degrees.
    """
    a = 6378137.0          # WGS84 semi-major axis
    f = 1 / 298.257223563   # WGS84 flattening
    b = a * (1 - f)
    e = math.sqrt(1 - (b / a) ** 2)
    e_prime_sq = (e ** 2) / (1 - e ** 2)
    k0 = 0.9996

    x = easting - 500000.0
    y = northing if northern_hemisphere else northing - 10000000.0

    M = y / k0
    mu = M / (a * (1 - e ** 2 / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256))

    e1 = (1 - math.sqrt(1 - e ** 2)) / (1 + math.sqrt(1 - e ** 2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * math.sin(8 * mu)
    )

    N1 = a / math.sqrt(1 - e ** 2 * math.sin(phi1) ** 2)
    T1 = math.tan(phi1) ** 2
    C1 = e_prime_sq * math.cos(phi1) ** 2
    R1 = a * (1 - e ** 2) / ((1 - e ** 2 * math.sin(phi1) ** 2) ** 1.5)
    D = x / (N1 * k0)

    lat = phi1 - (N1 * math.tan(phi1) / R1) * (
        D ** 2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e_prime_sq) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e_prime_sq - 3 * C1 ** 2) * D ** 6 / 720
    )
    lat_deg = math.degrees(lat)

    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    lon = lon0 + (
        D
        - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e_prime_sq + 24 * T1 ** 2) * D ** 5 / 120
    ) / math.cos(phi1)
    lon_deg = math.degrees(lon)

    return lat_deg, lon_deg


def extract_geotiff_spatial_metadata(tiff_path: Optional[Path]) -> Dict[str, Any]:
    """
    Extract GeoTIFF tiepoints, pixel scale, and CRS information.
    Returns has_georef=False without inventing fake UTM coordinates if missing.
    """
    meta = {
        "has_georef": False,
        "easting_0": None,
        "northing_0": None,
        "scale_x": 10.0,
        "scale_y": 10.0,
        "zone": None,
        "northern_hemisphere": True
    }

    if tiff_path is None or not HAS_TIFFFILE:
        return meta

    try:
        path = Path(tiff_path)
        if not path.exists() or path.suffix.lower() not in (".tif", ".tiff"):
            return meta

        with tifffile.TiffFile(path) as tif:
            page = tif.pages[0]
            if "ModelTiepointTag" in page.tags and "ModelPixelScaleTag" in page.tags:
                tiepoints = page.tags["ModelTiepointTag"].value
                scales = page.tags["ModelPixelScaleTag"].value
                meta["easting_0"] = float(tiepoints[3])
                meta["northing_0"] = float(tiepoints[4])
                meta["scale_x"] = float(scales[0])
                meta["scale_y"] = float(scales[1])
                meta["has_georef"] = True

            if "GeoKeyDirectoryTag" in page.tags:
                geokeys = page.tags["GeoKeyDirectoryTag"].value
                for i in range(4, len(geokeys), 4):
                    key_id = geokeys[i]
                    val = geokeys[i + 3]
                    if key_id == 3072:
                        if 32601 <= val <= 32660:
                            meta["zone"] = val - 32600
                            meta["northern_hemisphere"] = True
                        elif 32701 <= val <= 32760:
                            meta["zone"] = val - 32700
                            meta["northern_hemisphere"] = False

            if "GeoAsciiParamsTag" in page.tags:
                ascii_str = str(page.tags["GeoAsciiParamsTag"].value)
                if "UTM Zone" in ascii_str:
                    m = re.search(r"UTM Zone\s+(\d+)\s*([NSns]?)", ascii_str)
                    if m:
                        meta["zone"] = int(m.group(1))
                        if m.group(2).upper() == "S":
                            meta["northern_hemisphere"] = False

    except Exception:
        pass

    return meta


def extract_acquisition_time(tiff_path: Optional[Path], filename: str) -> str:
    """Extract acquisition timestamp from TIFF metadata tags or filename pattern."""
    if tiff_path and HAS_TIFFFILE:
        try:
            path = Path(tiff_path)
            if path.exists() and path.suffix.lower() in (".tif", ".tiff"):
                with tifffile.TiffFile(path) as tif:
                    page = tif.pages[0]
                    if "DateTime" in page.tags:
                        val = str(page.tags["DateTime"].value).strip()
                        parts = val.split()
                        if len(parts) == 2:
                            d_str = parts[0].replace(":", "-")
                            return f"{d_str}T{parts[1]}Z"
                        return val
        except Exception:
            pass

    # Robust regex search on filename stem (supports YYYY_MM_DD, YYYY-MM-DD, YYYYMMDD with optional time)
    stem = Path(filename).stem
    m = re.search(r"(\d{4})[-_]?(\d{2})[-_]?(\d{2})(?:[T_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})?)?", stem)
    if m:
        year, month, day = m.group(1), m.group(2), m.group(3)
        hour = m.group(4) or "00"
        minute = m.group(5) or "00"
        second = m.group(6) or "00"
        return f"{year}-{month}-{day}T{hour}:{minute}:{second}Z"

    return "UNAVAILABLE"


def extract_slick_geojson(
    binary_mask: np.ndarray,
    prob_map: np.ndarray,
    source_name: str = "20200224.tif",
    source_path: Optional[Path] = None,
    min_area_pixels: int = 15,
    pixel_spacing_m: float = 10.0
) -> Dict[str, Any]:
    """
    Extract connected oil-slick components from full-scene binary mask and produce Stage 1 GeoJSON output
    strictly conforming to PRD §7.1 schema with geographic WGS84 coordinates when available.
    """
    h, w = binary_mask.shape
    geo_meta = extract_geotiff_spatial_metadata(source_path)

    has_georef = geo_meta["has_georef"]
    e0 = geo_meta["easting_0"]
    n0 = geo_meta["northing_0"]
    sx = geo_meta["scale_x"]
    sy = geo_meta["scale_y"]
    zone = geo_meta["zone"] or 16
    is_north = geo_meta["northern_hemisphere"]

    pixel_area_km2 = (sx * sy) * 1e-6    # 100 m^2 = 0.0001 km^2
    pixel_dist_km = (sx + sy) * 0.5 * 1e-3  # 10 m = 0.01 km

    # Extract contours
    contours, _ = cv2.findContours(binary_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    features: List[Dict[str, Any]] = []
    slick_idx = 1
    total_valid_oil_pixels = 0
    total_valid_area_km2 = 0.0

    for cnt in contours:
        # Use exact connected-component foreground mask pixel count
        c_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(c_mask, [cnt], -1, 1, -1)
        area_pixels = int(np.sum(c_mask))

        if area_pixels < min_area_pixels:
            continue

        total_valid_oil_pixels += area_pixels
        area_km2 = area_pixels * pixel_area_km2
        total_valid_area_km2 += area_km2

        perimeter_pixels = cv2.arcLength(cnt, closed=True)
        perimeter_km = perimeter_pixels * pixel_dist_km

        # Moments & Centroid
        M = cv2.moments(cnt)
        if M["m00"] > 0:
            cx = float(M["m10"] / M["m00"])
            cy = float(M["m01"] / M["m00"])
        else:
            pts = cnt.squeeze()
            if pts.ndim == 1:
                cx, cy = float(pts[0]), float(pts[1])
            else:
                cx, cy = float(pts[:, 0].mean()), float(pts[:, 1].mean())

        if has_georef and e0 is not None and n0 is not None:
            centroid_E = e0 + cx * sx
            centroid_N = n0 - cy * sy
            centroid_lat, centroid_lon = utm_to_latlon(centroid_E, centroid_N, zone=zone, northern_hemisphere=is_north)
            centroid_geo = [round(centroid_lon, 6), round(centroid_lat, 6)]
        else:
            centroid_geo = [round(cx, 2), round(cy, 2)]  # Pixel centroid coordinates

        # Ellipse fitting for major/minor axes, orientation & eccentricity
        if len(cnt) >= 5:
            try:
                (ecx, ecy), (axis1, axis2), angle = cv2.fitEllipse(cnt)
                major_px = max(axis1, axis2)
                minor_px = min(axis1, axis2)
                orientation_deg = float(angle)
            except Exception:
                x, y, bw, bh = cv2.boundingRect(cnt)
                major_px, minor_px = max(bw, bh), min(bw, bh)
                orientation_deg = 0.0
        else:
            x, y, bw, bh = cv2.boundingRect(cnt)
            major_px, minor_px = max(bw, bh), min(bw, bh)
            orientation_deg = 0.0

        major_axis_km = major_px * pixel_dist_km
        minor_axis_km = minor_px * pixel_dist_km

        if major_px > 0:
            eccentricity = float(np.sqrt(max(0.0, 1.0 - (minor_px / major_px) ** 2)))
        else:
            eccentricity = 0.0

        # Mean model confidence over contour region
        conf_pixels = prob_map[c_mask == 1]
        confidence = float(np.mean(conf_pixels)) if len(conf_pixels) > 0 else 0.5

        # Simplify contour to eliminate collinear duplicate vertices
        cnt_approx = cv2.approxPolyDP(cnt, epsilon=0.5, closed=True)
        pts_raw = cnt_approx.squeeze()

        if pts_raw.ndim == 1:
            pts_list = [[float(pts_raw[0]), float(pts_raw[1])]]
        else:
            pts_list = [[float(p[0]), float(p[1])] for p in pts_raw]

        # Convert pixel points to WGS84 lat/lon if georeferenced, else keep pixel coords
        geo_ring = []
        for px, py in pts_list:
            if has_georef and e0 is not None and n0 is not None:
                E_p = e0 + px * sx
                N_p = n0 - py * sy
                p_lat, p_lon = utm_to_latlon(E_p, N_p, zone=zone, northern_hemisphere=is_north)
                geo_ring.append([round(p_lon, 6), round(p_lat, 6)])
            else:
                geo_ring.append([round(px, 1), round(py, 1)])

        # Remove consecutive duplicate points
        clean_ring = []
        for pt in geo_ring:
            if not clean_ring or clean_ring[-1] != pt:
                clean_ring.append(pt)

        # Ensure ring is closed and has at least 4 positions
        if len(clean_ring) > 0 and clean_ring[0] != clean_ring[-1]:
            clean_ring.append(clean_ring[0])

        if len(clean_ring) < 4:
            continue

        feature = {
            "type": "Feature",
            "id": f"slick_{slick_idx:03d}",
            "geometry": {
                "type": "Polygon",
                "coordinates": [clean_ring]
            },
            "properties": {
                "slick_id": f"slick_{slick_idx:03d}",
                "confidence": round(confidence, 4),
                "area_km2": round(area_km2, 6),
                "area_pixels": area_pixels,
                "perimeter_km": round(perimeter_km, 4),
                "major_axis_km": round(major_axis_km, 4),
                "minor_axis_km": round(minor_axis_km, 4),
                "eccentricity": round(eccentricity, 4),
                "orientation_deg": round(orientation_deg, 2),
                "centroid": centroid_geo,
                "georeferencing_available": has_georef
            }
        }
        features.append(feature)
        slick_idx += 1

    overall_conf = float(np.mean(prob_map[binary_mask == 1])) if np.sum(binary_mask) > 0 else float(np.mean(prob_map))
    scene_stem = Path(source_name).stem
    acq_time = extract_acquisition_time(source_path, source_name)

    prd_schema_output = {
        "scene_id": scene_stem,
        "acquisition_time": acq_time,
        "georeferencing_status": "AVAILABLE" if has_georef else "UNAVAILABLE",
        "confidence": round(overall_conf, 4),
        "polygons": {
            "type": "FeatureCollection",
            "features": features
        },
        "geometry_features": {
            "total_slicks_detected": len(features),
            "total_oil_pixels": int(total_valid_oil_pixels),
            "total_area_km2": round(total_valid_area_km2, 6),
            "pixel_resolution_m": pixel_spacing_m,
            "min_area_filter_pixels": min_area_pixels
        },
        "lookalike_filter": {
            "applied": False,
            "stage": "Stage 1 Candidate Slicks",
            "candidate_count": len(features),
            "filter_status": "PENDING_STAGE2_LOOKALIKE_DISCRIMINATION"
        }
    }
    return prd_schema_output

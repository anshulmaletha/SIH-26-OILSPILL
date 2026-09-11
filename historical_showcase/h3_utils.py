"""
h3_utils.py — Consolidated H3 Geospatial Discretization Utility
Marine Oil Spill Attribution System (SIH 2026)

Single source of truth for:
- H3_RESOLUTION = 7 (PRD §2.2 non-negotiable anchor resolution)
- point_to_hex(lat, lon) -> hex_id
- polygon_to_hex(geojson_polygon) -> list of hex_ids
- k_ring_expansion(hex_id, k) -> list of hex_ids with confidence-decay weight 1/(1+k)
- get_h3_boundary(cell_id) -> boundary coordinates for visualization
"""

from typing import List, Dict, Any, Union, Tuple
import h3

# =====================================================================
# SINGLE SOURCE OF TRUTH — H3 RESOLUTION
# PRD §2.2 / §7.2: Resolution 7 (~1.22 km edge length, ~5.16 km² area)
# =====================================================================
H3_RESOLUTION: int = 7


def point_to_hex(lat: float, lon: float, res: int = H3_RESOLUTION) -> str:
    """
    Converts (latitude, longitude) geographic coordinates to H3 hex index string.
    Supports both h3-py v4 (latlng_to_cell) and v3 (geo_to_h3).
    """
    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lon, res)
    return h3.geo_to_h3(lat, lon, res)


# Backward-compatible aliases used across scripts
latlon_to_h3 = point_to_hex
get_h3_cell = point_to_hex


def get_h3_boundary(cell_id: str) -> List[Tuple[float, float]]:
    """
    Returns polygon boundary coordinates for an H3 cell.
    Supports both h3-py v4 (cell_to_boundary) and v3 (h3_to_geo_boundary).
    """
    if hasattr(h3, "cell_to_boundary"):
        return h3.cell_to_boundary(cell_id)
    return h3.h3_to_geo_boundary(cell_id)


def polygon_to_hex(
    geojson_polygon: Union[Dict[str, Any], List[Any]],
    res: int = H3_RESOLUTION
) -> List[str]:
    """
    Converts a GeoJSON Polygon (or coordinates list) to a list of H3 hex IDs.
    Handles GeoJSON dictionary {"type": "Polygon", "coordinates": [[[lon, lat], ...]]}
    or a list of coordinate rings.
    """
    if isinstance(geojson_polygon, dict):
        coords = geojson_polygon.get("coordinates", [])
    else:
        coords = geojson_polygon

    if not coords or not coords[0]:
        return []

    # GeoJSON coordinates are in [lon, lat] order. H3 expects (lat, lon).
    outer_ring = [(pt[1], pt[0]) for pt in coords[0]]

    if hasattr(h3, "LatLngPoly") and hasattr(h3, "polygon_to_cells"):
        latlng_poly = h3.LatLngPoly(outer_ring)
        return sorted(list(h3.polygon_to_cells(latlng_poly, res)))
    elif hasattr(h3, "polygon_to_cells"):
        return sorted(list(h3.polygon_to_cells(outer_ring, res)))
    elif hasattr(h3, "polyfill"):
        geojson_repr = {"type": "Polygon", "coordinates": coords}
        return sorted(list(h3.polyfill(geojson_repr, res, geo_json_conformant=True)))
    return []


def k_ring_expansion(
    hex_id: str,
    k: int = 1
) -> List[Dict[str, Any]]:
    """
    Computes k-ring expansion around hex_id up to distance k with confidence-decay weights.
    Decay weight formula: 1 / (1 + distance), per PRD §4 Stage 3 and PRD §7.3.
    
    Returns:
        List of dicts: [
            {"hex_id": str, "k_ring": int, "decay_weight": float},
            ...
        ]
    """
    results: List[Dict[str, Any]] = []
    visited = set()

    for d in range(k + 1):
        if hasattr(h3, "grid_ring"):
            ring_cells = h3.grid_ring(hex_id, d)
        elif hasattr(h3, "k_ring_distances"):
            # v3 fallback
            distances = h3.k_ring_distances(hex_id, k)
            ring_cells = distances[d] if d < len(distances) else []
        else:
            ring_cells = []

        for cell in sorted(list(ring_cells)):
            if cell not in visited:
                visited.add(cell)
                results.append({
                    "hex_id": cell,
                    "k_ring": d,
                    "decay_weight": round(1.0 / (1.0 + d), 4)
                })

    return results

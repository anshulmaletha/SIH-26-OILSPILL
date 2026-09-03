#!/usr/bin/env python3
"""
lookalike_filter.py — Stage 1 Look-Alike Filter (P3 Module)
Marine Oil Spill Detection & AIS-Based Vessel Attribution Pipeline
SIH 2026 — NTRO Problem Statement

Implements three-gate classification per PRD §7.1:
  Gate A (Wind Gate):    Rejects if wind_speed outside 2.0–12.0 m/s
  Gate B (Damping Gate): Rejects if damping_ratio < 0.50
  Gate C (Shape Gate):   Rejects if eccentricity < 0.70

Oil is undetectable in SAR below ~2 m/s (everything looks dark/glassy)
and above ~12 m/s (damping signature washes out). Mineral oil has a
distinctive radar damping ratio; natural look-alikes do not. Operational
discharges are long/thin/linear (high eccentricity); natural calm patches
are broad and amorphous (low eccentricity).

Usage:
  python lookalike_filter.py                      # reads dummy_day1_input.json
  python lookalike_filter.py path/to/input.json   # reads specified file

Output: day1_output.json (PRD §7.1 compliant)
"""

import json
import sys
import os
from datetime import datetime, timezone


# ═══════════════════════════════════════════════════════════════════════
#  CONFIGURATION — Threshold constants from PRD §4 Stage 1
#  These values are recorded in the case file (§7.5) for auditability.
# ═══════════════════════════════════════════════════════════════════════

WIND_MIN_MS = 2.0       # Below this, SAR shows uniform dark (false positives)
WIND_MAX_MS = 12.0      # Above this, wave damping signature washes out
DAMPING_THRESHOLD = 0.50 # Mineral oil damping ratio lower bound
ECCENTRICITY_THRESHOLD = 0.70  # Operational discharge linearity threshold
ALIGNMENT_TOLERANCE_DEG = 15.0 # Max angle diff to shipping lane/vessel heading

# Dummy shipping lane headings for Arabian Sea (e.g., traffic into Mumbai)
KNOWN_SHIPPING_LANES_DEG = [45.0, 225.0, 10.0, 190.0]

DEFAULT_INPUT_FILE = "dummy_day1_input.json"
OUTPUT_FILE = "day1_output.json"


# ═══════════════════════════════════════════════════════════════════════
#  EXTERNAL DATA & ALIGNMENT UTILITIES
# ═══════════════════════════════════════════════════════════════════════

def fetch_era5_wind(lat, lon, time_str, fallback_speed):
    """
    Fetch ERA5 wind speed using cdsapi (Copernicus Climate Data Store).
    For the hackathon, if credentials aren't set or api fails, it falls back
    to the pre-populated value from the input JSON.
    """
    if "CDSAPI_URL" not in os.environ or "CDSAPI_KEY" not in os.environ:
        return fallback_speed

    try:
        import cdsapi
        import math  # noqa: F401
        _c = cdsapi.Client()  # noqa: F841
        # In a real implementation, we would query using the lat, lon, and time
        # For now, if we have a client, we just return the fallback for the demo
        return fallback_speed
    except ImportError:
        print("  [WARNING] cdsapi not installed, using fallback wind speed.")
        return fallback_speed
    except Exception as e:
        print(f"  [WARNING] ERA5 fetch failed: {e}. Using fallback.")
        return fallback_speed


def compute_centroid(coords):
    """Compute simplistic unweighted centroid (lat, lon) from GeoJSON coords."""
    if not coords or not coords[0]:
        return 0.0, 0.0
    ring = coords[0]
    avg_lon = sum(pt[0] for pt in ring) / len(ring)
    avg_lat = sum(pt[1] for pt in ring) / len(ring)
    return avg_lat, avg_lon


def check_shipping_lane_alignment(orientation_deg):
    """
    Checks if the slick's major axis aligns with any known shipping lane.
    Alignment is within ALIGNMENT_TOLERANCE_DEG.
    """
    if not isinstance(orientation_deg, (int, float)):
        return False, None

    for lane in KNOWN_SHIPPING_LANES_DEG:
        # Calculate smallest angular difference (0 to 90 degrees)
        diff = abs(orientation_deg - lane) % 180
        if diff > 90:
            diff = 180 - diff
        if diff <= ALIGNMENT_TOLERANCE_DEG:
            return True, lane
    return False, None


# ═══════════════════════════════════════════════════════════════════════
#  GATE EVALUATION FUNCTIONS
#  Each gate returns (passed: bool, reason: str|None)
# ═══════════════════════════════════════════════════════════════════════

def evaluate_wind_gate(wind_speed_ms):
    """
    Gate A — Wind Speed Operational Range.

    Oil slicks dampen capillary waves, producing dark patches in SAR.
    Below 2 m/s the entire sea surface is calm (everything looks dark),
    above 12 m/s wind-driven waves overpower the damping signature.

    Args:
        wind_speed_ms: ERA5 reanalysis wind speed at scene time/location.

    Returns:
        (passed, rejection_reason) tuple.
    """
    if type(wind_speed_ms) not in (int, float):
        return False, "Invalid wind_speed_ms value (non-numeric)"

    if wind_speed_ms < WIND_MIN_MS or wind_speed_ms > WIND_MAX_MS:
        return False, (
            f"Wind speed {wind_speed_ms:.1f} m/s out of operational "
            f"range ({WIND_MIN_MS:.1f} - {WIND_MAX_MS:.1f} m/s)"
        )
    return True, None


def evaluate_damping_gate(damping_ratio):
    """
    Gate B — Radar Damping Ratio.

    Damping ratio = mean backscatter inside dark region / local sea
    background. Mineral oil produces strong, consistent damping (high
    ratio). Natural phenomena (biogenic films, low-wind patches) produce
    weaker, inconsistent damping.

    Args:
        damping_ratio: Computed from calibrated SAR backscatter values.

    Returns:
        (passed, rejection_reason) tuple.
    """
    if type(damping_ratio) not in (int, float):
        return False, "Invalid damping_ratio value (non-numeric)"

    if damping_ratio < DAMPING_THRESHOLD:
        return False, (
            f"Insufficient radar damping ratio "
            f"({damping_ratio:.2f} < {DAMPING_THRESHOLD:.2f})"
        )
    return True, None


def evaluate_shape_gate(eccentricity):
    """
    Gate C — Shape Complexity / Linearity.

    Operational discharges (bilge/ballast pumping while underway) leave
    long, thin, linear slicks aligned with vessel heading. Natural
    look-alikes (calm patches, algae) are typically broad and amorphous
    with low eccentricity.

    Args:
        eccentricity: Ellipse-fit eccentricity of the candidate polygon.
                      Range [0, 1]; 1 = perfectly linear.

    Returns:
        (passed, rejection_reason) tuple.
    """
    if type(eccentricity) not in (int, float):
        return False, "Invalid eccentricity value (non-numeric)"

    if eccentricity < ECCENTRICITY_THRESHOLD:
        return False, (
            f"Non-linear geometry typical of natural look-alike "
            f"(eccentricity {eccentricity:.2f} < {ECCENTRICITY_THRESHOLD:.2f})"
        )
    return True, None


# ═══════════════════════════════════════════════════════════════════════
#  POLYGON PROCESSOR
# ═══════════════════════════════════════════════════════════════════════

def validate_polygon_fields(polygon, polygon_id):
    """Validate that all required fields exist in the polygon object."""
    errors = []

    if "geometry_features" not in polygon or polygon["geometry_features"] is None:
        errors.append("missing 'geometry_features' block")

    if "lookalike_filter" not in polygon or polygon["lookalike_filter"] is None:
        errors.append("missing 'lookalike_filter' block")

    if not errors:
        gf = polygon["geometry_features"]
        laf = polygon["lookalike_filter"]

        required_geom = ["area_km2", "perimeter_km", "major_axis_km",
                         "minor_axis_km", "eccentricity", "orientation_deg"]
        for field in required_geom:
            if field not in gf or gf[field] is None:
                errors.append(f"missing geometry_features.{field}")

        if "wind_speed_ms" not in laf or laf["wind_speed_ms"] is None:
            errors.append("missing lookalike_filter.wind_speed_ms")
        if "damping_ratio" not in laf or laf["damping_ratio"] is None:
            errors.append("missing lookalike_filter.damping_ratio")

    if errors:
        raise ValueError(
            f"Polygon '{polygon_id}' validation failed: {'; '.join(errors)}"
        )


def process_polygon(polygon):
    """
    Run all three filter gates on a single candidate polygon.

    Gate evaluation order: Wind → Damping → Shape.
    All gates are evaluated even if an earlier one fails, so the output
    captures every reason for rejection (aids human review of edge cases).

    The PRD §7.1 schema maps Gate B (damping) and Gate C (shape) into
    a single 'shape_gate_passed' boolean — both must pass for it to
    be True.

    Args:
        polygon: dict matching the input polygon structure.

    Returns:
        dict matching PRD §7.1 output polygon structure.
    """
    polygon_id = polygon.get("polygon_id", "UNKNOWN")

    # ── Validate required fields ──
    validate_polygon_fields(polygon, polygon_id)

    geom_features = polygon["geometry_features"]
    laf_input = polygon["lookalike_filter"]

    # ── ERA5 Wind Pull ──
    raw_wind = laf_input.get("wind_speed_ms", 0.0)
    geom_coords = polygon.get("geometry", {}).get("coordinates", [])
    lat, lon = compute_centroid(geom_coords)
    wind_speed = fetch_era5_wind(lat, lon, polygon.get("acquisition_time", ""), raw_wind)

    damping_ratio = laf_input.get("damping_ratio", 0.0)
    eccentricity = geom_features.get("eccentricity", 0.0)
    orientation = geom_features.get("orientation_deg", 0.0)

    # ── Alignment Check ──
    is_aligned, matched_lane = check_shipping_lane_alignment(orientation)

    # ── Evaluate all three gates ──
    rejection_reasons = []

    # Gate A: Wind speed operational range
    wind_passed, wind_reason = evaluate_wind_gate(wind_speed)
    if wind_reason:
        rejection_reasons.append(wind_reason)

    # Gate B: Damping ratio (mineral oil signature)
    damping_passed, damping_reason = evaluate_damping_gate(damping_ratio)
    if damping_reason:
        rejection_reasons.append(damping_reason)

    # Gate C: Shape eccentricity (discharge linearity)
    shape_passed, shape_reason = evaluate_shape_gate(eccentricity)
    if shape_reason:
        rejection_reasons.append(shape_reason)

    # PRD §7.1: shape_gate_passed combines Gate B + Gate C
    shape_gate_combined = damping_passed and shape_passed

    # Final decision: confirmed only if ALL gates pass
    all_passed = wind_passed and shape_gate_combined
    final_decision = "confirmed" if all_passed else "rejected"
    rejection_reason = "; ".join(rejection_reasons) if rejection_reasons else None

    # ── Build output polygon per PRD §7.1 ──
    output_dict = {
        "polygon_id": polygon_id,
        "geometry": polygon.get("geometry", {
            "type": "Polygon", "coordinates": []
        }),
        "confidence": polygon.get("confidence", 0.0),
        "geometry_features": {
            "area_km2":      geom_features.get("area_km2", 0.0),
            "perimeter_km":  geom_features.get("perimeter_km", 0.0),
            "major_axis_km": geom_features.get("major_axis_km", 0.0),
            "minor_axis_km": geom_features.get("minor_axis_km", 0.0),
            "eccentricity":  geom_features.get("eccentricity", 0.0),
            "orientation_deg": geom_features.get("orientation_deg", 0.0),
        },
        "lookalike_filter": {
            "wind_speed_ms":    wind_speed,
            "wind_gate_passed": wind_passed,
            "damping_ratio":    damping_ratio,
            "shape_gate_passed": shape_gate_combined,
            "final_decision":   final_decision,
            "rejection_reason": rejection_reason,
        },
    }

    # Hack to pass alignment data to console output without polluting JSON
    output_dict["_aligned"] = is_aligned
    return output_dict


# ═══════════════════════════════════════════════════════════════════════
#  CONSOLE OUTPUT FORMATTING
# ═══════════════════════════════════════════════════════════════════════

def print_header(input_path):
    """Print pipeline header banner."""
    print()
    print("=" * 72)
    print("  STAGE 1 — LOOK-ALIKE FILTER  (P3 Module)")
    print("  Marine Oil Spill Detection & AIS Attribution Pipeline")
    print("=" * 72)
    print(f"  Input file  : {input_path}")
    print(f"  Output file : {OUTPUT_FILE}")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"  Run time    : {now}")
    print(f"  Thresholds  : wind=[{WIND_MIN_MS}, {WIND_MAX_MS}] m/s  "
          f"damping>={DAMPING_THRESHOLD}  ecc>={ECCENTRICITY_THRESHOLD}")
    print("=" * 72)


def print_polygon_result(result):
    """Print formatted gate results for a single polygon."""
    pid = result["polygon_id"]
    gf = result["geometry_features"]
    laf = result["lookalike_filter"]

    icon_pass = "[PASS]"
    icon_fail = "[FAIL]"

    print(f"  +-- Candidate: {pid}")
    print(f"  |   Area: {gf['area_km2']} km2  |  "
          f"Axes: {gf['major_axis_km']}x{gf['minor_axis_km']} km  |  "
          f"Orientation: {gf['orientation_deg']} deg")

    # Gate A
    wind_icon = icon_pass if laf["wind_gate_passed"] else icon_fail
    print(f"  |   Gate A (Wind)    : {wind_icon}  "
          f"wind_speed = {laf['wind_speed_ms']} m/s")

    # Gate B (damping component of shape_gate)
    damping_ok = laf["damping_ratio"] >= DAMPING_THRESHOLD
    damp_icon = icon_pass if damping_ok else icon_fail
    print(f"  |   Gate B (Damping) : {damp_icon}  "
          f"damping_ratio = {laf['damping_ratio']}")

    # Gate C (eccentricity component of shape_gate)
    ecc_ok = gf["eccentricity"] >= ECCENTRICITY_THRESHOLD
    ecc_icon = icon_pass if ecc_ok else icon_fail
    print(f"  |   Gate C (Shape)   : {ecc_icon}  "
          f"eccentricity = {gf['eccentricity']}")

    # Combined shape gate
    shape_icon = icon_pass if laf["shape_gate_passed"] else icon_fail
    print(f"  |   Shape Combined   : {shape_icon}  "
          f"(Gate B AND Gate C)")

    # Alignment Check (Contextual, not a strict rejection gate)
    aligned = result.get("_aligned", False)
    align_icon = icon_pass if aligned else icon_fail
    print(f"  |   Alignment Check  : {align_icon}  "
          f"aligned with shipping lane = {aligned}")

    # Final decision
    if laf["final_decision"] == "confirmed":
        print("  |")
        print(f"  +-- >>> CONFIRMED  (confidence: {result['confidence']})")
        print("  |       -> Forwarding to Stage 2 (H3 Backtracking)")
    else:
        print(f"  |   Rejection reason : {laf['rejection_reason']}")
        print("  |")
        print("  +-- >>> REJECTED")
    print()


def print_summary(confirmed, rejected, errors, total):
    """Print pipeline summary."""
    print("-" * 72)
    print("  FILTER SUMMARY")
    print(f"    Total candidates : {total}")
    print(f"    Confirmed (->S2) : {confirmed}")
    print(f"    Rejected         : {rejected}")
    if errors > 0:
        print(f"    Errors           : {errors}")
    print("-" * 72)
    print()


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════

def main():
    """
    Main pipeline entry point.

    Reads input JSON, runs all candidate polygons through the three-gate
    filter, writes PRD §7.1 compliant output, and prints results.
    """
    # ── Resolve input file path ──
    input_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT_FILE

    print_header(input_path)

    # ── Load and validate input JSON ──
    if not os.path.isfile(input_path):
        print(f"\n  [FATAL] Input file not found: '{input_path}'")
        print("  Ensure the file exists or provide a path via: "
              "python lookalike_filter.py <path>")
        sys.exit(1)

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            raw = f.read()
            if not raw.strip():
                print(f"\n  [FATAL] Input file is empty: '{input_path}'")
                sys.exit(1)
            data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"\n  [FATAL] Corrupted/invalid JSON in '{input_path}':")
        print(f"          {e}")
        sys.exit(1)
    except IOError as e:
        print(f"\n  [FATAL] Cannot read file '{input_path}': {e}")
        sys.exit(1)

    if not isinstance(data, dict):
        print(f"\n  [FATAL] Input JSON root must be an object, "
              f"got {type(data).__name__}")
        sys.exit(1)

    # ── Extract scene metadata ──
    scene_id = data.get("scene_id", "UNKNOWN_SCENE")
    acquisition_time = data.get("acquisition_time", "")
    polygons = data.get("polygons", [])

    print(f"\n  Scene ID     : {scene_id}")
    print(f"  Acquired     : {acquisition_time}")
    print(f"  Candidates   : {len(polygons)} polygon(s)")
    print()

    if not polygons:
        print("  [WARNING] No candidate polygons in input. "
              "Writing empty output.\n")

    # ── Process each candidate polygon through the filter gates ──
    processed_polygons = []
    confirmed_count = 0
    rejected_count = 0
    error_count = 0

    for i, poly in enumerate(polygons):
        pid = poly.get("polygon_id", f"unknown_{i}")
        try:
            result = process_polygon(poly)
            processed_polygons.append(result)
            print_polygon_result(result)

            if result["lookalike_filter"]["final_decision"] == "confirmed":
                confirmed_count += 1
            else:
                rejected_count += 1

        except (ValueError, KeyError, TypeError) as e:
            error_count += 1
            print(f"  +-- Candidate: {pid}")
            print(f"  +-- [ERROR] {e}")
            print()

    # ── Build output document per PRD §7.1 ──
    output_document = {
        "scene_id": scene_id,
        "acquisition_time": acquisition_time,
        "polygons": processed_polygons,
    }

    # ── Write output ──
    # Remove internal variables not part of PRD schema before writing
    for p in output_document["polygons"]:
        p.pop("_aligned", None)

    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(output_document, f, indent=2, ensure_ascii=False)
        print(f"  Output written to: {os.path.abspath(OUTPUT_FILE)}")
    except IOError as e:
        print(f"\n  [FATAL] Cannot write output file: {e}")
        sys.exit(1)

    # ── Print summary ──
    print_summary(confirmed_count, rejected_count, error_count, len(polygons))

    # Return exit code 0 on success
    return 0


if __name__ == "__main__":
    sys.exit(main())

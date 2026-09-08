#!/usr/bin/env python3
"""
pipeline_integrator.py — Stage 5 Case File Exporter (P3 Module)
Marine Oil Spill Detection & AIS-Based Vessel Attribution Pipeline
SIH 2026 — NTRO Problem Statement

Orchestrates all stage outputs into a single, legally auditable
case file per PRD §7.5. This is the final deliverable — the
evidence package that NTRO/Coast Guard would use to initiate
prosecution.

Responsibilities:
  1. Ingest all stage outputs (Stage 1 filter, Stage 2/3 corridor
     + AIS, Stage 4 scoring)
  2. Dark vessel cross-reference (CFAR radar vs AIS tracks)
  3. SHA-256 input data hash for tamper-evidence
  4. Export case_file.json per PRD §7.5

Usage:
  python pipeline_integrator.py
  python pipeline_integrator.py --stage1 day1_output.json \\
      --stage23 stage2_3_data.json --stage4 ranked_suspects.json

Output: case_file.json (PRD §7.5 compliant)
"""

import json
import sys
import os
import uuid
import hashlib
import math
from datetime import datetime, timezone


# ═══════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

DEFAULT_STAGE1 = "day1_output.json"
DEFAULT_STAGE23 = "stage2_3_data.json"
DEFAULT_STAGE4 = "ranked_suspects.json"
OUTPUT_FILE = "case_file.json"

# Maximum distance (km) for CFAR-to-AIS matching
CFAR_AIS_MATCH_RADIUS_KM = 2.0

# Pipeline metadata
SEGMENTATION_MODEL_VERSION = "UNet-v1.2-Krestenitis"
LOOKALIKE_THRESHOLDS = {
    "wind_min_ms": 2.0,
    "wind_max_ms": 12.0,
}
DRIFT_CONFIG = {
    "currents_source": "HYCOM",
    "wind_source": "ERA5",
    "wind_drift_factor": 0.03,
}
SCORING_WEIGHTS = {
    "corridor_overlap": 0.40,
    "heading_alignment": 0.30,
    "speed_anomaly": 0.20,
    "ais_gap_history": 0.10,
}


# ═══════════════════════════════════════════════════════════════════════
#  UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def load_json_file(filepath, label):
    """Load and validate a JSON file. Returns dict or exits."""
    if not os.path.isfile(filepath):
        print(f"  [FATAL] {label} not found: '{filepath}'")
        sys.exit(1)

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()
            if not raw.strip():
                print(f"  [FATAL] {label} is empty: '{filepath}'")
                sys.exit(1)
            return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [FATAL] Invalid JSON in {label}: {e}")
        sys.exit(1)
    except IOError as e:
        print(f"  [FATAL] Cannot read {label}: {e}")
        sys.exit(1)


def compute_sha256(*filepaths):
    """
    Compute SHA-256 over the concatenated byte stream of
    all input files. This provides tamper-evidence for the
    case file — if any input is modified after case generation,
    the hash will not match.
    """
    h = hashlib.sha256()
    for fp in filepaths:
        try:
            with open(fp, "rb") as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    h.update(chunk)
        except IOError:
            # File missing — hash will still be deterministic
            # for the files that do exist
            pass
    return h.hexdigest()


def haversine_km(lon1, lat1, lon2, lat2):
    """
    Haversine distance between two (lon, lat) points in km.
    Used for CFAR-to-AIS proximity matching.
    """
    r = 6371.0  # Earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ═══════════════════════════════════════════════════════════════════════
#  DARK VESSEL CROSS-REFERENCE
# ═══════════════════════════════════════════════════════════════════════

def cross_reference_dark_vessels(cfar_detections, ais_tracks):
    """
    Compare CFAR radar ship detections against AIS broadcast
    positions. A CFAR detection with NO nearby AIS track is
    flagged as a 'dark vessel' — the highest-priority legal
    evidence because it means a physical ship was present but
    deliberately hiding its identity.

    Args:
        cfar_detections: list of CFAR radar detection dicts.
        ais_tracks:      list of AIS position dicts.

    Returns:
        list of dark vessel dicts per PRD §7.4.
    """
    dark_vessels = []

    for det in cfar_detections:
        det_id = det.get("cfar_detection_id", "UNKNOWN")
        det_pos = det.get("position", {})
        det_coords = det_pos.get("coordinates", [0, 0])
        det_lon, det_lat = det_coords[0], det_coords[1]

        # Search for any AIS track within match radius
        matched = False
        for track in ais_tracks:
            trk_pos = track.get("position", {})
            trk_coords = trk_pos.get("coordinates", [0, 0])
            trk_lon, trk_lat = trk_coords[0], trk_coords[1]

            dist = haversine_km(
                det_lon, det_lat, trk_lon, trk_lat
            )
            if dist <= CFAR_AIS_MATCH_RADIUS_KM:
                matched = True
                break

        if not matched:
            dark_vessels.append({
                "cfar_detection_id": det_id,
                "position": det_pos,
                "timestamp": det.get("timestamp", ""),
                "ais_match_found": False,
                "proximity_to_corridor": det.get(
                    "nearest_corridor_hex", ""
                ),
            })

    return dark_vessels


# ═══════════════════════════════════════════════════════════════════════
#  CASE FILE BUILDER
# ═══════════════════════════════════════════════════════════════════════

def build_case_file(
    stage1_data, stage23_data, stage4_data,
    input_hash, dark_vessels
):
    """
    Assemble the final case file per PRD §7.5.

    This is the single evidence document that would be handed
    to NTRO, the Coast Guard, or a maritime court.
    """
    case_id = str(uuid.uuid4())
    generated_at = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    # Extract scene_id from Stage 1
    scene_id = stage1_data.get(
        "scene_id", "UNKNOWN_SCENE"
    )

    # Merge dark vessels into Stage 4 output
    ranked = stage4_data.get("ranked_suspects", [])
    null_result = stage4_data.get("null_result", True)

    # If dark vessels exist, it's never truly null —
    # there IS evidence, just unattributed
    if dark_vessels and null_result:
        null_result = True  # Still null for attribution

    return {
        "case_id": case_id,
        "generated_at": generated_at,
        "scene_id": scene_id,
        "h3_resolution": 7,
        "processing_parameters": {
            "segmentation_model_version": (
                SEGMENTATION_MODEL_VERSION
            ),
            "lookalike_thresholds": LOOKALIKE_THRESHOLDS,
            "drift_config": DRIFT_CONFIG,
            "scoring_weights": SCORING_WEIGHTS,
        },
        "corridor": stage23_data.get("corridor", {}),
        "ais_query_bounds": stage23_data.get(
            "ais_query_bounds", {}
        ),
        "ranked_suspects": ranked,
        "dark_vessels": dark_vessels,
        "null_result": null_result,
        "input_data_hash": input_hash,
    }


# ═══════════════════════════════════════════════════════════════════════
#  CONSOLE OUTPUT
# ═══════════════════════════════════════════════════════════════════════

def print_header():
    """Print pipeline header."""
    print()
    print("=" * 72)
    print("  STAGE 5 — CASE FILE EXPORTER  (P3 Module)")
    print("  Marine Oil Spill Detection & AIS Attribution Pipeline")
    print("=" * 72)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"  Run time : {now}")
    print("=" * 72)


def print_case_summary(case):
    """Print case file summary."""
    print(f"\n  Case ID    : {case['case_id']}")
    print(f"  Scene ID   : {case['scene_id']}")
    print(f"  Generated  : {case['generated_at']}")
    print(f"  H3 Res     : {case['h3_resolution']}")
    print(f"  Data Hash  : {case['input_data_hash'][:16]}...")

    ranked = case["ranked_suspects"]
    dark = case["dark_vessels"]
    null = case["null_result"]

    print()
    print(f"  Ranked suspects : {len(ranked)}")
    for i, s in enumerate(ranked, 1):
        print(f"    #{i}  {s['vessel_id']}  "
              f"({s['total_score']:.2f}%)")

    print(f"  Dark vessels    : {len(dark)}")
    for d in dark:
        print(f"    >> {d['cfar_detection_id']}  "
              f"near {d['proximity_to_corridor']}  "
              f"[NO AIS]")

    print(f"  Null result     : {null}")

    if null and not dark:
        print("\n  >> SYSTEM RESTRAINT: No vessel accused. "
              "No dark vessels detected.")
        print("     Case closed with no attribution.")
    elif null and dark:
        print("\n  >> SYSTEM RESTRAINT: No vessel accused, "
              "but DARK VESSEL(s) detected.")
        print("     Recommend physical investigation of "
              "unidentified radar contacts.")
    elif not null:
        top = ranked[0]
        print(f"\n  >> PRIMARY SUSPECT: {top['vessel_id']}  "
              f"({top['total_score']:.2f}%)")

    print()
    print("-" * 72)
    print()


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════

def main():
    """
    Main orchestration entry point.

    Loads all stage outputs, performs dark vessel cross-reference,
    computes SHA-256 hash, and exports PRD §7.5 case file.
    """
    # ── Parse arguments ──
    stage1_path = DEFAULT_STAGE1
    stage23_path = DEFAULT_STAGE23
    stage4_path = DEFAULT_STAGE4

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--stage1" and i + 1 < len(args):
            stage1_path = args[i + 1]
            i += 2
        elif args[i] == "--stage23" and i + 1 < len(args):
            stage23_path = args[i + 1]
            i += 2
        elif args[i] == "--stage4" and i + 1 < len(args):
            stage4_path = args[i + 1]
            i += 2
        else:
            i += 1

    print_header()

    print(f"  Stage 1 (Filter)   : {stage1_path}")
    print(f"  Stage 2/3 (Corr.)  : {stage23_path}")
    print(f"  Stage 4 (Scoring)  : {stage4_path}")
    print(f"  Output             : {OUTPUT_FILE}")

    # ── Load all stage data ──
    print("\n  Loading stage outputs...")
    stage1 = load_json_file(stage1_path, "Stage 1 output")
    print(f"    Stage 1: OK  ({len(stage1.get('polygons', []))} "
          "polygons)")

    stage23 = load_json_file(stage23_path, "Stage 2/3 data")
    corridor_hexes = stage23.get(
        "corridor", {}
    ).get("corridor_hexes", [])
    print(f"    Stage 2/3: OK  ({len(corridor_hexes)} "
          "corridor hexes)")

    stage4 = load_json_file(stage4_path, "Stage 4 output")
    print(f"    Stage 4: OK  "
          f"({len(stage4.get('ranked_suspects', []))} "
          "ranked suspects)")

    # ── Dark vessel cross-reference ──
    print("\n  Running CFAR-to-AIS cross-reference...")
    cfar_dets = stage23.get("cfar_radar_detections", [])
    ais_tracks = stage23.get("ais_tracks_at_scene_time", [])

    print(f"    CFAR detections : {len(cfar_dets)}")
    print(f"    AIS tracks      : {len(ais_tracks)}")
    print(f"    Match radius    : {CFAR_AIS_MATCH_RADIUS_KM} km")

    dark_vessels = cross_reference_dark_vessels(
        cfar_dets, ais_tracks
    )
    print(f"    Dark vessels    : {len(dark_vessels)}")

    for dv in dark_vessels:
        print(f"      >> {dv['cfar_detection_id']}  "
              f"[NO AIS MATCH]  "
              f"near {dv['proximity_to_corridor']}")

    # ── Compute SHA-256 input hash ──
    print("\n  Computing SHA-256 input data hash...")
    input_hash = compute_sha256(
        stage1_path, stage23_path, stage4_path
    )
    print(f"    Hash: {input_hash[:32]}...")

    # ── Build case file ──
    print("\n  Assembling case file (PRD §7.5)...")
    case = build_case_file(
        stage1, stage23, stage4, input_hash, dark_vessels
    )

    # ── Write output ──
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(case, f, indent=2, ensure_ascii=False)
        print(
            f"  Output written to: {os.path.abspath(OUTPUT_FILE)}"
        )
    except IOError as e:
        print(f"\n  [FATAL] Cannot write output file: {e}")
        sys.exit(1)

    # ── Print summary ──
    print_case_summary(case)

    return 0


if __name__ == "__main__":
    sys.exit(main())

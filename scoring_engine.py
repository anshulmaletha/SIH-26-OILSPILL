#!/usr/bin/env python3
"""
scoring_engine.py — Stage 4 Multi-Factor Scoring Engine (P3 Module)
Marine Oil Spill Detection & AIS-Based Vessel Attribution Pipeline
SIH 2026 — NTRO Problem Statement

Computes a transparent, auditable guilt score (0–100%) for each
candidate vessel that intersected the H3 backtrack corridor (Stage 3).

Scoring is strictly explainable — no black-box ML. Every factor,
weight, and intermediate value is recorded in the output for
courtroom/NTRO audit review.

Four scoring factors (PRD §7.3 → §7.4):
  F1  Corridor Overlap   (w=0.40)  How close in space+time?
  F2  Heading Alignment   (w=0.30)  Slick axis vs vessel heading
  F3  Speed Anomaly       (w=0.20)  Did vessel slow during transit?
  F4  AIS Gap History     (w=0.10)  Did vessel go dark?

Usage:
  python scoring_engine.py                       # reads dummy_day2_input.json
  python scoring_engine.py path/to/input.json    # reads specified file

Output: ranked_suspects.json (PRD §7.4 compliant)
"""

import json
import sys
import os
from datetime import datetime, timezone


# ═══════════════════════════════════════════════════════════════════════
#  CONFIGURATION — Scoring weights from PRD §4 Stage 4
#  These weights are recorded in every output record for auditability.
# ═══════════════════════════════════════════════════════════════════════

WEIGHTS = {
    "corridor_overlap": 0.40,
    "heading_alignment": 0.30,
    "speed_anomaly": 0.20,
    "ais_gap_history": 0.10,
}

# Heading alignment: angles beyond this threshold score 0.0
HEADING_MAX_DIFF_DEG = 45.0

# AIS gap: gaps shorter than this are ignored
AIS_GAP_MIN_MINUTES = 15

DEFAULT_INPUT_FILE = "dummy_day2_input.json"
OUTPUT_FILE = "ranked_suspects.json"

# Speed anomaly: minimum knot drop to qualify as suspicious
SPEED_DROP_THRESHOLD_KNOTS = 3.0

# System restraint: minimum score to appear in ranked_suspects
# If ALL vessels score below this, null_result = true
MIN_CONFIDENCE_THRESHOLD = 40.0


# ═══════════════════════════════════════════════════════════════════════
#  INDIVIDUAL FEATURE SCORING FUNCTIONS
#  Each returns a float in [0.0, 1.0]
# ═══════════════════════════════════════════════════════════════════════

def score_corridor_overlap(matches):
    """
    F1 — Corridor Overlap Score.

    Uses the best (highest) decay_weight from the vessel's H3
    corridor matches. decay_weight = 1.0 at k_ring=0 (direct hit),
    drops with distance.

    Args:
        matches: list of match dicts, each with 'decay_weight'.

    Returns:
        float in [0.0, 1.0].
    """
    if not matches:
        return 0.0
    best_weight = max(m.get("decay_weight", 0.0) for m in matches)
    return min(max(best_weight, 0.0), 1.0)


def score_heading_alignment(vessel_heading, slick_orientation):
    """
    F2 — Heading Alignment Score.

    Operational discharges leave slicks aligned with the vessel's
    heading. Perfect alignment (0°) scores 1.0; ≥45° scores 0.0.
    Linear interpolation between.

    Angular difference is computed modulo 180° (slick axis is
    bidirectional — a vessel heading 45° and 225° both align
    with a 45° slick).

    Args:
        vessel_heading:     float, vessel COG in degrees [0, 360).
        slick_orientation:  float, slick major axis in degrees.

    Returns:
        float in [0.0, 1.0].
    """
    if type(vessel_heading) not in (int, float):
        return 0.0
    if type(slick_orientation) not in (int, float):
        return 0.0

    angular_diff = abs(vessel_heading - slick_orientation) % 180
    if angular_diff > 90:
        angular_diff = 180 - angular_diff

    return max(0.0, 1.0 - (angular_diff / HEADING_MAX_DIFF_DEG))


def score_speed_anomaly(speed_dropped):
    """
    F3 — Speed Anomaly Score.

    Vessels that slow down significantly during corridor transit
    are more suspicious (pumping while underway requires reduced
    speed). Binary flag with a low residual for non-droppers.

    Args:
        speed_dropped: bool, True if speed_knots_during < speed_knots_before.

    Returns:
        1.0 if dropped, 0.1 otherwise.
    """
    return 1.0 if speed_dropped else 0.1


def score_ais_gap(ais_gap_minutes):
    """
    F4 — AIS Gap History Score.

    Vessels that go dark (disable AIS transponder) during or near
    the corridor transit window are highly suspicious. Gaps shorter
    than 15 minutes are considered normal (port maneuvers, signal
    loss).

    Args:
        ais_gap_minutes: int/float, longest AIS gap in minutes.

    Returns:
        1.0 if gap > 15 min, 0.0 otherwise.
    """
    if type(ais_gap_minutes) not in (int, float):
        return 0.0
    return 1.0 if ais_gap_minutes > AIS_GAP_MIN_MINUTES else 0.0


# ═══════════════════════════════════════════════════════════════════════
#  COMPOSITE SCORING
# ═══════════════════════════════════════════════════════════════════════

def compute_vessel_score(vessel, slick_orientation):
    """
    Compute the total guilt score for a single candidate vessel.

    Args:
        vessel:             dict from candidate_vessels array.
        slick_orientation:  float, slick major axis degrees.

    Returns:
        dict with vessel_id, total_score, feature_breakdown, weights_used.
    """
    vessel_id = vessel.get("vessel_id", "UNKNOWN")

    # ── Compute individual feature scores ──
    f1 = score_corridor_overlap(vessel.get("matches", []))
    f2 = score_heading_alignment(
        vessel.get("heading_deg", 0.0),
        slick_orientation,
    )
    # ── Derive speed_dropped from raw knot values ──
    speed_before = vessel.get("speed_knots_before", 0.0)
    speed_during = vessel.get("speed_knots_during", 0.0)
    if (isinstance(speed_before, (int, float))
            and isinstance(speed_during, (int, float))):
        speed_dropped = (
            (speed_before - speed_during)
            >= SPEED_DROP_THRESHOLD_KNOTS
        )
    else:
        speed_dropped = vessel.get(
            "speed_dropped_during_transit", False
        )

    f3 = score_speed_anomaly(speed_dropped)

    # ── Derive AIS gap from gaps array if available ──
    gaps_array = vessel.get("ais_gaps", [])
    if gaps_array:
        longest_gap = max(
            g.get("duration_minutes", 0) for g in gaps_array
        )
    else:
        longest_gap = vessel.get("ais_gap_minutes", 0)
    f4 = score_ais_gap(longest_gap)

    # ── Weighted sum ──
    raw_score = (
        WEIGHTS["corridor_overlap"] * f1
        + WEIGHTS["heading_alignment"] * f2
        + WEIGHTS["speed_anomaly"] * f3
        + WEIGHTS["ais_gap_history"] * f4
    )
    total_score = round(raw_score * 100.0, 2)

    return {
        "vessel_id": vessel_id,
        "total_score": total_score,
        "feature_breakdown": {
            "corridor_overlap_score": round(f1, 4),
            "heading_alignment_score": round(f2, 4),
            "speed_anomaly_score": round(f3, 4),
            "ais_gap_history_score": round(f4, 4),
        },
        "weights_used": {
            "corridor_overlap": WEIGHTS["corridor_overlap"],
            "heading_alignment": WEIGHTS["heading_alignment"],
            "speed_anomaly": WEIGHTS["speed_anomaly"],
            "ais_gap_history": WEIGHTS["ais_gap_history"],
        },
    }


# ═══════════════════════════════════════════════════════════════════════
#  CONSOLE OUTPUT FORMATTING
# ═══════════════════════════════════════════════════════════════════════

def print_header(input_path):
    """Print pipeline header banner."""
    print()
    print("=" * 72)
    print("  STAGE 4 — MULTI-FACTOR SCORING ENGINE  (P3 Module)")
    print("  Marine Oil Spill Detection & AIS Attribution Pipeline")
    print("=" * 72)
    print(f"  Input file  : {input_path}")
    print(f"  Output file : {OUTPUT_FILE}")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"  Run time    : {now}")
    print(f"  Weights     : corridor={WEIGHTS['corridor_overlap']}  "
          f"heading={WEIGHTS['heading_alignment']}  "
          f"speed={WEIGHTS['speed_anomaly']}  "
          f"ais_gap={WEIGHTS['ais_gap_history']}")
    print("=" * 72)


def print_vessel_result(rank, result, vessel_meta):
    """Print formatted scoring breakdown for a single vessel."""
    vid = result["vessel_id"]
    fb = result["feature_breakdown"]
    ts = result["total_score"]

    vname = vessel_meta.get("vessel_name", "—")
    vtype = vessel_meta.get("vessel_type", "—")
    flag = vessel_meta.get("flag_state", "—")

    # Score tier classification
    if ts >= 70:
        tier = "HIGH SUSPECT"
        tier_icon = "[!!!]"
    elif ts >= 40:
        tier = "MODERATE"
        tier_icon = "[!! ]"
    else:
        tier = "LOW"
        tier_icon = "[!  ]"

    print(f"  #{rank}  {tier_icon}  {vid}  "
          f"({vname} | {vtype} | {flag})")
    print(f"  |   Total Score : {ts:.2f}%   [{tier}]")
    print(f"  |   F1 Corridor Overlap   : "
          f"{fb['corridor_overlap_score']:.4f}  "
          f"(w={WEIGHTS['corridor_overlap']})")
    print(f"  |   F2 Heading Alignment  : "
          f"{fb['heading_alignment_score']:.4f}  "
          f"(w={WEIGHTS['heading_alignment']})")
    print(f"  |   F3 Speed Anomaly      : "
          f"{fb['speed_anomaly_score']:.4f}  "
          f"(w={WEIGHTS['speed_anomaly']})")
    print(f"  |   F4 AIS Gap History    : "
          f"{fb['ais_gap_history_score']:.4f}  "
          f"(w={WEIGHTS['ais_gap_history']})")
    print()


def print_summary(results):
    """Print pipeline summary."""
    print("-" * 72)
    print("  SCORING SUMMARY")
    print(f"    Total candidates scored : {len(results)}")

    high = sum(1 for r in results if r["total_score"] >= 70)
    moderate = sum(
        1 for r in results
        if MIN_CONFIDENCE_THRESHOLD <= r["total_score"] < 70
    )
    low = sum(
        1 for r in results
        if r["total_score"] < MIN_CONFIDENCE_THRESHOLD
    )

    print(f"    HIGH (>=70%)            : {high}")
    print(f"    MODERATE (40-69%)       : {moderate}")
    print(f"    LOW (<40%)              : {low}")

    if results:
        top = results[0]
        print(f"    Top suspect             : "
              f"{top['vessel_id']}  ({top['total_score']:.2f}%)")

    null_result = len(results) == 0
    print(f"    Null result             : {null_result}")
    print("-" * 72)
    print()


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════

def main():
    """
    Main pipeline entry point.

    Reads §7.3 input JSON, scores each candidate vessel, ranks
    descending by total_score, writes §7.4 compliant output.
    """
    # ── Resolve input file path ──
    input_path = (
        sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT_FILE
    )

    print_header(input_path)

    # ── Load and validate input JSON ──
    if not os.path.isfile(input_path):
        print(f"\n  [FATAL] Input file not found: '{input_path}'")
        print("  Ensure the file exists or provide a path via: "
              "python scoring_engine.py <path>")
        sys.exit(1)

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            raw = f.read()
            if not raw.strip():
                print(
                    f"\n  [FATAL] Input file is empty: "
                    f"'{input_path}'"
                )
                sys.exit(1)
            data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(
            f"\n  [FATAL] Corrupted/invalid JSON in "
            f"'{input_path}':"
        )
        print(f"          {e}")
        sys.exit(1)
    except IOError as e:
        print(f"\n  [FATAL] Cannot read file '{input_path}': {e}")
        sys.exit(1)

    if not isinstance(data, dict):
        print(
            f"\n  [FATAL] Input JSON root must be an object, "
            f"got {type(data).__name__}"
        )
        sys.exit(1)

    # ── Extract metadata ──
    slick_id = data.get("slick_id", "UNKNOWN_SLICK")
    slick_orientation = data.get("slick_orientation_deg", 0.0)
    candidates = data.get("candidate_vessels", [])

    print(f"\n  Slick ID           : {slick_id}")
    print(f"  Slick orientation  : {slick_orientation}°")
    print(f"  Candidate vessels  : {len(candidates)}")
    print()

    if not candidates:
        print("  [WARNING] No candidate vessels in input. "
              "Null result.\n")

    # ── Build vessel lookup for metadata ──
    vessel_lookup = {v["vessel_id"]: v for v in candidates}

    # ── Score each candidate ──
    scored_results = []
    for vessel in candidates:
        vid = vessel.get("vessel_id", "UNKNOWN")
        try:
            result = compute_vessel_score(vessel, slick_orientation)
            scored_results.append(result)
        except (ValueError, KeyError, TypeError) as e:
            print(f"  +-- Vessel: {vid}")
            print(f"  +-- [ERROR] Scoring failed: {e}")
            print()

    # ── Sort descending by total_score ──
    scored_results.sort(
        key=lambda r: r["total_score"], reverse=True
    )

    # ── Print ranked results ──
    for rank, result in enumerate(scored_results, 1):
        meta = vessel_lookup.get(result["vessel_id"], {})
        print_vessel_result(rank, result, meta)

    # ── Apply confidence threshold (system restraint) ──
    qualified = [
        r for r in scored_results
        if r["total_score"] >= MIN_CONFIDENCE_THRESHOLD
    ]
    is_null = len(qualified) == 0

    if is_null:
        print("  [RESTRAINT] No vessel met the minimum "
              f"confidence threshold ({MIN_CONFIDENCE_THRESHOLD}%).")
        print("  >> null_result = true  "
              "(no accusation issued)")
        print()

    # ── Build output document per PRD §7.4 ──
    output_document = {
        "ranked_suspects": qualified,
        "dark_vessels": [],
        "null_result": is_null,
    }

    # ── Write output ──
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(
                output_document, f, indent=2, ensure_ascii=False
            )
        print(
            f"  Output written to: {os.path.abspath(OUTPUT_FILE)}"
        )
    except IOError as e:
        print(f"\n  [FATAL] Cannot write output file: {e}")
        sys.exit(1)

    # ── Print summary ──
    print_summary(scored_results)

    return 0


if __name__ == "__main__":
    sys.exit(main())

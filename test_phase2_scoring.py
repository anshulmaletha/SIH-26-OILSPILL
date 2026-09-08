#!/usr/bin/env python3
"""
test_phase2_scoring.py — QA & Mathematical Verification Suite
Stage 4 Multi-Factor Scoring Engine (P3 Module)

Covers:
  1. Deterministic Score Verification (hand-computed expectations)
  2. Ranking Order (strict descending sort)
  3. Weight Integrity (sum = 1.0, features bounded [0,1])
  4. PRD §7.4 Schema Contract Validation
  5. Edge cases and null-result handling

Run:  pytest test_phase2_scoring.py -v
"""

import json
import os
import subprocess
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.abspath(__file__))
)  # noqa: E402

from scoring_engine import (  # noqa: E402
    score_corridor_overlap,
    score_heading_alignment,
    score_speed_anomaly,
    score_ais_gap,
    compute_vessel_score,
    WEIGHTS,
    HEADING_MAX_DIFF_DEG,
    AIS_GAP_MIN_MINUTES,
)


# ═══════════════════════════════════════════════════════════════════════
#  FIXTURES
# ═══════════════════════════════════════════════════════════════════════

def _build_vessel(
    vessel_id="TEST_VESSEL",
    decay_weight=1.0,
    k_ring=0,
    heading_deg=42.5,
    speed_dropped=True,
    ais_gap_minutes=30,
):
    """Build a single candidate vessel dict."""
    return {
        "vessel_id": vessel_id,
        "vessel_name": "Test Ship",
        "vessel_type": "Tanker",
        "flag_state": "XX",
        "matches": [
            {
                "hex_id": "872a1076dffffff",
                "timestamp": "2026-09-01T04:15:00Z",
                "t_minus_hours": 6,
                "k_ring": k_ring,
                "decay_weight": decay_weight,
            }
        ],
        "heading_deg": heading_deg,
        "speed_knots_before": 14.0,
        "speed_knots_during": 5.0 if speed_dropped else 14.0,
        "speed_dropped_during_transit": speed_dropped,
        "ais_gap_minutes": ais_gap_minutes,
        "ais_gaps": [],
    }


def _build_scene(vessels, slick_orientation=42.5):
    """Build a full scene document."""
    return {
        "slick_id": "test_slick",
        "slick_orientation_deg": slick_orientation,
        "backtrack_corridor": {
            "origin_hex": "872a1076dffffff",
            "resolution": 7,
            "timesteps_hours": [6],
            "corridor_hexes": ["872a1076dffffff"],
        },
        "candidate_vessels": vessels,
    }


@pytest.fixture
def perfect_vessel():
    """Vessel that scores 1.0 on every factor."""
    return _build_vessel(
        vessel_id="PERFECT",
        decay_weight=1.0,
        heading_deg=42.5,
        speed_dropped=True,
        ais_gap_minutes=30,
    )


@pytest.fixture
def zero_vessel():
    """Vessel that scores minimum on every factor."""
    return _build_vessel(
        vessel_id="ZERO",
        decay_weight=0.0,
        heading_deg=132.5,  # 90 deg off → 0.0
        speed_dropped=False,
        ais_gap_minutes=0,
    )


@pytest.fixture
def python_cmd():
    return sys.executable


@pytest.fixture
def script_path():
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "scoring_engine.py",
    )


@pytest.fixture
def tmp_input_file(tmp_path):
    def _create(scene_data):
        filepath = tmp_path / "test_scoring_input.json"
        filepath.write_text(
            json.dumps(scene_data, indent=2), encoding="utf-8"
        )
        return str(filepath)
    return _create


# ═══════════════════════════════════════════════════════════════════════
#  1. DETERMINISTIC SCORE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

class TestDeterministicScoring:
    """Hand-computed score expectations."""

    SLICK_ORIENTATION = 42.5

    def test_perfect_score_100(self, perfect_vessel):
        """All factors = 1.0 → total = 100.0%."""
        result = compute_vessel_score(
            perfect_vessel, self.SLICK_ORIENTATION
        )
        assert result["total_score"] == 100.0

        fb = result["feature_breakdown"]
        assert fb["corridor_overlap_score"] == 1.0
        assert fb["heading_alignment_score"] == pytest.approx(
            1.0, abs=0.01
        )
        assert fb["speed_anomaly_score"] == 1.0
        assert fb["ais_gap_history_score"] == 1.0

    def test_zero_alignment_zero_corridor(self, zero_vessel):
        """
        decay=0, heading 90° off, no speed drop, no gap.
        Expected:
          F1 = 0.0, F2 = 0.0, F3 = 0.1, F4 = 0.0
          raw = 0.40*0 + 0.30*0 + 0.20*0.1 + 0.10*0
              = 0.02
          total = 2.0%
        """
        result = compute_vessel_score(
            zero_vessel, self.SLICK_ORIENTATION
        )
        expected = round(
            (0.40 * 0.0 + 0.30 * 0.0
             + 0.20 * 0.1 + 0.10 * 0.0) * 100, 2
        )
        assert result["total_score"] == pytest.approx(
            expected, abs=0.01
        )

    def test_known_intermediate_score(self):
        """
        decay=0.5, heading 10° off, speed dropped, no gap.
        Expected:
          F1 = 0.5
          F2 = 1.0 - (10/45) = 0.7778
          F3 = 1.0
          F4 = 0.0
          raw = 0.40*0.5 + 0.30*0.7778 + 0.20*1.0 + 0.10*0.0
              = 0.20 + 0.2333 + 0.20 + 0.0 = 0.6333
          total = 63.33%
        """
        vessel = _build_vessel(
            vessel_id="MID",
            decay_weight=0.5,
            heading_deg=52.5,  # 10 deg off from 42.5
            speed_dropped=True,
            ais_gap_minutes=0,
        )
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)

        f2_expected = 1.0 - (10.0 / HEADING_MAX_DIFF_DEG)
        raw = (
            0.40 * 0.5
            + 0.30 * f2_expected
            + 0.20 * 1.0
            + 0.10 * 0.0
        )
        expected_total = round(raw * 100, 2)
        assert result["total_score"] == pytest.approx(
            expected_total, abs=0.01
        )

    def test_heading_exactly_45_off_scores_zero(self):
        """Heading exactly HEADING_MAX_DIFF_DEG off → F2 = 0.0."""
        vessel = _build_vessel(heading_deg=42.5 + 45.0)
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)
        fb = result["feature_breakdown"]
        assert fb["heading_alignment_score"] == pytest.approx(
            0.0, abs=0.001
        )

    def test_heading_beyond_45_still_zero(self):
        """Heading 60° off → F2 = max(0, 1 - 60/45) = 0.0."""
        vessel = _build_vessel(heading_deg=42.5 + 60.0)
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)
        fb = result["feature_breakdown"]
        assert fb["heading_alignment_score"] == 0.0

    def test_speed_no_drop_gives_residual(self):
        """No speed drop → F3 = 0.1 (not 0.0)."""
        vessel = _build_vessel(speed_dropped=False)
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)
        assert result["feature_breakdown"]["speed_anomaly_score"] == 0.1

    def test_ais_gap_exactly_15_scores_zero(self):
        """Gap = 15 min (not >15) → F4 = 0.0."""
        vessel = _build_vessel(ais_gap_minutes=15)
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)
        assert result["feature_breakdown"]["ais_gap_history_score"] == 0.0

    def test_ais_gap_16_scores_one(self):
        """Gap = 16 min (>15) → F4 = 1.0."""
        vessel = _build_vessel(ais_gap_minutes=16)
        result = compute_vessel_score(vessel, self.SLICK_ORIENTATION)
        assert result["feature_breakdown"]["ais_gap_history_score"] == 1.0


# ═══════════════════════════════════════════════════════════════════════
#  2. RANKING ORDER TEST
# ═══════════════════════════════════════════════════════════════════════

class TestRankingOrder:
    """Output must be strictly sorted descending by total_score."""

    def test_five_vessels_sorted(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        """5 unordered vessels → output sorted descending."""
        vessels = [
            _build_vessel("V_LOW", 0.1, heading_deg=132.5,
                          speed_dropped=False, ais_gap_minutes=0),
            _build_vessel("V_HIGH", 1.0, heading_deg=42.5,
                          speed_dropped=True, ais_gap_minutes=60),
            _build_vessel("V_MID1", 0.5, heading_deg=55.0,
                          speed_dropped=True, ais_gap_minutes=0),
            _build_vessel("V_MID2", 0.6, heading_deg=50.0,
                          speed_dropped=False, ais_gap_minutes=20),
            _build_vessel("V_ZERO", 0.0, heading_deg=132.5,
                          speed_dropped=False, ais_gap_minutes=0),
        ]
        scene = _build_scene(vessels)
        input_file = tmp_input_file(scene)

        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        assert result.returncode == 0

        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        scores = [
            r["total_score"]
            for r in output["ranked_suspects"]
        ]
        # Only vessels >= 40.0 threshold survive
        assert len(scores) >= 1
        assert all(s >= 40.0 for s in scores), (
            f"Sub-threshold scores in output: {scores}"
        )
        assert scores == sorted(scores, reverse=True), (
            f"Scores not in descending order: {scores}"
        )

    def test_top_vessel_is_highest_scorer(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        """First element in ranked_suspects has the max score."""
        vessels = [
            _build_vessel("LOW", 0.2, heading_deg=132.5,
                          speed_dropped=False, ais_gap_minutes=0),
            _build_vessel("HIGH", 1.0, heading_deg=42.5,
                          speed_dropped=True, ais_gap_minutes=60),
        ]
        scene = _build_scene(vessels)
        input_file = tmp_input_file(scene)

        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        assert result.returncode == 0

        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        ranked = output["ranked_suspects"]
        assert len(ranked) >= 1
        assert ranked[0]["vessel_id"] == "HIGH"
        # LOW vessel (score < 40) should be filtered out
        low_ids = [r["vessel_id"] for r in ranked]
        assert "LOW" not in low_ids


# ═══════════════════════════════════════════════════════════════════════
#  3. WEIGHT INTEGRITY TEST
# ═══════════════════════════════════════════════════════════════════════

class TestWeightIntegrity:
    """Weights must sum to 1.0; features must be in [0, 1]."""

    def test_weights_sum_to_one(self, perfect_vessel):
        result = compute_vessel_score(
            perfect_vessel, 42.5
        )
        w = result["weights_used"]
        total = sum(w.values())
        assert total == pytest.approx(1.0, abs=1e-9), (
            f"Weights sum to {total}, expected 1.0"
        )

    def test_global_weights_sum_to_one(self):
        assert sum(WEIGHTS.values()) == pytest.approx(
            1.0, abs=1e-9
        )

    def test_feature_scores_bounded_perfect(self, perfect_vessel):
        result = compute_vessel_score(
            perfect_vessel, 42.5
        )
        for key, val in result["feature_breakdown"].items():
            assert 0.0 <= val <= 1.0, (
                f"{key} = {val} out of [0, 1] range"
            )

    def test_feature_scores_bounded_zero(self, zero_vessel):
        result = compute_vessel_score(zero_vessel, 42.5)
        for key, val in result["feature_breakdown"].items():
            assert 0.0 <= val <= 1.0, (
                f"{key} = {val} out of [0, 1] range"
            )

    def test_feature_scores_bounded_random_inputs(self):
        """Fuzz-like test with edge-case values."""
        test_cases = [
            (0.0, 0.0, False, 0),
            (1.0, 180.0, True, 999),
            (0.5, 90.0, False, 15),
            (0.33, 270.0, True, 1),
        ]
        for dw, hdg, spd, gap in test_cases:
            vessel = _build_vessel(
                decay_weight=dw,
                heading_deg=hdg,
                speed_dropped=spd,
                ais_gap_minutes=gap,
            )
            result = compute_vessel_score(vessel, 42.5)
            for key, val in result["feature_breakdown"].items():
                assert 0.0 <= val <= 1.0, (
                    f"{key}={val} for inputs "
                    f"dw={dw},hdg={hdg},spd={spd},gap={gap}"
                )

    def test_total_score_bounded(self):
        """total_score must always be in [0, 100]."""
        extremes = [
            _build_vessel(decay_weight=0.0, heading_deg=132.5,
                          speed_dropped=False, ais_gap_minutes=0),
            _build_vessel(decay_weight=1.0, heading_deg=42.5,
                          speed_dropped=True, ais_gap_minutes=60),
        ]
        for v in extremes:
            result = compute_vessel_score(v, 42.5)
            assert 0.0 <= result["total_score"] <= 100.0


# ═══════════════════════════════════════════════════════════════════════
#  4. SCHEMA CONTRACT TEST (PRD §7.4)
# ═══════════════════════════════════════════════════════════════════════

class TestSchemaContract:
    """Validate character-for-character PRD §7.4 compliance."""

    REQUIRED_TOP_KEYS = {
        "ranked_suspects", "dark_vessels", "null_result"
    }
    REQUIRED_SUSPECT_KEYS = {
        "vessel_id", "total_score",
        "feature_breakdown", "weights_used"
    }
    REQUIRED_BREAKDOWN_KEYS = {
        "corridor_overlap_score",
        "heading_alignment_score",
        "speed_anomaly_score",
        "ais_gap_history_score",
    }
    REQUIRED_WEIGHT_KEYS = {
        "corridor_overlap", "heading_alignment",
        "speed_anomaly", "ais_gap_history",
    }

    def test_top_level_keys(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([_build_vessel()])
        input_file = tmp_input_file(scene)

        subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert set(output.keys()) == self.REQUIRED_TOP_KEYS

    def test_suspect_keys(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        assert set(result.keys()) == self.REQUIRED_SUSPECT_KEYS

    def test_breakdown_keys(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        fb_keys = set(result["feature_breakdown"].keys())
        assert fb_keys == self.REQUIRED_BREAKDOWN_KEYS

    def test_weight_keys(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        w_keys = set(result["weights_used"].keys())
        assert w_keys == self.REQUIRED_WEIGHT_KEYS

    def test_vessel_id_is_string(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        assert isinstance(result["vessel_id"], str)

    def test_total_score_is_float(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        assert isinstance(result["total_score"], float)

    def test_breakdown_values_are_floats(self, perfect_vessel):
        result = compute_vessel_score(perfect_vessel, 42.5)
        for k, v in result["feature_breakdown"].items():
            assert isinstance(v, (int, float)), (
                f"{k} is {type(v)}, expected float"
            )

    def test_dark_vessels_is_list(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([_build_vessel()])
        input_file = tmp_input_file(scene)

        subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert isinstance(output["dark_vessels"], list)

    def test_null_result_is_bool(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([_build_vessel()])
        input_file = tmp_input_file(scene)

        subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert isinstance(output["null_result"], bool)

    def test_null_result_false_when_vessels_exist(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([_build_vessel()])
        input_file = tmp_input_file(scene)

        subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert output["null_result"] is False

    def test_null_result_true_when_no_vessels(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([])
        input_file = tmp_input_file(scene)

        subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        out_path = os.path.join(
            str(tmp_path), "ranked_suspects.json"
        )
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert output["null_result"] is True
        assert output["ranked_suspects"] == []


# ═══════════════════════════════════════════════════════════════════════
#  5. INDIVIDUAL SCORING FUNCTION UNIT TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestCorridorOverlapFunction:
    """Unit tests for score_corridor_overlap."""

    def test_empty_matches(self):
        assert score_corridor_overlap([]) == 0.0

    def test_single_match(self):
        assert score_corridor_overlap(
            [{"decay_weight": 0.75}]
        ) == 0.75

    def test_multiple_matches_takes_max(self):
        matches = [
            {"decay_weight": 0.3},
            {"decay_weight": 0.9},
            {"decay_weight": 0.5},
        ]
        assert score_corridor_overlap(matches) == 0.9

    def test_clamps_above_one(self):
        assert score_corridor_overlap(
            [{"decay_weight": 1.5}]
        ) == 1.0

    def test_clamps_below_zero(self):
        assert score_corridor_overlap(
            [{"decay_weight": -0.5}]
        ) == 0.0


class TestHeadingAlignmentFunction:
    """Unit tests for score_heading_alignment."""

    def test_perfect_alignment(self):
        assert score_heading_alignment(42.5, 42.5) == pytest.approx(
            1.0
        )

    def test_opposite_direction_same_axis(self):
        """222.5° is 180° from 42.5° → same axis → score 1.0."""
        assert score_heading_alignment(
            222.5, 42.5
        ) == pytest.approx(1.0)

    def test_perpendicular(self):
        """90° off → score 0.0."""
        assert score_heading_alignment(
            132.5, 42.5
        ) == pytest.approx(0.0)

    def test_non_numeric_heading(self):
        assert score_heading_alignment("bad", 42.5) == 0.0

    def test_non_numeric_slick(self):
        assert score_heading_alignment(42.5, None) == 0.0


class TestSpeedAnomalyFunction:
    """Unit tests for score_speed_anomaly."""

    def test_dropped_true(self):
        assert score_speed_anomaly(True) == 1.0

    def test_dropped_false(self):
        assert score_speed_anomaly(False) == 0.1


class TestAISGapFunction:
    """Unit tests for score_ais_gap."""

    def test_zero_gap(self):
        assert score_ais_gap(0) == 0.0

    def test_gap_at_threshold(self):
        assert score_ais_gap(AIS_GAP_MIN_MINUTES) == 0.0

    def test_gap_above_threshold(self):
        assert score_ais_gap(AIS_GAP_MIN_MINUTES + 1) == 1.0

    def test_large_gap(self):
        assert score_ais_gap(999) == 1.0

    def test_non_numeric(self):
        assert score_ais_gap("bad") == 0.0


# ═══════════════════════════════════════════════════════════════════════
#  6. FILE SYSTEM RESILIENCE
# ═══════════════════════════════════════════════════════════════════════

class TestFileResilience:
    """Graceful handling of bad inputs."""

    def test_missing_file(self, python_cmd, script_path, tmp_path):
        result = subprocess.run(
            [python_cmd, script_path,
             str(tmp_path / "nope.json")],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout
        assert "Traceback" not in result.stderr

    def test_malformed_json(
        self, python_cmd, script_path, tmp_path
    ):
        bad = tmp_path / "bad.json"
        bad.write_text("{broken json!!", encoding="utf-8")
        result = subprocess.run(
            [python_cmd, script_path, str(bad)],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout

    def test_empty_file(self, python_cmd, script_path, tmp_path):
        empty = tmp_path / "empty.json"
        empty.write_text("", encoding="utf-8")
        result = subprocess.run(
            [python_cmd, script_path, str(empty)],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout

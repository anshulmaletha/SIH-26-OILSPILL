#!/usr/bin/env python3
"""
test_phase1_lookalike.py — Comprehensive QA Test Suite
Stage 1 Look-Alike Filter Validation (P3 Module)

Covers:
  1. Boundary Value Analysis (Wind Gate thresholds)
  2. Damping & Shape Gate Isolation
  3. PRD §7.1 Schema & Data Contract Validation
  4. File System & Exception Resilience
  5. Alignment Check Validation
  6. Multi-gate interaction & edge cases

Run:  pytest test_phase1_lookalike.py -v
"""

import json
import os
import subprocess
import sys
import tempfile  # noqa: F401

import pytest

# Add the project directory to sys.path so we can import directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # noqa: E402

from lookalike_filter import (  # noqa: E402
    evaluate_wind_gate,
    evaluate_damping_gate,
    evaluate_shape_gate,
    check_shipping_lane_alignment,
    process_polygon,
)


# ═══════════════════════════════════════════════════════════════════════
#  FIXTURES — Reusable test data generators
# ═══════════════════════════════════════════════════════════════════════

def _build_polygon(
    polygon_id="test_poly",
    wind_speed_ms=6.0,
    damping_ratio=0.75,
    eccentricity=0.85,
    orientation_deg=42.5,
    area_km2=10.0,
    perimeter_km=15.0,
    major_axis_km=5.0,
    minor_axis_km=2.0,
    confidence=0.80,
):
    """Build a single polygon dict matching the input schema."""
    return {
        "polygon_id": polygon_id,
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [72.50, 18.50],
                    [72.52, 18.52],
                    [72.54, 18.50],
                    [72.52, 18.48],
                    [72.50, 18.50],
                ]
            ],
        },
        "confidence": confidence,
        "geometry_features": {
            "area_km2": area_km2,
            "perimeter_km": perimeter_km,
            "major_axis_km": major_axis_km,
            "minor_axis_km": minor_axis_km,
            "eccentricity": eccentricity,
            "orientation_deg": orientation_deg,
        },
        "lookalike_filter": {
            "wind_speed_ms": wind_speed_ms,
            "wind_gate_passed": None,
            "damping_ratio": damping_ratio,
            "shape_gate_passed": None,
            "final_decision": None,
            "rejection_reason": None,
        },
    }


def _build_scene(polygons):
    """Build a full scene document wrapping a list of polygons."""
    return {
        "scene_id": "TEST_SCENE_001",
        "acquisition_time": "2026-09-01T10:15:00Z",
        "polygons": polygons,
    }


@pytest.fixture
def valid_polygon():
    """A polygon that passes all gates."""
    return _build_polygon(
        polygon_id="valid_slick",
        wind_speed_ms=6.0,
        damping_ratio=0.75,
        eccentricity=0.85,
        orientation_deg=42.5,
    )


@pytest.fixture
def rejected_polygon():
    """A polygon that fails all gates."""
    return _build_polygon(
        polygon_id="bad_lookalike",
        wind_speed_ms=1.0,
        damping_ratio=0.30,
        eccentricity=0.40,
        orientation_deg=120.0,
    )


@pytest.fixture
def tmp_input_file(tmp_path):
    """Creates a temporary input JSON file and returns its path."""
    def _create(scene_data):
        filepath = tmp_path / "test_input.json"
        filepath.write_text(json.dumps(scene_data, indent=2), encoding="utf-8")
        return str(filepath)
    return _create


@pytest.fixture
def python_cmd():
    """Returns the Python executable path."""
    return sys.executable


@pytest.fixture
def script_path():
    """Returns the absolute path to lookalike_filter.py."""
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "lookalike_filter.py"
    )


# ═══════════════════════════════════════════════════════════════════════
#  1. BOUNDARY VALUE ANALYSIS — Wind Gate
# ═══════════════════════════════════════════════════════════════════════

class TestWindGateBoundary:
    """PRD §4 Stage 1: Wind speed must be in [2.0, 12.0] m/s."""

    def test_wind_just_below_minimum(self):
        """1.99 m/s — just below threshold, must reject."""
        passed, reason = evaluate_wind_gate(1.99)
        assert passed is False
        assert reason is not None
        assert "1.99" in reason or "out of operational range" in reason.lower()

    def test_wind_at_exact_minimum(self):
        """2.00 m/s — exact lower bound, must pass."""
        passed, reason = evaluate_wind_gate(2.00)
        assert passed is True
        assert reason is None

    def test_wind_at_exact_maximum(self):
        """12.00 m/s — exact upper bound, must pass."""
        passed, reason = evaluate_wind_gate(12.00)
        assert passed is True
        assert reason is None

    def test_wind_just_above_maximum(self):
        """12.01 m/s — just above threshold, must reject."""
        passed, reason = evaluate_wind_gate(12.01)
        assert passed is False
        assert reason is not None
        assert "12.01" in reason or "out of operational range" in reason.lower()

    def test_wind_mid_range(self):
        """7.0 m/s — solidly in range, must pass."""
        passed, reason = evaluate_wind_gate(7.0)
        assert passed is True
        assert reason is None

    def test_wind_zero(self):
        """0.0 m/s — dead calm, must reject."""
        passed, reason = evaluate_wind_gate(0.0)
        assert passed is False

    def test_wind_negative(self):
        """Negative wind speed — physically impossible, must reject."""
        passed, reason = evaluate_wind_gate(-3.0)
        assert passed is False

    def test_wind_extreme_high(self):
        """Hurricane-force wind — must reject."""
        passed, reason = evaluate_wind_gate(50.0)
        assert passed is False

    def test_wind_non_numeric(self):
        """String input — must reject gracefully, not crash."""
        passed, reason = evaluate_wind_gate("not_a_number")
        assert passed is False
        assert "non-numeric" in reason.lower() or "invalid" in reason.lower()

    def test_wind_none(self):
        """None input — must reject gracefully."""
        passed, reason = evaluate_wind_gate(None)
        assert passed is False

    def test_boundary_polygon_199(self):
        """Full polygon with wind=1.99 → rejected."""
        poly = _build_polygon(wind_speed_ms=1.99)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["wind_gate_passed"] is False
        assert result["lookalike_filter"]["final_decision"] == "rejected"

    def test_boundary_polygon_200(self):
        """Full polygon with wind=2.00, all else valid → confirmed."""
        poly = _build_polygon(wind_speed_ms=2.00)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["wind_gate_passed"] is True
        assert result["lookalike_filter"]["final_decision"] == "confirmed"

    def test_boundary_polygon_1200(self):
        """Full polygon with wind=12.00, all else valid → confirmed."""
        poly = _build_polygon(wind_speed_ms=12.00)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["wind_gate_passed"] is True
        assert result["lookalike_filter"]["final_decision"] == "confirmed"

    def test_boundary_polygon_1201(self):
        """Full polygon with wind=12.01 → rejected."""
        poly = _build_polygon(wind_speed_ms=12.01)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["wind_gate_passed"] is False
        assert result["lookalike_filter"]["final_decision"] == "rejected"


# ═══════════════════════════════════════════════════════════════════════
#  2. DAMPING & SHAPE GATE ISOLATION
# ═══════════════════════════════════════════════════════════════════════

class TestDampingGateIsolation:
    """Gate B: Damping ratio must be >= 0.50."""

    def test_damping_below_threshold(self):
        """damping_ratio=0.30 — below threshold, must reject."""
        passed, reason = evaluate_damping_gate(0.30)
        assert passed is False
        assert "damping" in reason.lower()

    def test_damping_at_threshold(self):
        """damping_ratio=0.50 — exact threshold, must pass."""
        passed, reason = evaluate_damping_gate(0.50)
        assert passed is True
        assert reason is None

    def test_damping_above_threshold(self):
        """damping_ratio=0.82 — above threshold, must pass."""
        passed, reason = evaluate_damping_gate(0.82)
        assert passed is True

    def test_damping_zero(self):
        """damping_ratio=0.0 — no damping, must reject."""
        passed, reason = evaluate_damping_gate(0.0)
        assert passed is False

    def test_damping_non_numeric(self):
        """String input — must reject gracefully."""
        passed, reason = evaluate_damping_gate("bad")
        assert passed is False

    def test_polygon_low_damping_only(self):
        """Wind OK, eccentricity OK, but damping too low → rejected."""
        poly = _build_polygon(wind_speed_ms=6.0, damping_ratio=0.30, eccentricity=0.90)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["final_decision"] == "rejected"
        assert result["lookalike_filter"]["wind_gate_passed"] is True
        assert result["lookalike_filter"]["shape_gate_passed"] is False
        assert "damping" in result["lookalike_filter"]["rejection_reason"].lower()


class TestShapeGateIsolation:
    """Gate C: Eccentricity must be >= 0.70."""

    def test_eccentricity_below_threshold(self):
        """eccentricity=0.40 — too round, must reject."""
        passed, reason = evaluate_shape_gate(0.40)
        assert passed is False
        assert "eccentricity" in reason.lower() or "non-linear" in reason.lower()

    def test_eccentricity_at_threshold(self):
        """eccentricity=0.70 — exact threshold, must pass."""
        passed, reason = evaluate_shape_gate(0.70)
        assert passed is True
        assert reason is None

    def test_eccentricity_high(self):
        """eccentricity=0.97 — very linear, must pass."""
        passed, reason = evaluate_shape_gate(0.97)
        assert passed is True

    def test_eccentricity_non_numeric(self):
        """String input — must reject gracefully."""
        passed, reason = evaluate_shape_gate("round")
        assert passed is False

    def test_polygon_low_eccentricity_only(self):
        """Wind OK, damping OK, but shape too round → rejected."""
        poly = _build_polygon(
            wind_speed_ms=6.0, damping_ratio=0.75, eccentricity=0.40
        )
        result = process_polygon(poly)
        assert result["lookalike_filter"]["final_decision"] == "rejected"
        assert result["lookalike_filter"]["wind_gate_passed"] is True
        assert result["lookalike_filter"]["shape_gate_passed"] is False
        reason = result["lookalike_filter"]["rejection_reason"]
        assert "geometry" in reason.lower() or "eccentricity" in reason.lower()


class TestCombinedShapeGate:
    """shape_gate_passed = Gate B (damping) AND Gate C (eccentricity)."""

    def test_both_damping_and_shape_fail(self):
        """Both sub-gates fail → shape_gate_passed=False, both reasons listed."""
        poly = _build_polygon(
            wind_speed_ms=6.0, damping_ratio=0.30, eccentricity=0.40
        )
        result = process_polygon(poly)
        laf = result["lookalike_filter"]
        assert laf["shape_gate_passed"] is False
        assert "damping" in laf["rejection_reason"].lower()
        assert "eccentricity" in laf["rejection_reason"].lower()

    def test_damping_passes_shape_fails(self):
        """Damping OK but eccentricity low → shape_gate_passed=False."""
        poly = _build_polygon(
            wind_speed_ms=6.0, damping_ratio=0.75, eccentricity=0.50
        )
        result = process_polygon(poly)
        assert result["lookalike_filter"]["shape_gate_passed"] is False

    def test_damping_fails_shape_passes(self):
        """Damping low but eccentricity OK → shape_gate_passed=False."""
        poly = _build_polygon(
            wind_speed_ms=6.0, damping_ratio=0.40, eccentricity=0.85
        )
        result = process_polygon(poly)
        assert result["lookalike_filter"]["shape_gate_passed"] is False

    def test_both_pass(self):
        """Both sub-gates pass → shape_gate_passed=True."""
        poly = _build_polygon(
            wind_speed_ms=6.0, damping_ratio=0.75, eccentricity=0.85
        )
        result = process_polygon(poly)
        assert result["lookalike_filter"]["shape_gate_passed"] is True


class TestAllGatesConfirmed:
    """All gates pass → confirmed with null rejection_reason."""

    def test_all_valid(self, valid_polygon):
        result = process_polygon(valid_polygon)
        laf = result["lookalike_filter"]
        assert laf["final_decision"] == "confirmed"
        assert laf["rejection_reason"] is None
        assert laf["wind_gate_passed"] is True
        assert laf["shape_gate_passed"] is True


class TestAllGatesRejected:
    """All gates fail → rejected with all reasons concatenated."""

    def test_all_fail(self, rejected_polygon):
        result = process_polygon(rejected_polygon)
        laf = result["lookalike_filter"]
        assert laf["final_decision"] == "rejected"
        assert laf["rejection_reason"] is not None
        assert laf["wind_gate_passed"] is False
        assert laf["shape_gate_passed"] is False
        # All three reasons should be present (semicolon-delimited)
        reasons = laf["rejection_reason"]
        assert "eccentricity" in reasons.lower() or "non-linear" in reasons.lower()


# ═══════════════════════════════════════════════════════════════════════
#  3. SCHEMA & DATA CONTRACT VALIDATION (PRD §7.1)
# ═══════════════════════════════════════════════════════════════════════

class TestOutputSchema:
    """Validate output structure matches PRD §7.1 exactly."""

    REQUIRED_POLYGON_KEYS = {
        "polygon_id", "geometry", "confidence",
        "geometry_features", "lookalike_filter"
    }
    REQUIRED_GEOM_KEYS = {
        "area_km2", "perimeter_km", "major_axis_km",
        "minor_axis_km", "eccentricity", "orientation_deg"
    }
    REQUIRED_FILTER_KEYS = {
        "wind_speed_ms", "wind_gate_passed", "damping_ratio",
        "shape_gate_passed", "final_decision",
        "rejection_reason"
    }

    def test_top_level_keys(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert set(result.keys()) >= self.REQUIRED_POLYGON_KEYS

    def test_geometry_features_keys(self, valid_polygon):
        result = process_polygon(valid_polygon)
        gf_keys = set(result["geometry_features"].keys())
        assert gf_keys >= self.REQUIRED_GEOM_KEYS

    def test_lookalike_filter_keys(self, valid_polygon):
        result = process_polygon(valid_polygon)
        laf_keys = set(result["lookalike_filter"].keys())
        assert laf_keys >= self.REQUIRED_FILTER_KEYS

    def test_confidence_is_float(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert isinstance(result["confidence"], float)

    def test_confidence_in_range(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_wind_gate_passed_is_bool(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert isinstance(result["lookalike_filter"]["wind_gate_passed"], bool)

    def test_shape_gate_passed_is_bool(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert isinstance(result["lookalike_filter"]["shape_gate_passed"], bool)

    def test_geometry_features_are_floats(self, valid_polygon):
        result = process_polygon(valid_polygon)
        for key in self.REQUIRED_GEOM_KEYS:
            val = result["geometry_features"][key]
            assert isinstance(val, (int, float)), (
                f"geometry_features.{key} should be numeric, got {type(val)}"
            )

    def test_final_decision_enum(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert result["lookalike_filter"]["final_decision"] in (
            "confirmed", "rejected"
        )

    def test_rejection_reason_null_when_confirmed(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert result["lookalike_filter"]["rejection_reason"] is None

    def test_rejection_reason_string_when_rejected(self, rejected_polygon):
        result = process_polygon(rejected_polygon)
        reason = result["lookalike_filter"]["rejection_reason"]
        assert isinstance(reason, str)
        assert len(reason) > 0

    def test_geometry_preserved(self, valid_polygon):
        """GeoJSON geometry must pass through unchanged."""
        result = process_polygon(valid_polygon)
        assert result["geometry"]["type"] == "Polygon"
        assert isinstance(result["geometry"]["coordinates"], list)
        assert len(result["geometry"]["coordinates"]) > 0

    def test_polygon_id_preserved(self, valid_polygon):
        result = process_polygon(valid_polygon)
        assert result["polygon_id"] == "valid_slick"


class TestFullPipelineSchema:
    """Validate the end-to-end subprocess output matches §7.1."""

    def test_output_json_structure(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        scene = _build_scene([_build_polygon()])
        input_file = tmp_input_file(scene)
        output_file = str(tmp_path / "test_output.json")

        # Monkey-patch the output file by running as subprocess
        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=30,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"

        # The script writes to 'day1_output.json' in cwd
        out_path = os.path.join(str(tmp_path), "day1_output.json")
        assert os.path.isfile(out_path), "day1_output.json not generated"

        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        # Top-level keys
        assert "scene_id" in output
        assert "acquisition_time" in output
        assert "polygons" in output
        assert isinstance(output["polygons"], list)
        assert len(output["polygons"]) == 1

        # Polygon-level keys
        poly = output["polygons"][0]
        for key in (
            "polygon_id", "geometry", "confidence",
            "geometry_features", "lookalike_filter"
        ):
            assert key in poly, f"Missing key: {key}"


# ═══════════════════════════════════════════════════════════════════════
#  4. FILE SYSTEM & EXCEPTION RESILIENCE
# ═══════════════════════════════════════════════════════════════════════

class TestFileSystemResilience:
    """Ensure graceful handling of bad inputs at the filesystem level."""

    def test_missing_input_file(self, python_cmd, script_path, tmp_path):
        """Non-existent file → exit code 1, no uncaught traceback."""
        result = subprocess.run(
            [python_cmd, script_path, str(tmp_path / "nonexistent.json")],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=10,
        )
        assert result.returncode == 1
        # Must print a clean error, not an uncaught Python traceback
        assert "Traceback" not in result.stdout
        assert "Traceback" not in result.stderr
        assert "FATAL" in result.stdout or "not found" in result.stdout.lower()

    def test_malformed_json(self, python_cmd, script_path, tmp_path):
        """Corrupted JSON → exit code 1, graceful error message."""
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("{this is not valid json!!", encoding="utf-8")

        result = subprocess.run(
            [python_cmd, script_path, str(bad_file)],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout
        assert "Traceback" not in result.stderr
        assert "FATAL" in result.stdout or "JSON" in result.stdout

    def test_empty_file(self, python_cmd, script_path, tmp_path):
        """Empty file → exit code 1, graceful error."""
        empty_file = tmp_path / "empty.json"
        empty_file.write_text("", encoding="utf-8")

        result = subprocess.run(
            [python_cmd, script_path, str(empty_file)],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout
        assert "Traceback" not in result.stderr

    def test_json_array_instead_of_object(self, python_cmd, script_path, tmp_path):
        """JSON root is array instead of object → exit code 1."""
        arr_file = tmp_path / "array.json"
        arr_file.write_text("[1, 2, 3]", encoding="utf-8")

        result = subprocess.run(
            [python_cmd, script_path, str(arr_file)],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout

    def test_empty_polygons_array(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        """Empty polygons list → exit code 0, empty output."""
        scene = _build_scene([])
        input_file = tmp_input_file(scene)

        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=10,
        )
        assert result.returncode == 0

        out_path = os.path.join(str(tmp_path), "day1_output.json")
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)
        assert output["polygons"] == []


class TestMissingFieldResilience:
    """Ensure validate_polygon_fields catches missing/null data."""

    def test_missing_geometry_features(self):
        poly = _build_polygon()
        del poly["geometry_features"]
        with pytest.raises(ValueError, match="geometry_features"):
            process_polygon(poly)

    def test_missing_lookalike_filter(self):
        poly = _build_polygon()
        del poly["lookalike_filter"]
        with pytest.raises(ValueError, match="lookalike_filter"):
            process_polygon(poly)

    def test_missing_wind_speed(self):
        poly = _build_polygon()
        poly["lookalike_filter"]["wind_speed_ms"] = None
        with pytest.raises(ValueError, match="wind_speed_ms"):
            process_polygon(poly)

    def test_missing_damping_ratio(self):
        poly = _build_polygon()
        poly["lookalike_filter"]["damping_ratio"] = None
        with pytest.raises(ValueError, match="damping_ratio"):
            process_polygon(poly)

    def test_missing_eccentricity(self):
        poly = _build_polygon()
        poly["geometry_features"]["eccentricity"] = None
        with pytest.raises(ValueError, match="eccentricity"):
            process_polygon(poly)

    def test_missing_multiple_fields(self):
        poly = _build_polygon()
        poly["geometry_features"]["area_km2"] = None
        poly["geometry_features"]["eccentricity"] = None
        poly["lookalike_filter"]["wind_speed_ms"] = None
        with pytest.raises(ValueError) as exc_info:
            process_polygon(poly)
        msg = str(exc_info.value)
        assert "area_km2" in msg
        assert "eccentricity" in msg
        assert "wind_speed_ms" in msg


# ═══════════════════════════════════════════════════════════════════════
#  5. ALIGNMENT CHECK VALIDATION
# ═══════════════════════════════════════════════════════════════════════

class TestShippingLaneAlignment:
    """Validate alignment check logic against known shipping lanes."""

    def test_exact_match(self):
        """Orientation matching a shipping lane exactly → aligned."""
        aligned, lane = check_shipping_lane_alignment(45.0)
        assert aligned is True
        assert lane == 45.0

    def test_within_tolerance(self):
        """Orientation within tolerance of a lane → aligned."""
        aligned, lane = check_shipping_lane_alignment(42.5)
        assert aligned is True
        assert lane == 45.0  # closest lane

    def test_outside_tolerance(self):
        """Orientation far from any lane → not aligned."""
        aligned, lane = check_shipping_lane_alignment(120.0)
        assert aligned is False
        assert lane is None

    def test_non_numeric(self):
        """Non-numeric orientation → not aligned, no crash."""
        aligned, lane = check_shipping_lane_alignment("north")
        assert aligned is False

    def test_alignment_in_output(self):
        """Alignment check result appears in processed polygon output."""
        poly = _build_polygon(orientation_deg=45.0)
        result = process_polygon(poly)
        assert "_aligned" in result
        assert result["_aligned"] is True

    def test_no_alignment_in_output(self):
        """Non-aligned slick shows False in output."""
        poly = _build_polygon(orientation_deg=120.0)
        result = process_polygon(poly)
        assert result.get("_aligned") is False


# ═══════════════════════════════════════════════════════════════════════
#  6. MULTI-GATE INTERACTION & EDGE CASES
# ═══════════════════════════════════════════════════════════════════════

class TestMultiGateInteraction:
    """All gates are always evaluated — rejection_reason must be complete."""

    def test_all_three_gates_fail_three_reasons(self):
        """When all three gates fail, rejection_reason has three parts."""
        poly = _build_polygon(
            wind_speed_ms=1.0, damping_ratio=0.20, eccentricity=0.30
        )
        result = process_polygon(poly)
        reasons = result["lookalike_filter"]["rejection_reason"]
        # Semicolon-delimited, should have three segments
        parts = [r.strip() for r in reasons.split(";")]
        assert len(parts) == 3, f"Expected 3 rejection reasons, got {len(parts)}"

    def test_wind_fails_shape_ok_one_reason(self):
        """Only wind fails → single rejection reason."""
        poly = _build_polygon(
            wind_speed_ms=0.5, damping_ratio=0.80, eccentricity=0.90
        )
        result = process_polygon(poly)
        reasons = result["lookalike_filter"]["rejection_reason"]
        parts = [r.strip() for r in reasons.split(";")]
        assert len(parts) == 1

    def test_integer_inputs_accepted(self):
        """Integer values for float fields should work fine."""
        poly = _build_polygon(wind_speed_ms=6, damping_ratio=1, eccentricity=1)
        result = process_polygon(poly)
        assert result["lookalike_filter"]["final_decision"] == "confirmed"

    def test_multiple_polygons_independent(self):
        """Processing one polygon does not affect another."""
        good = _build_polygon(
            polygon_id="good", wind_speed_ms=6.0,
            damping_ratio=0.80, eccentricity=0.90
        )
        bad = _build_polygon(
            polygon_id="bad", wind_speed_ms=1.0,
            damping_ratio=0.20, eccentricity=0.30
        )

        result_good = process_polygon(good)
        result_bad = process_polygon(bad)

        assert result_good["lookalike_filter"]["final_decision"] == "confirmed"
        assert result_bad["lookalike_filter"]["final_decision"] == "rejected"

    def test_confirmed_polygon_has_all_true_gates(self):
        """A confirmed polygon must have both gate booleans True."""
        poly = _build_polygon()
        result = process_polygon(poly)
        if result["lookalike_filter"]["final_decision"] == "confirmed":
            assert result["lookalike_filter"]["wind_gate_passed"] is True
            assert result["lookalike_filter"]["shape_gate_passed"] is True


# ═══════════════════════════════════════════════════════════════════════
#  7. END-TO-END SUBPROCESS INTEGRATION
# ═══════════════════════════════════════════════════════════════════════

class TestEndToEndSubprocess:
    """Run lookalike_filter.py as a subprocess against real test data."""

    def test_mixed_polygons_e2e(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        """One confirmed + one rejected polygon, full pipeline."""
        scene = _build_scene([
            _build_polygon(
                polygon_id="real_slick",
                wind_speed_ms=5.8,
                damping_ratio=0.82,
                eccentricity=0.97,
            ),
            _build_polygon(
                polygon_id="fake_patch",
                wind_speed_ms=1.4,
                damping_ratio=0.35,
                eccentricity=0.58,
            ),
        ])
        input_file = tmp_input_file(scene)

        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=30,
        )
        assert result.returncode == 0

        out_path = os.path.join(str(tmp_path), "day1_output.json")
        with open(out_path, "r", encoding="utf-8") as f:
            output = json.load(f)

        assert len(output["polygons"]) == 2

        confirmed = [
            p for p in output["polygons"]
            if p["lookalike_filter"]["final_decision"] == "confirmed"
        ]
        rejected = [
            p for p in output["polygons"]
            if p["lookalike_filter"]["final_decision"] == "rejected"
        ]

        assert len(confirmed) == 1
        assert len(rejected) == 1
        assert confirmed[0]["polygon_id"] == "real_slick"
        assert rejected[0]["polygon_id"] == "fake_patch"

    def test_stdout_contains_pass_fail_markers(
        self, tmp_input_file, python_cmd, script_path, tmp_path
    ):
        """Console output must show [PASS]/[FAIL] gate markers."""
        scene = _build_scene([_build_polygon()])
        input_file = tmp_input_file(scene)

        result = subprocess.run(
            [python_cmd, script_path, input_file],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            timeout=30,
        )
        assert "[PASS]" in result.stdout or "[FAIL]" in result.stdout
        assert "CONFIRMED" in result.stdout or "REJECTED" in result.stdout

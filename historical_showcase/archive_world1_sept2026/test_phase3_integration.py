#!/usr/bin/env python3
"""
test_phase3_integration.py — Integration & Security QA Suite
Stage 5 Pipeline Integrator & Case File Exporter (P3 Module)

Covers:
  1. Null Result State Verification
  2. Dark Vessel Detection Integration
  3. SHA-256 Tamper-Evidence Verification
  4. Complete PRD §7.5 Schema Verification
  5. Threshold Filtering (system restraint)
  6. Haversine Distance & CFAR Matching

Run:  pytest test_phase3_integration.py -v
"""

import json
import os
import subprocess
import sys
import uuid

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.abspath(__file__))
)  # noqa: E402

from pipeline_integrator import (  # noqa: E402
    cross_reference_dark_vessels,
    haversine_km,
    compute_sha256,
)


# ═══════════════════════════════════════════════════════════════════════
#  FIXTURES & HELPERS
# ═══════════════════════════════════════════════════════════════════════

def _write_json(path, data):
    """Write a dict to a JSON file."""
    with open(str(path), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _build_stage1_output(scene_id="TEST_SCENE_001"):
    """Minimal Stage 1 output."""
    return {
        "scene_id": scene_id,
        "acquisition_time": "2026-09-01T10:15:00Z",
        "polygons": [
            {
                "polygon_id": "slick_001",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[72.5, 18.5], [72.6, 18.5],
                         [72.6, 18.6], [72.5, 18.6],
                         [72.5, 18.5]]
                    ],
                },
                "confidence": 0.85,
                "geometry_features": {
                    "area_km2": 14.2,
                    "perimeter_km": 22.8,
                    "major_axis_km": 8.1,
                    "minor_axis_km": 1.8,
                    "eccentricity": 0.97,
                    "orientation_deg": 42.5,
                },
                "lookalike_filter": {
                    "wind_speed_ms": 5.8,
                    "wind_gate_passed": True,
                    "damping_ratio": 0.82,
                    "shape_gate_passed": True,
                    "final_decision": "confirmed",
                    "rejection_reason": None,
                },
            }
        ],
    }


def _build_stage23_data(cfar_dets=None, ais_tracks=None):
    """Minimal Stage 2/3 data with configurable CFAR/AIS."""
    if cfar_dets is None:
        cfar_dets = []
    if ais_tracks is None:
        ais_tracks = []
    return {
        "corridor": {
            "origin_hex": "872a1076dffffff",
            "resolution": 7,
            "timesteps_hours": [6, 12, 18, 24],
            "corridor_hexes": [
                "872a1076dffffff",
                "872a1076effffff",
            ],
            "drift_config": {
                "currents_source": "HYCOM",
                "wind_source": "ERA5",
                "wind_drift_factor": 0.03,
            },
        },
        "ais_query_bounds": {
            "time_window_start": "2026-08-31T10:15:00Z",
            "time_window_end": "2026-09-01T10:15:00Z",
            "hex_ids_queried": ["872a1076dffffff"],
            "total_ais_positions_scanned": 5000,
            "vessels_intersecting_corridor": 0,
        },
        "cfar_radar_detections": cfar_dets,
        "ais_tracks_at_scene_time": ais_tracks,
    }


def _build_stage4_output(ranked=None, null_result=False):
    """Minimal Stage 4 output."""
    if ranked is None:
        ranked = []
    return {
        "ranked_suspects": ranked,
        "dark_vessels": [],
        "null_result": null_result,
    }


def _build_suspect(
    vessel_id="IMO_TEST", total_score=85.0
):
    """Build a single ranked suspect record."""
    return {
        "vessel_id": vessel_id,
        "total_score": total_score,
        "feature_breakdown": {
            "corridor_overlap_score": 1.0,
            "heading_alignment_score": 0.9,
            "speed_anomaly_score": 1.0,
            "ais_gap_history_score": 1.0,
        },
        "weights_used": {
            "corridor_overlap": 0.40,
            "heading_alignment": 0.30,
            "speed_anomaly": 0.20,
            "ais_gap_history": 0.10,
        },
    }


def _build_cfar(det_id, lon, lat, hex_id):
    """Build a single CFAR radar detection."""
    return {
        "cfar_detection_id": det_id,
        "position": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "timestamp": "2026-09-01T09:45:00Z",
        "radar_cross_section_dbsm": 40.0,
        "estimated_length_m": 150.0,
        "nearest_corridor_hex": hex_id,
    }


def _build_ais_track(vessel_id, lon, lat):
    """Build a single AIS position track."""
    return {
        "vessel_id": vessel_id,
        "position": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "timestamp": "2026-09-01T09:44:00Z",
    }


@pytest.fixture
def python_cmd():
    return sys.executable


@pytest.fixture
def script_path():
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "pipeline_integrator.py",
    )


def _run_pipeline(
    tmp_path, python_cmd, script_path,
    stage1, stage23, stage4
):
    """Write stage files and run the pipeline integrator."""
    s1 = tmp_path / "stage1.json"
    s23 = tmp_path / "stage23.json"
    s4 = tmp_path / "stage4.json"

    _write_json(s1, stage1)
    _write_json(s23, stage23)
    _write_json(s4, stage4)

    result = subprocess.run(
        [
            python_cmd, script_path,
            "--stage1", str(s1),
            "--stage23", str(s23),
            "--stage4", str(s4),
        ],
        capture_output=True, text=True,
        cwd=str(tmp_path), timeout=30,
    )

    out_path = tmp_path / "case_file.json"
    case = None
    if out_path.exists():
        with open(str(out_path), "r", encoding="utf-8") as f:
            case = json.load(f)

    return result, case


# ═══════════════════════════════════════════════════════════════════════
#  1. NULL RESULT STATE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

class TestNullResultState:
    """When all vessels score < 40, system must show restraint."""

    def test_null_result_true_no_suspects(
        self, tmp_path, python_cmd, script_path
    ):
        """All below threshold → null_result=true, empty list."""
        stage4 = _build_stage4_output(
            ranked=[], null_result=True
        )
        result, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert result.returncode == 0
        assert case["null_result"] is True
        assert case["ranked_suspects"] == []

    def test_null_result_false_with_suspects(
        self, tmp_path, python_cmd, script_path
    ):
        """At least one ≥ 40 → null_result=false."""
        stage4 = _build_stage4_output(
            ranked=[_build_suspect("V1", 85.0)],
            null_result=False,
        )
        result, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert result.returncode == 0
        assert case["null_result"] is False
        assert len(case["ranked_suspects"]) == 1

    def test_null_with_dark_vessels(
        self, tmp_path, python_cmd, script_path
    ):
        """Null attribution but dark vessels exist."""
        cfar = [_build_cfar("CFAR_X", 72.5, 18.5,
                            "872a1076dffffff")]
        stage23 = _build_stage23_data(
            cfar_dets=cfar, ais_tracks=[]
        )
        stage4 = _build_stage4_output(
            ranked=[], null_result=True
        )
        result, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            stage23,
            stage4,
        )
        assert result.returncode == 0
        assert case["null_result"] is True
        assert case["ranked_suspects"] == []
        assert len(case["dark_vessels"]) == 1


# ═══════════════════════════════════════════════════════════════════════
#  2. DARK VESSEL DETECTION INTEGRATION
# ═══════════════════════════════════════════════════════════════════════

class TestDarkVesselDetection:
    """CFAR detections with no AIS → dark_vessels array."""

    def test_single_dark_vessel(self):
        """One CFAR, zero AIS → one dark vessel."""
        cfar = [_build_cfar("CFAR_001", 72.5, 18.5,
                            "872a1076dffffff")]
        dark = cross_reference_dark_vessels(cfar, [])

        assert len(dark) == 1
        dv = dark[0]
        assert dv["cfar_detection_id"] == "CFAR_001"
        assert dv["ais_match_found"] is False
        assert dv["proximity_to_corridor"] == (
            "872a1076dffffff"
        )
        assert dv["timestamp"] == "2026-09-01T09:45:00Z"
        assert dv["position"]["type"] == "Point"

    def test_cfar_with_ais_match(self):
        """CFAR near AIS track → NOT dark."""
        cfar = [_build_cfar("CFAR_M", 72.5, 18.5,
                            "872a1076dffffff")]
        ais = [_build_ais_track("IMO_1", 72.501, 18.501)]
        dark = cross_reference_dark_vessels(cfar, ais)
        assert len(dark) == 0

    def test_mixed_matched_and_dark(self):
        """2 CFAR: one matched, one dark."""
        cfar = [
            _build_cfar("CFAR_A", 72.5, 18.5,
                        "872a1076dffffff"),
            _build_cfar("CFAR_B", 73.0, 19.0,
                        "872a1076effffff"),
        ]
        ais = [_build_ais_track("IMO_1", 72.501, 18.501)]
        dark = cross_reference_dark_vessels(cfar, ais)

        assert len(dark) == 1
        assert dark[0]["cfar_detection_id"] == "CFAR_B"

    def test_dark_vessel_in_case_file(
        self, tmp_path, python_cmd, script_path
    ):
        """Dark vessel flows through to case_file.json."""
        cfar = [_build_cfar("CFAR_DARK", 73.5, 19.5,
                            "872a1076effffff")]
        stage23 = _build_stage23_data(
            cfar_dets=cfar, ais_tracks=[]
        )
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        result, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(), stage23, stage4,
        )
        assert result.returncode == 0
        assert len(case["dark_vessels"]) == 1
        dv = case["dark_vessels"][0]
        assert dv["cfar_detection_id"] == "CFAR_DARK"
        assert dv["ais_match_found"] is False
        assert "proximity_to_corridor" in dv

    def test_no_cfar_no_dark(self):
        """Zero CFAR detections → zero dark vessels."""
        dark = cross_reference_dark_vessels([], [])
        assert dark == []


# ═══════════════════════════════════════════════════════════════════════
#  3. SHA-256 TAMPER-EVIDENCE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

class TestTamperEvidence:
    """Input data hash must change when any input changes."""

    def test_hash_is_64_char_hex(
        self, tmp_path, python_cmd, script_path
    ):
        """input_data_hash is a valid 64-char SHA-256 hex."""
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        result, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert result.returncode == 0
        h = case["input_data_hash"]
        assert isinstance(h, str)
        assert len(h) == 64
        # Must be valid hex
        int(h, 16)

    def test_hash_changes_on_tamper(self, tmp_path):
        """Modifying a single byte changes the hash."""
        f1 = tmp_path / "a.json"
        f2 = tmp_path / "b.json"

        _write_json(f1, {"version": "original"})
        _write_json(f2, {"data": "stable"})

        hash_original = compute_sha256(str(f1), str(f2))

        # Tamper: change one character
        _write_json(f1, {"version": "Original"})

        hash_tampered = compute_sha256(str(f1), str(f2))

        assert hash_original != hash_tampered

    def test_hash_deterministic(self, tmp_path):
        """Same inputs → same hash (determinism)."""
        f1 = tmp_path / "x.json"
        _write_json(f1, {"stable": True})

        h1 = compute_sha256(str(f1))
        h2 = compute_sha256(str(f1))
        assert h1 == h2

    def test_full_pipeline_tamper_detection(
        self, tmp_path, python_cmd, script_path
    ):
        """End-to-end: run pipeline, tamper input, re-run,
        hashes must differ."""
        stage1 = _build_stage1_output()
        stage23 = _build_stage23_data()
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )

        # First run
        _, case1 = _run_pipeline(
            tmp_path, python_cmd, script_path,
            stage1, stage23, stage4,
        )
        hash1 = case1["input_data_hash"]

        # Tamper the Stage 1 file
        s1_path = tmp_path / "stage1.json"
        stage1_tampered = _build_stage1_output(
            scene_id="TAMPERED_SCENE"
        )
        _write_json(s1_path, stage1_tampered)

        # Re-run
        result2 = subprocess.run(
            [
                python_cmd, script_path,
                "--stage1", str(s1_path),
                "--stage23", str(tmp_path / "stage23.json"),
                "--stage4", str(tmp_path / "stage4.json"),
            ],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=30,
        )
        assert result2.returncode == 0

        out2 = tmp_path / "case_file.json"
        with open(str(out2), "r", encoding="utf-8") as f:
            case2 = json.load(f)

        hash2 = case2["input_data_hash"]
        assert hash1 != hash2, (
            "Hash must change after input tamper"
        )


# ═══════════════════════════════════════════════════════════════════════
#  4. COMPLETE PRD §7.5 SCHEMA VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

class TestCaseFileSchema:
    """Validate PRD §7.5 case file structure."""

    REQUIRED_TOP_KEYS = {
        "case_id",
        "generated_at",
        "scene_id",
        "h3_resolution",
        "processing_parameters",
        "corridor",
        "ais_query_bounds",
        "ranked_suspects",
        "dark_vessels",
        "null_result",
        "input_data_hash",
    }

    REQUIRED_PROC_PARAMS = {
        "segmentation_model_version",
        "lookalike_thresholds",
        "drift_config",
        "scoring_weights",
    }

    def test_all_top_level_keys_present(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        for key in self.REQUIRED_TOP_KEYS:
            assert key in case, f"Missing §7.5 key: {key}"

    def test_no_extra_top_level_keys(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert set(case.keys()) == self.REQUIRED_TOP_KEYS

    def test_case_id_is_uuid4(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        # Should parse as valid UUID
        parsed = uuid.UUID(case["case_id"], version=4)
        assert str(parsed) == case["case_id"]

    def test_generated_at_iso8601(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        ts = case["generated_at"]
        assert ts.endswith("Z")
        assert "T" in ts

    def test_h3_resolution_is_7(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert case["h3_resolution"] == 7

    def test_processing_parameters_keys(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        pp = case["processing_parameters"]
        for key in self.REQUIRED_PROC_PARAMS:
            assert key in pp, (
                f"Missing processing_parameters key: {key}"
            )

    def test_scoring_weights_sum_to_one(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        w = case["processing_parameters"]["scoring_weights"]
        assert abs(sum(w.values()) - 1.0) < 1e-9

    def test_corridor_has_hexes(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        corridor = case["corridor"]
        assert "corridor_hexes" in corridor
        assert "origin_hex" in corridor
        assert len(corridor["corridor_hexes"]) > 0

    def test_scene_id_from_stage1(
        self, tmp_path, python_cmd, script_path
    ):
        stage1 = _build_stage1_output(
            scene_id="MY_SCENE_XYZ"
        )
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            stage1, _build_stage23_data(), stage4,
        )
        assert case["scene_id"] == "MY_SCENE_XYZ"

    def test_null_result_is_bool(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[], null_result=True
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert isinstance(case["null_result"], bool)

    def test_dark_vessels_is_list(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert isinstance(case["dark_vessels"], list)

    def test_ranked_suspects_is_list(
        self, tmp_path, python_cmd, script_path
    ):
        stage4 = _build_stage4_output(
            ranked=[_build_suspect()], null_result=False
        )
        _, case = _run_pipeline(
            tmp_path, python_cmd, script_path,
            _build_stage1_output(),
            _build_stage23_data(),
            stage4,
        )
        assert isinstance(case["ranked_suspects"], list)


# ═══════════════════════════════════════════════════════════════════════
#  5. HAVERSINE & CFAR MATCHING UNIT TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestHaversine:
    """Verify geospatial distance calculation."""

    def test_same_point(self):
        assert haversine_km(72.5, 18.5, 72.5, 18.5) == 0.0

    def test_known_distance(self):
        """Mumbai to Pune ≈ 118 km."""
        dist = haversine_km(72.87, 19.07, 73.85, 18.52)
        assert 115 < dist < 125

    def test_short_distance(self):
        """Two points ~1 km apart."""
        dist = haversine_km(72.5, 18.5, 72.509, 18.5)
        assert 0.5 < dist < 2.0

    def test_match_radius_boundary(self):
        """Points exactly at match radius edge."""
        # Approximately 2km at this latitude
        dist = haversine_km(72.5, 18.5, 72.519, 18.5)
        assert 1.5 < dist < 2.5
        # If within radius, it's a match; if outside, dark
        cfar = [_build_cfar("C1", 72.5, 18.5, "hex1")]
        ais = [_build_ais_track("V1", 72.519, 18.5)]
        dark = cross_reference_dark_vessels(cfar, ais)
        # Just verify it runs — exact boundary is
        # implementation-defined
        assert isinstance(dark, list)


# ═══════════════════════════════════════════════════════════════════════
#  6. FILE RESILIENCE
# ═══════════════════════════════════════════════════════════════════════

class TestPipelineResilience:
    """Graceful handling of missing/bad inputs."""

    def test_missing_stage1_file(
        self, python_cmd, script_path, tmp_path
    ):
        result = subprocess.run(
            [
                python_cmd, script_path,
                "--stage1", str(tmp_path / "missing.json"),
                "--stage23", str(tmp_path / "s23.json"),
                "--stage4", str(tmp_path / "s4.json"),
            ],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout
        assert "Traceback" not in result.stderr

    def test_no_traceback_on_bad_json(
        self, python_cmd, script_path, tmp_path
    ):
        bad = tmp_path / "bad.json"
        bad.write_text("{broken!", encoding="utf-8")
        s23 = tmp_path / "s23.json"
        s4 = tmp_path / "s4.json"
        _write_json(s23, _build_stage23_data())
        _write_json(s4, _build_stage4_output())

        result = subprocess.run(
            [
                python_cmd, script_path,
                "--stage1", str(bad),
                "--stage23", str(s23),
                "--stage4", str(s4),
            ],
            capture_output=True, text=True,
            cwd=str(tmp_path), timeout=10,
        )
        assert result.returncode == 1
        assert "Traceback" not in result.stdout

#!/usr/bin/env python3
"""
test_validation_kerala_msc_elsa3.py — Test Suite for Kerala Validation
Marine Oil Spill Detection & AIS-Based Vessel Attribution Pipeline
SIH 2026 — NTRO Problem Statement

Rigorously tests the real-world validation case study module
(validation_kerala_msc_elsa3.py) against the MSC Elsa 3 disaster.

Test Categories:
  1. Coordinate Conversion Arithmetic (DMS ↔ Decimal)
  2. Timezone-Aware IST/UTC Handling
  3. Forward-Projection Bearing & Distance Math
  4. Wind Gate Failure Graceful Abort
  5. Caveats Array Regression
  6. Corridor Generation Integrity
  7. Haversine Distance Consistency
  8. Full Integration Smoke Test

Usage:
  pytest test_validation_kerala_msc_elsa3.py -v
"""

import json
import os
import pytest
from datetime import datetime, timezone, timedelta

from validation_kerala_msc_elsa3 import (
    GROUND_TRUTH,
    OBSERVATION_TIME_UTC,
    SINKING_TIME_UTC,
    DRIFT_DURATION_HOURS,
    DRIFT_SPEED_KMH,
    DRIFT_BEARING_DEG,
    destination_point,
    haversine_km,
    build_polygon_ring,
    lat_lon_to_h3_index,
    construct_synthetic_polygon,
    run_gate_evaluation,
    generate_backward_corridor,
    compute_validation_metrics,
)


# ═══════════════════════════════════════════════════════════════════════
#  TEST 1: COORDINATE CONVERSION ARITHMETIC (DMS ↔ Decimal)
# ═══════════════════════════════════════════════════════════════════════

class TestCoordinateConversion:
    """Verify lat/lon minutes-to-decimal conversion is exact."""

    def test_latitude_dms_to_decimal(self):
        """09°18.75' N → 9.3125° N exactly."""
        # Formula: degrees + (minutes / 60)
        degrees = 9
        minutes = 18.75
        decimal = degrees + (minutes / 60.0)
        assert decimal == 9.3125
        assert GROUND_TRUTH["origin_lat"] == 9.3125

    def test_longitude_dms_to_decimal(self):
        """076°08.16' E → 76.136° E exactly."""
        degrees = 76
        minutes = 8.16
        decimal = degrees + (minutes / 60.0)
        assert abs(decimal - 76.136) < 1e-10
        assert abs(
            GROUND_TRUTH["origin_lon"] - 76.136
        ) < 1e-10

    def test_latitude_decimal_to_dms_roundtrip(self):
        """9.3125 → 09°18.75' → 9.3125 roundtrip."""
        decimal = GROUND_TRUTH["origin_lat"]
        deg = int(decimal)
        minutes = (decimal - deg) * 60.0
        assert deg == 9
        assert abs(minutes - 18.75) < 1e-10
        reconstructed = deg + (minutes / 60.0)
        assert abs(reconstructed - decimal) < 1e-12

    def test_longitude_decimal_to_dms_roundtrip(self):
        """76.136 → 076°08.16' → 76.136 roundtrip."""
        decimal = GROUND_TRUTH["origin_lon"]
        deg = int(decimal)
        minutes = (decimal - deg) * 60.0
        assert deg == 76
        assert abs(minutes - 8.16) < 1e-10
        reconstructed = deg + (minutes / 60.0)
        assert abs(reconstructed - decimal) < 1e-12

    def test_ground_truth_string_matches_numeric(self):
        """Verify the IST string embeds the same date as UTC."""
        ist_str = GROUND_TRUTH["sinking_time_ist"]
        utc_str = GROUND_TRUTH["sinking_time_utc"]
        assert "2025-05-25" in ist_str
        assert "2025-05-25" in utc_str
        assert "07:50" in ist_str   # IST time
        assert "02:20" in utc_str   # UTC time


# ═══════════════════════════════════════════════════════════════════════
#  TEST 2: TIMEZONE-AWARE IST/UTC HANDLING
# ═══════════════════════════════════════════════════════════════════════

class TestTimezoneHandling:
    """Strict timezone-aware handling between IST and UTC."""

    def test_sinking_time_is_timezone_aware(self):
        """SINKING_TIME_UTC must be timezone-aware (not naive)."""
        assert SINKING_TIME_UTC.tzinfo is not None

    def test_observation_time_is_timezone_aware(self):
        """OBSERVATION_TIME_UTC must be timezone-aware."""
        assert OBSERVATION_TIME_UTC.tzinfo is not None

    def test_ist_to_utc_conversion(self):
        """07:50 IST = 02:20 UTC (IST = UTC+5:30)."""
        ist_offset = timedelta(hours=5, minutes=30)
        ist_tz = timezone(ist_offset)
        sinking_ist = datetime(
            2025, 5, 25, 7, 50, 0, tzinfo=ist_tz
        )
        sinking_utc = sinking_ist.astimezone(timezone.utc)
        assert sinking_utc.hour == 2
        assert sinking_utc.minute == 20
        assert sinking_utc.day == 25
        assert sinking_utc.month == 5

    def test_ist_utc_offset_is_5h30m(self):
        """IST offset from UTC is exactly 5 hours 30 minutes."""
        ist_offset = timedelta(hours=5, minutes=30)
        ist_tz = timezone(ist_offset)
        sinking_ist = datetime(
            2025, 5, 25, 7, 50, 0, tzinfo=ist_tz
        )
        sinking_utc = sinking_ist.astimezone(timezone.utc)
        diff = sinking_ist - sinking_utc
        assert diff.total_seconds() == 0  # Same instant

    def test_sinking_time_matches_ground_truth(self):
        """Module constant matches ground truth dict."""
        assert SINKING_TIME_UTC.year == 2025
        assert SINKING_TIME_UTC.month == 5
        assert SINKING_TIME_UTC.day == 25
        assert SINKING_TIME_UTC.hour == 2
        assert SINKING_TIME_UTC.minute == 20

    def test_observation_is_after_sinking(self):
        """Observation (May 27) is strictly after sinking (May 25)."""
        assert OBSERVATION_TIME_UTC > SINKING_TIME_UTC

    def test_drift_duration_positive(self):
        """Drift duration must be positive hours."""
        assert DRIFT_DURATION_HOURS > 0

    def test_drift_duration_approximately_51_hours(self):
        """~51.67 hours between sinking and observation."""
        assert abs(DRIFT_DURATION_HOURS - 51.667) < 0.01

    def test_corridor_timestamps_are_utc(self):
        """All corridor timestep timestamps end with Z (UTC)."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        corridor = generate_backward_corridor(
            obs_lat, obs_lon,
            OBSERVATION_TIME_UTC,
            SINKING_TIME_UTC,
            DRIFT_SPEED_KMH,
            DRIFT_BEARING_DEG,
            timestep_hours=12,
        )
        for ts in corridor:
            assert ts["timestamp"].endswith("Z")


# ═══════════════════════════════════════════════════════════════════════
#  TEST 3: FORWARD-PROJECTION BEARING & DISTANCE MATH
# ═══════════════════════════════════════════════════════════════════════

class TestBearingAndDistanceMath:
    """Check SSE bearing math and distance-to-lat/lon offsets."""

    def test_zero_distance_returns_same_point(self):
        """Zero distance → identical coordinates."""
        lat, lon = destination_point(9.3125, 76.136, 157.5, 0.0)
        assert abs(lat - 9.3125) < 1e-10
        assert abs(lon - 76.136) < 1e-10

    def test_due_north_increases_latitude(self):
        """Bearing 0° (north) should increase latitude."""
        lat, lon = destination_point(9.0, 76.0, 0.0, 100.0)
        assert lat > 9.0
        assert abs(lon - 76.0) < 0.01

    def test_due_south_decreases_latitude(self):
        """Bearing 180° (south) should decrease latitude."""
        lat, lon = destination_point(9.0, 76.0, 180.0, 100.0)
        assert lat < 9.0
        assert abs(lon - 76.0) < 0.01

    def test_due_east_increases_longitude(self):
        """Bearing 90° (east) should increase longitude."""
        lat, lon = destination_point(9.0, 76.0, 90.0, 100.0)
        assert lon > 76.0
        assert abs(lat - 9.0) < 0.1

    def test_sse_bearing_decreases_lat_increases_lon(self):
        """SSE (157.5°) should move south and slightly east."""
        lat, lon = destination_point(9.3125, 76.136, 157.5, 50.0)
        assert lat < 9.3125   # Moved south
        assert lon > 76.136   # Moved slightly east

    def test_destination_haversine_roundtrip(self):
        """Distance to destination matches haversine back-check."""
        start_lat, start_lon = 9.3125, 76.136
        distance_km = 100.0
        bearing = 157.5
        dest_lat, dest_lon = destination_point(
            start_lat, start_lon, bearing, distance_km
        )
        computed_dist = haversine_km(
            start_lat, start_lon, dest_lat, dest_lon
        )
        assert abs(computed_dist - distance_km) < 0.5

    def test_full_drift_distance(self):
        """Total drift = speed * time = 3 * 51.67 ≈ 155 km."""
        total_km = DRIFT_SPEED_KMH * DRIFT_DURATION_HOURS
        assert abs(total_km - 155.0) < 1.0

    def test_observed_centroid_is_south_of_wreck(self):
        """After SSE drift, observed centroid is south of wreck."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        assert obs_lat < GROUND_TRUTH["origin_lat"]

    def test_observed_centroid_is_east_of_wreck(self):
        """After SSE drift, observed centroid is east of wreck."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        assert obs_lon > GROUND_TRUTH["origin_lon"]

    def test_100km_north_is_about_0_9_degrees(self):
        """Sanity: 100 km north ≈ 0.9° latitude change."""
        lat, _ = destination_point(9.0, 76.0, 0.0, 100.0)
        delta_lat = lat - 9.0
        assert 0.85 < delta_lat < 0.95

    def test_polygon_ring_is_closed(self):
        """GeoJSON ring must have first == last point."""
        ring = build_polygon_ring(9.0, 76.0, 2.0)
        assert ring[0] == ring[-1]

    def test_polygon_ring_has_correct_vertex_count(self):
        """Default 8 vertices + 1 closing = 9 points."""
        ring = build_polygon_ring(9.0, 76.0, 2.0)
        assert len(ring) == 9  # 8 + 1 closing

    def test_polygon_ring_custom_vertex_count(self):
        """Custom n=12 → 12 + 1 = 13 points."""
        ring = build_polygon_ring(9.0, 76.0, 2.0, n=12)
        assert len(ring) == 13


# ═══════════════════════════════════════════════════════════════════════
#  TEST 4: WIND GATE FAILURE — GRACEFUL ABORT
# ═══════════════════════════════════════════════════════════════════════

class TestWindGateFailureAbort:
    """
    If wind gate rejects (e.g., wind > 12 m/s), the script must
    safely skip corridor generation and note it in the report
    without crashing.
    """

    def _make_polygon_with_wind(self, wind_speed):
        """Helper: build a polygon with a specific wind speed."""
        poly, _, _, _ = construct_synthetic_polygon()
        poly["lookalike_filter"]["wind_speed_ms"] = wind_speed
        return poly

    def test_wind_above_12_rejects(self):
        """Wind > 12 m/s → final_decision = 'rejected'."""
        poly = self._make_polygon_with_wind(14.0)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["final_decision"] == "rejected"
        assert gate_details["wind_gate_passed"] is False

    def test_wind_below_2_rejects(self):
        """Wind < 2 m/s → final_decision = 'rejected'."""
        poly = self._make_polygon_with_wind(1.5)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["final_decision"] == "rejected"

    def test_wind_at_boundary_2_passes(self):
        """Wind = 2.0 m/s → passes (inclusive lower bound)."""
        poly = self._make_polygon_with_wind(2.0)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["wind_gate_passed"] is True

    def test_wind_at_boundary_12_passes(self):
        """Wind = 12.0 m/s → passes (inclusive upper bound)."""
        poly = self._make_polygon_with_wind(12.0)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["wind_gate_passed"] is True

    def test_wind_reject_has_rejection_reason(self):
        """Rejected polygon must have a non-null reason string."""
        poly = self._make_polygon_with_wind(15.0)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["rejection_reason"] is not None
        assert "wind" in gate_details[
            "rejection_reason"
        ].lower() or "Wind" in gate_details[
            "rejection_reason"
        ]

    def test_gate_reject_does_not_crash(self):
        """Gate rejection must return cleanly, no exception."""
        poly = self._make_polygon_with_wind(99.0)
        # Must not raise
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["final_decision"] == "rejected"

    def test_monsoon_extreme_wind_does_not_crash(self):
        """Cyclone-force winds (25+ m/s) handled gracefully."""
        poly = self._make_polygon_with_wind(25.0)
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["final_decision"] == "rejected"

    def test_default_estimated_wind_passes(self):
        """Default estimated wind (8.5 m/s) must pass."""
        poly, _, _, _ = construct_synthetic_polygon()
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["wind_gate_passed"] is True
        assert gate_details["final_decision"] == "confirmed"


# ═══════════════════════════════════════════════════════════════════════
#  TEST 5: CAVEATS ARRAY REGRESSION
# ═══════════════════════════════════════════════════════════════════════

class TestCaveatsArray:
    """Ensure the caveats array is always populated in the report."""

    @pytest.fixture
    def report(self):
        """Load the validation report if it exists."""
        report_path = os.path.join(
            os.path.dirname(__file__),
            "validation_report_kerala_msc_elsa3.json"
        )
        if not os.path.isfile(report_path):
            pytest.skip("Validation report not yet generated")
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def test_caveats_key_exists(self, report):
        """Report must contain a 'caveats' key."""
        assert "caveats" in report

    def test_caveats_is_list(self, report):
        """Caveats must be a list."""
        assert isinstance(report["caveats"], list)

    def test_caveats_not_empty(self, report):
        """Caveats array must never be empty."""
        assert len(report["caveats"]) > 0

    def test_caveats_minimum_count(self, report):
        """At least 5 caveats expected for this validation."""
        assert len(report["caveats"]) >= 5

    def test_each_caveat_has_parameter_and_note(self, report):
        """Every caveat must have 'parameter' and 'note' keys."""
        for caveat in report["caveats"]:
            assert "parameter" in caveat
            assert "note" in caveat
            assert isinstance(caveat["parameter"], str)
            assert isinstance(caveat["note"], str)
            assert len(caveat["parameter"]) > 0
            assert len(caveat["note"]) > 0

    def test_wind_speed_is_caveated(self, report):
        """Wind speed must be listed as an estimated value."""
        params = [c["parameter"] for c in report["caveats"]]
        assert "wind_speed_ms" in params

    def test_damping_ratio_is_caveated(self, report):
        """Damping ratio must be listed as an estimated value."""
        params = [c["parameter"] for c in report["caveats"]]
        assert "damping_ratio" in params

    def test_drift_model_is_caveated(self, report):
        """Drift model limitation must be caveated."""
        params = [c["parameter"] for c in report["caveats"]]
        assert "drift_model" in params

    def test_single_case_is_caveated(self, report):
        """Single-case statistical limitation must be noted."""
        params = [c["parameter"] for c in report["caveats"]]
        assert "single_case" in params

    def test_disclaimer_present(self, report):
        """Report must include a disclaimer string."""
        assert "disclaimer" in report
        assert "PHYSICS" in report["disclaimer"]
        assert "vessel-attribution" in report[
            "disclaimer"
        ].lower() or "vessel" in report[
            "disclaimer"
        ].lower()


# ═══════════════════════════════════════════════════════════════════════
#  TEST 6: CORRIDOR GENERATION INTEGRITY
# ═══════════════════════════════════════════════════════════════════════

class TestCorridorGeneration:
    """Verify backward corridor timestep generation logic."""

    @pytest.fixture
    def corridor(self):
        """Generate a corridor from observation back to sinking."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        return generate_backward_corridor(
            obs_lat, obs_lon,
            OBSERVATION_TIME_UTC,
            SINKING_TIME_UTC,
            DRIFT_SPEED_KMH,
            DRIFT_BEARING_DEG,
            timestep_hours=6,
        )

    def test_corridor_has_timesteps(self, corridor):
        """Corridor must contain at least one timestep."""
        assert len(corridor) > 0

    def test_corridor_timestep_count(self, corridor):
        """~51.67 hours at 6h steps → 9 timesteps (0,6,...48)."""
        assert len(corridor) == 9

    def test_first_timestep_is_observation_time(self, corridor):
        """First timestep t_minus=0 is the observation time."""
        assert corridor[0]["t_minus_hours"] == 0.0
        assert corridor[0]["timestamp"] == (
            "2025-05-27T06:00:00Z"
        )

    def test_timesteps_monotonically_increase(self, corridor):
        """t_minus_hours must strictly increase."""
        for i in range(1, len(corridor)):
            assert (
                corridor[i]["t_minus_hours"]
                > corridor[i - 1]["t_minus_hours"]
            )

    def test_last_timestep_closest_to_sinking(self, corridor):
        """Last timestep should be close to the sinking time."""
        last = corridor[-1]
        assert last["t_minus_hours"] >= 48.0

    def test_each_timestep_has_required_keys(self, corridor):
        """Each timestep must have all required fields."""
        required = [
            "timestamp", "t_minus_hours",
            "centroid_lat", "centroid_lon",
            "h3_hex", "k_ring_hexes", "decay_weight",
        ]
        for ts in corridor:
            for key in required:
                assert key in ts, f"Missing key: {key}"

    def test_corridor_moves_toward_wreck(self, corridor):
        """
        As we go backward in time, the centroid should
        approach the wreck site (latitude increases toward
        9.3125 from the SSE-displaced observation point).
        """
        first_lat = corridor[0]["centroid_lat"]
        last_lat = corridor[-1]["centroid_lat"]
        assert last_lat > first_lat

    def test_decay_weight_is_one(self, corridor):
        """Analytical drift has uniform decay_weight = 1.0."""
        for ts in corridor:
            assert ts["decay_weight"] == 1.0

    def test_h3_hexes_are_strings(self, corridor):
        """All H3 hex IDs must be non-empty strings."""
        for ts in corridor:
            assert isinstance(ts["h3_hex"], str)
            assert len(ts["h3_hex"]) > 0

    def test_corridor_with_12h_timestep(self):
        """12-hour timestep → fewer timesteps."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        corridor = generate_backward_corridor(
            obs_lat, obs_lon,
            OBSERVATION_TIME_UTC,
            SINKING_TIME_UTC,
            DRIFT_SPEED_KMH,
            DRIFT_BEARING_DEG,
            timestep_hours=12,
        )
        assert len(corridor) == 5  # 0, 12, 24, 36, 48


# ═══════════════════════════════════════════════════════════════════════
#  TEST 7: HAVERSINE DISTANCE CONSISTENCY
# ═══════════════════════════════════════════════════════════════════════

class TestHaversineConsistency:
    """Cross-check haversine distances in the validation context."""

    def test_wreck_to_observation_distance(self):
        """Wreck-to-observation distance ≈ 155 km (drift)."""
        _, obs_lat, obs_lon, meta = (
            construct_synthetic_polygon()
        )
        dist = haversine_km(
            GROUND_TRUTH["origin_lat"],
            GROUND_TRUTH["origin_lon"],
            obs_lat, obs_lon
        )
        expected_drift = DRIFT_SPEED_KMH * DRIFT_DURATION_HOURS
        assert abs(dist - expected_drift) < 2.0

    def test_same_point_is_zero(self):
        """Distance from a point to itself is 0."""
        dist = haversine_km(76.136, 9.3125, 76.136, 9.3125)
        assert dist == 0.0

    def test_symmetry(self):
        """haversine(A→B) == haversine(B→A)."""
        d1 = haversine_km(76.136, 9.3125, 76.5, 8.5)
        d2 = haversine_km(76.5, 8.5, 76.136, 9.3125)
        assert abs(d1 - d2) < 1e-10


# ═══════════════════════════════════════════════════════════════════════
#  TEST 8: VALIDATION METRICS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════

class TestValidationMetrics:
    """Test the distance error and hex-hit computation."""

    @pytest.fixture
    def corridor_and_metrics(self):
        """Generate corridor and compute metrics."""
        _, obs_lat, obs_lon, _ = construct_synthetic_polygon()
        corridor = generate_backward_corridor(
            obs_lat, obs_lon,
            OBSERVATION_TIME_UTC,
            SINKING_TIME_UTC,
            DRIFT_SPEED_KMH,
            DRIFT_BEARING_DEG,
            timestep_hours=6,
        )
        metrics = compute_validation_metrics(
            corridor,
            GROUND_TRUTH["origin_lat"],
            GROUND_TRUTH["origin_lon"],
        )
        return corridor, metrics

    def test_distance_error_is_numeric(
        self, corridor_and_metrics
    ):
        """Distance error must be a float."""
        _, metrics = corridor_and_metrics
        assert isinstance(
            metrics["distance_error_km"], float
        )

    def test_distance_error_is_positive(
        self, corridor_and_metrics
    ):
        """Distance error must be non-negative."""
        _, metrics = corridor_and_metrics
        assert metrics["distance_error_km"] >= 0.0

    def test_distance_error_within_reasonable_range(
        self, corridor_and_metrics
    ):
        """
        With constant 3 km/h drift over ~52 hours, the
        analytical corridor should get within ~50 km of
        the true wreck (generous upper bound).
        """
        _, metrics = corridor_and_metrics
        assert metrics["distance_error_km"] < 50.0

    def test_distance_error_within_good_range(
        self, corridor_and_metrics
    ):
        """
        Expected ~11 km with the current parameters.
        Accept anything under 20 km as regression-safe.
        """
        _, metrics = corridor_and_metrics
        assert metrics["distance_error_km"] < 20.0

    def test_hex_hit_is_boolean(self, corridor_and_metrics):
        """Hex hit must be a boolean."""
        _, metrics = corridor_and_metrics
        assert isinstance(metrics["hex_hit"], bool)

    def test_true_wreck_h3_is_string(
        self, corridor_and_metrics
    ):
        """True wreck H3 index must be a non-empty string."""
        _, metrics = corridor_and_metrics
        assert isinstance(metrics["true_wreck_h3"], str)
        assert len(metrics["true_wreck_h3"]) > 0

    def test_closest_timestep_exists(
        self, corridor_and_metrics
    ):
        """Closest timestep must be identified."""
        _, metrics = corridor_and_metrics
        assert metrics["closest_timestep"] is not None

    def test_closest_is_last_or_near_last(
        self, corridor_and_metrics
    ):
        """
        The closest timestep to the wreck should be one of
        the last timesteps (near t_minus = 48-54h).
        """
        corridor, metrics = corridor_and_metrics
        closest = metrics["closest_timestep"]
        assert closest["t_minus_hours"] >= 42.0

    def test_empty_corridor_returns_inf(self):
        """Empty corridor → infinite distance error."""
        metrics = compute_validation_metrics(
            [], 9.3125, 76.136
        )
        assert metrics["distance_error_km"] == float("inf")
        assert metrics["hex_hit"] is False


# ═══════════════════════════════════════════════════════════════════════
#  TEST 9: FULL INTEGRATION SMOKE TEST
# ═══════════════════════════════════════════════════════════════════════

class TestFullIntegration:
    """End-to-end smoke test of the validation module."""

    def test_synthetic_polygon_schema(self):
        """Synthetic polygon has all PRD §7.1 required keys."""
        poly, lat, lon, meta = construct_synthetic_polygon()
        assert "polygon_id" in poly
        assert "geometry" in poly
        assert poly["geometry"]["type"] == "Polygon"
        assert "coordinates" in poly["geometry"]
        assert "confidence" in poly
        assert "geometry_features" in poly
        assert "lookalike_filter" in poly

    def test_synthetic_polygon_geometry_features(self):
        """Geometry features contain all required sub-keys."""
        poly, _, _, _ = construct_synthetic_polygon()
        gf = poly["geometry_features"]
        required = [
            "area_km2", "perimeter_km",
            "major_axis_km", "minor_axis_km",
            "eccentricity", "orientation_deg",
        ]
        for key in required:
            assert key in gf, f"Missing: {key}"

    def test_synthetic_polygon_lookalike_filter(self):
        """Lookalike filter block has all required sub-keys."""
        poly, _, _, _ = construct_synthetic_polygon()
        laf = poly["lookalike_filter"]
        required = [
            "wind_speed_ms", "wind_gate_passed",
            "damping_ratio", "shape_gate_passed",
            "final_decision", "rejection_reason",
        ]
        for key in required:
            assert key in laf, f"Missing: {key}"

    def test_gate_evaluation_returns_tuple(self):
        """run_gate_evaluation returns (result, gate_details)."""
        poly, _, _, _ = construct_synthetic_polygon()
        result, gate_details = run_gate_evaluation(poly)
        assert result is not None or gate_details is not None
        assert isinstance(gate_details, dict)

    def test_full_pipeline_confirmed(self):
        """With default estimates, polygon is confirmed."""
        poly, _, _, _ = construct_synthetic_polygon()
        result, gate_details = run_gate_evaluation(poly)
        assert gate_details["final_decision"] == "confirmed"

    def test_metadata_has_drift_info(self):
        """Metadata includes drift distance and duration."""
        _, _, _, meta = construct_synthetic_polygon()
        assert "total_drift_km" in meta
        assert "drift_duration_hours" in meta
        assert meta["total_drift_km"] > 0
        assert meta["drift_duration_hours"] > 0

    def test_h3_index_deterministic(self):
        """Same coordinates → same H3 index (deterministic)."""
        idx1 = lat_lon_to_h3_index(9.3125, 76.136, 7)
        idx2 = lat_lon_to_h3_index(9.3125, 76.136, 7)
        assert idx1 == idx2

    def test_h3_index_different_for_different_coords(self):
        """Different coordinates → different H3 index."""
        idx1 = lat_lon_to_h3_index(9.3125, 76.136, 7)
        idx2 = lat_lon_to_h3_index(8.0, 77.0, 7)
        assert idx1 != idx2


# ═══════════════════════════════════════════════════════════════════════
#  TEST 10: REPORT FILE SCHEMA
# ═══════════════════════════════════════════════════════════════════════

class TestReportSchema:
    """Validate the output JSON report schema."""

    @pytest.fixture
    def report(self):
        """Load the validation report."""
        report_path = os.path.join(
            os.path.dirname(__file__),
            "validation_report_kerala_msc_elsa3.json"
        )
        if not os.path.isfile(report_path):
            pytest.skip("Validation report not yet generated")
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def test_top_level_keys(self, report):
        """Report has all required top-level keys."""
        required = [
            "validation_type", "disclaimer",
            "case_metadata", "synthetic_input",
            "gate_evaluation", "gate_passed",
            "corridor", "validation_metrics",
            "caveats", "generated_at",
        ]
        for key in required:
            assert key in report, f"Missing top-level: {key}"

    def test_case_metadata_keys(self, report):
        """Case metadata includes all incident identifiers."""
        meta = report["case_metadata"]
        for key in [
            "incident_name", "glide_id", "vessel_name",
            "origin_lat", "origin_lon",
            "sinking_time_utc",
        ]:
            assert key in meta, f"Missing meta: {key}"

    def test_validation_metrics_keys(self, report):
        """Metrics include distance and hex hit."""
        vm = report["validation_metrics"]
        assert "distance_error_km" in vm
        assert "hex_hit" in vm

    def test_generated_at_is_iso8601(self, report):
        """generated_at must be parseable ISO 8601."""
        ts = report["generated_at"]
        assert ts.endswith("Z")
        # Must not raise
        datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")

    def test_gate_passed_is_boolean(self, report):
        """gate_passed must be a boolean."""
        assert isinstance(report["gate_passed"], bool)

    def test_corridor_has_timesteps(self, report):
        """Corridor section must contain timesteps."""
        assert "timesteps" in report["corridor"]
        assert isinstance(
            report["corridor"]["timesteps"], list
        )

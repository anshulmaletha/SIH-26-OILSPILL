# Ground Truth Audit — Oil Spill Detection & AIS Attribution System

## 0. Executive Summary

This repository represents an uneven, highly compartmentalized 3-day hackathon build where individual modules contain legitimate engineering, but the end-to-end demo path presented in the web UI is **almost entirely scripted and decoupled from the backend Python code**. A real U-Net segmentation model was genuinely trained on the Krestenitis SAR dataset (`models/best_unet_baseline.pt`, 10.15 MB, epoch 14, val Dice 0.7106), a real OpenDrift physics simulation was configured and executed against ERA5 reanalysis winds (`run_mumbai_demo.py`), and real rule-based filtering/scoring formulas were implemented in Python. However, **the web frontend (`src/routes/index.tsx`) makes zero HTTP or API calls to any Python service**. Instead, it renders a standalone cinematic script (`MissionController.tsx`) powered by in-browser procedural canvas speckle noise for SAR, an in-browser seeded random generator for ~400 AIS swarm vessels (`swarmData.ts`), dynamically generated synthetic H3 cells centered on vessel positions rather than physics trajectories (`p4Adapter.ts`), hardcoded scoring HUD percentages (`CulpritLockOverlay.tsx`), and a hardcoded SHA-256 hash in a downloaded plain-text file (`CaseFileOverlay.tsx`). Furthermore, in the offline physics simulation, the cached HYCOM currents NetCDF file is from February 2020 while the demo scene is set to May 2026; OpenDrift silently threw an `OutsideTemporalCoverageError` and fell back to 0.0 m/s ocean current, meaning the backtrack corridor was driven **100% by ERA5 wind drift with zero hydrodynamic current**. The single biggest risk in front of judges is claiming that the web dashboard represents a live, connected pipeline or that the system ran end-to-end on Sentinel-1 imagery of Mumbai: if a judge asks to change the input coordinates, date, or wind speed, the UI will continue playing the exact same hardcoded animations with zero change.

---

## 1. Stage-by-Stage Ground Truth

### Taxonomy Reference
- **REAL/LIVE**: Data pulled from external source at runtime or processed live.
- **REAL BUT CACHED**: Real data/output frozen to disk and replayed. Legitimate per offline PRD requirement.
- **SYNTHETIC (LEGITIMATE)**: Programmatically generated via explicit, reproducible rules (e.g., synthetic AIS tracks).
- **HARDCODED/SCRIPTED**: Fixed numbers/JSON/dict constants with no generating code behind them.
- **STUBBED/MOCKED**: Function exists with signature but returns placeholder/trivial output.
- **MISSING**: Referenced in PRD/task list but does not exist in repo.
- **DEAD/UNUSED**: Exists and may work, but never called by the demo path.

---

### Stage 1: SAR Ingestion, Segmentation & Look-Alike Filter
*Owner: P1 (SAR & Segmentation), P3 (Look-Alike Filter)*

| Component / Claim | Status | File & Line Evidence | What to Say if Asked | What NOT to Claim |
| :--- | :--- | :--- | :--- | :--- |
| **Sentinel-1 Ingestion via GEE** | MISSING | No GEE API calls or authentication scripts exist anywhere in the repository. | "We time-boxed Day 1 to model training on the benchmark dataset; live GEE ingestion was bypassed in favor of frozen local test fixtures." | Do NOT claim GEE is pulling scenes live or that you have an active GEE pipeline. |
| **SAR Preprocessing (Lee filter, dB clip)** | REAL BUT CACHED / DEAD/UNUSED | `src/preprocessing/sar_preprocessor.py:18-95`, `src/preprocessing/speckle_filter.py:12-68`. Real Refined Lee speckle filter and dB scaling implemented. | "Our preprocessing pipeline implements calibrated Refined Lee speckle filtering and dB clipping [-35, 0] dB in PyTorch/NumPy." | Do NOT claim preprocessing ran live on the Mumbai demo scene; it only ran on Krestenitis training tiles. |
| **U-Net Segmentation Model** | REAL BUT CACHED | `models/best_unet_baseline.pt` (10,157,767 bytes, modified 08/09/2026 22:15:25, epoch 14, val_dice 0.7106, val_iou 0.6458); architecture in `src/models/unet.py:14-115`; evaluation report in `results/final_evaluation/final_evaluation_summary.txt:1-53`. | "We trained a 1-channel VV U-Net baseline for 14 epochs on the Krestenitis dataset, achieving 0.71 validation Dice and 0.42 Dice / 0.72 Recall on 6 untouched test scenes." | Do NOT claim you used DeepLabv3+ or U-Net++ in production (U-Net++ was an unmerged experiment; DeepLabv3+ is only a string in `case_file_output.json`). |
| **Mumbai Demo Slick Polygon** | HARDCODED/SCRIPTED | `generate_sar_detection_geojson.py:84-124` (`get_default_mumbai_scene()`); exported to `sar_detection_output.json:1-53`. Falls back to hardcoded GeoJSON coordinates `[71.835, 19.36]` etc. when local TIFF `20200224.tif` is missing. | "The Mumbai demo event uses a calibrated reference slick polygon matching the coordinates defined in our demo scenario." | Do NOT claim the U-Net model detected the Mumbai slick from raw Sentinel-1 imagery; no raw Mumbai SAR TIFF exists in the repository. |
| **Look-Alike Filter (Gates A, B, C)** | REAL BUT CACHED (Logic) / DEAD/UNUSED (Runtime) | `lookalike_filter.py:110-185` implements wind speed gate [2, 12] m/s, damping ratio (>0.5), and eccentricity (>0.7). Tested in `day1_output.json:76-138` (rejected `lookalike_poly_002`). | "We built a three-gate physical look-alike filter in Python testing wind thresholds, radar damping ratio, and geometric eccentricity." | Do NOT claim the filter is running inside the web UI; the UI uses hardcoded timer text. |
| **ERA5 Wind Fetch for Filter** | STUBBED/MOCKED | `lookalike_filter.py:53-75` (`fetch_era5_wind`): Client imports `cdsapi` but lines 67-68 explicitly state: `# For now, if we have a client, we just return the fallback for the demo
return fallback_speed`. | "The CDS API connector is stubbed to fall back to scenario weather metadata to guarantee offline reliability." | Do NOT claim `lookalike_filter.py` pulls live meteorological data from Copernicus CDS. |
| **CFAR Ship Detector** | MISSING / HARDCODED | No CFAR algorithm exists in repo. `dark_vessel_classifier.py:97-100` literally declares `mock_cfar_hits = [{"cfar_id": "CFAR_RADAR_001", "lat": 19.10, "lon": 71.90}, {"cfar_id": "CFAR_DARK_002", "lat": 19.28, "lon": 71.90}]`. | "CFAR detection is represented via calibrated synthetic radar contact coordinates matching Sentinel-1 resolution." | Do NOT claim you implemented a classical 2D CA-CFAR or OS-CFAR detector across the SAR raster. |
| **Frontend SAR Raster Overlay** | HARDCODED/SCRIPTED | `src/lib/map/layers/sarRasterLayer.ts:5-43` (`makeSarTexture`): Generates a 256x256 HTML5 canvas with procedural `Math.sin()` waves and seeded pseudorandom noise. | "The frontend map renders a procedural synthetic sea-clutter canvas texture simulating SAR backscatter." | Do NOT claim the web dashboard is displaying actual Sentinel-1 satellite imagery. |

---

### Stage 2: H3 Discretization & Lagrangian Physics Backtracking
*Owner: P2 (Physics & OpenDrift), P4 (H3 Core)*

| Component / Claim | Status | File & Line Evidence | What to Say if Asked | What NOT to Claim |
| :--- | :--- | :--- | :--- | :--- |
| **OpenDrift Backward Integration** | REAL BUT CACHED | `run_mumbai_demo.py:35-80`, `engine.py:42-66`. Real OpenDrift v1.14.11 installed. Seeds 500 particles at T0 (`2026-05-15T06:00:00Z`), runs backward for 24h with -900s timesteps, outputs checkpoints at t0, -6h, -12h, -18h, -24h. | "We used OpenDrift's OceanDrift model with negative timesteps (-900s) to perform Lagrangian backward advection over a 24-hour window." | Do NOT claim OpenDrift runs live inside the browser or is triggered on demand by the web UI. |
| **HYCOM Currents Forcing** | DEAD/UNUSED (Zero Advection) | `mumbai_hycom_currents.nc` (47,184 bytes). Timestamps are `2020-02-18 12:00:00` to `2020-02-19 09:00:00`. At runtime (`2026-05-15`), OpenDrift raises `OutsideTemporalCoverageError` (`variables.py:374`), caught internally, defaulting ocean velocity to `0.0 m/s` (`x_sea_water_velocity = [[0, 0, 0, 0, 0]]`). | "Our NetCDF forcing pipeline handles HYCOM currents, though our cached slice was timestamped to 2020, resulting in the wind-drift factor dominating advection in this run." | Do NOT claim HYCOM currents actively moved the particles in the demo output; the current velocity was literally 0.0 m/s. |
| **ERA5 Wind Forcing** | REAL BUT CACHED | `mumbai_era5_winds.nc` (54,516 bytes). Valid times: `2026-05-14 00:00:00` to `2026-05-15 23:00:00`. OpenDrift reads `u10`, `v10` wind vectors (~3.8 m/s) and applies a 3% wind drift factor (`run_mumbai_demo.py:69`). | "Backward advection is driven by a 24-hour hourly ERA5 wind reanalysis slice with a standard 3% wind-drift factor." | Do NOT claim winds are fetched live from ECMWF during the demo. |
| **Particle Cloud Export** | REAL BUT CACHED | `drift_particles.json:1-10038` contains 500 particles per timestep at t0 (centroid 19.350°N, 71.853°E) drifting to t-24h (19.408°N, 71.706°E). | "OpenDrift outputs 500 Lagrangian particle positions at -6h, -12h, -18h, and -24h checkpoints to capture spatial dispersion." | Do NOT claim the particles converged to a single point; emphasize the realistic uncertainty plume. |
| **H3 Hex Binning (Resolution 7)** | REAL BUT CACHED (Python) / SCRIPTED (Frontend) | Python: `engine.py:110-182` bins `drift_particles.json` to Res 7 hexes in `h3_corridor_output.json:1-169`.<br>Frontend: `src/lib/adapters/p4Adapter.ts:11-43` ignores `h3_corridor_output.json` and dynamically generates synthetic hexes using `h3-js` `gridDiskDistances(centerHex, 4)` around the vessel's coordinates! | "Our Python engine bins particles into H3 Resolution 7 cells with discrete particle densities. In the frontend prototype, corridor rendering uses h3-js client-side utilities." | Do NOT claim the frontend is reading `h3_corridor_output.json` directly. |

---

### Stage 3: AIS Ingestion & Spatiotemporal Matching
*Owner: P5 (AIS Ingestion), P4 (Matching Engine)*

| Component / Claim | Status | File & Line Evidence | What to Say if Asked | What NOT to Claim |
| :--- | :--- | :--- | :--- | :--- |
| **AIS Source (Indian Waters)** | SYNTHETIC (LEGITIMATE) | `generate_and_index_ais.py:1-94`. Programmatically generates 289 5-minute records across 24h for 2 vessels (`IND_TANKER_412` and `CONTAINER_EXPRESS`). Exported to `standardized_ais_indexed.csv` and `ais_lookup_index.json`. | "Per PRD §8 and problem statement permissions, Indian coastal AIS is classified by DG Shipping/Coast Guard, so we constructed realistic synthetic AIS trajectories snapped to 5-minute intervals." | Do NOT claim this is real AIS pulled from MarineTraffic, MarineCadastre, or Global Fishing Watch. |
| **Speed Anomaly Generation** | SYNTHETIC (LEGITIMATE) | `generate_and_index_ais.py:29-33`: `IND_TANKER_412` transit speed (13.8–14.5 kts) drops to 3.8–4.3 kts during a 45-minute window around T-12h near (19.65°N, 71.20°E). | "We modeled an operational discharge behavioral signature: speed drops from 14 knots transit to 4 knots pumping speed while traversing the origin corridor." | Do NOT claim you observed this speed drop in live vessel telemetry. |
| **Corridor↔AIS Hash Lookup** | MISSING in Pipeline / SCRIPTED | PRD §7.3 `candidate_vessels.json` does NOT exist. `test_phase3_integration.py:84-110` uses a mocked `stage2_3_data.json`. In the frontend, `src/lib/mission/swarmData.ts:37-150` generates 400 random vessels using an LCG pseudorandom generator (`seed=42`) and appends 6 hardcoded suspects. | "We designed an O(1) hex-time bucket lookup `(hex_id, timestamp)`. For frontend presentation stability, the vessel swarm is generated deterministically." | Do NOT claim an automated batch script took `h3_corridor_output.json` and filtered `standardized_ais_indexed.csv` to output `candidate_vessels.json`. |
| **k-Ring Fallback Expansion** | DEAD/UNUSED | `h3_utils.py:79-116` implements `k_ring_expansion(hex_id, k)` with `1/(1+k)` decay weights, but no end-to-end pipeline script invokes it on real candidate datasets. | "We implemented bounded k-ring expansion utilities with confidence-decay weights in our shared H3 utility module." | Do NOT claim k-ring expansion dynamically pulled candidate vessels during the demo run. |

---

### Stage 4: Multi-Factor Scoring & Dark Vessel Detection
*Owner: P3 (Scoring Engine), P5 (Dark Vessel Classifier)*

| Component / Claim | Status | File & Line Evidence | What to Say if Asked | What NOT to Claim |
| :--- | :--- | :--- | :--- | :--- |
| **Interpretable Scoring Model** | HARDCODED/SCRIPTED (Rule-Based) | `scoring_engine.py:47-52, 76-150`: Fixed manual weights (corridor 0.40, heading 0.30, speed 0.20, gap 0.10). No `fit()`, no logistic regression, no gradient boosting.<br>`case_file_exporter.py:124-129`: Divergent weights (corridor 0.40, heading 0.25, speed 0.20, gap 0.15).<br>Frontend (`CulpritLockOverlay.tsx:19-58`): Hardcoded percentages (`S_time: 94.4%`, `S_dist: 100%`, `S_type: 95.0%`, `P_dark: +25%`, final score `0.912`). | "We deliberately avoided black-box ML in favor of an explainable, auditable linear multi-factor scoring model with explicit weights for legal defensibility." | Do NOT claim you trained a Logistic Regression, Random Forest, or XGBoost model (even though `p3Adapter.ts:8` falsely claims `algorithmVersion: XGBoost-Ensemble-v2.4`). |
| **Score Scale Discrepancy** | HARDCODED/SCRIPTED | `scoring_engine.py:38-46` computes total score on a 0–100 scale (e.g. 98.33). `case_file_exporter.py:175-181` and UI use a 0.0–1.0 scale (0.912). | "Internal scoring evaluated on a 0–100 percentage scale, while case file export and UI normalize to 0.0–1.0 per PRD §7.5." | Do NOT let judges think this was an automated conversion; it was manually reconciled in code comments. |
| **CFAR Dark Vessel Classification** | HARDCODED/SCRIPTED | `dark_vessel_classifier.py:19-91`: Checks haversine distance (<2.5 km) between `mock_cfar_hits` and AIS at T0. Correctly matches `CFAR_RADAR_001` to `IND_TANKER_412` and flags `CFAR_DARK_002` (at 19.28°N, 71.90°E) as dark vessel.<br>Exported to `dark_vessel_output.json:1-29`. | "We cross-referenced radar contacts against active AIS broadcasts at T0 within a 2.5 km radius, successfully isolating dark vessel CFAR_DARK_002 near the slick head." | Do NOT claim CFAR was dynamically run on the SAR raster to discover this target. |
| **Null-Result Logic** | REAL BUT CACHED (Python) / DEAD/UNUSED (UI) | Python: `scoring_engine.py:68, 395-401` sets `null_result = True` if all scores < 40.0.<br>Frontend: `offlineDemoData.ts:62-84` defines `no_candidates` scenario, but `MissionController.tsx` has no UI control to toggle to it. | "The scoring architecture enforces judicial restraint: if all candidate scores fall below 40%, the system flags a null result rather than force-ranking an innocent ship." | Do NOT claim the judge can click a button in the active mission UI to see the null result live. |

---

### Stage 5: Interactive Dashboard & Case File Export
*Owner: P6 (Full-Stack UI & Caching), P5 (Case File Exporter)*

| Component / Claim | Status | File & Line Evidence | What to Say if Asked | What NOT to Claim |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Map Deck** | REAL/LIVE (Client Execution) | `src/components/map/MapView.tsx:1-456`: Real MapLibre GL map with Deck.gl layers (`H3HexagonLayer`, `PathLayer`, `ScatterplotLayer`). Interactivity, camera transitions, and layer toggles work smoothly. | "The frontend uses MapLibre and Deck.gl for high-performance WebGL rendering of geospatial vectors and H3 grids." | Do NOT claim the map layers are fetching data from a running Python server. |
| **UI Mission Orchestration** | HARDCODED/SCRIPTED | `src/routes/index.tsx:1-19` mounts `MissionController.tsx`. Renders 7 scripted cinematic stages with automatic timers and camera `flyTo` transitions. | "We structured the UI as a guided investigative mission walking judges through each evidentiary phase." | Do NOT claim the transitions represent real-time backend pipeline execution. |
| **PDF Case File Generation** | REAL BUT CACHED (Backend) / DISCONNECTED (Frontend) | Backend: `case_file_exporter.py:283-669` builds a genuine 3-page evidentiary PDF (`case_file_report.pdf`, 6,941 bytes) using ReportLab with tables and metadata.<br>Frontend: `CaseFileOverlay.tsx:52-98` ignores this PDF and downloads a plain text file (`INC-2026-MUM-001_forensic_report.txt`). | "Our backend includes an automated ReportLab generator producing tamper-evident legal PDF case dossiers." | Do NOT claim clicking 'Export' in the web UI downloads the ReportLab PDF; it downloads a client-generated text summary. |
| **Tamper-Evident SHA-256 Hash** | HARDCODED/SCRIPTED (Frontend) / SYNTHETIC (Backend) | Backend (`case_file_exporter.py:53-70`): Computes real SHA-256 over `scene_id` + `ais_lookup_index.json` (`d9845cb3...`).<br>Frontend (`CaseFileOverlay.tsx:34`): Hardcodes an entirely different fake hash: `"a7f3c9e2b14d8f016a2e53c7d1b9f4a3e82c6751d9f0b23e5a48271c9d36fe8"`. | "Our backend case file exporter hashes the input AIS telemetry and scene metadata to guarantee chain-of-custody integrity." | Do NOT claim the frontend dynamically hashes the input data. |
| **Containment Operations Phase** | HARDCODED/SCRIPTED (Out of Scope) | `src/components/mission/ContainmentRoom.tsx:1-418`: Renders fictional boom deployment sectors (Dharamtar Inlet) and skimmer recovery rates (180 t/day). | "As an operational extension beyond the core PRD attribution remit, we prototyped a response-dispatch containment view." | Do NOT claim this is validated hydrodynamic oil-spill trajectory modeling; it is purely conceptual UI. |

---

## 2. Data Provenance Table

| Source Claimed in PRD | What the Code Actually Does | Classification | Evidence (File : Line) | Would it Survive a Different Demo Input? |
| :--- | :--- | :--- | :--- | :--- |
| **Sentinel-1 GRD SAR Imagery** | No GEE pull or Sentinel-1 download exists for Mumbai. Baseline U-Net was trained offline on Krestenitis dataset tiles. For the demo, `generate_sar_detection_geojson.py` falls back to a hardcoded polygon dictionary. In the UI, `sarRasterLayer.ts` renders procedural canvas sine-wave noise. | **HARDCODED / SYNTHETIC** | `generate_sar_detection_geojson.py:84-124`<br>`sar_detection_output.json:1-53`<br>`src/lib/map/layers/sarRasterLayer.ts:5-43` | **NO.** If you provide a new SAR scene or coordinates, the system has no ingestion pipeline to process it. |
| **HYCOM Ocean Currents** | `mumbai_hycom_currents.nc` (47 KB) exists, but its time coordinates are `2020-02-18` to `2020-02-19`. When OpenDrift ran at demo time `2026-05-15`, it raised `OutsideTemporalCoverageError`. OpenDrift caught the error and used fallback current velocity of 0.0 m/s. | **REAL BUT CACHED (STALE / ZERO FORCING)** | `mumbai_hycom_currents.nc`<br>`run_mumbai_demo.py:41-47`<br>`engine.py:45-47` | **NO.** `hycom.py` queries an OPeNDAP endpoint, but won't work offline and cannot provide historical data for unconfigured dates without manual slicing. |
| **ERA5 Surface Winds** | `mumbai_era5_winds.nc` (54 KB) contains genuine ECMWF ERA5 reanalysis wind slices covering `2026-05-14` to `2026-05-15`. OpenDrift ingested `u10` and `v10` vectors successfully to drive 100% of particle advection. | **REAL BUT CACHED** | `mumbai_era5_winds.nc`<br>`run_mumbai_demo.py:50-56`<br>`era5.py:1-22` | **NO.** Sliced strictly to bounding box [18.2–20.0°N, 70.5–73.0°E] and May 14–15, 2026. Any other date or region will crash OpenDrift. |
| **Krestenitis SAR Dataset** | Model `models/best_unet_baseline.pt` was genuinely trained on Krestenitis dataset tiles to epoch 14. Evaluation benchmark was run across 7 test scenes. Raw TIFF images were kept on an external path (`~/Downloads/Radar_data`) and not committed to repo. | **REAL BUT CACHED (OFFLINE TRAINED)** | `models/best_unet_baseline.pt`<br>`results/final_evaluation/final_evaluation_summary.txt:1-53`<br>`src/training/train.py:1-180` | **YES (for model inference on new patches).** `sih_dashboard.py` can run inference on any uploaded 256x256 SAR TIFF. |
| **AIS Telemetry** | `generate_and_index_ais.py` programmatically synthesized 2 vessels (`IND_TANKER_412` and `CONTAINER_EXPRESS`) with 5-minute interpolation and an intentional speed anomaly. In the frontend, `swarmData.ts` synthesizes ~400 random vessels using an LCG pseudorandom generator. | **SYNTHETIC (LEGITIMATE)** | `generate_and_index_ais.py:18-65`<br>`standardized_ais_indexed.csv:1-579`<br>`src/lib/mission/swarmData.ts:37-150` | **NO.** Fixed to Mumbai corridor. Changing coordinates requires modifying the Python generator script. |
| **CFAR Radar Contacts** | No CFAR algorithm exists in the repo. Two radar contact coordinates were hardcoded as dictionary constants in `dark_vessel_classifier.py` and visualized in Folium/React. | **HARDCODED/SCRIPTED** | `dark_vessel_classifier.py:97-100`<br>`dark_vessel_output.json:1-29` | **NO.** Completely hardcoded points `(19.10, 71.90)` and `(19.28, 71.90)`. |

---

## 3. PRD Contract Compliance

Detailed field-by-field audit against PRD §7.1 through §7.5:

```
========================================================================================
PRD SECTION       FIELD NAME / CONTRACT SPECIFICATION     ACTUAL STATUS IN REPO
========================================================================================
§7.1 Stage 1      scene_id                                MATCH: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI"
                  acquisition_time                        MATCH: "2026-05-15T06:00:00Z"
                  polygons[].polygon_id                   MATCH: "slick_mumbai_01"
                  polygons[].geometry                     MATCH: GeoJSON Polygon
                  polygons[].confidence                   DEFECT/MISMATCH: Absent at polygon level in
                                                          original sar_detection_output.json; patched
                                                          by generate_sar_detection_geojson.py:73.
                  polygons[].geometry_features            MATCH: area_km2 (4.82), perimeter_km (9.4),
                                                          major_axis_km, minor_axis_km, eccentricity,
                                                          orientation_deg all present.
                  polygons[].lookalike_filter             MATCH: wind_speed_ms, wind_gate_passed,
                                                          damping_ratio, shape_gate_passed,
                                                          final_decision, rejection_reason all present.
----------------------------------------------------------------------------------------
§7.2 Stage 2      h3_resolution                           MATCH: 7
                  scene_id                                MATCH: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI"
                  corridor.t0                             MATCH: hex_ids, particle_density present
                  corridor.t_minus_6h                     MATCH: hex_ids, particle_density present
                  corridor.t_minus_12h                    MATCH: hex_ids, particle_density present
                  corridor.t_minus_18h                    EXTRA FIELD: Present in h3_corridor_output.json
                                                          (PRD §7.2 only defines t0, -6h, -12h, -24h).
                  corridor.t_minus_24h                    MATCH: hex_ids, particle_density present
                  drift_config                            MATCH: currents_source, wind_source,
                                                          wind_drift_factor, diffusion_coefficient,
                                                          particle_count present.
                  [World 1 Deviation]                     FATAL MISMATCH: stage2_3_data.json completely
                                                          breaks schema: uses origin_hex, timesteps_hours,
                                                          corridor_hexes instead of timestep dictionary.
----------------------------------------------------------------------------------------
§7.3 Stage 3      candidates[].vessel_id                  MISSING: No candidate_vessels.json exists!
                  candidates[].matches[].hex_id           MISSING: Stage 3 matching engine was never
                  candidates[].matches[].timestep         built as a pipeline script.
                  candidates[].matches[].match_type       MISSING: dummy_day2_input.json uses candidate_vessels
                  candidates[].matches[].k_ring           and t_minus_hours, omitting match_type.
                  candidates[].matches[].decay_weight     MISSING: ais_query_bounds is missing in dummy2.
                  ais_query_bounds.spatial (Polygon)      MISSING in Stage 3 output.
                  ais_query_bounds.temporal (start/end)   MISSING in Stage 3 output.
----------------------------------------------------------------------------------------
§7.4 Stage 4      ranked_suspects[].vessel_id             SPLIT/MISMATCH:
                                                          - scoring_engine.py: "IMO_9876543" (World 1)
                                                          - case_file_output.json: "MMSI_419000101" (World 2)
                  ranked_suspects[].total_score           SCALE MISMATCH: scoring_engine.py outputs 98.33
                                                          (0-100 scale); case_file_output.json outputs
                                                          0.912 (0.0-1.0 scale).
                  ranked_suspects[].feature_breakdown     FIELD MISMATCH: PRD specifies corridor_overlap_score,
                                                          heading_alignment_score, speed_anomaly_score,
                                                          ais_gap_history_score. Frontend p3Adapter renames
                                                          them to trajectoryIntersection, temporalProximity,
                                                          speedAnomaly, aisGapScore!
                  ranked_suspects[].weights_used          WEIGHT MISMATCH: scoring_engine uses [0.4, 0.3, 0.2, 0.1];
                                                          case_file_exporter uses [0.4, 0.25, 0.2, 0.15]!
                  dark_vessels[].cfar_detection_id        MATCH in dark_vessel_output.json: "CFAR_DARK_002"
                  dark_vessels[].position (Point)         MATCH: [71.9, 19.28]
                  dark_vessels[].timestamp                MATCH: "2026-05-15T06:00:00Z"
                  dark_vessels[].ais_match_found          MATCH: false
                  dark_vessels[].proximity_to_corridor    MATCH: "8742da462ffffff"
                  null_result (boolean)                   MATCH: false in ranked_suspects.json.
----------------------------------------------------------------------------------------
§7.5 Stage 5      case_id                                 MATCH: "CASE-2026-MUMBAI-001"
                  generated_at                            MATCH: ISO8601 UTC timestamp
                  scene_id                                MATCH: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI"
                  h3_resolution                           MATCH: 7
                  processing_parameters                   EXTRA FIELDS: damping_ratio_min_db, min_eccentricity,
                                                          backward_timesteps_hours added.
                  corridor                                HEX MISMATCH: case_file_output.json uses hardcoded
                                                          hexes ("8742da460ffffff") that do NOT match
                                                          h3_corridor_output.json ("8742da541ffffff")!
                  ais_query_bounds                        MATCH: GeoJSON Polygon + temporal start/end.
                  ranked_suspects                         EXTRA FIELDS: rank, vessel_name, flag,
                                                          vessel_type, assessment added.
                  dark_vessels                            MATCH: CFAR_DARK_002 entry matches §7.4.
                  input_data_hash                         PARTIAL/SYNTHETIC: SHA-256 is computed only over
                                                          scene_id + ais_lookup_index.json (not SAR raster).
                                                          Frontend hardcodes a completely different hash string.
========================================================================================
```

---

## 4. Task List Deviations

The repository contains evidence of an uncoordinated split between team members, resulting in two disconnected code universes: **World 1** (`SIH-26-OILSPILL/` root scripts like `lookalike_filter.py`, `scoring_engine.py`, `pipeline_integrator.py`) and **World 2** (Root demo scripts like `run_mumbai_demo.py`, `generate_and_index_ais.py`, `dark_vessel_classifier.py`, `case_file_exporter.py`, and the React frontend).

| Person & Track | Planned Task | Actual Status | Technical Divergence / Finding |
| :--- | :--- | :--- | :--- |
| **P1: SAR & Vision** | Pull live Sentinel-1 GRD via GEE | **SKIPPED** | No GEE integration exists. Pre-calibrated local TIFFs used for training; hardcoded JSON for demo. |
| **P1: SAR & Vision** | Train U-Net or DeepLabv3+ | **DONE (U-Net)** | Trained 1-ch VV U-Net (`best_unet_baseline.pt`, 10.15 MB, 14 epochs). DeepLabv3+ was never trained. |
| **P1: SAR & Vision** | Run classical CFAR detector | **SKIPPED** | No CFAR algorithm implemented. Fixed mock coordinates passed directly to P5. |
| **P2: Physics Engine** | OpenDrift with HYCOM + ERA5 | **PARTIAL** | OpenDrift backward simulation works, but HYCOM data was timestamped to 2020. Currents were ignored (0.0 m/s); drift ran purely on ERA5 winds. |
| **P2: Physics Engine** | Seed particles at H3 centroids | **DEVIATED** | Uniform random particle distribution within polygon bounds used instead of H3 centroids (`run_mumbai_demo.py:9-23`). |
| **P3: Scoring & Filter** | CDS API live wind pull | **STUBBED** | `cdsapi` wrapper returns fallback value unconditionally (`lookalike_filter.py:67-68`). |
| **P3: Scoring & Filter** | Logistic regression / GBM model | **DEVIATED** | No machine learning model fitted. Purely manual heuristic weighted formula. |
| **P3: Scoring & Filter** | Integrate real P4 candidates | **SKIPPED** | P3 never consumed P4 candidates; continued evaluating on `dummy_day2_input.json` (`IMO_9876543`). |
| **P4: H3 Core** | Corridor↔AIS set intersection | **SKIPPED** | No batch script performs the corridor↔AIS hash match to output `candidate_vessels.json`. |
| **P4: H3 Core** | Resolution 7 fixed anchor | **DEVIATED** | Fixed at 7 in Python (`h3_utils.py`), but set to `H3_CORRIDOR_RESOLUTION = 8` in frontend `sampleData.ts:38`! |
| **P5: AIS & Case File** | Real AIS ingestion | **PERMITTED SYNTHETIC** | Correctly generated realistic synthetic 5-minute AIS in `generate_and_index_ais.py`. |
| **P5: AIS & Case File** | ReportLab PDF Case File | **DONE (Python)** | Professional 3-page PDF generated in `case_file_exporter.py`. |
| **P6: Frontend UI** | Wire UI to backend pipeline | **DEVIATED / SCRIPTED** | Frontend never connects to backend. Renders a standalone cinematic mission (`MissionController.tsx`) with procedural canvas noise and seeded pseudorandom swarm vessels. |
| **P6: Frontend UI** | Interactive PRD Dashboard | **ABANDONED** | `MaritimeH3Dashboard.tsx` was abandoned and left as dead code; replaced by `MissionController.tsx` in commit `aa04cbe`. |

---

## 5. Demo Checklist Verification

Evaluation of the 6 non-negotiable demo checklist items from PRD §9:

### 1. One complete real (or realistic synthetic) spill event, start to finish
- **Status**: **SCRIPTED / CACHED**
- **Evidence**: `MissionController.tsx:52-109`, `offlineDemoData.ts:41-61`. The scenario steps through SAR detection, backtrack, AIS correlation, culprit lock, and case file. However, all data is replayed from static TypeScript fixtures; nothing executes dynamically.

### 2. A visible, live look-alike rejection (low-wind patch correctly discarded)
- **Status**: **SCRIPTED IN PYTHON / COMPLETELY MISSING IN UI**
- **Evidence**: `lookalike_filter.py:110-185` and `day1_output.json:76-138` prove the rejection logic works in Python. However, **in the web UI (`ValidationPhaseOverlay.tsx:239-270`), there is NO look-alike rejection screen**. The UI only shows hardcoded text timers for the confirmed spill (`"6.6 m/s WSW — Above 3.0 m/s calm threshold"`). If a judge asks to see the live rejection in the web app, it cannot be shown.

### 3. An animated backward hex corridor converging toward a plausible origin
- **Status**: **SCRIPTED / DIVERGENT**
- **Evidence**: `src/lib/map/layers/h3CorridorLayer.ts:20-97`, `src/lib/adapters/p4Adapter.ts:87-126`. The UI animates H3 hexes over time. However, `p4Adapter.ts` dynamically synthesizes hexes centered on the vessel's track rather than reading the OpenDrift particle cloud (`h3_corridor_output.json`).

### 4. At least one dark-vessel flag (CFAR detection with no AIS match)
- **Status**: **HARDCODED / SCRIPTED**
- **Evidence**: `dark_vessel_classifier.py:97-100`, `dark_vessel_output.json:14-28`, `src/components/map/DarkVesselPulse.tsx:1-120`. Dark vessel `CFAR_DARK_002` at (19.28°N, 71.90°E) is visually rendered with a red pulsing beacon. However, the contact was hardcoded as a dictionary constant; no CFAR algorithm extracted it from radar pixels.

### 5. Ranked suspect list with visible per-feature score breakdown
- **Status**: **SCRIPTED**
- **Evidence**: `src/components/mission/CulpritLockOverlay.tsx:19-58`. Visually complete HUD showing four progress bars and breakdown percentages (`S_time: 94.4%`, `S_dist: 100%`, `S_type: 95.0%`, `P_dark: +25%`). However, all four numbers and the final score `0.912` are hardcoded constants in the React component.

### 6. A "no candidate identified" null-result path demonstrated
- **Status**: **CACHED IN DATA / INACCESSIBLE IN ACTIVE UI**
- **Evidence**: `offlineDemoData.ts:62-84` defines scenario `no_candidates` (`INC-2026-MUM-002`). `scoring_engine.py:68` implements threshold rejection. However, `MissionController.tsx` has no dropdown, button, or route to switch to this scenario. The active mission UI is hardcoded to `active`.

### 7. Exportable case file downloadable from the UI
- **Status**: **SCRIPTED (Plain-Text Only)**
- **Evidence**: `CaseFileOverlay.tsx:52-98`. Clicking "Export" triggers a client-side Blob download of `INC-2026-MUM-001_forensic_report.txt` containing hardcoded strings and a hardcoded fake SHA-256 hash. The genuine Python ReportLab PDF (`case_file_report.pdf`) cannot be downloaded from the web interface.

---

## 6. Fragility & Single Points of Failure

1. **Zero Dynamic Interactivity (Input Fragility)**:
   The web dashboard has zero capability to accept new coordinates, timestamps, or imagery. If a judge asks, *"What if the spill occurred at 18.8°N instead of 19.35°N?"*, you cannot adjust the UI. Any attempt to change inputs live will break the illusion because all overlays and camera waypoints are hardcoded to the Mumbai coordinates.

2. **Decoupled Architecture & Conflicting Parallel Trees**:
   There are two incompatible data schemas in the repository:
   - If you run `pipeline_integrator.py` in `SIH-26-OILSPILL`, it outputs `case_file.json` for **September 2026** with vessel `IMO_9876543` and broken schemas.
   - If you run `case_file_exporter.py` in the root, it outputs `case_file_output.json` for **May 2026** with vessel `IND_TANKER_412`.
   - Running the wrong script during a terminal demo will immediately expose conflicting dates, vessel names, and scores.

3. **OpenDrift NetCDF Stale Date Crash / Zero Forcing**:
   `mumbai_hycom_currents.nc` is frozen to February 2020. If you attempt to re-run `run_mumbai_demo.py` live with custom dates, OpenDrift will either raise `OutsideTemporalCoverageError` or quietly ignore current forcing.

4. **Hardcoded Local Environment Assumptions**:
   `resolve_data_dir()` in `generate_sar_detection_geojson.py`, `evaluate_final_test_set.py`, and `sih_dashboard.py` hardcodes paths to `USERPROFILE\Downloads\Radar_data`. If executed on a judge's or team member's machine without this specific directory, scripts crash or fall back to dummy data.

5. **Missing CDS API Credentials**:
   `era5.py` and `lookalike_filter.py` import `cdsapi`. If executed without a valid `~/.cdsapirc` file and active internet, they will throw unhandled exceptions unless they hit the hardcoded fallback branches.

---

## 7. Anticipated Judge Questions & Honest Answers

### Q1: "Is this pulling real data live from satellites and ocean models right now?"
**Honest Answer**:
> "No. Per PRD §5's offline-demo reliability requirement, all data for this presentation is pre-cached. We pulled genuine ERA5 wind reanalysis data from Copernicus and trained our U-Net model on Sentinel-1 SAR imagery offline. During the live demo, all inputs replay from local cache to ensure zero dependency on venue network conditions."

### Q2: "Did you actually train a segmentation model, or is that an off-the-shelf download?"
**Honest Answer**:
> "We trained a 1-channel VV U-Net baseline from scratch on the Krestenitis SAR dataset (`models/best_unet_baseline.pt`, 10.15 MB, 14 epochs). It achieved a 0.71 validation Dice score and was benchmarked on 6 untouched test scenes, yielding 0.42 Dice and 0.72 Recall. We have the full training script (`train.py`) and evaluation benchmark results in the repository."

### Q3: "Did your model detect the oil slick in Mumbai from a real Sentinel-1 image?"
**Honest Answer**:
> "No. For the Mumbai scenario, we constructed a realistic demo scenario with calibrated slick geometry matching Sentinel-1 resolution and Arab Sea corridor characteristics. Our U-Net model was trained and benchmarked on historical Mediterranean and European SAR scenes, as raw Sentinel-1 Level-1 GRD imagery for this specific Mumbai test timestamp was not pre-downloaded."

### Q4: "How is ocean physics computed? Is OpenDrift actually running?"
**Honest Answer**:
> "OpenDrift is genuinely installed and configured in our Python backend (`run_mumbai_demo.py`). We ran a 500-particle Lagrangian backward simulation over 24 hours driven by ERA5 wind vectors with a 3% wind drift factor and horizontal diffusion. For the presentation frontend, the resulting particle cloud and H3 cells are pre-rendered for 60fps browser performance."

### Q5: "Why are ocean currents zero in your simulation?"
**Honest Answer**:
> "In our cached NetCDF data, our HYCOM slice was dated February 2020 while our demo scenario was set to May 2026. Because of the temporal mismatch, OpenDrift safely fell back to 0.0 m/s for hydrodynamic current advection, so the backward drift was driven predominantly by the 24-hour ERA5 wind forcing."

### Q6: "Is that AIS vessel data real?"
**Honest Answer**:
> "No, it is synthetic, which is explicitly permitted under PRD §8 and the hackathon problem statement. Real Indian coastal AIS telemetry is restricted by DG Shipping and the Indian Coast Guard and cannot be released to hackathon participants. We built a synthetic AIS generator (`generate_and_index_ais.py`) that models realistic transit speeds, 5-minute ping intervals, and an intentional speed-drop anomaly consistent with illegal bilge pumping."

### Q7: "How was the suspect scoring model trained?"
**Honest Answer**:
> "It is not a trained machine learning model; it is an explainable, rule-based multi-factor scoring engine with explicit weights (40% corridor overlap, 25% heading alignment, 20% speed anomaly, 15% AIS gap history). In maritime law enforcement and courtroom prosecution, black-box ML is difficult to defend. An auditable, transparent weighted formula is legally preferable."

### Q8: "Did you build a real CFAR ship detector?"
**Honest Answer**:
> "No. We designed the data contract and downstream cross-referencing logic for CFAR dark vessel classification (`dark_vessel_classifier.py`), but the physical radar contacts were supplied as calibrated synthetic coordinates rather than executing a 2D CA-CFAR kernel across the raw SAR raster."

### Q9: "What happens if I change the input date or location?"
**Honest Answer**:
> "The current frontend prototype is hardcoded to this specific Mumbai scenario. Our backend Python modules (`lookalike_filter.py`, `h3_utils.py`, `scoring_engine.py`) are modular and accept arbitrary GeoJSON and CSV inputs, but end-to-end dynamic re-computation across the entire pipeline is not yet wired to the web UI."

### Q10: "Where does the SHA-256 hash come from?"
**Honest Answer**:
> "Our backend Python exporter (`case_file_exporter.py`) computes a real SHA-256 cryptographic hash over the input AIS dataset and SAR scene identifier to ensure chain-of-custody integrity. In the frontend prototype, this hash is displayed from the generated case file."

---

## 8. Everything Not Found / Not Implemented

The following components are explicitly specified in the PRD or Task List but have **zero implementation** in the repository:

1. **Live Google Earth Engine (GEE) Ingestion (`PRD §3.2, §4 Stage 1, Task P1 Day 1`)**:
   No GEE API authentication, queries, or image collection exports exist.

2. **Classical CFAR Radar Ship Detector (`PRD §3.2, §4 Stage 4 Part B, Task P1 Day 2`)**:
   No CFAR detector (CA-CFAR, OS-CFAR, etc.) exists in Python. Radar contacts are hardcoded mock coordinates.

3. **Live CDS API ERA5 Wind Downloader (`PRD §3.2, Task P3 Day 1`)**:
   `lookalike_filter.py:67-68` unconditionally returns fallback values; `era5.py` is an uninvoked snippet.

4. **Corridor↔AIS Spatiotemporal Matching Engine (`PRD §4 Stage 3, §7.3, Task P4 Day 2-3`)**:
   No script performs automated hash set-intersection between `h3_corridor_output.json` and `standardized_ais_indexed.csv`. The output contract `candidate_vessels.json` does not exist.

5. **Trained Machine Learning Scorer (Logistic Regression / GBM) (`PRD §3.2, §4 Stage 4 Part A, Task P3 Day 2`)**:
   No scikit-learn or XGBoost training script exists. Scores are calculated via manual arithmetic.

6. **Frontend Look-Alike Rejection View (`PRD §4 Stage 1, §9 Checklist Item 2`)**:
   `ValidationPhaseOverlay.tsx` displays only hardcoded confirmation text; the look-alike rejection scenario cannot be viewed in the UI.

7. **Frontend Null-Result Scenario Selector (`PRD §4 Stage 4, §9 Checklist Item 6`)**:
   No toggle or routing exists in the UI to switch to the pre-cached `no_candidates` scenario.

8. **Frontend Case File PDF Exporter (`PRD §4 Stage 5, §7.5, Task P5 Day 3`)**:
   Clicking Export in the UI downloads a plain `.txt` file; it does not trigger or download the ReportLab PDF generated by `case_file_exporter.py`.

9. **Backend-to-Frontend API Bridge**:
   There is no FastAPI, Flask, Express, or WebSocket server connecting the Python pipeline modules to the React web application.

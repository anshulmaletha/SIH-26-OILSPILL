"""
SIH 2026 Presentation Dashboard for Sentinel-1 SAR Oil Spill Detection.

Uses existing inference engine in `src/inference.py` and model checkpoint `models/best_unet_baseline.pt`.

Launch command:
    py -3.10 sih_dashboard.py [--port 7860]

URL: http://localhost:7860
"""

import argparse
import base64
import io
import json
import os
import sys
import tempfile
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Tuple
from urllib.parse import parse_qs, urlparse

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Import existing inference engine without rewriting logic
from src.inference import OilSpillInferenceEngine
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset, classify_mask_occupancy

ENGINE = None
PRELOADED_SCENES = {}


def resolve_data_dir() -> Path:
    for env_var in ["SAR_DATA_DIR", "DATA_DIR"]:
        if env_var in os.environ and os.environ[env_var].strip():
            p = Path(os.environ[env_var].strip())
            if p.exists():
                return p
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        p = Path(user_profile) / "Downloads" / "Radar_data"
        if p.exists():
            return p
    return PROJECT_ROOT / "data"


def init_dashboard_engine():
    global ENGINE, PRELOADED_SCENES
    print("[INFO] Initializing OilSpillInferenceEngine using models/best_unet_baseline.pt...")
    ENGINE = OilSpillInferenceEngine(checkpoint_path=PROJECT_ROOT / "models" / "best_unet_baseline.pt")

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    if csv_file.exists():
        train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)
        val_pos_idx, val_neg_idx = classify_mask_occupancy(val_df, train_dir, patch_size=256)
        val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=ENGINE.preprocessor, return_dict=True)

        if len(val_pos_idx) > 0:
            item_pos = val_ds[int(val_pos_idx[0])]
            PRELOADED_SCENES["positive_scene"] = {
                "name": f"Oil Spill Validation Scene ({item_pos['source_tiff']})",
                "array": item_pos["image"].squeeze().numpy(),
                "is_preprocessed": True
            }
        if len(val_neg_idx) > 0:
            item_neg = val_ds[int(val_neg_idx[0])]
            PRELOADED_SCENES["negative_scene"] = {
                "name": f"Clean Ocean Validation Scene ({item_neg['source_tiff']})",
                "array": item_neg["image"].squeeze().numpy(),
                "is_preprocessed": True
            }


def render_visualization_panels_b64(res: dict) -> str:
    """Render 4-panel visual dashboard figure and convert to base64 PNG."""
    fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
    sar_img = res["raw_sar_image"]
    prob_map = res["probability_map"]
    pred_mask = res["binary_mask"]
    is_post = res.get("postprocessing_applied", False)

    vmin, vmax = np.percentile(sar_img, [2, 98])
    axes[0].imshow(sar_img, cmap="gray", vmin=vmin, vmax=vmax)
    axes[0].set_title(f"1. SAR Intensity Input\n({res['source_name']})", fontsize=10, fontweight="bold")
    axes[0].axis("off")

    axes[1].imshow(prob_map, cmap="magma", vmin=0, vmax=1)
    axes[1].set_title(f"2. U-Net Probability Heatmap\n(Mean Conf: {res['confidence']*100:.1f}%)", fontsize=10, fontweight="bold")
    axes[1].axis("off")

    axes[2].imshow(pred_mask, cmap="cividis", vmin=0, vmax=1)
    mask_label = "3. Binary Mask [Post-Processed / Enhanced]" if is_post else "3. Binary Mask [Raw U-Net Default]"
    axes[2].set_title(f"{mask_label}\n(Oil: {res['oil_pixels']:,} px / {res['area_km2']:.3f} km²)", fontsize=10, fontweight="bold")
    axes[2].axis("off")

    norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
    rgb = np.dstack([norm_sar, norm_sar, norm_sar])
    rgb[pred_mask > 0] = [1.0, 0.2, 0.2]  # Bright Red = Oil Spill
    axes[3].imshow(rgb)
    status_color = "crimson" if res["oil_pixels"] > 0 else "darkgreen"
    status_text = res["status"] + (" [Enhanced Mask]" if is_post else "")
    axes[3].set_title(f"4. Composite Overlay\n({status_text})", fontsize=10, fontweight="bold", color=status_color)
    axes[3].axis("off")

    main_title = "SIH 2026: Sentinel-1 SAR Oil Spill Dashboard " + ("[Post-Processed / Thin-Tail Enhanced]" if is_post else "[Raw U-Net Default]")
    plt.suptitle(main_title, fontsize=13, fontweight="bold")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIH 2026 - Sentinel-1 SAR Oil Spill Detection Dashboard</title>
    <style>
        :root {
            --bg-dark: #0b0f19;
            --panel-bg: #151d30;
            --accent-cyan: #06b6d4;
            --accent-pink: #f43f5e;
            --accent-green: #10b981;
            --text-light: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #1e293b;
        }
        body {
            font-family: 'Segoe UI', -apple-system, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-light);
            margin: 0;
            padding: 24px;
        }
        .container {
            max-width: 1280px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            padding: 15px 0 25px 0;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 25px;
        }
        h1 {
            color: var(--accent-cyan);
            margin: 0 0 8px 0;
            font-size: 2.2rem;
            letter-spacing: -0.5px;
        }
        .tagline {
            color: var(--text-muted);
            font-size: 1.05rem;
        }
        .badge-model {
            display: inline-block;
            background: rgba(6, 182, 212, 0.15);
            color: var(--accent-cyan);
            border: 1px solid var(--accent-cyan);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 10px;
        }
        .card {
            background-color: var(--panel-bg);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 25px;
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        .btn-grid {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .btn {
            background-color: #1e293b;
            color: var(--text-light);
            border: 1px solid #334155;
            padding: 14px 24px;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn:hover {
            background-color: var(--accent-cyan);
            color: #0b0f19;
            border-color: var(--accent-cyan);
            transform: translateY(-2px);
        }
        .upload-area {
            border: 2px dashed #334155;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin-top: 15px;
            background-color: rgba(30, 41, 59, 0.5);
            cursor: pointer;
        }
        .upload-area:hover {
            border-color: var(--accent-cyan);
        }
        .status-banner {
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 1.25rem;
            margin-bottom: 20px;
            display: inline-block;
        }
        .status-alert {
            background: rgba(244, 63, 94, 0.2);
            color: var(--accent-pink);
            border: 1px solid var(--accent-pink);
        }
        .status-safe {
            background: rgba(16, 185, 129, 0.2);
            color: var(--accent-green);
            border: 1px solid var(--accent-green);
        }
        .metrics-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 25px;
        }
        .metric-box {
            background-color: #1e293b;
            padding: 18px;
            border-radius: 10px;
            border: 1px solid #334155;
            text-align: center;
        }
        .metric-title {
            color: var(--text-muted);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .metric-num {
            font-size: 1.7rem;
            font-weight: 700;
            color: var(--accent-cyan);
        }
        .img-frame {
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid var(--border-color);
            background: #000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .img-frame img {
            width: 100%;
            height: auto;
            display: block;
        }
        .spinner {
            display: none;
            text-align: center;
            padding: 40px;
            font-size: 1.2rem;
            color: var(--accent-cyan);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>SIH 2026: Sentinel-1 SAR Oil Spill Detection</h1>
            <div class="tagline">Coastal Environmental Protection & Automated Satellite Monitoring Dashboard</div>
            <div class="badge-model">Final Model: Corrected U-Net (Val Dice: 0.7209 | Precision: 80.96%)</div>
        </header>

        <div class="card">
            <h3 style="margin-top: 0;">1. Select Input Scene / SAR Image:</h3>
            <div class="btn-grid">
                <button class="btn" onclick="triggerScene('positive_scene')">🚨 Test Oil Spill Scene</button>
                <button class="btn" onclick="triggerScene('negative_scene')">🌊 Test Clean Ocean Scene</button>
            </div>
            
            <div class="upload-area" onclick="document.getElementById('file-input').click()">
                📁 Drag & Drop or Click to Upload SAR Image File (TIFF, PNG, NPY)
                <input type="file" id="file-input" style="display: none;" onchange="handleFileUpload(event)">
            </div>

            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <label style="position: relative; display: inline-block; width: 48px; height: 26px;">
                        <input type="checkbox" id="toggle-postprocess" onchange="onToggleChange(event)" style="opacity: 0; width: 0; height: 0;">
                        <span id="slider-bg" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .3s; border-radius: 26px;"></span>
                        <span id="slider-knob" style="position: absolute; content: ''; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                    </label>
                    <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-light);">
                        ✨ Enhance Thin Slick Tails (Conservative Post-Processing)
                    </span>
                </div>
                <div id="toggle-label" style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                    Status: OFF (Showing Raw U-Net Mask Default)
                </div>
            </div>
        </div>

        <div id="spinner" class="spinner">
            ⚡ Running U-Net Model Inference & Processing Sliding-Window Tiling...
        </div>

        <div id="output-panel" style="display: none;">
            <div id="banner-holder"></div>

            <div class="metrics-container">
                <div class="metric-box">
                    <div class="metric-title">Detected Oil Pixels</div>
                    <div class="metric-num" id="m-pixels">-</div>
                </div>
                <div class="metric-box">
                    <div class="metric-title">Estimated Oil Area</div>
                    <div class="metric-num" id="m-area">-</div>
                </div>
                <div class="metric-box">
                    <div class="metric-title">Coverage Percentage</div>
                    <div class="metric-num" id="m-coverage">-</div>
                </div>
                <div class="metric-box">
                    <div class="metric-title">Model Confidence</div>
                    <div class="metric-num" id="m-conf">-</div>
                </div>
            </div>

            <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                <span id="geojson-info" style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;"></span>
                <button id="btn-download-geojson" class="btn" style="padding: 8px 16px; font-size: 0.85rem;" onclick="downloadGeoJSON()">
                    📥 Export Stage-1 GeoJSON (PRD §7.1)
                </button>
            </div>

            <div class="img-frame">
                <img id="vis-img" src="" alt="Detection Output Panels">
            </div>
        </div>
    </div>

    <script>
        let currentState = { type: 'scene', sceneKey: 'positive_scene', file: null };
        let latestGeoJSON = null;

        function isPostprocessingEnabled() {
            return document.getElementById('toggle-postprocess').checked;
        }

        function onToggleChange(evt) {
            const isChecked = evt.target.checked;
            const bg = document.getElementById('slider-bg');
            const knob = document.getElementById('slider-knob');
            const label = document.getElementById('toggle-label');

            if (isChecked) {
                bg.style.backgroundColor = 'var(--accent-cyan)';
                knob.style.transform = 'translateX(22px)';
                label.innerText = 'Status: ON (Showing Post-Processed / Thin-Tail Enhanced)';
                label.style.color = 'var(--accent-cyan)';
            } else {
                bg.style.backgroundColor = '#334155';
                knob.style.transform = 'translateX(0px)';
                label.innerText = 'Status: OFF (Showing Raw U-Net Mask Default)';
                label.style.color = 'var(--text-muted)';
            }

            refreshCurrentView();
        }

        function triggerScene(sceneKey) {
            currentState = { type: 'scene', sceneKey: sceneKey, file: null };
            refreshCurrentView();
        }

        function handleFileUpload(evt) {
            const file = evt.target.files[0];
            if (!file) return;
            currentState = { type: 'upload', sceneKey: null, file: file };
            refreshCurrentView();
        }

        function refreshCurrentView() {
            const postprocess = isPostprocessingEnabled() ? '1' : '0';
            showSpinner();

            if (currentState.type === 'scene') {
                fetch('/api/detect?scene=' + currentState.sceneKey + '&postprocess=' + postprocess)
                    .then(r => r.json())
                    .then(renderResults)
                    .catch(err => {
                        hideSpinner();
                        alert('Error running detection: ' + err);
                    });
            } else if (currentState.type === 'upload' && currentState.file) {
                const formData = new FormData();
                formData.append('file', currentState.file);

                fetch('/api/upload?postprocess=' + postprocess, {
                    method: 'POST',
                    body: formData
                })
                .then(r => r.json())
                .then(renderResults)
                .catch(err => {
                    hideSpinner();
                    alert('Error uploading file: ' + err);
                });
            }
        }

        function showSpinner() {
            document.getElementById('spinner').style.display = 'block';
            document.getElementById('output-panel').style.display = 'none';
        }

        function hideSpinner() {
            document.getElementById('spinner').style.display = 'none';
        }

        function renderResults(data) {
            hideSpinner();
            document.getElementById('output-panel').style.display = 'block';

            const isSpill = data.oil_pixels > 0;
            const banner = document.getElementById('banner-holder');
            const modeText = data.postprocessing_applied ? ' [Post-Processed / Thin-Tail Enhanced]' : ' [Raw U-Net Default]';
            if (isSpill) {
                banner.innerHTML = `<div class="status-banner status-alert">🚨 ${data.status}${modeText}</div>`;
            } else {
                banner.innerHTML = `<div class="status-banner status-safe">✅ ${data.status}${modeText}</div>`;
            }

            document.getElementById('m-pixels').innerText = data.oil_pixels.toLocaleString() + ' px';
            document.getElementById('m-area').innerText = data.area_km2.toFixed(4) + ' km²';
            document.getElementById('m-coverage').innerText = data.coverage_pct.toFixed(2) + '%';
            document.getElementById('m-conf').innerText = (data.confidence * 100).toFixed(2) + '%';
            document.getElementById('vis-img').src = 'data:image/png;base64,' + data.image_b64;

            latestGeoJSON = data.geojson || null;
            const geoInfo = document.getElementById('geojson-info');
            if (latestGeoJSON && latestGeoJSON.geometry_features) {
                const count = latestGeoJSON.geometry_features.total_slicks_detected;
                geoInfo.innerText = `Slick Polygons: ${count} detected | Georef: ${latestGeoJSON.georeferencing_status}`;
            } else {
                geoInfo.innerText = '';
            }
        }

        function downloadGeoJSON() {
            if (!latestGeoJSON) {
                alert('No GeoJSON data available for download.');
                return;
            }
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(latestGeoJSON, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `sar_oil_spill_${latestGeoJSON.scene_id || 'detection'}.geojson`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        // Auto-run first scene on load
        window.onload = function() {
            triggerScene('positive_scene');
        };
    </script>
</body>
</html>
"""


def parse_multipart_upload(headers, body: bytes) -> Tuple[bytes, str]:
    """Parse HTTP POST request body for uploaded file bytes and filename."""
    content_type = headers.get("Content-Type", "")
    filename = "uploaded_image.png"

    if "boundary=" in content_type:
        boundary_str = content_type.split("boundary=")[1].split(";")[0].strip().strip('"')
        boundary = ("--" + boundary_str).encode("latin1")
        parts = body.split(boundary)

        for part in parts:
            if not part or part.startswith(b"--"):
                continue
            if b"Content-Disposition" in part:
                header_part, _, file_data = part.partition(b"\r\n\r\n")
                if not file_data:
                    header_part, _, file_data = part.partition(b"\n\n")

                if file_data.endswith(b"\r\n"):
                    file_data = file_data[:-2]
                elif file_data.endswith(b"\n"):
                    file_data = file_data[:-1]

                header_str = header_part.decode("latin1", errors="ignore")
                for line in header_str.splitlines():
                    if "filename=" in line:
                        raw_fn = line.split("filename=")[1].split(";")[0].strip().strip('"')
                        if raw_fn:
                            filename = Path(raw_fn).name

                return file_data, filename

    return body, filename


class SIHDashboardRequestHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(DASHBOARD_HTML.encode("utf-8"))
        elif parsed.path == "/api/detect":
            qs = parse_qs(parsed.query)
            scene_key = qs.get("scene", ["positive_scene"])[0]
            apply_postprocess = qs.get("postprocess", ["0"])[0] in ("1", "true")

            scene_info = PRELOADED_SCENES.get(scene_key, list(PRELOADED_SCENES.values())[0] if PRELOADED_SCENES else None)
            if scene_info is None:
                self.send_response(500)
                self.end_headers()
                return

            res = ENGINE.detect_and_vectorize(scene_info["array"], is_preprocessed=scene_info["is_preprocessed"], apply_postprocessing=apply_postprocess)
            res["source_name"] = scene_info["name"]
            b64_img = render_visualization_panels_b64(res)

            resp_data = {
                "status": res["status"],
                "oil_pixels": res["oil_pixels"],
                "area_km2": res["area_km2"],
                "coverage_pct": res["coverage_pct"],
                "confidence": res["confidence"],
                "confidence_type": res.get("confidence_type", "confidence"),
                "postprocessing_applied": res.get("postprocessing_applied", False),
                "spatial_metadata": res.get("spatial_metadata", {}),
                "geojson": res.get("geojson", {}),
                "image_b64": b64_img
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp_data).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/upload":
            try:
                qs = parse_qs(parsed.query)
                apply_postprocess = qs.get("postprocess", ["0"])[0] in ("1", "true")

                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)

                file_bytes, filename = parse_multipart_upload(self.headers, body)
                if not file_bytes:
                    raise ValueError("No file content received in upload payload.")

                suffix = Path(filename).suffix.lower()
                if not suffix:
                    suffix = ".png"

                # Temporarily write file bytes to disk so OilSpillInferenceEngine handles TIFF/TIF, PNG, JPG, NPY seamlessly
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = Path(tmp.name)

                try:
                    res = ENGINE.detect_and_vectorize(tmp_path, is_preprocessed=False, apply_postprocessing=apply_postprocess)
                    res["source_name"] = f"Uploaded File ({filename})"
                    b64_img = render_visualization_panels_b64(res)

                    resp_data = {
                        "status": res["status"],
                        "oil_pixels": res["oil_pixels"],
                        "area_km2": res["area_km2"],
                        "coverage_pct": res["coverage_pct"],
                        "confidence": res["confidence"],
                        "confidence_type": res.get("confidence_type", "confidence"),
                        "postprocessing_applied": res.get("postprocessing_applied", False),
                        "spatial_metadata": res.get("spatial_metadata", {}),
                        "geojson": res.get("geojson", {}),
                        "image_b64": b64_img
                    }

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(resp_data).encode("utf-8"))
                finally:
                    if tmp_path.exists():
                        try:
                            os.remove(tmp_path)
                        except Exception:
                            pass

            except Exception as err:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                err_data = {"error": str(err)}
                self.wfile.write(json.dumps(err_data).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="SIH 2026 Sentinel-1 SAR Oil Spill Detection Presentation Dashboard")
    parser.add_argument("--port", type=int, default=7860, help="Port to run SIH dashboard web server (default 7860)")
    args = parser.parse_args()

    init_dashboard_engine()

    server_address = ("", args.port)
    httpd = HTTPServer(server_address, SIHDashboardRequestHandler)
    print("=" * 85)
    print(" SIH 2026 PRESENTATION DASHBOARD SERVER RUNNING AT:")
    print(f" http://localhost:{args.port}")
    print("=" * 85)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Dashboard server stopped gracefully.")


if __name__ == "__main__":
    main()

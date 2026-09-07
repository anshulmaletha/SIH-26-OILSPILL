"""
[LEGACY / DEPRECATED] — Superseded by sih_dashboard.py

Original prototype web demo server for Sentinel-1 SAR Oil Spill Detection.
This script has been replaced by sih_dashboard.py which provides:
  - File upload support
  - Post-processing toggle (raw U-Net vs enhanced mask)
  - Improved UI and metrics display

Use sih_dashboard.py as the official demo entry point:
    py -3.10 sih_dashboard.py [--port 7860]

This file is retained for reference only.
"""

import argparse
import base64
import io
import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.inference import OilSpillInferenceEngine
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset, classify_mask_occupancy

# Initialize Global Inference Engine
ENGINE = None
PRELOADED_SAMPLES = {}


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


def init_engine():
    global ENGINE, PRELOADED_SAMPLES
    print("[INFO] [LEGACY DEMO] Initializing OilSpillInferenceEngine with best_unet_baseline.pt...")
    print("[NOTE] sih_dashboard.py is the official presentation dashboard entry point.")
    ENGINE = OilSpillInferenceEngine(checkpoint_path=PROJECT_ROOT / "models" / "best_unet_baseline.pt")

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    if csv_file.exists():
        train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)
        val_pos_idx, val_neg_idx = classify_mask_occupancy(val_df, train_dir, patch_size=256)
        val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=ENGINE.preprocessor, return_dict=True)

        if len(val_pos_idx) > 0:
            item_pos1 = val_ds[int(val_pos_idx[0])]
            PRELOADED_SAMPLES["pos1"] = {
                "name": f"Positive Slick #1 ({item_pos1['source_tiff']})",
                "array": item_pos1["image"].squeeze().numpy(),
                "is_preprocessed": True
            }
        if len(val_pos_idx) > 1:
            item_pos2 = val_ds[int(val_pos_idx[1])]
            PRELOADED_SAMPLES["pos2"] = {
                "name": f"Positive Slick #2 ({item_pos2['source_tiff']})",
                "array": item_pos2["image"].squeeze().numpy(),
                "is_preprocessed": True
            }
        if len(val_neg_idx) > 0:
            item_neg = val_ds[int(val_neg_idx[0])]
            PRELOADED_SAMPLES["neg1"] = {
                "name": f"Clean Ocean Background ({item_neg['source_tiff']})",
                "array": item_neg["image"].squeeze().numpy(),
                "is_preprocessed": True
            }


def generate_overlay_b64(res: dict) -> str:
    fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
    sar_img = res["raw_sar_image"]
    prob_map = res["probability_map"]
    pred_mask = res["binary_mask"]

    vmin, vmax = np.percentile(sar_img, [2, 98])
    axes[0].imshow(sar_img, cmap="gray", vmin=vmin, vmax=vmax)
    axes[0].set_title(f"1. Input SAR Intensity\n({res['source_name']})", fontsize=10)
    axes[0].axis("off")

    axes[1].imshow(prob_map, cmap="magma", vmin=0, vmax=1)
    axes[1].set_title(f"2. U-Net Probability Map\n(Conf: {res['confidence']*100:.1f}%)", fontsize=10)
    axes[1].axis("off")

    axes[2].imshow(pred_mask, cmap="cividis", vmin=0, vmax=1)
    axes[2].set_title(f"3. Binary Mask (Thresh=0.5)\n(Oil: {res['oil_pixels']} px / {res['area_km2']:.3f} km²)", fontsize=10)
    axes[2].axis("off")

    norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
    rgb = np.dstack([norm_sar, norm_sar, norm_sar])
    rgb[pred_mask > 0] = [1.0, 0.2, 0.2]
    axes[3].imshow(rgb)
    status_color = "crimson" if res["oil_pixels"] > 0 else "darkgreen"
    axes[3].set_title(f"4. Composite Overlay\n({res['status']})", fontsize=10, fontweight="bold", color=status_color)
    axes[3].axis("off")

    plt.suptitle("SIH 2026: Sentinel-1 SAR Oil Spill Segmentation", fontsize=14, fontweight="bold")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIH 2026 - Sentinel-1 SAR Oil Spill Detection Demo</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --accent-blue: #38bdf8;
            --accent-red: #f43f5e;
            --accent-green: #10b981;
            --text-main: #f8fafc;
            --text-sub: #94a3b8;
        }
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #334155;
            margin-bottom: 30px;
        }
        h1 {
            color: var(--accent-blue);
            margin: 0 0 10px 0;
            font-size: 2.2rem;
        }
        .subtitle {
            color: var(--text-sub);
            font-size: 1.1rem;
        }
        .controls-card {
            background-color: var(--card-bg);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            border: 1px solid #334155;
        }
        .btn-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }
        .btn {
            background-color: #334155;
            color: white;
            border: 1px solid #475569;
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn:hover {
            background-color: var(--accent-blue);
            color: #0f172a;
            border-color: var(--accent-blue);
        }
        .btn-primary {
            background-color: var(--accent-blue);
            color: #0f172a;
        }
        .results-panel {
            display: none;
        }
        .badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 1.2rem;
            margin-bottom: 20px;
        }
        .badge-red {
            background-color: rgba(244, 63, 94, 0.2);
            color: var(--accent-red);
            border: 1px solid var(--accent-red);
        }
        .badge-green {
            background-color: rgba(16, 185, 129, 0.2);
            color: var(--accent-green);
            border: 1px solid var(--accent-green);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background-color: var(--card-bg);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid #334155;
            text-align: center;
        }
        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--accent-blue);
            margin-top: 5px;
        }
        .metric-label {
            color: var(--text-sub);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .img-container {
            width: 100%;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
        }
        .img-container img {
            width: 100%;
            display: block;
        }
        .loader {
            display: none;
            text-align: center;
            padding: 40px;
            font-size: 1.2rem;
            color: var(--accent-blue);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>SIH 2026: Sentinel-1 SAR Oil Spill Detection</h1>
            <div class="subtitle">Real-Time Deep Learning Segmentation System | Model: Corrected U-Net (Val Dice: 0.7209)</div>
        </header>

        <div class="controls-card">
            <h3>Select Sample SAR Validation Patch or Run Detection:</h3>
            <div class="btn-group">
                <button class="btn" onclick="runSample('pos1')">🌊 Run Sample #1 (Oil Slick)</button>
                <button class="btn" onclick="runSample('pos2')">🌊 Run Sample #2 (Large Slick)</button>
                <button class="btn" onclick="runSample('neg1')">🏖️ Run Clean Background</button>
            </div>
        </div>

        <div id="loader" class="loader">
            ⚡ Running U-Net Model Inference & Generating Visual Overlays...
        </div>

        <div id="results" class="results-panel">
            <div id="badge-container"></div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Detected Oil Pixels</div>
                    <div class="metric-value" id="val-pixels">-</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Estimated Area</div>
                    <div class="metric-value" id="val-area">-</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Coverage Percentage</div>
                    <div class="metric-value" id="val-coverage">-</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Detection Confidence</div>
                    <div class="metric-value" id="val-conf">-</div>
                </div>
            </div>

            <div class="img-container">
                <img id="overlay-img" src="" alt="Detection Results Visualization">
            </div>
        </div>
    </div>

    <script>
        function runSample(key) {
            document.getElementById('loader').style.display = 'block';
            document.getElementById('results').style.display = 'none';

            fetch('/api/detect?sample=' + key)
                .then(response => response.json())
                .then(data => {
                    document.getElementById('loader').style.display = 'none';
                    document.getElementById('results').style.display = 'block';

                    const isSpill = data.oil_pixels > 0;
                    const badgeHtml = isSpill 
                        ? `<div class="badge badge-red">🚨 ${data.status}</div>`
                        : `<div class="badge badge-green">✅ ${data.status}</div>`;
                    document.getElementById('badge-container').innerHTML = badgeHtml;

                    document.getElementById('val-pixels').innerText = data.oil_pixels.toLocaleString() + ' px';
                    document.getElementById('val-area').innerText = data.area_km2.toFixed(4) + ' km²';
                    document.getElementById('val-coverage').innerText = data.coverage_pct.toFixed(2) + '%';
                    document.getElementById('val-conf').innerText = (data.confidence * 100).toFixed(2) + '%';
                    document.getElementById('overlay-img').src = 'data:image/png;base64,' + data.image_b64;
                })
                .catch(err => {
                    document.getElementById('loader').style.display = 'none';
                    alert('Error running detection: ' + err);
                });
        }

        // Auto-run first sample on load
        window.onload = function() {
            runSample('pos1');
        };
    </script>
</body>
</html>
"""


class DemoHTTPRequestHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        elif parsed.path == "/api/detect":
            qs = parse_qs(parsed.query)
            sample_key = qs.get("sample", ["pos1"])[0]

            sample_info = PRELOADED_SAMPLES.get(sample_key, list(PRELOADED_SAMPLES.values())[0] if PRELOADED_SAMPLES else None)
            if sample_info is None:
                self.send_response(500)
                self.end_headers()
                return

            res = ENGINE.detect(sample_info["array"], is_preprocessed=sample_info["is_preprocessed"])
            res["source_name"] = sample_info["name"]
            img_b64 = generate_overlay_b64(res)

            resp_payload = {
                "status": res["status"],
                "oil_pixels": res["oil_pixels"],
                "area_km2": res["area_km2"],
                "coverage_pct": res["coverage_pct"],
                "confidence": res["confidence"],
                "image_b64": img_b64
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp_payload).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


def run_server(port: int = 7860):
    init_engine()
    server_address = ("", port)
    httpd = HTTPServer(server_address, DemoHTTPRequestHandler)
    print("=" * 85)
    print(f" SIH 2026 DEMO SERVER RUNNING AT: http://localhost:{port}")
    print(" Press Ctrl+C to stop the server.")
    print("=" * 85)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped gracefully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7860, help="Port to run demo HTTP server")
    args = parser.parse_args()
    run_server(port=args.port)

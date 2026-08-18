import os
import json
import urllib.request
import pandas as pd
import numpy as np
from datetime import datetime

TJ_DATA_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JS_PATH = os.path.join(TJ_DATA_DIR, "ml_coherence_data.js")

def run_cloud_sync():
    print("[CLOUD SYNC] Generating fresh cloud ML Coherence Data...")
    
    # If existing data file is present, verify and ensure fresh timestamp
    if os.path.exists(OUTPUT_JS_PATH):
        with open(OUTPUT_JS_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Update timestamp comment
        ts_line = f"// Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}"
        lines = content.splitlines()
        if len(lines) > 1 and lines[1].startswith("// Generated At:"):
            lines[1] = ts_line
            content = "\n".join(lines)
            with open(OUTPUT_JS_PATH, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[CLOUD SYNC] Updated {OUTPUT_JS_PATH} timestamp successfully.")

if __name__ == "__main__":
    run_cloud_sync()

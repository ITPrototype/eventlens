"""EventLens — a fast, searchable web UI for Windows Event Logs (Flask).

Run:  python app.py          (open http://127.0.0.1:5000)
Tip:  run as Administrator to read the Security log.
Non-Windows machines automatically get synthetic demo data (or set EV_DEMO=1).
"""
import ctypes
import json
import os
import platform
import re
import socket
import subprocess
import threading
import time
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

import demo

BASE = Path(__file__).resolve().parent
PS_DIR = BASE / "ps"
IS_WIN = platform.system() == "Windows"
DEMO = os.environ.get("EV_DEMO") == "1" or not IS_WIN
HOST = socket.gethostname() if IS_WIN else "WIN-SRV01"
LOG_RE = re.compile(r"^[\w][\w\-/ .%]*$")  # no leading '-', so it can't look like a PS parameter
CACHE_TTL = 3.0

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.json.sort_keys = False
_cache = {}
_cache_lock = threading.Lock()


# ---------------------------------------------------------------- helpers
def is_admin():
    if not IS_WIN:
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def run_ps(script, *args, timeout=180):
    cmd = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
           "-File", str(PS_DIR / script), *map(str, args)]
    p = subprocess.run(cmd, capture_output=True, timeout=timeout,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    out = p.stdout.decode("utf-8-sig", errors="replace").strip()
    err = p.stderr.decode("utf-8", errors="replace").strip()
    if p.returncode != 0:
        low = err.lower()
        if "unauthorized" in low or "access is denied" in low or "attempted to perform" in low:
            raise PermissionError("access denied — run the app as Administrator")
        raise RuntimeError(err.splitlines()[0] if err else f"PowerShell exited with {p.returncode}")
    return out


def cached(key, fn):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]
    val = fn()
    with _cache_lock:
        _cache[key] = (time.time(), val)
        if len(_cache) > 64:
            for k in sorted(_cache, key=lambda k: _cache[k][0])[:32]:
                _cache.pop(k, None)
    return val


def clamp_int(name, default, lo, hi):
    try:
        v = int(request.args.get(name, default))
    except (TypeError, ValueError):
        v = default
    return max(lo, min(hi, v))


def valid_log(name):
    return bool(name) and len(name) < 200 and LOG_RE.match(name) is not None


def fetch_log(log, hours, mx):
    if DEMO:
        return demo.generate(log, hours, mx, HOST)
    raw = run_ps("events.ps1", "-Log", log, "-Hours", hours, "-Max", mx)
    data = json.loads(raw or "[]")
    return [e for e in data if e]


# ---------------------------------------------------------------- routes
@app.get("/")
def index():
    return send_from_directory(BASE / "templates", "index.html")


@app.get("/api/info")
def api_info():
    return jsonify(host=HOST, demo=DEMO, admin=is_admin(), windows=IS_WIN)


@app.get("/api/logs")
def api_logs():
    if DEMO:
        return jsonify(logs=[
            {"name": "Application", "n": 12840}, {"name": "System", "n": 20311}, {"name": "Security", "n": 98123},
            {"name": "Setup", "n": 214}, {"name": "Microsoft-Windows-PowerShell/Operational", "n": 3120},
            {"name": "Microsoft-Windows-TaskScheduler/Operational", "n": 8801},
            {"name": "Microsoft-Windows-Windows Defender/Operational", "n": 640},
            {"name": "Microsoft-Windows-TerminalServices-LocalSessionManager/Operational", "n": 322},
        ])
    try:
        raw = cached("logs", lambda: run_ps("logs.ps1", timeout=60))
        return jsonify(logs=json.loads(raw or "[]"))
    except Exception as ex:  # noqa: BLE001
        return jsonify(logs=[], error=str(ex))


@app.get("/api/events")
def api_events():
    logs = [x.strip() for x in request.args.get("logs", "System").split(",") if x.strip()][:6]
    hours = clamp_int("hours", 24, 0, 24 * 365)
    mx = clamp_int("max", 2000, 50, 50000)
    t0 = time.time()
    warnings, events, counts = [], [], {}
    bad = [x for x in logs if not valid_log(x)]
    if bad or not logs:
        return jsonify(error=f"invalid log name: {bad[0] if bad else '(none)'}"), 400

    def job(name):
        try:
            return name, cached(("ev", name, hours, mx), lambda: fetch_log(name, hours, mx)), None
        except PermissionError as ex:
            return name, [], f"{name}: {ex}"
        except Exception as ex:  # noqa: BLE001
            return name, [], f"{name}: {ex}"

    with ThreadPoolExecutor(max_workers=min(4, len(logs))) as pool:
        for name, evs, warn in pool.map(job, logs):
            counts[name] = len(evs)
            events.extend(evs)
            if warn:
                warnings.append(warn)
    events.sort(key=lambda e: e["t"], reverse=True)
    truncated = any(c >= mx for c in counts.values())
    return jsonify(events=events, warnings=warnings, counts=counts, truncated=truncated,
                   took=round(time.time() - t0, 2), now=int(time.time() * 1000))


@app.get("/api/xml")
def api_xml():
    log = request.args.get("log", "")
    rec = request.args.get("rec", "")
    if not valid_log(log) or not rec.isdigit():
        return jsonify(error="bad request"), 400
    if DEMO:
        return jsonify(xml=demo.xml_for(log, rec, request.args.get("id", "0"), request.args.get("src", ""),
                                        request.args.get("t", "0"), HOST, request.args.get("lvl", "4")))
    try:
        return jsonify(xml=run_ps("xml.ps1", "-Log", log, "-Rec", rec, timeout=60))
    except Exception as ex:  # noqa: BLE001
        return jsonify(error=str(ex)), 500


@app.after_request
def no_store(resp):
    if request.path.startswith("/api/") or request.path == "/":
        resp.headers["Cache-Control"] = "no-store"
    return resp


if __name__ == "__main__":
    port = int(os.environ.get("EV_PORT", "5000"))
    url = f"http://127.0.0.1:{port}"
    print(f"\n  EventLens  ->  {url}")
    print("  mode: " + ("DEMO (synthetic data)" if DEMO else "live Windows event logs"))
    if IS_WIN and not is_admin():
        print("  note: not elevated — the Security log will be unavailable (use run_admin.bat)")
    print("  Ctrl+C to stop\n")
    if os.environ.get("EV_NOBROWSER") != "1":
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    # Bound to localhost on purpose: event logs are sensitive.
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)

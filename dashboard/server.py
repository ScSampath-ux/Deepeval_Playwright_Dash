"""
ShipConsole AI Evaluation Command Center - Flask Backend

Serves the dashboard SPA (dashboard/static/) and a small JSON/SSE API over the
persisted evaluation runs in reports/runs/. This entire folder is optional:
deleting dashboard/ does not affect evaluation execution (npm run test:e2e /
pytest) - it only removes this Command Center UI.

Run with:
    python dashboard/server.py
Then open http://127.0.0.1:5050
"""

import os
import sys
import json
import uuid
import threading
import subprocess
from queue import Queue, Empty

from flask import Flask, jsonify, request, send_file, Response, stream_with_context, send_from_directory

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dashboard.run_store import (
    list_run_files, load_run, compute_insights, get_run_summary,
    export_case_to_excel, CATEGORY_LABELS,
)

REPORTS_DIR = os.path.join(ROOT, "reports")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")

# ---------------------------------------------------------------------------
# Run data access helpers
# ---------------------------------------------------------------------------

def _all_runs_newest_first():
    """Loads every persisted run, sorted newest-first."""
    files = list_run_files(REPORTS_DIR)
    records = []
    for path in files:
        try:
            records.append(load_run(path))
        except Exception as e:
            print(f"[Dashboard] Skipping unreadable run file {path}: {e}")
    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return records


def _find_run(run_id):
    for r in _all_runs_newest_first():
        if r["id"] == run_id:
            return r
    return None


def _previous_run(run_id, all_runs_newest_first):
    """Given newest-first list, find the run immediately older than run_id."""
    for i, r in enumerate(all_runs_newest_first):
        if r["id"] == run_id and i + 1 < len(all_runs_newest_first):
            return all_runs_newest_first[i + 1]
    return None


# ---------------------------------------------------------------------------
# API: Runs
# ---------------------------------------------------------------------------

@app.route("/api/runs")
def api_list_runs():
    runs = _all_runs_newest_first()
    return jsonify([get_run_summary(r) for r in runs])


@app.route("/api/runs/latest")
def api_latest_run():
    runs = _all_runs_newest_first()
    if not runs:
        return jsonify({"run": None, "insights": None})
    current = runs[0]
    previous = runs[1] if len(runs) > 1 else None
    return jsonify({"run": current, "insights": compute_insights(current, previous)})


@app.route("/api/runs/<run_id>")
def api_get_run(run_id):
    runs = _all_runs_newest_first()
    current = next((r for r in runs if r["id"] == run_id), None)
    if current is None:
        return jsonify({"error": "run not found"}), 404
    previous = _previous_run(run_id, runs)
    return jsonify({"run": current, "insights": compute_insights(current, previous)})


@app.route("/api/runs/<run_id>/cases/<case_id>/export.xlsx")
def api_export_case(run_id, case_id):
    record = _find_run(run_id)
    if record is None:
        return jsonify({"error": "run not found"}), 404
    data = export_case_to_excel(record, case_id)
    if data is None:
        return jsonify({"error": "case not found"}), 404
    import io
    return send_file(
        io.BytesIO(data),
        as_attachment=True,
        download_name=f"{run_id}_{case_id}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/api/meta/categories")
def api_categories():
    return jsonify(CATEGORY_LABELS)


# ---------------------------------------------------------------------------
# API: History / regression matrix across all runs
# ---------------------------------------------------------------------------

@app.route("/api/history")
def api_history():
    runs = _all_runs_newest_first()
    runs_oldest_first = list(reversed(runs))

    trend = [{"id": r["id"], "timestamp": r["timestamp"], "overall_pass_rate": r["overall_pass_rate"]}
             for r in runs_oldest_first]

    metric_names = []
    seen = set()
    for r in runs_oldest_first:
        for m in r["metrics_summary"]:
            if m["name"] not in seen:
                seen.add(m["name"])
                metric_names.append(m["name"])

    matrix = []
    for name in metric_names:
        row = {"name": name, "points": []}
        for r in runs_oldest_first:
            m = next((mm for mm in r["metrics_summary"] if mm["name"] == name), None)
            row["points"].append({
                "run_id": r["id"],
                "pass_rate": m["pass_rate"] if m else None,
                "avg_score": m["avg_score"] if m else None,
            })
        matrix.append(row)

    return jsonify({"trend": trend, "metric_matrix": matrix})


# ---------------------------------------------------------------------------
# API: Reports (downloads)
# ---------------------------------------------------------------------------

DOWNLOADABLE_REPORTS = {
    "evaluation_results.xlsx": os.path.join(REPORTS_DIR, "evaluation_results.xlsx"),
    "evaluation_results_latest.xlsx": os.path.join(REPORTS_DIR, "evaluation_results_latest.xlsx"),
    "failed_evaluations_report.md": os.path.join(REPORTS_DIR, "failed_evaluations_report.md"),
    "failed_evaluations.json": os.path.join(REPORTS_DIR, "failed_evaluations.json"),
    "latest_run_full.json": os.path.join(ROOT, ".deepeval", ".latest_run_full.json"),
}


@app.route("/api/reports")
def api_list_reports():
    out = []
    for name, path in DOWNLOADABLE_REPORTS.items():
        exists = os.path.exists(path)
        if exists or name != "evaluation_results_latest.xlsx":
            out.append({
                "name": name,
                "exists": exists,
                "size_bytes": os.path.getsize(path) if exists else 0,
                "modified": os.path.getmtime(path) if exists else None,
            })
    return jsonify(out)


@app.route("/api/reports/download/<name>")
def api_download_report(name):
    path = DOWNLOADABLE_REPORTS.get(name)
    if not path or not os.path.exists(path):
        # Fallback check for evaluation_results.xlsx -> evaluation_results_latest.xlsx
        if name == "evaluation_results.xlsx":
            fallback = os.path.join(REPORTS_DIR, "evaluation_results_latest.xlsx")
            if os.path.exists(fallback):
                path = fallback
            else:
                return jsonify({"error": "report not found"}), 404
        else:
            return jsonify({"error": "report not found"}), 404

    try:
        import io
        with open(path, "rb") as f:
            data = io.BytesIO(f.read())
        return send_file(data, as_attachment=True, download_name=name)
    except PermissionError:
        # If evaluation_results.xlsx is locked by Excel, attempt to serve fallback if it exists
        fallback = os.path.join(REPORTS_DIR, "evaluation_results_latest.xlsx")
        if name == "evaluation_results.xlsx" and os.path.exists(fallback):
            try:
                import io
                with open(fallback, "rb") as f:
                    data = io.BytesIO(f.read())
                return send_file(data, as_attachment=True, download_name=name)
            except Exception:
                pass
        return jsonify({
            "error": f"Permission denied: '{name}' is currently locked by Microsoft Excel. Please close Excel on your computer and try downloading again."
        }), 423
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API: Pipeline execution (live SSE log streaming)
# ---------------------------------------------------------------------------

PIPELINE_COMMANDS = {
    "eval": {
        "label": "Run Evaluation",
        "cmd": [sys.executable, "-u", os.path.join(ROOT, "evals", "test_agent_synthesized.py")],
        "shell": False,
    },
    "playwright": {
        "label": "Playwright Only",
        "cmd": "npx playwright test",
        "shell": True,
    },
    "full": {
        "label": "Full Pipeline",
        "cmd": "npm run test:e2e",
        "shell": True,
    },
}

JOBS = {}
JOBS_LOCK = threading.Lock()


def _run_job(job_id, cmd, shell):
    entry = JOBS[job_id]
    env = os.environ.copy()
    dotenv_path = os.path.join(ROOT, ".env")
    if os.path.exists(dotenv_path):
        from dotenv import dotenv_values
        env.update(dotenv_values(dotenv_path))
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    try:
        proc = subprocess.Popen(
            cmd, cwd=ROOT, shell=shell, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
        entry["process"] = proc
        for line in proc.stdout:
            entry["queue"].put(line.rstrip("\n"))
        proc.wait()
        entry["returncode"] = proc.returncode
        if entry["status"] != "stopped":
            entry["status"] = "done" if proc.returncode == 0 else "failed"
    except Exception as e:
        if entry["status"] != "stopped":
            entry["queue"].put(f"[Dashboard] Failed to launch pipeline: {e}")
            entry["status"] = "error"
    finally:
        entry["queue"].put(None)


@app.route("/api/pipeline/commands")
def api_pipeline_commands():
    return jsonify({k: v["label"] for k, v in PIPELINE_COMMANDS.items()})


@app.route("/api/pipeline/run", methods=["POST"])
def api_pipeline_run():
    body = request.get_json(silent=True) or {}
    mode = body.get("mode")
    spec = PIPELINE_COMMANDS.get(mode)
    if not spec:
        return jsonify({"error": f"unknown mode '{mode}'"}), 400

    with JOBS_LOCK:
        if any(j["status"] == "running" for j in JOBS.values()):
            return jsonify({"error": "a pipeline job is already running"}), 409
        job_id = uuid.uuid4().hex[:12]
        JOBS[job_id] = {"queue": Queue(), "status": "running", "process": None,
                         "returncode": None, "mode": mode}

    thread = threading.Thread(target=_run_job, args=(job_id, spec["cmd"], spec["shell"]), daemon=True)
    thread.start()
    return jsonify({"job_id": job_id, "mode": mode, "label": spec["label"]})


@app.route("/api/pipeline/stop", methods=["POST"])
def api_pipeline_stop():
    body = request.get_json(silent=True) or {}
    job_id = body.get("job_id")
    with JOBS_LOCK:
        entry = JOBS.get(job_id) if job_id else None
        if not entry:
            running_jobs = [j for j in JOBS.values() if j.get("status") == "running"]
            entry = running_jobs[0] if running_jobs else None

        if not entry or entry.get("status") != "running":
            return jsonify({"message": "No active pipeline job to stop"}), 200

        entry["status"] = "stopped"
        proc = entry.get("process")
        if proc and proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                                   capture_output=True, text=True)
                else:
                    proc.kill()
            except Exception as e:
                print(f"[Dashboard] Error terminating process {proc.pid}: {e}")

        entry["queue"].put("\n[Dashboard] 🛑 Pipeline execution stopped by user.")
        entry["queue"].put(None)

    return jsonify({"success": True, "message": "Pipeline stopped successfully"})


@app.route("/api/pipeline/status/<job_id>")
def api_pipeline_status(job_id):
    entry = JOBS.get(job_id)
    if not entry:
        return jsonify({"error": "unknown job"}), 404
    return jsonify({"status": entry["status"], "returncode": entry["returncode"], "mode": entry["mode"]})


@app.route("/api/pipeline/stream/<job_id>")
def api_pipeline_stream(job_id):
    entry = JOBS.get(job_id)
    if not entry:
        return jsonify({"error": "unknown job"}), 404

    def generate():
        q: Queue = entry["queue"]
        while True:
            try:
                line = q.get(timeout=30)
            except Empty:
                yield ": keep-alive\n\n"
                continue
            if line is None:
                yield f"event: done\ndata: {json.dumps({'returncode': entry['returncode'], 'status': entry['status']})}\n\n"
                break
            yield f"data: {json.dumps(line)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Static SPA
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


if __name__ == "__main__":
    print(f"[Dashboard] ShipConsole AI Evaluation Command Center")
    print(f"[Dashboard] Serving runs from: {os.path.join(REPORTS_DIR, 'runs')}")
    print(f"[Dashboard] Open: http://127.0.0.1:5050\n")
    app.run(host="127.0.0.1", port=5050, debug=False, threaded=True)

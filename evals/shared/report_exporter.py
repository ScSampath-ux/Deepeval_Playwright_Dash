"""
ShipConsole AI Chatbot - Local Failure Report Exporter

This module parses DeepEval run data (.deepeval/.latest_run_full.json) after evaluation completes
and exports structured JSON and Markdown failure reports into the reports/ directory.
"""

import os
import json


def export_failure_reports(latest_run_path: str, reports_dir: str):
    """
    Parses DeepEval test run results and exports failed evaluation test cases to JSON and Markdown.

    :param latest_run_path: Absolute path to .deepeval/.latest_run_full.json
    :param reports_dir: Path to output reports directory
    """
    if not os.path.exists(latest_run_path):
        return

    try:
        with open(latest_run_path, "r", encoding="utf-8") as f:
            run_data = json.load(f)

        test_cases_data = run_data.get("testCases", []) or run_data.get("testCasesData", [])
        failed_cases = []

        md_lines = [
            "# ShipConsole AI Chatbot - Failed Evaluations Report",
            "\nThis report highlights all evaluation test cases that failed to meet metric thresholds.\n"
        ]

        idx = 0
        for tc in test_cases_data:
            metrics_data = tc.get("metricsData", [])
            has_failure = any(not m.get("success", True) for m in metrics_data)

            if has_failure:
                idx += 1
                failed_metrics = []
                for m in metrics_data:
                    if not m.get("success", True):
                        failed_metrics.append({
                            "metric_name": m.get("name"),
                            "score": m.get("score"),
                            "threshold": m.get("threshold"),
                            "reason": m.get("reason")
                        })

                case_data = {
                    "case_id": f"failed_case_{idx}",
                    "input": tc.get("input"),
                    "actual_output": tc.get("actualOutput"),
                    "expected_output": tc.get("expectedOutput"),
                    "failed_metrics": failed_metrics
                }
                failed_cases.append(case_data)

                # Format Markdown details
                md_lines.append(f"## Failure #{idx}: {tc.get('input')}\n")
                md_lines.append(f"**Input**:\n```\n{tc.get('input')}\n```\n")
                md_lines.append(f"**Actual UI Output**:\n```\n{tc.get('actualOutput')}\n```\n")
                md_lines.append(f"**Expected Output**:\n```\n{tc.get('expectedOutput')}\n```\n")
                md_lines.append("### Failed Metrics Breakdown:")
                for fm in failed_metrics:
                    md_lines.append(f"- **Metric**: `{fm['metric_name']}` (Score: `{fm['score']}` / Threshold: `{fm['threshold']}`)")
                    md_lines.append(f"  - **Reason**: {fm['reason']}\n")
                md_lines.append("\n---\n")

        # Save JSON Report
        failed_json_path = os.path.join(reports_dir, "failed_evaluations.json")
        with open(failed_json_path, "w", encoding="utf-8") as f:
            json.dump(failed_cases, f, indent=4, ensure_ascii=False)

        # Save Markdown Report
        failed_md_path = os.path.join(reports_dir, "failed_evaluations_report.md")
        with open(failed_md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))

        print(f"[Report Exporter] Exported {len(failed_cases)} failed test case(s) to:")
        print(f"  - JSON: {failed_json_path}")
        print(f"  - Markdown: {failed_md_path}\n")

    except Exception as e:
        print(f"[Warning] Failed to generate local failure reports: {e}")

"""
ShipConsole AI Chatbot - Step 3: DeepEval Evaluation Suite & Reporting Runner

This script executes the production evaluation metrics against the captured Playwright UI
chatbot outputs, generates local JSON/Markdown failure reports, and exports a formatted Excel workbook.

Pipeline Position:
  - Step 1: DeepEval Synthesizer (evals/synthesize_dataset.py)
  - Step 2: Playwright UI Automation (e2e/tests/chatbot.spec.js)
  - Step 3: DeepEval Evaluation Suite (this module)
"""

import os
import sys
import json
from datetime import datetime, timezone

# Ensure UTF-8 console encoding on Windows for Rich console rendering
os.environ["PYTHONIOENCODING"] = "utf-8"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv()

# Disable DeepEval telemetry and Confident AI cloud upload globally before any deepeval imports run
os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
os.environ["DEEPEVAL_TELEMETRY"] = "no"
os.environ["DEEPEVAL_CONFIDENT_AI_OPT_OUT"] = "YES"
os.environ.pop("CONFIDENT_API_KEY", None)

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.evaluate.configs import ErrorConfig

# Ensure project root is in sys.path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from evals.shared.deepeval_bedrock import BedrockLLM
from evals.metrics.suite import get_evaluation_metrics
from evals.shared.report_exporter import export_failure_reports
from evals.shared.excel_exporter import export_results_to_excel

# Centralized Data & Report Paths
DATASET_PATH = os.path.join(_ROOT, "evals", "datasets", "synthesized_safety_dataset.json")
REPORTS_DIR = os.path.join(_ROOT, "reports")
LATEST_RUN_PATH = os.path.join(_ROOT, ".deepeval", ".latest_run_full.json")
os.makedirs(REPORTS_DIR, exist_ok=True)


def load_evaluation_test_cases():
    """
    Loads dataset JSON containing actual_output captured by Playwright UI automation
    and constructs LLMTestCase objects.
    """
    existing_data = []
    if os.path.exists(DATASET_PATH) and os.path.getsize(DATASET_PATH) > 0:
        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                if not isinstance(existing_data, list):
                    existing_data = []
        except Exception as e:
            print(f"\n[Warning] Failed to load dataset: {e}\n")
            existing_data = []

    print(f"\n[DeepEval Engine] Loaded {len(existing_data)} test case(s) from: {DATASET_PATH}")

    test_cases = []
    for item in existing_data:
        actual_out = item.get("actual_output")
        if not actual_out or str(actual_out).strip() == "":
            print(f"[Skip] Prompt '{item.get('input')[:40]}...' missing actual_output. Run Playwright UI test first.")
            continue

        # Retrieval context fallback for contextual metrics
        retrieval_ctx = item.get("retrieval_context")
        if not retrieval_ctx:
            exp = item.get("expected_output")
            retrieval_ctx = [exp] if exp else [item["input"]]

        test_cases.append(
            LLMTestCase(
                input=item["input"],
                expected_output=item.get("expected_output"),
                actual_output=actual_out,
                retrieval_context=retrieval_ctx
            )
        )

    return test_cases


def run_evaluation_suite():
    """
    Executes the evaluation metrics, exports failure reports, generates Excel workbook, and persists run data.
    """
    test_cases = load_evaluation_test_cases()
    if not test_cases:
        print("\n[Warning] No test cases found with populated actual_output. Run Playwright UI test (Step 2) first.")
        return

    # Initialize Bedrock LLM evaluator & metrics suite
    bedrock_eval_llm = BedrockLLM()
    metrics_list = get_evaluation_metrics(bedrock_eval_llm)

    print(f"\n[DeepEval Engine] Running 13 evaluation metrics on {len(test_cases)} test case(s)...")
    evaluate(test_cases=test_cases, metrics=metrics_list, error_config=ErrorConfig(ignore_errors=True))

    # Export Local Reports (JSON, Markdown, and Excel Workbook)
    export_failure_reports(LATEST_RUN_PATH, REPORTS_DIR)
    export_results_to_excel(LATEST_RUN_PATH, REPORTS_DIR)

    # Persist this run to reports/runs/ for the Evaluation Command Center dashboard.
    # Guarded so deleting dashboard/ never breaks core pipeline execution.
    try:
        from dashboard.run_store import persist_run
        run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        timestamp_iso = datetime.now(timezone.utc).isoformat()
        persist_run(
            LATEST_RUN_PATH,
            REPORTS_DIR,
            run_id=run_id,
            timestamp_iso=timestamp_iso,
            model_used=bedrock_eval_llm.get_model_name(),
            dataset_source=os.path.basename(DATASET_PATH),
        )
    except Exception as e:
        print(f"[Dashboard] Skipping run persistence: {e}")


if __name__ == "__main__":
    run_evaluation_suite()

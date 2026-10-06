"""
ShipConsole AI Chatbot - Langfuse Cloud Exporter

This module syncs evaluation traces, inputs, expected outputs, live UI responses,
and 13 metric scores directly with Langfuse Cloud (https://us.cloud.langfuse.com).
"""

import os
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


def export_results_to_langfuse(test_cases: List[Any], run_data: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """
    Exports evaluation test cases and metric scores to Langfuse Cloud using Langfuse v4 API.

    :param test_cases: List of DeepEval LLMTestCase objects
    :param run_data: Optional dictionary loaded from .deepeval/.latest_run_full.json
    :return: Mapping of {input_prompt: langfuse_trace_url} for cases successfully synced,
             so callers (e.g. the dashboard run persister) can attach deep links per case.
    """
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    host = os.getenv("LANGFUSE_HOST") or os.getenv("LANGFUSE_BASE_URL") or "https://us.cloud.langfuse.com"

    trace_urls: Dict[str, str] = {}

    if not (public_key and secret_key):
        print("[Langfuse Exporter] API keys missing in .env. Skipping export.")
        return trace_urls

    try:
        from langfuse import Langfuse
        langfuse = Langfuse(public_key=public_key, secret_key=secret_key, host=host)
        print(f"\n[Langfuse] Connected to {host}. Syncing {len(test_cases)} evaluation trace(s)...")

        # Map metrics by test case input prompt if run_data is provided
        tc_metrics_map = {}
        if run_data and isinstance(run_data, dict):
            for tc in run_data.get("testCases", []):
                tc_metrics_map[tc.get("input", "").strip()] = tc.get("metricsData", [])

        for tc in test_cases:
            prompt_text = tc.input
            actual_out = tc.actual_output
            expected_out = tc.expected_output

            # Start trace observation in Langfuse Cloud
            obs = langfuse.start_observation(
                name="ShipConsole_AI_Chatbot_Eval",
                input=prompt_text,
                output=actual_out,
                metadata={
                    "expected_output": expected_out,
                    "target_url": "https://sandbox.shipconsole.com/ShipConsole/login"
                }
            )

            trace_id = getattr(obs, "trace_id", None) or getattr(obs, "id", None)
            obs.end()

            if trace_id:
                try:
                    trace_url = langfuse.get_trace_url(trace_id=trace_id)
                    if trace_url:
                        trace_urls[prompt_text.strip()] = trace_url
                except Exception:
                    pass

            # Push evaluated metric scores attached to this trace ID
            metrics = tc_metrics_map.get(prompt_text.strip(), [])
            for m in metrics:
                metric_name = m.get("name", "Metric")
                score_val = float(m.get("score", 0.0))
                reason = m.get("reason", "")

                try:
                    langfuse.create_score(
                        trace_id=trace_id,
                        observation_id=getattr(obs, "id", None),
                        name=metric_name,
                        value=score_val,
                        comment=reason
                    )
                except Exception as se:
                    print(f"[Langfuse Warning] Could not attach score '{metric_name}': {se}")

        langfuse.flush()
        print(f"[Langfuse] Successfully synced {len(test_cases)} evaluation trace(s) with Langfuse Cloud!\n")

    except ImportError:
        print("[Langfuse Exporter] Package 'langfuse' not installed in active environment.")
    except Exception as e:
        print(f"[Langfuse Exporter] Warning: Failed to export to Langfuse: {e}")

    return trace_urls


if __name__ == "__main__":
    from deepeval.test_case import LLMTestCase
    sample_tc = [LLMTestCase(input="Test Prompt", actual_output="Test Output", expected_output="Expected")]
    export_results_to_langfuse(sample_tc)

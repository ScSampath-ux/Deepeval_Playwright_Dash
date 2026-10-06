"""
ShipConsole AI Chatbot - Step 1: DeepEval Dataset Synthesizer

This module automatically synthesizes new, unique test cases (input prompts and expected policy
goldens) from evals/datasets/safety_policies.txt using AWS Bedrock.

Pipeline Position:
  - Step 1: DeepEval Synthesizer (this module)
  - Step 2: Playwright UI Automation (e2e/tests/chatbot.spec.js)
  - Step 3: DeepEval Evaluation Suite (evals/test_agent_synthesized.py)
"""

import os
import sys
import json
from typing import List, Dict, Any, Tuple, Set

from dotenv import load_dotenv
load_dotenv()

os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
os.environ["DEEPEVAL_TELEMETRY"] = "no"
os.environ["DEEPEVAL_CONFIDENT_AI_OPT_OUT"] = "YES"
os.environ.pop("CONFIDENT_API_KEY", None)

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

DATASET_PATH = os.path.join(_ROOT, "evals", "datasets", "synthesized_safety_dataset.json")
POLICY_DOC_PATH = os.path.join(_ROOT, "evals", "datasets", "policies.txt")


def load_existing_dataset() -> Tuple[List[Dict[str, Any]], Set[str]]:
    """
    Loads existing dataset items from JSON and extracts lowercased input prompts for deduplication.

    :return: Tuple of (existing_data_list, existing_inputs_set)
    """
    existing_data = []
    existing_inputs = set()

    if os.path.exists(DATASET_PATH) and os.path.getsize(DATASET_PATH) > 0:
        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                if not isinstance(existing_data, list):
                    existing_data = []
        except Exception as e:
            print(f"[Synthesizer Warning] Failed to parse existing dataset JSON: {e}")
            existing_data = []

    for item in existing_data:
        inp = item.get("input", "").strip().lower()
        if inp:
            existing_inputs.add(inp)

    return existing_data, existing_inputs


def synthesize_unique_goldens(existing_data: List[Dict[str, Any]], existing_inputs: Set[str]) -> List[Dict[str, Any]]:
    """
    Synthesizes unique test goldens from safety_policies.txt using AWS Bedrock and appends them to existing_data.

    :param existing_data: Current list of dataset dictionaries
    :param existing_inputs: Set of existing lowercased input prompts
    :return: Updated dataset list
    """
    if not os.path.exists(POLICY_DOC_PATH):
        print(f"[Synthesizer Warning] Policy document not found at: {POLICY_DOC_PATH}")
        return existing_data

    try:
        from deepeval.synthesizer import Synthesizer
        from deepeval.synthesizer.config import ContextConstructionConfig
        from evals.shared.deepeval_bedrock import BedrockLLM, BedrockEmbeddingModel

        bedrock_eval_llm = BedrockLLM()
        bedrock_embed_model = BedrockEmbeddingModel()

        print(f"[Step 1: DeepEval Synthesizer] Synthesizing new unique test cases from: {POLICY_DOC_PATH}...")
        synthesizer = Synthesizer(model=bedrock_eval_llm)
        context_config = ContextConstructionConfig(
            embedder=bedrock_embed_model,
            critic_model=bedrock_eval_llm
        )

        goldens = synthesizer.generate_goldens_from_docs(
            document_paths=[POLICY_DOC_PATH],
            context_construction_config=context_config
        )

        # Configurable limit for synthesized questions per run (default: 3)
        max_questions = int(os.getenv("MAX_QUESTIONS", "3"))

        added_count = 0
        for golden in goldens:
            if added_count >= max_questions:
                break
            prompt = golden.input.strip()
            # Deduplication Check: Skip if input is already present
            if prompt.lower() not in existing_inputs:
                existing_inputs.add(prompt.lower())
                existing_data.append({
                    "input": prompt,
                    "expected_output": golden.expected_output,
                    "actual_output": None  # Blank for Playwright to populate in Step 2
                })
                added_count += 1

        print(f"[Step 1: DeepEval Synthesizer] Added {added_count} (limit: {max_questions}) brand-new unique test case(s) (blank actual_output).")

    except Exception as e:
        print(f"[Step 1 Warning] Synthesizer generation skipped: {e}")

    return existing_data


def save_dataset(data: List[Dict[str, Any]]) -> None:
    """
    Saves the dataset list to JSON file on disk.

    :param data: Complete list of dataset dictionaries
    """
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def generate_unique_dataset() -> None:
    """
    Orchestrates loading existing dataset, synthesizing unique questions, and saving to disk.
    """
    existing_data, existing_inputs = load_existing_dataset()
    print(f"\n[Step 1: DeepEval Synthesizer] Found {len(existing_inputs)} existing unique prompt(s) in dataset.")
    updated_data = synthesize_unique_goldens(existing_data, existing_inputs)
    save_dataset(updated_data)


if __name__ == "__main__":
    generate_unique_dataset()

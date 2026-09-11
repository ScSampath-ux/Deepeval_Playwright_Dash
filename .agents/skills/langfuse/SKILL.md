---
name: langfuse
description: Langfuse LLM Observability, Prompt Tracing, and Evaluation exporter for Python and DeepEval applications.
---

# Langfuse Observability Skill

This skill provides best practices for integrating Langfuse LLM tracing and evaluation score exports into Python and DeepEval applications.

## Key Features
1. **Trace Export**: Automatically creates execution traces for every test case prompt and live AI response.
2. **Metric Score Logging**: Sends DeepEval metric scores (Toxicity, Bias, GEval, Relevancy, Recall) directly to Langfuse.
3. **Environment Setup**: Reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` from `.env`.

## Usage Pattern
```python
from langfuse import Langfuse

langfuse = Langfuse()

trace = langfuse.trace(
    name="ShipConsole_AI_Chatbot_Eval",
    input=test_case.input,
    output=test_case.actual_output,
    metadata={"expected_output": test_case.expected_output}
)

# Attach DeepEval metric scores to the trace
trace.score(name="GEval_Business_Rule", value=0.85)
langfuse.flush()
```

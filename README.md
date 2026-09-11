# ShipConsole AI Chatbot Evaluation & E2E Testing Suite

Automated Playwright UI testing and DeepEval multi-metric evaluation framework connected to **Langfuse Cloud** for full observability, tracing, and metric scoring.

---

## 🚀 Execution Pipeline

```powershell
npm run test:e2e
```

### 3-Step Automated Workflow:
1. **Step 1 (DeepEval Synthesizer):** Synthesizes new, unique input prompts and expected policy goldens from `evals/datasets/safety_policies.txt` using AWS Bedrock (`actual_output: null`).
2. **Step 2 (Playwright UI Automation):** Logins to ShipConsole, sends input prompts sequentially to the live UI chatbot, waits for complete response streaming, and updates `actual_output` on disk per question.
3. **Step 3 (DeepEval Evaluation Engine):** Evaluates 13 domain metrics via AWS Bedrock, generates custom interactive HTML dashboard + Excel report, and syncs all traces & scores to **Langfuse Cloud**.

---

## 📊 Tracing & Monitoring via Langfuse Cloud

All evaluation runs, LLM calls, and metric scores are automatically exported to Langfuse:
- **Host:** `https://us.cloud.langfuse.com`
- **Tracing Module:** `evals/shared/langfuse_exporter.py`

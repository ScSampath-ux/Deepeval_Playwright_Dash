# ShipConsole AI Chatbot Evaluation & E2E Testing Suite

Automated Playwright UI testing and DeepEval multi-metric evaluation framework connected to **Langfuse Cloud** for full observability, tracing, and metric scoring.

---

## ⚡ Environment Setup & Activation

### 1. Activate Virtual Environment (PowerShell) Mandatory
```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies (Playwright, dotenv)
npm install

# Install Python evaluation & dashboard dependencies
pip install -r requirements.txt
```

---

## 🚀 Quick Start & Execution Pipelines

### Run Full 3-Step E2E Pipeline
```powershell
npm run test:e2e
```

### 3-Step Automated Workflow:
1. **Step 1 (DeepEval Synthesizer):** Synthesizes new, unique input prompts and expected policy goldens from `evals/datasets/safety_policies.txt` using AWS Bedrock (`actual_output: null`).
2. **Step 2 (Playwright UI Automation):** Logins to ShipConsole, sends input prompts sequentially to the live UI chatbot, waits for complete response streaming, and updates `actual_output` on disk per question.
3. **Step 3 (DeepEval Evaluation Engine):** Evaluates 13 domain metrics via AWS Bedrock, generates custom interactive HTML dashboard + Excel report, and syncs all traces & scores to **Langfuse Cloud**.

---

## 💻 Complete Command Reference

### 🌐 1. Dashboard Command
Starts the web-based Command Center Dashboard to view past run history, metric analytics, export Excel reports, and trigger pipeline executions.

| Command | Action |
| :--- | :--- |
| `npm run dashboard` | Runs the Flask Command Center server on [http://127.0.0.1:5050](http://127.0.0.1:5050) |
| `python dashboard/server.py` | Direct Python alternative to start the dashboard server |

### 🚀 2. Pipeline Execution Commands (npm scripts)

| Command | Workflow Description |
| :--- | :--- |
| `npm run test:e2e` | **Full 3-Step Pipeline:** Synthesize dataset ➔ Playwright UI capture ➔ DeepEval metrics & Langfuse sync |
| `npm run test:p2e` | **Playwright + Evaluation:** Runs Playwright UI capture ➔ DeepEval metrics (skips prompt synthesis) |
| `npm run test:e2p` | **Synthesis + Playwright:** Synthesizes prompts ➔ Playwright UI capture (skips metrics evaluation) |
| `npm run test` | Runs **Playwright UI tests only** in headless mode |
| `npm run test:headed` | Runs **Playwright UI tests in headed mode** (opens visible browser window) |

### 🐍 3. Individual Python Scripts

| Command | Purpose |
| :--- | :--- |
| `python evals/synthesize_dataset.py` | **Step 1:** Generates synthetic input prompts & golden policy answers using AWS Bedrock |
| `python evals/test_agent_synthesized.py` | **Step 3:** Runs 13 DeepEval metrics, generates Excel/MD reports, and exports traces to Langfuse |
| `pytest evals/test_agent_synthesized.py` | Alternative way to run DeepEval evaluations using `pytest` |

### 🎭 4. Playwright CLI Commands

| Command | Purpose |
| :--- | :--- |
| `npx playwright test` | Runs Playwright tests headlessly |
| `npx playwright test --headed` | Runs Playwright tests with browser visible |
| `npx playwright show-report` | Opens local HTML Playwright test execution report in browser |

---

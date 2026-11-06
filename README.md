# ShipConsole AI Chatbot Evaluation & E2E Testing Suite

Automated Playwright UI testing and DeepEval multi-metric evaluation framework for the live ShipConsole AI Chatbot. Evaluates responses using AWS Bedrock and generates local reports (formatted Excel workbook, JSON/Markdown failure logs, and the local Command Center Dashboard).

**100% offline & local reporting** — zero external cloud tracing (Confident AI / Langfuse) required.

---

## 📋 Prerequisites

* **Node.js**: v18+ or v20+ LTS
* **Python**: 3.10 to 3.12
* **AWS Bedrock Access**: Model access enabled for Anthropic Claude models (e.g., Claude 3 / 3.5 Haiku)
* **ShipConsole Network**: Access to ShipConsole portal (`https://qa.shipconsole.com`)

---

## ⚡ Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/ScSampath-ux/Deepeval_Playwright_Dash.git
cd Deepeval_Playwright_Dash
```

### 2. Install Node & Playwright Dependencies
```bash
npm install
npx playwright install chromium
```

### 3. Create and Activate Virtual Environment

**Windows PowerShell:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:

* **Windows:**
  ```powershell
  copy .env.example .env
  ```
* **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

Open `.env` and fill in:
* `PORTAL_USERNAME` & `PORTAL_PASSWORD`: Your ShipConsole portal credentials.
* `AWS_REGION` & `AWS_USER` (or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`): Your AWS Bedrock credentials.

---

## 🚀 Execution Pipelines

### Run Full 3-Step E2E Pipeline
```powershell
npm run test:e2e
```

### 3-Step Automated Workflow:
1. **Step 1 (DeepEval Synthesizer):** Synthesizes new, unique input prompts and expected policy goldens from `evals/datasets/policies.txt` using AWS Bedrock (`actual_output: null`).
2. **Step 2 (Playwright UI Automation):** Logs in to ShipConsole, sends input prompts sequentially to the live UI chatbot, waits for complete response streaming, and incrementally saves `actual_output` to disk per question.
3. **Step 3 (DeepEval Evaluation Engine):** Evaluates live responses against policy goldens via AWS Bedrock, generates formatted Excel workbook (`reports/evaluation_results.xlsx`), JSON/Markdown failure logs, and records run data for the local dashboard.

---

## 💻 Complete Command Reference

### 🌐 1. Dashboard Command
Starts the local Command Center Dashboard to view past run history, metric analytics, export Excel reports, and trigger pipeline executions.

| Command | Action |
| :--- | :--- |
| `npm run dashboard` | Runs the Flask Command Center server on [http://127.0.0.1:5050](http://127.0.0.1:5050) |
| `python dashboard/server.py` | Direct Python alternative to start the dashboard server |

### 🚀 2. Pipeline Execution Commands (npm scripts)

| Command | Workflow Description |
| :--- | :--- |
| `npm run test:e2e` | **Full 3-Step Pipeline:** Synthesize dataset ➔ Playwright UI capture ➔ DeepEval metrics & local Excel report |
| `npm run test:p2e` | **Playwright + Evaluation:** Runs Playwright UI capture ➔ DeepEval metrics (skips prompt synthesis) |
| `npm run test:e2p` | **Synthesis + Playwright:** Synthesizes prompts ➔ Playwright UI capture (skips metrics evaluation) |
| `npm run test` | Runs **Playwright UI tests only** in headless mode |
| `npm run test:headed` | Runs **Playwright UI tests in headed mode** (opens visible browser window) |

### 🐍 3. Individual Python Scripts

| Command | Purpose |
| :--- | :--- |
| `python evals/synthesize_dataset.py` | **Step 1:** Generates synthetic input prompts & golden policy answers using AWS Bedrock |
| `python evals/test_agent_synthesized.py` | **Step 3:** Runs DeepEval metrics, generates Excel/MD reports, and persists run data |
| `pytest evals/test_agent_synthesized.py` | Alternative way to run DeepEval evaluations using `pytest` |

### 🎭 4. Playwright CLI Commands

| Command | Purpose |
| :--- | :--- |
| `npx playwright test` | Runs Playwright tests headlessly |
| `npx playwright test --headed` | Runs Playwright tests with browser visible |
| `npx playwright show-report` | Opens local HTML Playwright test execution report in browser |

---

## 📊 Output Reports

All evaluation outputs are strictly saved locally under the `reports/` directory:
* **Executive Excel Workbook:** `reports/evaluation_results.xlsx` (multi-sheet workbook with KPI summary, pass/fail scores, and embedded charts)
* **Failure Analysis Logs:** `reports/failed_evaluations.json` and `reports/failed_evaluations_report.md`
* **Historical Run Records:** `reports/runs/run_<timestamp>.json` (browsable in the local Command Center dashboard at `http://127.0.0.1:5050`)

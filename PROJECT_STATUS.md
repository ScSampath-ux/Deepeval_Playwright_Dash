# 🚀 ShipConsole AI Chatbot - Project Status & Living Document

**Last Updated:** 2026-11-06  
**Project Name:** ShipConsole AI Chatbot E2E UI Automation & DeepEval Evaluation Suite  
**Repository:** `Deepeval_Playwright_Dash`  
**Overall Status:** 🟢 **Active & Operational** (3-Step Pipeline Functioning with Local Excel & Command Center Dashboard)

---

## 📊 1. Executive Summary & Health Dashboard

| Indicator | Status | Details |
| :--- | :--- | :--- |
| **Pipeline Workflow** | 🟢 **Healthy** | 3-Step Automated Pipeline (`npm run test:e2e`) |
| **Synthesizer Engine** | 🟢 **Active** | Deduplicated generation from `policies.txt` via AWS Bedrock |
| **Playwright UI Automation** | 🟢 **Active** | Sequential prompt execution & actual_output capture |
| **DeepEval Evaluation Engine** | 🟢 **Active** | Domain Evaluation Metrics (Safety, Relevancy, Guardrails, Business Rules) |
| **Local Dashboard** | 🟢 **Active** | **Command Center Dashboard** (`http://127.0.0.1:5050`) |
| **Executive Reports** | 🟢 **Active** | Formatted Excel Workbook (`reports/evaluation_results.xlsx`) & JSON/MD Failure Logs |

---

## 🎯 2. Active Milestones & Feature Status

| Module | Feature / Requirement | Status | Completed Date | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Step 1: Dataset Synthesizer** | Auto-generate unique questions | ✅ Complete | 2026-08-06 | Uses AWS Bedrock (`actual_output: null`) |
| **Step 1: Dataset Synthesizer** | Deduplicate prompts vs JSON | ✅ Complete | 2026-08-06 | Avoids duplicating existing dataset questions |
| **Step 2: Playwright UI** | Portal Login POM | ✅ Complete | 2026-08-06 | `LoginPage.js` handles login & redirect |
| **Step 2: Playwright UI** | Chatbot Drawer POM | ✅ Complete | 2026-08-06 | `ChatbotWidget.js` streams & polls responses |
| **Step 2: Playwright UI** | Skip Populated Questions | ✅ Complete | 2026-08-10 | Only sends prompts where `actual_output` is missing |
| **Step 2: Playwright UI** | Per-Question Disk Save | ✅ Complete | 2026-08-06 | Saves `actual_output` immediately after each response |
| **Step 3: DeepEval Engine** | Evaluation Metrics Suite | ✅ Complete | 2026-08-10 | Encapsulated in `evals/metrics/suite.py` |
| **Step 3: DeepEval Engine** | AWS Bedrock Evaluator Driver | ✅ Complete | 2026-08-06 | Anthropic Claude via `ChatBedrockConverse` |
| **Step 3: DeepEval Engine** | Failure Exporter Utility | ✅ Complete | 2026-08-10 | `export_failure_reports()` parses `testCases` key |
| **Executive Reporting** | Excel Workbook Exporter | ✅ Complete | 2026-08-10 | Auto-generates multi-sheet `.xlsx` with charts |
| **Observability** | Command Center Dashboard | ✅ Complete | 2026-08-10 | Local Flask SPA with run histories & SSE runner |
| **Code Cleanup** | Remove Cloud Tracing (Confident / Langfuse) | ✅ Complete | 2026-11-06 | Dependencies & cloud configs removed (100% local) |

---

## 📜 3. Architectural Decisions Log (ADR)

| ADR # | Decision Title | Context & Rationale | Status |
| :---: | :--- | :--- | :---: |
| **ADR-01** | **AWS Bedrock LLM Integration** | Route evaluator model calls and embeddings through AWS Bedrock (`ChatBedrockConverse` & `amazon.titan-embed-text-v1`) to comply with enterprise AWS credentials. | Approved |
| **ADR-02** | **100% Local Reporting Architecture** | Replace external cloud tracing (Confident AI / Langfuse) with local formatted Excel workbooks (`reports/evaluation_results.xlsx`) and the Flask Command Center dashboard (`http://127.0.0.1:5050`) for data security and offline execution. | Approved |
| **ADR-03** | **Playwright Incremental actual_output Capture** | Playwright saves `actual_output` to disk immediately after each question and skips questions already populated to avoid redundant UI execution. | Approved |
| **ADR-04** | **Modular Codebase Restructuring** | Extract metrics to `evals/metrics/suite.py` and failure reporting to `evals/shared/report_exporter.py` to keep `test_agent_synthesized.py` clean and maintainable. | Approved |

---

## 📈 4. Latest Evaluation Run Statistics

* **Total Dataset Size:** 9 Prompts
* **Evaluated Prompts:** 9
* **Passed Prompts:** 0 (Chatbot returning default fallback message: *"No Information Found... Contact ShipConsole Support"*)
* **Failed Prompts:** 9 (Log saved in `reports/failed_evaluations.json`)
* **Primary Failure Cause:** Chatbot RAG knowledge base requires indexing for label printing, USCO, HazMat, and consolidation guidelines.

---

## 📋 5. Pending Action Items & Next Steps

1. 🟡 **Chatbot Knowledge Base Indexing:** Update the backend RAG agent with `safety_policies.txt` content so the live chatbot answers queries accurately instead of returning the default support fallback message.
2. 🟢 **Automated Excel Exporter:** Add `evals/shared/excel_exporter.py` to automatically output formatted `.xlsx` execution spreadsheets to `reports/evaluation_results.xlsx`.

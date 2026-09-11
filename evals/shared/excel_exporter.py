"""
ShipConsole AI Chatbot - Automated Excel Exporter

Parses DeepEval evaluation results (.deepeval/.latest_run_full.json) and exports
a formatted multi-tab Excel workbook to reports/evaluation_results.xlsx.

Tabs Generated:
  1. Executive Summary: High-level dashboard metrics & pass rate %
  2. Test Cases & UI Outputs: Complete prompt-by-prompt details and individual metric scores
  3. 13-Metric Breakdown: Aggregate scores, pass rates, and thresholds across all 13 metrics
  4. Failed Cases Log: Filtered view of failed test cases and failure reasons for debugging
"""

import os
import json
from datetime import datetime


def export_results_to_excel(latest_run_path: str, reports_dir: str):
    """
    Parses DeepEval test run results and generates reports/evaluation_results.xlsx.

    :param latest_run_path: Absolute path to .deepeval/.latest_run_full.json
    :param reports_dir: Path to output reports directory
    """
    if not os.path.exists(latest_run_path):
        print(f"[Excel Exporter Warning] Run results file not found at: {latest_run_path}")
        return

    excel_path = os.path.join(reports_dir, "evaluation_results.xlsx")

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        with open(latest_run_path, "r", encoding="utf-8") as f:
            run_data = json.load(f)

        test_cases_data = run_data.get("testCases", []) or run_data.get("testCasesData", [])
        if not test_cases_data:
            print("[Excel Exporter Warning] No test cases found in run results data.")
            return

        wb = openpyxl.Workbook()

        # Styles
        header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        pass_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
        pass_font = Font(name="Calibri", size=10, bold=True, color="375623")
        fail_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
        fail_font = Font(name="Calibri", size=10, bold=True, color="C65911")
        align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='D9D9D9'),
            right=Side(style='thin', color='D9D9D9'),
            top=Side(style='thin', color='D9D9D9'),
            bottom=Side(style='thin', color='D9D9D9')
        )

        total_cases = len(test_cases_data)
        passed_cases = sum(1 for tc in test_cases_data if all(m.get("success", True) for m in tc.get("metricsData", [])))
        failed_cases_count = total_cases - passed_cases
        pass_rate = (passed_cases / total_cases * 100) if total_cases > 0 else 0

        # =========================================================================
        # SHEET 1: Executive Summary
        # =========================================================================
        ws1 = wb.active
        ws1.title = "Executive Summary"
        ws1.views.sheetView[0].showGridLines = True

        ws1.cell(row=1, column=1, value="ShipConsole AI Chatbot - Evaluation Summary").font = Font(name="Calibri", size=16, bold=True, color="1F4E78")

        summary_headers = ["Metric Indicator", "Value", "Notes"]
        for col_idx, h in enumerate(summary_headers, 1):
            cell = ws1.cell(row=3, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = align_center

        summary_data = [
            ("Execution Timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Timestamp of evaluation run"),
            ("Target Portal URL", "http://scdocker.shipconsole.com:9001/parcel-shipping", "Live portal environment"),
            ("Total Test Cases", total_cases, "Prompts processed"),
            ("Passed Test Cases", passed_cases, "Passed all 13 metrics"),
            ("Failed Test Cases", failed_cases_count, "Failed 1 or more metrics"),
            ("Overall Pass Rate (%)", f"{pass_rate:.1f}%", "Suite success rate"),
            ("Metrics Evaluated", 13, "Safety, Relevancy, Guardrails, Business Rules"),
            ("Cloud Observability", "Langfuse Cloud", "https://us.cloud.langfuse.com")
        ]

        for r_idx, (k, v, desc) in enumerate(summary_data, 4):
            c1 = ws1.cell(row=r_idx, column=1, value=k)
            c2 = ws1.cell(row=r_idx, column=2, value=v)
            c3 = ws1.cell(row=r_idx, column=3, value=desc)
            c1.border = thin_border
            c2.border = thin_border
            c3.border = thin_border
            c1.alignment = align_left
            c2.alignment = align_center
            c3.alignment = align_left
            if k == "Overall Pass Rate (%)":
                c2.fill = pass_fill if pass_rate >= 80 else fail_fill
                c2.font = pass_font if pass_rate >= 80 else fail_font

        # =========================================================================
        # SHEET 2: Test Cases & UI Outputs
        # =========================================================================
        ws2 = wb.create_sheet(title="Test Cases & UI Outputs")
        ws2.views.sheetView[0].showGridLines = True

        tc_headers = ["Case ID", "Input Prompt", "Expected Output (Golden)", "Actual UI Output", "Status", "Failed Metrics"]
        for col_idx, h in enumerate(tc_headers, 1):
            cell = ws2.cell(row=1, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = align_center

        for idx, tc in enumerate(test_cases_data, 1):
            row_num = idx + 1
            metrics_data = tc.get("metricsData", [])
            has_fail = any(not m.get("success", True) for m in metrics_data)
            failed_count = sum(1 for m in metrics_data if not m.get("success", True))
            status_text = "FAIL" if has_fail else "PASS"

            c_id = ws2.cell(row=row_num, column=1, value=f"TC_{idx:03d}")
            c_inp = ws2.cell(row=row_num, column=2, value=tc.get("input", ""))
            c_exp = ws2.cell(row=row_num, column=3, value=tc.get("expectedOutput", ""))
            c_act = ws2.cell(row=row_num, column=4, value=tc.get("actualOutput", ""))
            c_sts = ws2.cell(row=row_num, column=5, value=status_text)
            c_cnt = ws2.cell(row=row_num, column=6, value=failed_count)

            for c in [c_id, c_inp, c_exp, c_act, c_sts, c_cnt]:
                c.border = thin_border
                c.alignment = align_left

            c_id.alignment = align_center
            c_sts.alignment = align_center
            c_cnt.alignment = align_center

            c_sts.fill = fail_fill if has_fail else pass_fill
            c_sts.font = fail_font if has_fail else pass_font

        # =========================================================================
        # SHEET 3: 13-Metric Breakdown
        # =========================================================================
        ws3 = wb.create_sheet(title="13-Metric Breakdown")
        ws3.views.sheetView[0].showGridLines = True

        m_headers = ["Metric Name", "Threshold", "Average Score", "Pass Rate (%)", "Status"]
        for col_idx, h in enumerate(m_headers, 1):
            cell = ws3.cell(row=1, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = align_center

        # Aggregate metric calculations
        metrics_stats = {}
        for tc in test_cases_data:
            for m in tc.get("metricsData", []):
                m_name = m.get("name")
                if m_name not in metrics_stats:
                    metrics_stats[m_name] = {"scores": [], "successes": [], "threshold": m.get("threshold", 0.7)}
                metrics_stats[m_name]["scores"].append(float(m.get("score", 0.0)))
                metrics_stats[m_name]["successes"].append(1 if m.get("success", True) else 0)

        r_num = 2
        for m_name, s in metrics_stats.items():
            avg_score = sum(s["scores"]) / len(s["scores"]) if s["scores"] else 0.0
            m_pass_rate = (sum(s["successes"]) / len(s["successes"]) * 100) if s["successes"] else 0.0
            m_status = "HEALTHY" if m_pass_rate >= 80 else "NEEDS ATTENTION"

            cm1 = ws3.cell(row=r_num, column=1, value=m_name)
            cm2 = ws3.cell(row=r_num, column=2, value=s["threshold"])
            cm3 = ws3.cell(row=r_num, column=3, value=round(avg_score, 2))
            cm4 = ws3.cell(row=r_num, column=4, value=f"{m_pass_rate:.1f}%")
            cm5 = ws3.cell(row=r_num, column=5, value=m_status)

            for c in [cm1, cm2, cm3, cm4, cm5]:
                c.border = thin_border
                c.alignment = align_center

            cm1.alignment = align_left
            cm5.fill = pass_fill if m_pass_rate >= 80 else fail_fill
            cm5.font = pass_font if m_pass_rate >= 80 else fail_font
            r_num += 1

        # =========================================================================
        # SHEET 4: Failed Cases Log
        # =========================================================================
        ws4 = wb.create_sheet(title="Failed Cases Log")
        ws4.views.sheetView[0].showGridLines = True

        f_headers = ["Failure ID", "Input Prompt", "Actual UI Output", "Expected Output", "Failed Metric", "Score / Threshold", "Reason"]
        for col_idx, h in enumerate(f_headers, 1):
            cell = ws4.cell(row=1, column=col_idx, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = align_center

        fail_row = 2
        fail_idx = 0
        for tc in test_cases_data:
            metrics_data = tc.get("metricsData", [])
            for m in metrics_data:
                if not m.get("success", True):
                    fail_idx += 1
                    cf1 = ws4.cell(row=fail_row, column=1, value=f"FAIL_{fail_idx:03d}")
                    cf2 = ws4.cell(row=fail_row, column=2, value=tc.get("input", ""))
                    cf3 = ws4.cell(row=fail_row, column=3, value=tc.get("actualOutput", ""))
                    cf4 = ws4.cell(row=fail_row, column=4, value=tc.get("expectedOutput", ""))
                    cf5 = ws4.cell(row=fail_row, column=5, value=m.get("name", ""))
                    cf6 = ws4.cell(row=fail_row, column=6, value=f"{m.get('score', 0):.2f} / {m.get('threshold', 0):.2f}")
                    cf7 = ws4.cell(row=fail_row, column=7, value=m.get("reason", ""))

                    for c in [cf1, cf2, cf3, cf4, cf5, cf6, cf7]:
                        c.border = thin_border
                        c.alignment = align_left

                    cf1.alignment = align_center
                    cf6.alignment = align_center
                    fail_row += 1

        # Set Column Auto-Widths
        for ws in [ws1, ws2, ws3, ws4]:
            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

        # =========================================================================
        # EMBEDDED DASHBOARD CHARTS (PieChart & BarChart)
        # =========================================================================
        try:
            from openpyxl.chart import PieChart, BarChart, Reference

            # 1. Pass vs Fail Pie Chart on Executive Summary (at Cell E3)
            pie = PieChart()
            pie.title = "Overall Test Suite Pass vs Fail Ratio"
            pie_labels = Reference(ws1, min_col=1, min_row=7, max_row=8)
            pie_data = Reference(ws1, min_col=2, min_row=6, max_row=8)
            pie.add_data(pie_data, titles_from_data=True)
            pie.set_categories(pie_labels)
            pie.width = 16
            pie.height = 8.5
            ws1.add_chart(pie, "E3")

            # 2. 13-Metric Performance Clustered Bar Chart on Executive Summary (at Cell E19)
            bar = BarChart()
            bar.type = "col"
            bar.style = 10
            bar.title = "13-Metric Average Scores vs Target Thresholds"
            bar.y_axis.title = "Score (0.00 - 1.00)"
            bar.x_axis.title = "Evaluation Metrics"
            bar.width = 24
            bar.height = 12

            bar_data = Reference(ws3, min_col=2, min_row=1, max_col=3, max_row=r_num - 1)
            bar_cats = Reference(ws3, min_col=1, min_row=2, max_row=r_num - 1)
            bar.add_data(bar_data, titles_from_data=True)
            bar.set_categories(bar_cats)
            ws1.add_chart(bar, "E19")

        except Exception as chart_err:
            print(f"[Excel Exporter Warning] Could not render native charts: {chart_err}")

        try:
            wb.save(excel_path)
            print(f"[Excel Exporter] Successfully generated formatted Excel report with embedded Dashboard Charts at:\n  - {excel_path}\n")
        except PermissionError:
            fallback_path = os.path.join(reports_dir, "evaluation_results_latest.xlsx")
            wb.save(fallback_path)
            print(f"[Excel Exporter Warning] 'evaluation_results.xlsx' is locked by Microsoft Excel. Saved fallback report to:\n  - {fallback_path}\n")

    except ImportError:
        print("[Excel Exporter Warning] Package 'openpyxl' not installed. Skipping Excel generation.")
    except Exception as e:
        print(f"[Excel Exporter Warning] Failed to generate Excel workbook: {e}")


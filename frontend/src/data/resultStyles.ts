import type { TestRunCaseResult } from "../api/client";

// Result meaning is independent of the user's navigation/action accent.
export const resultTextClasses: Record<TestRunCaseResult, string> = {
  not_run: "text-not-run", passed: "text-success", failed: "text-danger", blocked: "text-warning", skipped: "text-skipped",
};
export const resultChartClasses: Record<TestRunCaseResult, string> = {
  not_run: "bg-not-run", passed: "bg-success-chart", failed: "bg-danger-chart", blocked: "bg-warning-chart", skipped: "bg-skipped",
};

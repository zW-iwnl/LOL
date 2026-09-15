import { describe, expect, it } from "vitest";
import { resultSummary, validateRunForm } from "./model";

describe("run workspace metrics", () => {
  it("distinguishes one passed test out of one hundred from success rate", () => {
    const summary = resultSummary([{ result: "passed" }, ...Array.from({ length: 99 }, () => ({ result: "not_run" as const }))]);
    expect(summary).toMatchObject({ executed: 1, total: 100, progress: 1, passRate: 100 });
    expect(resultSummary([])).toMatchObject({ progress: 0, passRate: null });
    expect(resultSummary([{ result: "blocked" }, { result: "skipped" }])).toMatchObject({ executed: 2, progress: 100, passRate: 0 });
  });
  it("validates names and dates consistently for editing and creation", () => {
    const form = { name: "Valid", task_number: "", description: "", environment: "CUSTOM", version: "", planned_start: "", planned_end: "" };
    expect(validateRunForm(form)).toBeNull();
    expect(validateRunForm({ ...form, name: " " })).toBeTruthy();
    expect(validateRunForm({ ...form, planned_start: "invalid" })).toBeTruthy();
    expect(validateRunForm({ ...form, planned_start: "2026-10-02T12:00", planned_end: "2026-10-01T12:00" })).toBeTruthy();
  });
});

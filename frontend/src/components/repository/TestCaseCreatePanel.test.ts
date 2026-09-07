import { describe, expect, it } from "vitest";

import {
  createEmptyStepDraft,
  prepareTestCaseSteps,
  type TestCaseStepDraft,
} from "./TestCaseCreatePanel";

function step(patch: Partial<TestCaseStepDraft> = {}): TestCaseStepDraft {
  return {
    ...createEmptyStepDraft(),
    ...patch,
  };
}

describe("prepareTestCaseSteps", () => {
  it("skips blank rows and assigns consecutive order", () => {
    const result = prepareTestCaseSteps([
      step({ action: "Otevřít přihlášení", expectedResult: "Formulář je zobrazen" }),
      step(),
      step({ action: "Zadat údaje", testData: "tester@example.com" }),
    ]);

    expect(result.error).toBeNull();
    expect(result.steps).toEqual([
      {
        step_order: 1,
        action: "Otevřít přihlášení",
        step_type: "test",
        note: null,
        expected_result: "Formulář je zobrazen",
        test_data: null,
      },
      {
        step_order: 2,
        action: "Zadat údaje",
        step_type: "test",
        note: null,
        expected_result: null,
        test_data: "tester@example.com",
      },
    ]);
  });

  it("requires an action when another step field is filled", () => {
    const result = prepareTestCaseSteps([
      step({ action: "První krok" }),
      step({ expectedResult: "Chybějící akce" }),
    ]);

    expect(result.error).toBe("Doplňte akci u kroku 2, nebo tento krok odeberte.");
    expect(result.steps).toEqual([]);
  });

  it("does not send test-only values for an information step", () => {
    const result = prepareTestCaseSteps([
      step({
        stepType: "information",
        action: "Test vyžaduje administrátorský účet",
        expectedResult: "Nepoužije se",
        testData: "Nepoužijí se",
        note: "Příprava",
      }),
    ]);

    expect(result.error).toBeNull();
    expect(result.steps[0]).toMatchObject({
      step_type: "information",
      expected_result: null,
      test_data: null,
      note: "Příprava",
    });
  });
});

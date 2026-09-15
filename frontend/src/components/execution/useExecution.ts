import { useCallback, useEffect, useRef, useState } from "react";
import { updateTestRunCaseResult, type TestRunCaseResult, type TestRunStepResultValue } from "../../api/client";
import { createTestRunCaseRerun, createTestRunRerun, getTestRunExecution, updateTestRunStepResult, type TestRunExecution } from "../../api/testRuns";

export function useExecution(runId: number, initialAttemptId?: number) {
  const [run, setRun] = useState<TestRunExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStepId, setSavingStepId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sequence = useRef(0);
  const mutationLock = useRef(false);

  const reload = useCallback(async (attemptId?: number | null) => {
    const requestId = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTestRunExecution(runId, attemptId);
      if (requestId === sequence.current) setRun(data);
      return data;
    } catch (reason) {
      if (requestId === sequence.current) setError(reason instanceof Error ? reason.message : "Provedení se nepodařilo načíst.");
      return null;
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void reload(initialAttemptId);
    return () => { sequence.current += 1; };
  }, [reload, initialAttemptId]);

  async function mutate(action: () => Promise<void>, stepId: number | null = null) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setSaving(true);
    setSavingStepId(stepId);
    setError(null);
    setMessage(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Změnu se nepodařilo uložit.");
      return false;
    } finally {
      mutationLock.current = false;
      setSaving(false);
      setSavingStepId(null);
    }
  }

  async function saveResult(attemptId: number, result: TestRunCaseResult, comment: string) {
    return mutate(async () => {
      await updateTestRunCaseResult(attemptId, { result, comment: comment || null });
      // Reflect the accepted write even if the subsequent refresh fails.
      setRun(current => current ? { ...current, test_run_cases: current.test_run_cases.map(item => ({
        ...item, ...(item.case_attempt_id === attemptId ? { result, comment } : {}),
        case_attempts: item.case_attempts.map(attempt => attempt.id === attemptId ? { ...attempt, result, comment } : attempt),
      })) } : current);
      setMessage("Celkový výsledek a komentář byly uloženy.");
      await reload(run?.selected_attempt_id);
    });
  }

  async function saveStep(attemptId: number, stepId: number, result: TestRunStepResultValue) {
    return mutate(async () => {
      const updated = await updateTestRunStepResult(attemptId, stepId, result);
      setRun(current => current ? { ...current, test_run_cases: current.test_run_cases.map(item => ({
        ...item, case_attempts: item.case_attempts.map(attempt => attempt.id === attemptId ? {
          ...attempt, step_results: [...attempt.step_results.filter(step => step.test_step_id !== stepId), updated],
        } : attempt),
      })) } : current);
      setMessage("Krok byl uložen. Celkový výsledek potvrďte samostatně.");
    }, stepId);
  }

  async function rerunCase(attemptId: number) {
    return mutate(async () => {
      setRun(await createTestRunCaseRerun(attemptId));
      setMessage("Byl vytvořen nový pokus testu.");
    });
  }
  async function rerunAll() {
    return mutate(async () => {
      setRun(await createTestRunRerun(runId));
      setMessage("Bylo vytvořeno nové provedení běhu.");
    });
  }
  return { run, loading, busy: loading || saving, savingStepId, error, message, reload, saveResult, saveStep, rerunCase, rerunAll };
}

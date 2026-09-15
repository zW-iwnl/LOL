import { useEffect, useState } from "react";

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useApiResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    loader()
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, loading: false, error: error instanceof Error ? error.message : "API chyba" });
        }
      });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}

export function LoadingState() {
  return <div aria-live="polite" className="rounded-md border border-border bg-surface p-5 text-sm text-muted" role="status">Načítám data...</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-md border border-danger-border bg-danger-bg p-5 text-sm text-danger" role="alert">{message}</div>;
}

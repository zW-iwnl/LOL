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
  return <div aria-live="polite" className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-500" role="status">Načítám data...</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700" role="alert">{message}</div>;
}

import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export function useWorkspacePreference<T>(name: string, initial: T) {
  const { user } = useAuth();
  // Preserve existing browser preferences across the workspace extraction.
  const key = `repository:${user?.id}:${name}`;
  const [value, setValue] = useState<T>(() => { try { return JSON.parse(sessionStorage.getItem(key) ?? "null") ?? initial; } catch { return initial; } });
  function update(next: T) {
    setValue(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Optional browser preference. */ }
  }
  return [value, update] as const;
}

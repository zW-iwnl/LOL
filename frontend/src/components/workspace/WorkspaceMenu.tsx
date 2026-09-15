import { useEffect, useRef, type ReactNode } from "react";

export function WorkspaceMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);
  return <details className="workspace-actions" ref={ref}>
    <summary className="workspace-button cursor-pointer">{label}</summary>
    <div className="workspace-action-menu" onClick={event => {
      const target = event.target instanceof Element ? event.target.closest("button, a") : null;
      if (target && !target.hasAttribute("disabled") && ref.current) ref.current.open = false;
    }}>{children}</div>
  </details>;
}

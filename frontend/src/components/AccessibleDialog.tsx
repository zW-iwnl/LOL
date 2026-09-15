import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AccessibleDialog({
  title,
  onClose,
  children,
  panelClassName = "max-w-2xl",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-overlay p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`my-auto max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-md bg-surface p-5 shadow-xl shadow-shadow ${panelClassName}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
          <button
            aria-label="Zavřít dialog"
            className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            type="button"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

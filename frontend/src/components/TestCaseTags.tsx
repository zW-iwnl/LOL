import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { TestCaseTag } from "../api/client";


type MultiSelectProps = {
  label: string;
  values: number[];
  tags: TestCaseTag[];
  onChange: (values: number[]) => void;
  required?: boolean;
  emptyLabel?: string;
};

export function MultiTagSelect({
  label,
  values,
  tags,
  onChange,
  required = false,
  emptyLabel = "Vyhledejte a vyberte tagy",
}: MultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const optionsId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("cs");
  const selectedTags = tags.filter((tag) => values.includes(tag.id));
  const visibleTags = useMemo(
    () => tags.filter((tag) => !normalizedQuery || tag.name.toLocaleLowerCase("cs").includes(normalizedQuery)),
    [normalizedQuery, tags],
  );

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !comboboxRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [open]);

  function toggle(tagId: number) {
    onChange(
      values.includes(tagId)
        ? values.filter((value) => value !== tagId)
        : [...values, tagId],
    );
  }

  return (
    <fieldset className="rounded-md border border-border bg-surface p-3">
      <legend className="px-1 text-sm font-medium">
        {label}{required ? " *" : ""}
      </legend>
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span className="inline-flex items-center gap-1 rounded-full bg-selected-bg px-2 py-1 text-xs font-medium text-link" key={tag.id}>
              {tag.name}
              <button aria-label={`Odebrat tag ${tag.name}`} type="button" onClick={() => toggle(tag.id)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        ref={comboboxRef}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          setOpen(false);
          comboboxRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
        }}
      >
        <button
          aria-controls={optionsId}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-muted hover:border-focus"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <Search size={14} />
          <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
          <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} size={14} />
        </button>
        {open && (
          <div className="mt-2 rounded-md border border-border bg-surface p-2 shadow-lg shadow-shadow">
            <label className="relative block">
              <span className="sr-only">Hledat v {label.toLocaleLowerCase("cs")}</span>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" size={14} />
              <input
                autoFocus
                className="w-full rounded-md border border-control py-2 pl-8 pr-3 text-sm"
                placeholder="Hledat tag"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div aria-label={`Dostupné ${label.toLocaleLowerCase("cs")}`} className="mt-2 max-h-36 space-y-1 overflow-auto" id={optionsId} role="group">
              {visibleTags.map((tag) => {
                const selected = values.includes(tag.id);
                return (
                  <button
                    aria-pressed={selected}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                  >
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-focus bg-accent text-on-accent" : "border-control"}`}>
                      {selected && <Check size={12} />}
                    </span>
                    <span>{tag.name}</span>
                  </button>
                );
              })}
              {visibleTags.length === 0 && <p className="px-2 py-2 text-xs text-muted">Žádný odpovídající tag.</p>}
            </div>
          </div>
        )}
      </div>
      {required && values.length === 0 && <p className="mt-2 text-xs text-warning">Vyberte alespoň jeden tag.</p>}
    </fieldset>
  );
}

export function TagChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="flex flex-wrap justify-end gap-1">
        {values.length > 0
          ? values.map((value) => <span className="rounded-full bg-selected-bg px-2 py-0.5 font-medium text-link" key={value}>{value}</span>)
          : <span>-</span>}
      </span>
    </div>
  );
}


type SelectProps = {
  label: string;
  value: string;
  tags: TestCaseTag[];
  onChange: (value: string) => void;
};

export function TagSelect({ label, value, tags, onChange }: SelectProps) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-control bg-surface px-3 py-2"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Vyberte hodnotu</option>
        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select>
    </label>
  );
}

export function TagFilter({ label, value, tags, onChange }: SelectProps) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-control bg-surface px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Všechny</option>
        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select>
    </label>
  );
}

export function TagRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="rounded-full bg-selected-bg px-2 py-0.5 font-medium text-link">{value ?? "-"}</span>
    </div>
  );
}

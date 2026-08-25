import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

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
  const normalizedQuery = query.trim().toLocaleLowerCase("cs");
  const selectedTags = tags.filter((tag) => values.includes(tag.id));
  const visibleTags = useMemo(
    () => tags.filter((tag) => !normalizedQuery || tag.name.toLocaleLowerCase("cs").includes(normalizedQuery)),
    [normalizedQuery, tags],
  );

  function toggle(tagId: number) {
    onChange(
      values.includes(tagId)
        ? values.filter((value) => value !== tagId)
        : [...values, tagId],
    );
  }

  return (
    <fieldset className="rounded-md border border-slate-200 bg-white p-3">
      <legend className="px-1 text-sm font-medium">
        {label}{required ? " *" : ""}
      </legend>
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700" key={tag.id}>
              {tag.name}
              <button aria-label={`Odebrat tag ${tag.name}`} type="button" onClick={() => toggle(tag.id)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="relative block">
        <span className="sr-only">Hledat v {label.toLocaleLowerCase("cs")}</span>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm"
          placeholder={emptyLabel}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="mt-2 max-h-36 space-y-1 overflow-auto">
        {visibleTags.map((tag) => (
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50" key={tag.id}>
            <input checked={values.includes(tag.id)} type="checkbox" onChange={() => toggle(tag.id)} />
            <span>{tag.name}</span>
          </label>
        ))}
        {visibleTags.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">Žádný odpovídající tag.</p>}
      </div>
      {required && values.length === 0 && <p className="mt-2 text-xs text-amber-700">Vyberte alespoň jeden tag.</p>}
    </fieldset>
  );
}

export function TagChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="flex flex-wrap justify-end gap-1">
        {values.length > 0
          ? values.map((value) => <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700" key={value}>{value}</span>)
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
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
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
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
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
      <span className="text-slate-500">{label}</span>
      <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700">{value ?? "-"}</span>
    </div>
  );
}

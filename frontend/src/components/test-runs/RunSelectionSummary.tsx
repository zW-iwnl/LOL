import type { RunSelection, SelectionCatalog, SelectionPreview } from "../../api/testRuns";

type Props = {
  catalog: SelectionCatalog;
  selection: RunSelection;
  preview: SelectionPreview | null;
  onChange: (selection: RunSelection) => void;
};

export function RunSelectionSummary({ catalog, selection, preview, onChange }: Props) {
  const chips = [
    ...selection.groups.map((item) => ({
      key: `group-${item.group_id}`,
      name: `Skupina: ${catalog.groups.find((group) => group.id === item.group_id)?.name ?? item.group_id}${item.include_descendants ? "" : " (bez potomků)"}`,
      remove: () => onChange({ ...selection, groups: selection.groups.filter((entry) => entry.group_id !== item.group_id) }),
    })),
    ...selection.suite_ids.map((id) => ({
      key: `suite-${id}`, name: `Suita: ${catalog.suites.find((suite) => suite.id === id)?.name ?? id}`,
      remove: () => onChange({ ...selection, suite_ids: selection.suite_ids.filter((value) => value !== id) }),
    })),
    ...selection.test_case_ids.map((id) => ({
      key: `case-${id}`, name: catalog.cases.find((item) => item.id === id)?.code ?? String(id),
      remove: () => onChange({ ...selection, test_case_ids: selection.test_case_ids.filter((value) => value !== id) }),
    })),
  ];
  return <section className="space-y-3 rounded-md bg-selected-bg p-4" aria-label="Souhrn výběru">
    <p className="text-sm font-medium" role="status">
      Skupiny: {selection.groups.length} · Suity: {selection.suite_ids.length} · Jednotlivé testy: {selection.test_case_ids.length}
      {preview ? ` → Unikátní schválené testy: ${preview.cases.length}` : " — náhled zatím není dostupný"}
    </p>
    <div className="flex max-h-36 flex-wrap gap-2 overflow-auto">
      {chips.map((chip) => <button key={chip.key} type="button" aria-label={`Odebrat ${chip.name}`} onClick={chip.remove}
        className="rounded-md border border-focus bg-surface px-2 py-1 text-xs">{chip.name} ×</button>)}
    </div>
    {preview && <details className="text-sm">
      <summary className="cursor-pointer">Zobrazit zařazené testy ({preview.cases.length})</summary>
      <ul className="mt-2 max-h-48 overflow-auto">{preview.cases.map((item) => <li key={item.id}>{item.code} — {item.title}</li>)}</ul>
    </details>}
    {!!preview?.excluded_cases.length && <details className="text-sm text-warning">
      <summary className="cursor-pointer">Vynechané testy: {preview.excluded_cases.length} — zobrazit důvody</summary>
      <ul className="mt-2 max-h-48 overflow-auto">{preview.excluded_cases.map((item) => <li key={item.id}>
        {item.code} — {item.title}: {item.exclusion_reason}
      </li>)}</ul>
    </details>}
  </section>;
}

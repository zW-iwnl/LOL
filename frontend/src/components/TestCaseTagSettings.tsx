import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  createTestCaseTag,
  deleteTestCaseTag,
  getTestCaseTags,
  updateTestCaseTag,
  type TestCaseTag,
  type TestCaseTagCategory,
} from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";

const categories: Array<{ key: TestCaseTagCategory; label: string }> = [
  { key: "business_area", label: "Business oblast" },
  { key: "application_domain", label: "Aplikace/doména" },
  { key: "object_type", label: "Objekt" },
];

export function TestCaseTagSettings() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [newNames, setNewNames] = useState<Record<TestCaseTagCategory, string>>({
    business_area: "",
    application_domain: "",
    object_type: "",
  });
  const [names, setNames] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const tagsState = useApiResource(getTestCaseTags, [refreshKey]);

  useEffect(() => {
    if (tagsState.data) {
      setNames(Object.fromEntries(tagsState.data.map((tag) => [tag.id, tag.name])));
    }
  }, [tagsState.data]);

  async function addTag(event: FormEvent, category: TestCaseTagCategory) {
    event.preventDefault();
    const name = newNames[category].trim();
    if (!name) return;
    setError(null);
    setMessage(null);
    try {
      await createTestCaseTag({ category, name });
      setNewNames((current) => ({ ...current, [category]: "" }));
      setRefreshKey((value) => value + 1);
      setMessage("Položka byla přidána.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Položku se nepodařilo přidat.");
    }
  }

  async function renameTag(tag: TestCaseTag) {
    const name = (names[tag.id] ?? "").trim();
    if (!name || name === tag.name) return;
    setError(null);
    setMessage(null);
    try {
      await updateTestCaseTag(tag.id, { name });
      setRefreshKey((value) => value + 1);
      setMessage("Položka byla přejmenována.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Položku se nepodařilo přejmenovat.");
    }
  }

  async function removeTag(tag: TestCaseTag) {
    if (!window.confirm(`Opravdu odstranit položku „${tag.name}“?`)) return;
    setError(null);
    setMessage(null);
    try {
      await deleteTestCaseTag(tag.id);
      setRefreshKey((value) => value + 1);
      setMessage("Položka byla odstraněna.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Položku se nepodařilo odstranit.");
    }
  }

  if (tagsState.loading) return <LoadingState />;
  if (tagsState.error) return <ErrorState message={tagsState.error} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Vlastnosti test case</h2>
        <p className="mt-1 text-sm text-slate-500">Správa hodnot zobrazovaných v comboboxech nového test case.</p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-3">
        {categories.map((category) => {
          const tags = (tagsState.data ?? []).filter((tag) => tag.category === category.key);
          return (
            <section key={category.key} className="rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 font-semibold">{category.label}</div>
              <div className="divide-y divide-slate-100">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex gap-2 p-3">
                    <input
                      aria-label={`Název položky ${tag.name}`}
                      className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={names[tag.id] ?? tag.name}
                      onChange={(event) => setNames((current) => ({ ...current, [tag.id]: event.target.value }))}
                    />
                    <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" type="button" title="Uložit změnu" onClick={() => void renameTag(tag)}>
                      <Save size={16} />
                    </button>
                    <button className="grid h-9 w-9 place-items-center rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50" type="button" title="Odstranit položku" onClick={() => void removeTag(tag)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {tags.length === 0 ? <div className="p-4 text-sm text-slate-500">Číselník je prázdný.</div> : null}
              </div>
              <form className="flex gap-2 border-t border-slate-200 p-3" onSubmit={(event) => void addTag(event, category.key)}>
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Nová položka"
                  value={newNames[category.key]}
                  onChange={(event) => setNewNames((current) => ({ ...current, [category.key]: event.target.value }))}
                />
                <button className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white" type="submit">
                  <Plus size={16} /> Přidat
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

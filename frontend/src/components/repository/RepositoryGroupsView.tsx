import { Layers3, Plus, Trash2, Unlink } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  addSuiteGroupChild,
  addSuiteGroupMember,
  createSuiteGroup,
  deleteSuiteGroup,
  getSuiteGroupTestCases,
  removeSuiteGroupChild,
  removeSuiteGroupMember,
  setSuiteGroupParents,
  setSuiteGroupTestCases,
  updateSuiteGroupChildScope,
  type SuiteGroup,
  type TestCase,
  type TestSuite,
} from "../../api/client";
import {
  groupPathRows,
  wouldCreateGroupCycle,
} from "./groupGraph";

type RepositoryGroupsViewProps = {
  groups: SuiteGroup[];
  suites: TestSuite[];
  testCases: TestCase[];
  selectedGroupId: number | null;
  onSelectedGroupChange: (groupId: number | null) => void;
  onChanged: () => void | Promise<void>;
};

export function RepositoryGroupsView({
  groups,
  suites,
  testCases,
  selectedGroupId,
  onSelectedGroupChange,
  onChanged,
}: RepositoryGroupsViewProps) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [parentToAdd, setParentToAdd] = useState("");
  const [childToAdd, setChildToAdd] = useState("");
  const [suiteToAdd, setSuiteToAdd] = useState("");
  const [caseToAdd, setCaseToAdd] = useState("");
  const [childIncludeDescendants, setChildIncludeDescendants] = useState(true);
  const [contentCases, setContentCases] = useState<TestCase[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const byId = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const selected = selectedGroupId === null ? groups[0] ?? null : byId.get(selectedGroupId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase("cs");
  const hierarchyRows = useMemo(() => groupPathRows(groups), [groups]);
  const visibleRows = normalizedQuery
    ? groups
      .filter((group) => (
        group.name.toLocaleLowerCase("cs").includes(normalizedQuery)
        || String(group.id) === normalizedQuery
        || group.tags.some((tag) => tag.name.toLocaleLowerCase("cs").includes(normalizedQuery))
      ))
      .map((group) => ({ group, depth: 0, pathKey: String(group.id), pathLabel: group.name }))
    : hierarchyRows;
  const memberSuiteIds = new Set(selected?.members.map((member) => member.suite_id) ?? []);
  const explicitCaseIds = selected?.test_case_members
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((member) => member.test_case_id) ?? [];

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setContentCases([]);
      setContentError(null);
      setContentLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setContentCases([]);
    setContentError(null);
    setContentLoading(true);
    void getSuiteGroupTestCases(selected.id)
      .then((items) => {
        if (!cancelled) setContentCases(items);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setContentError(
          error instanceof Error
            ? error.message
            : "Obsah skupiny se nepodařilo načíst.",
        );
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  function selectGroup(groupId: number) {
    onSelectedGroupChange(groupId);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById("repository-group-detail")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      await onChanged();
      setFeedback({ kind: "success", message: success });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Operaci se nepodařilo dokončit.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createSuiteGroup({ name });
      setNewName("");
      onSelectedGroupChange(created.id);
      await onChanged();
      setFeedback({ kind: "success", message: "Skupina byla vytvořena." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Skupinu se nepodařilo vytvořit.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeParent(parentId: number) {
    if (!selected) return;
    await mutate(
      () => setSuiteGroupParents(
        selected.id,
        selected.parent_ids.filter((id) => id !== parentId),
      ),
      "Rodičovská vazba byla odebrána.",
    );
  }

  async function addParent() {
    if (!selected || !parentToAdd) return;
    const parentId = Number(parentToAdd);
    await mutate(
      () => setSuiteGroupParents(selected.id, [...selected.parent_ids, parentId]),
      "Nadřazená skupina byla přidána.",
    );
    setParentToAdd("");
  }

  async function addChild() {
    if (!selected || !childToAdd) return;
    await mutate(
      () => addSuiteGroupChild(
        selected.id,
        Number(childToAdd),
        childIncludeDescendants,
      ),
      "Podřazená skupina byla přidána.",
    );
    setChildToAdd("");
    setChildIncludeDescendants(true);
  }

  async function addSuite() {
    if (!selected || !suiteToAdd) return;
    await mutate(
      () => addSuiteGroupMember(selected.id, Number(suiteToAdd)),
      "Test suite byla přidána do skupiny.",
    );
    setSuiteToAdd("");
  }

  async function addCase() {
    if (!selected || !caseToAdd) return;
    const testCaseId = Number(caseToAdd);
    await mutate(
      () => setSuiteGroupTestCases(selected.id, [...explicitCaseIds, testCaseId]),
      "Test case byl přidán jako přímý odkaz.",
    );
    setCaseToAdd("");
  }

  return (
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-md border border-slate-200 bg-white lg:sticky lg:top-24 lg:self-start">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Layers3 size={17} className="text-violet-600" aria-hidden="true" /> Struktura skupin
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Hledat ve skupinách</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Název, ID nebo tag"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <form className="mt-3" onSubmit={(event) => void createGroup(event)}>
            <label className="block text-sm">
              <span className="font-medium">Nová kořenová skupina</span>
              <span className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Název skupiny"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button
                  aria-label="Vytvořit skupinu"
                  className="grid h-11 w-11 place-items-center rounded-md bg-violet-600 text-white disabled:opacity-50"
                  disabled={busy || !newName.trim()}
                  title="Vytvořit skupinu"
                  type="submit"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </span>
            </label>
          </form>
          {feedback && (
            <div
              aria-live="polite"
              className={feedback.kind === "error"
                ? "mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                : "mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </div>
          )}
        </div>
        <nav aria-label="Hierarchie skupin" className="max-h-[500px] overflow-y-auto p-2">
          {visibleRows.map(({ group, depth, pathKey, pathLabel }) => (
            <button
              aria-current={selected?.id === group.id ? "page" : undefined}
              className={
                selected?.id === group.id
                  ? "mb-1 min-h-11 w-full rounded-md bg-violet-50 py-2 pr-3 text-left text-sm text-violet-900"
                  : "mb-1 min-h-11 w-full rounded-md py-2 pr-3 text-left text-sm hover:bg-slate-50"
              }
              key={pathKey}
              style={{ paddingLeft: `${12 + Math.min(depth, 6) * 16}px` }}
              title={pathLabel}
              type="button"
              onClick={() => selectGroup(group.id)}
            >
              <span className="block truncate font-medium">{depth > 0 ? "↳ " : ""}{group.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {group.parent_ids.length} rodičů · {group.child_ids.length} dětí
              </span>
            </button>
          ))}
          {visibleRows.length === 0 && (
            <p className="p-3 text-sm text-slate-500">Žádné skupiny odpovídající hledání.</p>
          )}
        </nav>
      </aside>

      <section id="repository-group-detail" className="scroll-mt-24 rounded-md border border-slate-200 bg-white">
        {!selected ? (
          <div className="grid min-h-[420px] place-items-center p-8 text-sm text-slate-500">
            Vyberte skupinu nebo vytvořte novou.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-semibold">#{selected.id} {selected.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.description || "Skupina může být současně pod více rodiči."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <span className="font-medium">Rodiče:</span>
                  {selected.parent_ids.length === 0 && <span>Kořenová skupina</span>}
                  {selected.parent_ids.map((id) => (
                    <button
                      className="rounded-full bg-violet-50 px-2 py-1 text-violet-800 hover:bg-violet-100"
                      key={id}
                      type="button"
                      onClick={() => selectGroup(id)}
                    >
                      {byId.get(id)?.name ?? `#${id}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                  disabled={busy}
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Smazat skupinu „${selected.name}“? Suity ani test cases se nesmažou.`)) return;
                    void mutate(
                      () => deleteSuiteGroup(selected.id),
                      "Skupina byla smazána.",
                    ).then(() => onSelectedGroupChange(null));
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" /> Smazat skupinu
                </button>
              </div>
            </div>


            <div className="grid gap-4 p-5 xl:grid-cols-2">
              <RelationSection title="Nadřazené skupiny">
                {selected.parent_ids.map((id) => (
                  <RelationRow
                    disabled={busy}
                    key={id}
                    label={groupLabel(byId.get(id), id)}
                    onRemove={() => void removeParent(id)}
                  />
                ))}
                <AddSelect
                  label="Přidat nadřazenou skupinu"
                  value={parentToAdd}
                  onChange={setParentToAdd}
                  onAdd={() => void addParent()}
                  disabled={busy}
                  options={groups.filter(
                    (group) => (
                      !selected.parent_ids.includes(group.id)
                      && !wouldCreateGroupCycle(groups, group.id, selected.id)
                    ),
                  )}
                  placeholder="Vybrat dalšího rodiče"
                />
              </RelationSection>

              <RelationSection title="Podřazené skupiny">
                {selected.child_relations.map((relation) => (
                  <GroupRelationRow
                    disabled={busy}
                    includeDescendants={relation.include_descendants}
                    key={relation.child_group_id}
                    label={groupLabel(
                      byId.get(relation.child_group_id),
                      relation.child_group_id,
                    )}
                    onIncludeDescendantsChange={(include) => void mutate(
                      () => updateSuiteGroupChildScope(
                        selected.id,
                        relation.child_group_id,
                        include,
                      ),
                      include
                        ? "Podskupiny byly zahrnuty."
                        : "Podskupiny byly z výběru vyloučeny.",
                    )}
                    onRemove={() => void mutate(
                      () => removeSuiteGroupChild(
                        selected.id,
                        relation.child_group_id,
                      ),
                      "Podřazená vazba byla odebrána.",
                    )}
                  />
                ))}
                <AddSelect
                  label="Přidat podřazenou skupinu"
                  value={childToAdd}
                  onChange={setChildToAdd}
                  onAdd={() => void addChild()}
                  disabled={busy}
                  options={groups.filter(
                    (group) => (
                      !selected.child_ids.includes(group.id)
                      && !wouldCreateGroupCycle(groups, selected.id, group.id)
                    ),
                  )}
                  placeholder="Vybrat podřazenou skupinu"
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                  <input
                    checked={childIncludeDescendants}
                    className="h-4 w-4 accent-violet-600"
                    type="checkbox"
                    onChange={(event) => setChildIncludeDescendants(event.target.checked)}
                  />
                  Zahrnout podskupiny přidávané skupiny
                </label>
                <p className="text-xs text-slate-500">
                  Bez zaškrtnutí se vloží jen vybraná skupina, ne její potomci.
                </p>
              </RelationSection>

              <RelationSection title="Test suity">
                {selected.members.map((member) => (
                  <RelationRow
                    disabled={busy}
                    key={member.suite_id}
                    label={suiteLabel(suites, member.suite_id)}
                    onRemove={() => void mutate(
                      () => removeSuiteGroupMember(selected.id, member.suite_id),
                      "Test suite byla odebrána ze skupiny.",
                    )}
                  />
                ))}
                <AddSelect
                  label="Přidat test suitu"
                  value={suiteToAdd}
                  onChange={setSuiteToAdd}
                  onAdd={() => void addSuite()}
                  disabled={busy}
                  options={suites.filter((suite) => !memberSuiteIds.has(suite.id))}
                  placeholder="Vybrat test suitu"
                />
              </RelationSection>

              <RelationSection title="Přímé odkazy na test cases">
                {explicitCaseIds.map((id) => (
                  <RelationRow
                    disabled={busy}
                    key={id}
                    label={caseLabel(testCases, id)}
                    onRemove={() => void mutate(
                      () => setSuiteGroupTestCases(
                        selected.id,
                        explicitCaseIds.filter((caseId) => caseId !== id),
                      ),
                      "Přímý odkaz byl odebrán.",
                    )}
                  />
                ))}
                <AddSelect
                  label="Přidat přímý odkaz na test case"
                  value={caseToAdd}
                  onChange={setCaseToAdd}
                  onAdd={() => void addCase()}
                  disabled={busy}
                  options={testCases.filter((testCase) => !explicitCaseIds.includes(testCase.id))}
                  placeholder="Vybrat test case"
                />
              </RelationSection>
            </div>

            <section className="border-t border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Obsah skupiny</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Obsah respektuje nastavení „Zahrnout podskupiny“ u každé podřazené vazby.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {contentLoading && (
                  <p aria-live="polite" className="rounded-md bg-slate-50 p-4 text-sm text-slate-500" role="status">
                    Načítám obsah skupiny…
                  </p>
                )}
                {contentError && (
                  <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
                    {contentError}
                  </p>
                )}
                {!contentLoading && !contentError && contentCases.slice(0, 100).map((testCase) => {
                  const origin = explicitCaseIds.includes(testCase.id)
                    ? "Přímý odkaz"
                    : memberSuiteIds.has(testCase.suite_id)
                      ? "Přímá test suite"
                      : "Zděděno z podřízené skupiny";
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm" key={testCase.id}>
                      <span className="min-w-0">
                        <strong className="text-cyan-800">{testCase.code}</strong> {testCase.title}
                        <span className="mt-0.5 block text-xs text-slate-500">{suiteLabel(suites, testCase.suite_id)}</span>
                      </span>
                      <span className={origin.startsWith("Zděděno") ? "rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600" : "rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-800"}>
                        {origin}
                      </span>
                    </div>
                  );
                })}
                {!contentLoading && !contentError && contentCases.length === 0 && (
                  <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">V tomto rozsahu nejsou žádné test cases.</p>
                )}
                {!contentLoading && !contentError && contentCases.length > 100 && (
                  <p className="text-xs text-slate-500">Zobrazeno prvních 100 z {contentCases.length} test cases.</p>
                )}
              </div>
            </section>

            <section className="border-t border-slate-200 p-5">
              <h3 className="text-sm font-semibold">Tagy ve veškerém viditelném obsahu</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800"
                    key={tag.id}
                  >
                    {tag.name} ({tag.test_case_count})
                  </span>
                ))}
                {selected.tags.length === 0 && (
                  <span className="text-sm text-slate-500">Skupina zatím nemá žádné tagy.</span>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}

function RelationSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200">
      <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">
        {title}
      </h3>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

function GroupRelationRow({
  label,
  includeDescendants,
  onIncludeDescendantsChange,
  onRemove,
  disabled,
}: {
  label: string;
  includeDescendants: boolean;
  onIncludeDescendantsChange: (include: boolean) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          checked={includeDescendants}
          className="h-4 w-4 accent-violet-600"
          disabled={disabled}
          type="checkbox"
          onChange={(event) => onIncludeDescendantsChange(event.target.checked)}
        />
        Zahrnout podskupiny
      </label>
      <button
        aria-label={`Odebrat vazbu ${label}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        disabled={disabled}
        title="Odebrat vazbu"
        type="button"
        onClick={onRemove}
      >
        <Unlink size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function RelationRow({ label, onRemove, disabled }: { label: string; onRemove: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="truncate">{label}</span>
      <button
        aria-label={`Odebrat vazbu ${label}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        disabled={disabled}
        title="Odebrat vazbu"
        type="button"
        onClick={onRemove}
      >
        <Unlink size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function AddSelect<T extends { id: number; name?: string; title?: string; code?: string }>({
  label,
  value,
  onChange,
  onAdd,
  disabled,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
  options: T[];
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("cs");
  const visibleOptions = options
    .filter((option) => !normalized || optionLabel(option).toLocaleLowerCase("cs").includes(normalized))
    .slice(0, 50);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">
        {label}
        <input
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
          placeholder="Filtrovat nabídku"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <select
          aria-label={label}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {visibleOptions.map((option) => (
            <option key={option.id} value={option.id}>{optionLabel(option)}</option>
          ))}
        </select>
        <button
          className="min-h-11 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={disabled || !value}
          type="button"
          onClick={onAdd}
        >
          Přidat
        </button>
      </div>
      {options.length > 50 && !normalized && (
        <p className="text-xs text-slate-500">Zobrazeno prvních 50 položek. Pro další použijte filtr.</p>
      )}
    </div>
  );
}

function optionLabel(option: { id: number; name?: string; title?: string; code?: string }) {
  return `#${option.id} ${option.code ? `${option.code} · ${option.title}` : option.name}`;
}

function groupLabel(group: SuiteGroup | undefined, id: number) {
  return group ? `#${group.id} ${group.name}` : `Skupina #${id}`;
}

function suiteLabel(suites: TestSuite[], id: number) {
  const suite = suites.find((item) => item.id === id);
  return suite ? `#${suite.id} ${suite.name}` : `Test suite #${id}`;
}

function caseLabel(testCases: TestCase[], id: number) {
  const testCase = testCases.find((item) => item.id === id);
  return testCase ? `${testCase.code} · ${testCase.title}` : `Test case #${id}`;
}

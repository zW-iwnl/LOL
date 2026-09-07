import { FileCheck2, FolderKanban, Layers3, Tags } from "lucide-react";

import type { SuiteGroup, TestCase, TestCaseTag, TestSuite } from "../../api/client";
import { TestCaseTagSettings } from "../TestCaseTagSettings";
import { RepositoryCasesView } from "./RepositoryCasesView";
import { RepositoryGroupsView } from "./RepositoryGroupsView";
import { RepositorySuitesView } from "./RepositorySuitesView";

export type RepositoryTab = "groups" | "suites" | "cases" | "tags";

export function RepositoryWorkspace({
  activeTab,
  onTabChange,
  groups,
  suites,
  testCases,
  tags,
  selectedGroupId,
  onSelectedGroupChange,
  selectedSuiteId,
  onChanged,
  onCreateSuite,
  onEditSuite,
  onDeleteSuite,
  onCreateCase,
  onOpenCase,
  onDeleteCase,
  onMoveCase,
  movingCaseId,
}: {
  activeTab: RepositoryTab;
  onTabChange: (tab: RepositoryTab) => void;
  groups: SuiteGroup[];
  suites: TestSuite[];
  testCases: TestCase[];
  tags: TestCaseTag[];
  selectedGroupId: number | null;
  onSelectedGroupChange: (groupId: number | null) => void;
  selectedSuiteId: number | null;
  onChanged: () => void | Promise<void>;
  onCreateSuite: () => void;
  onEditSuite: (suite: TestSuite) => void;
  onDeleteSuite: (suite: TestSuite) => void;
  onCreateCase: (suiteId: number | null) => void;
  onOpenCase: (testCase: TestCase) => void;
  onDeleteCase: (testCase: TestCase) => void;
  onMoveCase: (testCase: TestCase, suiteId: number) => void;
  movingCaseId: number | null;
}) {
  const tabs = [
    { id: "groups" as const, label: "Skupiny", icon: Layers3, count: groups.length },
    { id: "suites" as const, label: "Test suity", icon: FolderKanban, count: suites.length },
    { id: "cases" as const, label: "Test cases", icon: FileCheck2, count: testCases.length },
    { id: "tags" as const, label: "Tagy", icon: Tags, count: tags.length },
  ];

  return (
    <section id="repository-workspace" className="space-y-4">
      <nav
        aria-label="Části Repository"
        className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-1 sm:flex sm:flex-wrap"
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              aria-controls="repository-panel"
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id
                  ? "inline-flex min-h-11 items-center justify-center gap-2 rounded bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800"
                  : "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              }
              id={`repository-tab-${tab.id}`}
              key={tab.id}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = tabs.findIndex((item) => item.id === tab.id);
                const nextIndex = event.key === "ArrowRight"
                  ? (currentIndex + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (currentIndex - 1 + tabs.length) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : null;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextTab = tabs[nextIndex];
                onTabChange(nextTab.id);
                document.getElementById(`repository-tab-${nextTab.id}`)?.focus();
              }}
            >
              <Icon size={16} aria-hidden="true" /> {tab.label}
              <span className="rounded-full bg-white px-1.5 py-0.5 text-xs text-slate-500">{tab.count}</span>
            </button>
          );
        })}
      </nav>

      <div
        aria-labelledby={`repository-tab-${activeTab}`}
        id="repository-panel"
        role="tabpanel"
      >
        {activeTab === "groups" && (
          <RepositoryGroupsView
            groups={groups}
            suites={suites}
            testCases={testCases}
            selectedGroupId={selectedGroupId}
            onSelectedGroupChange={onSelectedGroupChange}
            onChanged={onChanged}
          />
        )}
        {activeTab === "suites" && (
          <RepositorySuitesView
            suites={suites}
            groups={groups}
            selectedSuiteId={selectedSuiteId}
            onCreate={onCreateSuite}
            onEdit={onEditSuite}
            onDelete={onDeleteSuite}
          />
        )}
        {activeTab === "cases" && (
          <RepositoryCasesView
            testCases={testCases}
            suites={suites}
            tags={tags}
            onCreate={onCreateCase}
            onOpen={onOpenCase}
            onDelete={onDeleteCase}
            onMove={onMoveCase}
            movingCaseId={movingCaseId}
          />
        )}
        {activeTab === "tags" && <TestCaseTagSettings />}
      </div>
    </section>
  );
}

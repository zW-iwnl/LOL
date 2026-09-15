import type { TestCaseTag, TestSuite } from "../../api/client";
import type { RepositoryGroup } from "../../api/repositoryWorkspace";
import { TestCaseTagSettings } from "../TestCaseTagSettings";
import { RepositoryGroupsView } from "./RepositoryGroupsView";
import { RepositorySuitesView } from "./RepositorySuitesView";
import { RepositoryCasesView } from "./RepositoryCasesView";
import type { CaseActions } from "./RepositoryCaseTable";

export type RepositoryTab = "groups" | "suites" | "cases" | "tags";
type Props = {
  activeTab: RepositoryTab; onTabChange: (tab: RepositoryTab) => void; groups: RepositoryGroup[]; suites: TestSuite[]; tags: TestCaseTag[]; testCaseCount: number;
  selectedGroupId: number | null; onSelectedGroupChange: (id: number | null, path?: number[]) => void;
  selectedSuiteId: number | null; onSelectedSuiteChange: (id: number) => void; onChanged: () => void; refreshKey: number;
  onCreateSuite: () => void; onEditSuite: (suite: TestSuite) => void; onDeleteSuite: (suite: TestSuite) => void;
} & CaseActions;
export function RepositoryWorkspace(props: Props) {
  const tabs = [ { id: "groups" as const, label: "Skupiny", count: props.groups.length }, { id: "suites" as const, label: "Test suity", count: props.suites.length },
    { id: "cases" as const, label: "Test cases", count: props.testCaseCount }, { id: "tags" as const, label: "Tagy", count: props.tags.length } ];
  const actions: CaseActions = { onOpen: props.onOpen, onCreate: props.onCreate, onDelete: props.onDelete, onMove: props.onMove, movingCaseId: props.movingCaseId };
  return <section id="repository-workspace" className="repository-workspace">
    <nav role="tablist" aria-label="Části Repository" className="flex flex-wrap gap-1">
      {tabs.map((tab, i) => <button key={tab.id} role="tab" type="button" id={`repository-tab-${tab.id}`} aria-controls="repository-panel" aria-selected={props.activeTab === tab.id} tabIndex={props.activeTab === tab.id ? 0 : -1}
        className={`workspace-button ${props.activeTab === tab.id ? "workspace-active-tab" : ""}`} onClick={() => props.onTabChange(tab.id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (i + 1) % tabs.length : event.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return; event.preventDefault(); props.onTabChange(tabs[next].id); document.getElementById(`repository-tab-${tabs[next].id}`)?.focus();
        }}>{tab.label} <span className="text-slate-500">{tab.count}</span></button>)}
    </nav>
    <div role="tabpanel" id="repository-panel" aria-labelledby={`repository-tab-${props.activeTab}`} className="repository-tab-panel">
      {props.activeTab === "groups" && <RepositoryGroupsView groups={props.groups} suites={props.suites} tags={props.tags} selectedGroupId={props.selectedGroupId} onSelectedGroupChange={props.onSelectedGroupChange} onChanged={props.onChanged} onOpenCase={props.onOpen} onOpenSuite={props.onSelectedSuiteChange} />}
      {props.activeTab === "suites" && <RepositorySuitesView suites={props.suites} groups={props.groups} tags={props.tags} selectedSuiteId={props.selectedSuiteId} onSelect={props.onSelectedSuiteChange} onCreateSuite={props.onCreateSuite} onEditSuite={props.onEditSuite} onDeleteSuite={props.onDeleteSuite} refreshKey={props.refreshKey} movingCaseId={props.movingCaseId} onOpen={props.onOpen} onMove={props.onMove} onCreate={props.onCreate} onDelete={props.onDelete} />}
      {props.activeTab === "cases" && <RepositoryCasesView suites={props.suites} tags={props.tags} refreshKey={props.refreshKey} {...actions} />}
      {props.activeTab === "tags" && <div className="repository-detail-scroll"><TestCaseTagSettings /></div>}
    </div>
  </section>;
}

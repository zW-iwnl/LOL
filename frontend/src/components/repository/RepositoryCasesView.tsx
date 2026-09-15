import type { TestCaseTag, TestSuite } from "../../api/client";
import { RepositoryCaseTable, type CaseActions } from "./RepositoryCaseTable";

export function RepositoryCasesView(props: { suites: TestSuite[]; tags: TestCaseTag[]; refreshKey: number } & CaseActions) {
  return <section className="repository-detail h-full"><div className="repository-detail-scroll p-3"><RepositoryCaseTable {...props} /></div></section>;
}

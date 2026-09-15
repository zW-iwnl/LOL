import { withReturn } from "../workspace/navigation";
import { Link, useLocation } from "react-router-dom";
import { getTestCase } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { AccessibleDialog } from "../AccessibleDialog";

export function RepositoryCasePreview({ id, onClose }: { id: number; onClose: () => void }) {
  const location = useLocation();
  const state = useApiResource(() => getTestCase(id), [id]);
  const item = state.data;
  return <AccessibleDialog title={item ? `${item.code} · ${item.title}` : "Náhled test case"} onClose={onClose} panelClassName="max-w-4xl">
    {state.loading && <p role="status">Načítám test case…</p>}{state.error && <p role="alert" className="text-danger">{state.error}</p>}
    {item && <div className="space-y-3 text-sm">
      <Link to={withReturn(`/test-cases/${id}`, location.pathname + location.search)} className="workspace-button workspace-primary">Otevřít detail a úpravy</Link>
      {item.description && <p className="whitespace-pre-wrap">{item.description}</p>}
      {item.preconditions && <div><h3 className="font-semibold">Předpoklady</h3><p className="whitespace-pre-wrap">{item.preconditions}</p></div>}
      <table className="repository-table"><thead><tr><th>#</th><th>Akce</th><th>Očekávaný výsledek</th></tr></thead><tbody>{item.steps.map(step => <tr key={step.id}><td>{step.step_order}</td><td className="whitespace-pre-wrap">{step.action}{step.test_data && <p className="mt-1 text-xs text-muted">Data: {step.test_data}</p>}{step.note && <p className="mt-1 text-xs text-muted">{step.note}</p>}</td><td className="whitespace-pre-wrap">{step.step_type === "information" ? "Informační krok" : step.expected_result}</td></tr>)}</tbody></table>
      {item.expected_summary && <p className="whitespace-pre-wrap">{item.expected_summary}</p>}
    </div>}
  </AccessibleDialog>;
}

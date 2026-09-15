import { Link } from "react-router-dom";
export function NotFoundPage() {
  return <section className="rounded border border-border bg-surface p-6"><h1 className="text-lg font-semibold">Stránka nebyla nalezena</h1><p className="my-3 text-sm text-muted">Odkaz už nemusí být platný. Pokračujte v Repository nebo na Dashboardu.</p><div className="flex gap-2"><Link className="workspace-button workspace-primary" to="/test-cases">Otevřít Repository</Link><Link className="workspace-button" to="/dashboard">Dashboard</Link></div></section>;
}

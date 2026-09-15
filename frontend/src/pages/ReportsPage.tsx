import { FileBarChart } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reporty" description="Souhrny kvality a trendů výsledků." />
      <section className="grid gap-4 md:grid-cols-3">
        {["Trend pass rate", "Výsledky test runů", "Pokrytí test suites"].map((report) => (
          <article key={report} className="rounded-md border border-border bg-surface p-5">
            <FileBarChart className="text-link" size={22} />
            <h2 className="mt-4 font-semibold">{report}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Připravený panel pro report nad daty repository.</p>
          </article>
        ))}
      </section>
    </div>
  );
}

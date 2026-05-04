import { FileBarChart } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reporty" description="Souhrny kvality, trendů výsledků a stavu defectů." />
      <section className="grid gap-4 md:grid-cols-3">
        {["Trend pass rate", "Defect aging", "Pokrytí test suites"].map((report) => (
          <article key={report} className="rounded-md border border-slate-200 bg-white p-5">
            <FileBarChart className="text-cyan-700" size={22} />
            <h2 className="mt-4 font-semibold">{report}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Připravený panel pro report nad daty projektu ESHOP.</p>
          </article>
        ))}
      </section>
    </div>
  );
}

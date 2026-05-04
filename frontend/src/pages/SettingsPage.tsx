import { PageHeader } from "../components/PageHeader";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nastavení" description="Konfigurace projektu, uživatelů, rolí a integračních parametrů." />
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Výchozí projekt</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2">
              <option>E-shop</option>
              <option>CRM portál</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Výchozí prostředí</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2">
              <option>Staging</option>
              <option>QA</option>
              <option>Production shadow</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}

import { PageHeader } from "../components/PageHeader";
import { TestCaseTagSettings } from "../components/TestCaseTagSettings";

export function TestCasePropertiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nastavení comboboxů"
        description="Správa hodnot Business oblast, Aplikace/doména a Objekt."
      />
      <TestCaseTagSettings />
    </div>
  );
}

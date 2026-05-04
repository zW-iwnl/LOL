import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DefectsPage } from "./pages/DefectsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestCaseDetailPage } from "./pages/TestCaseDetailPage";
import { TestCasesPage } from "./pages/TestCasesPage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { TestRunsPage } from "./pages/TestRunsPage";
import { TestSuitesPage } from "./pages/TestSuitesPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/test-suites" element={<TestSuitesPage />} />
        <Route path="/test-cases" element={<TestCasesPage />} />
        <Route path="/test-cases/:testCaseId" element={<TestCaseDetailPage />} />
        <Route path="/test-runs" element={<TestRunsPage />} />
        <Route path="/test-runs/:testRunId/execution" element={<ExecutionPage />} />
        <Route path="/execution/:testRunId" element={<ExecutionPage />} />
        <Route path="/defects" element={<DefectsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

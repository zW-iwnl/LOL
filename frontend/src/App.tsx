import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DefectsPage } from "./pages/DefectsPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RequirementsPage } from "./pages/RequirementsPage";
import { ActiveProjectProvider } from "./projects/ActiveProjectContext";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestCaseDetailPage } from "./pages/TestCaseDetailPage";
import { TestCasesPage } from "./pages/TestCasesPage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { TestPlansPage } from "./pages/TestPlansPage";
import { TestRunsPage } from "./pages/TestRunsPage";
import { TestSuitesPage } from "./pages/TestSuitesPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fb] text-sm text-slate-500">Načítám aplikaci...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <ActiveProjectProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/test-suites" element={<TestSuitesPage />} />
          <Route path="/test-cases" element={<TestCasesPage />} />
          <Route path="/test-cases/:testCaseId" element={<TestCaseDetailPage />} />
          <Route path="/test-plans" element={<TestPlansPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/test-runs/:testRunId/execution" element={<ExecutionPage />} />
          <Route path="/execution/:testRunId" element={<ExecutionPage />} />
          <Route path="/defects" element={<DefectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppLayout>
    </ActiveProjectProvider>
  );
}

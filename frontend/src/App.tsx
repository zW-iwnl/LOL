import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { NotFoundPage } from "./pages/NotFoundPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestCaseDetailPage } from "./pages/TestCaseDetailPage";
import { TestCaseApprovalsPage } from "./pages/TestCaseApprovalsPage";
import { TestCaseApprovalDetailPage } from "./pages/TestCaseApprovalDetailPage";
import { TestCasePropertiesPage } from "./pages/TestCasePropertiesPage";
import { TestCasesPage } from "./pages/TestCasesPage";
import { ExecutionPage } from "./pages/ExecutionPage";
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
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/test-suites" element={<TestSuitesPage />} />
          <Route path="/test-cases" element={<TestCasesPage />} />
          <Route path="/test-cases/:testCaseId" element={<TestCaseDetailPage />} />
          <Route path="/test-case-approvals" element={<TestCaseApprovalsPage />} />
          <Route path="/test-case-approvals/:reviewId" element={<TestCaseApprovalDetailPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/test-runs/:testRunId/execution" element={<ExecutionPage />} />
          <Route path="/execution/:testRunId" element={<ExecutionPage />} />
          <Route path="/test-case-properties" element={<TestCasePropertiesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppLayout>
  );
}

import { Navigate } from "react-router-dom";

export function TestSuitesPage() {
  return <Navigate to="/test-cases?tab=suites" replace />;
}

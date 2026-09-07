import { Navigate } from "react-router-dom";

export function TestCasePropertiesPage() {
  return <Navigate to="/test-cases?tab=tags" replace />;
}

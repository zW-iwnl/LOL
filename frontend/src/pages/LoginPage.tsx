import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { ThemeSwitcher } from "../components/settings/ThemeSwitcher";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@testmanager.cz");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Přihlášení se nepodařilo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 py-8 text-text">
      <section className="w-full max-w-sm rounded-md border border-border bg-surface p-6 shadow-sm shadow-shadow">
        <div className="mb-6">
          <div className="mb-4 flex justify-end"><ThemeSwitcher /></div>
          <div className="text-sm font-medium text-link">FET - fio evidence testů</div>
          <h1 className="mt-1 text-2xl font-semibold">Přihlášení</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-text">E-mail</span>
            <input
              className="mt-1 w-full rounded-md border border-control px-3 py-2 text-sm outline-none ring-focus transition focus:border-focus focus:ring-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-text">Heslo</span>
            <input
              className="mt-1 w-full rounded-md border border-control px-3 py-2 text-sm outline-none ring-focus transition focus:border-focus focus:ring-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div> : null}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-skipped"
            type="submit"
            disabled={submitting}
          >
            <LogIn size={18} />
            {submitting ? "Přihlašuji..." : "Přihlásit"}
          </button>
        </form>
      </section>
    </main>
  );
}

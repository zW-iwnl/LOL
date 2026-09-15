import { useState } from "react";
import { getUsers, request } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";

export function ReviewerRoles() {
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const users = useApiResource(getUsers, [refresh]);
  if (user?.role !== "admin") return null;
  async function change(id: number, role: string) {
    setBusy(true); setError("");
    try { await request(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }); setRefresh(r => r + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "Změna role selhala."); }
    finally { setBusy(false); }
  }
  async function createReviewer() {
    setBusy(true); setError("");
    try {
      await request("/users", { method: "POST", body: JSON.stringify({ name, email, password, role: "reviewer" }) });
      setName(""); setEmail(""); setPassword(""); setRefresh(r => r + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Vytvoření uživatele selhalo."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-md border border-border bg-surface p-5">
    <h3 className="font-semibold">Role pro schvalování</h3>
    <p className="text-sm text-muted">Reviewer schvaluje cizí návrhy. Ani administrátor nemůže schválit vlastní práci; je potřeba druhý aktivní uživatel.</p>
    {(error || users.error) && <p role="alert" className="text-danger">{error || users.error}</p>}
    {users.data?.map(u => <label key={u.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-3 text-sm">
      <span>{u.name}</span>
      <select aria-label={`Role ${u.name}`} disabled={busy || u.id === user?.id} className="rounded-md border border-control px-3 py-2 text-sm bg-surface outline-none focus:border-focus focus:ring-2 focus:ring-focus" value={u.role} onChange={e => void change(u.id, e.target.value)}>
        {["tester", "reviewer", "test_lead", "admin"].map(r => <option value={r} key={r}>{r}</option>)}
      </select>
    </label>)}
    <form className="grid gap-4 rounded-md border border-border bg-surface-muted p-4 text-sm md:grid-cols-2" onSubmit={e => { e.preventDefault(); void createReviewer(); }}>
      <h4 className="font-semibold md:col-span-2">Nový schvalovatel</h4>
      <label>Jméno<input className="mt-1 block w-full rounded-md border border-control px-3 py-2 text-sm bg-surface outline-none focus:border-focus focus:ring-2 focus:ring-focus" required maxLength={255} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>E-mail<input className="mt-1 block w-full rounded-md border border-control px-3 py-2 text-sm bg-surface outline-none focus:border-focus focus:ring-2 focus:ring-focus" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Heslo (alespoň 12 znaků)<input className="mt-1 block w-full rounded-md border border-control px-3 py-2 text-sm bg-surface outline-none focus:border-focus focus:ring-2 focus:ring-focus" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy} className="justify-self-start rounded-md bg-accent px-4 py-2 text-on-accent disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-accent-hover disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Vytvořit schvalovatele</button>
    </form>
  </section>;
}

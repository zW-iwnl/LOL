import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Repository", to: "/test-cases", icon: ClipboardCheck },
  { label: "Requirements", to: "/requirements", icon: ShieldCheck },
  { label: "Test Runs", to: "/test-runs", icon: BarChart3 },
  { label: "Nastavení comboboxů", to: "/test-case-properties", icon: Settings2 },
];

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const initials = (user?.name ?? user?.email ?? "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      return;
    }
    navigate(`/test-cases?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="mb-8 px-2">
          <div className="text-lg font-semibold">FET - fio evidence testů</div>
          <div className="text-sm text-slate-500">Interní QA portál</div>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-cyan-50 text-cyan-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")
                }
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="grid gap-3 xl:grid-cols-[220px_minmax(240px,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-500">QA tým</div>
              <h1 className="truncate text-xl font-semibold">Správa testování</h1>
            </div>
            <form className="relative hidden w-full md:block" onSubmit={handleSearch}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none ring-cyan-500 transition focus:border-cyan-500 focus:ring-2"
                placeholder="Hledat test case nebo suite"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </form>
            <div className="hidden items-center justify-end gap-3 text-sm md:flex">
              <div className="text-right">
                <div className="font-medium">{user?.name}</div>
                <div className="text-slate-500">{user?.role}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-900 font-semibold text-white">
                {initials}
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                type="button"
                onClick={() => {
                  logout();
                  window.location.assign("/login");
                }}
                title="Odhlásit"
                aria-label="Odhlásit"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

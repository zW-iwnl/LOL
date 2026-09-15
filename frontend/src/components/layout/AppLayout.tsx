import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AccessibleDialog } from "../AccessibleDialog";
import { ThemeSwitcher } from "../settings/ThemeSwitcher";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Repository", to: "/test-cases", icon: ClipboardCheck },
  { label: "Schvalování", to: "/test-case-approvals", icon: ShieldCheck },
  { label: "Test Runs", to: "/test-runs", icon: BarChart3 },
  { label: "Nastavení", to: "/settings", icon: ShieldCheck },
];

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const workspaceLayout = /^\/(test-runs\/\d+\/execution|execution\/\d+)\/?$/.test(pathname) || /^\/(test-cases(?:\/\d+)?|test-case-approvals(?:\/\d+)?)\/?$/.test(pathname);
  const [executionMenuExpanded, setExecutionMenuExpanded] = useState(false);
  const compact = workspaceLayout && !executionMenuExpanded;
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const initials = (user?.name ?? user?.email ?? "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/test-cases?q=${encodeURIComponent(query)}`);
  }

  function handleLogout() {
    logout();
    window.location.assign("/login");
  }

  return (
    <div className="min-h-screen bg-page text-text">
      <aside className={`fixed inset-y-0 left-0 hidden border-r border-border bg-surface py-5 lg:block ${compact ? "w-16 px-2" : "w-64 px-4"}`}>
        <div className="mb-8 px-2">
          <div className="text-lg font-semibold">{compact ? "FET" : "FET - fio evidence testů"}</div>
          {!compact && <div className="text-sm text-muted">Interní QA portál</div>}
        </div>
        <NavigationLinks compact={compact} />
      </aside>
      <div className={`${compact ? "lg:pl-16" : "lg:pl-64"} ${workspaceLayout ? "execution-app-shell" : ""}`}>
        <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className={workspaceLayout ? "flex items-center gap-3" : "grid gap-3 xl:grid-cols-[220px_minmax(240px,1fr)_auto] xl:items-center"}>
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Otevřít hlavní navigaci"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
                type="button"
                onClick={() => setMobileNavigationOpen(true)}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              {workspaceLayout && <button type="button" className="hidden h-9 w-9 shrink-0 place-items-center rounded border border-border lg:grid" aria-label={compact ? "Rozbalit hlavní menu" : "Sbalit hlavní menu"} onClick={() => setExecutionMenuExpanded(value => !value)}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>}
              <div className={workspaceLayout ? "hidden 2xl:block" : "min-w-0"}>
                <div className="text-sm font-medium text-muted">QA tým</div>
                <h1 className="truncate text-xl font-semibold">Správa testování</h1>
              </div>
            </div>
            <form className={`relative hidden w-full md:block ${workspaceLayout ? "flex-1" : ""}`} onSubmit={handleSearch}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={18} aria-hidden="true" />
              <input
                aria-label="Globální hledání v repository"
                className="w-full rounded-md border border-control bg-surface-muted py-2 pl-10 pr-3 text-sm outline-none ring-focus transition focus:border-focus focus:ring-2"
                placeholder="Hledat test case nebo suite"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </form>
            <div className="flex items-center justify-end gap-3 text-sm">
              <ThemeSwitcher />
              <div className="hidden items-center gap-3 md:flex">
              <div className="text-right">
                <div className="font-medium">{user?.name}</div>
                <div className="text-muted">{user?.role}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-accent font-semibold text-on-accent">
                {initials}
              </div>
              <button
                aria-label="Odhlásit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted transition hover:bg-surface-muted hover:text-text"
                type="button"
                onClick={handleLogout}
                title="Odhlásit"
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
              </div>
            </div>
          </div>
        </header>
        <main className={workspaceLayout ? "execution-app-main" : "px-4 py-6 lg:px-8"}>{children}</main>
      </div>

      {mobileNavigationOpen && (
        <AccessibleDialog
          title="Navigace"
          panelClassName="max-w-sm"
          onClose={() => setMobileNavigationOpen(false)}
        >
          <NavigationLinks onNavigate={() => setMobileNavigationOpen(false)} />
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-3 text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-muted">{user?.role}</div>
            </div>
            <button
              className="flex min-h-11 w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-text"
              type="button"
              onClick={handleLogout}
            >
              <LogOut size={18} aria-hidden="true" />
              Odhlásit se
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}

function NavigationLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <nav aria-label="Hlavní navigace" className="space-y-1">
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => [
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-selected-bg text-link"
                : "text-muted hover:bg-surface-muted hover:text-text",
            ].join(" ")}
            onClick={onNavigate}
            title={compact ? item.label : undefined}
            aria-label={item.label}
          >
            <Icon size={18} aria-hidden="true" />
            {!compact && item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

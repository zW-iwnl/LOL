import {
  BarChart3,
  Bug,
  ClipboardCheck,
  FileBarChart,
  FolderKanban,
  LayoutDashboard,
  ListTree,
  Search,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Projekty", to: "/projects", icon: FolderKanban },
  { label: "Test Suity", to: "/test-suites", icon: ListTree },
  { label: "Test Cases", to: "/test-cases", icon: ClipboardCheck },
  { label: "Test Runs", to: "/test-runs", icon: BarChart3 },
  { label: "Defecty", to: "/defects", icon: Bug },
  { label: "Reporty", to: "/reports", icon: FileBarChart },
  { label: "Nastavení", to: "/settings", icon: Settings },
];

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="mb-8 px-2">
          <div className="text-lg font-semibold">Test Manager</div>
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-500">QA tým</div>
              <h1 className="text-xl font-semibold">Správa testování</h1>
            </div>
            <label className="relative hidden w-full max-w-md md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none ring-cyan-500 transition focus:border-cyan-500 focus:ring-2"
                placeholder="Hledat test case, suite nebo defect"
                type="search"
              />
            </label>
            <div className="hidden items-center gap-3 text-sm md:flex">
              <div className="text-right">
                <div className="font-medium">Admin Tester</div>
                <div className="text-slate-500">QA Lead</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-900 font-semibold text-white">
                AT
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

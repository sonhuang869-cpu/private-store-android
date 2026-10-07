import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Menu, Package, RotateCcw, Smartphone, Store, X } from "lucide-react";
import { toast } from "sonner";
import { reset } from "@/lib/api";

const MENU = [
  { to: "/", label: "Fleet", I: Store, exact: true },
  { to: "/apps", label: "Catalogue", I: Package },
  { to: "/devices", label: "Devices", I: Smartphone },
  { to: "/notes", label: "Constraints", I: BookOpen },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [pathname]);

  const nav = (
    <nav className="flex flex-wrap gap-1" aria-label="Sections">
      {MENU.map(({ to, label, I, exact }) => (
        <NavLink key={to} to={to} end={exact}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors ${
              isActive ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-secondary"
            }`
          }>
          <I className="size-4 shrink-0" aria-hidden /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <Link to="/" className="flex min-h-11 items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground">
                <Store className="size-5" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">Private app store</span>
                <span className="block text-xs text-muted-foreground">operator console · phase one</span>
              </span>
            </Link>
            <div className="hidden items-center gap-2 lg:flex">
              {nav}
              <button type="button" data-testid="reset"
                onClick={async () => { await reset(); toast.success("Demo data restored"); navigate("/", { replace: true }); }}
                className="flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:bg-secondary">
                <RotateCcw className="size-4 shrink-0" aria-hidden /> Reset
              </button>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"} data-testid="menu-button"
              className="grid size-11 place-items-center rounded-sm border border-border lg:hidden">
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
          {open && (
            <div className="pb-3 lg:hidden" data-testid="mobile-menu">
              {nav}
              <button type="button" data-testid="reset-mobile"
                onClick={async () => { await reset(); toast.success("Demo data restored"); navigate("/", { replace: true }); }}
                className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:bg-secondary">
                <RotateCcw className="size-4 shrink-0" aria-hidden /> Reset
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10"><Outlet /></main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Demo for evaluation. The families, serial numbers, package names and SHA-256 values are
          invented; no APK is uploaded, downloaded or installed anywhere. What is real is the
          decision logic: the check-in rules, the signature and device-owner preconditions and the
          staged rollout are the same ones the Kotlin client and the Node server would implement.
          This console is the server side of phase one, not a replacement for the Android work.
          Justin Gnoh · October 2026
        </div>
      </footer>
    </div>
  );
}

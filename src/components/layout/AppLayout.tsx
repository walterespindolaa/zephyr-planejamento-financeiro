import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Users,
  UserCog,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ZephyrLogo } from "@/components/brand/ZephyrLogo";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("zephyr_sidebar_collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("zephyr_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const nav = [
    { to: "/", label: "Clientes", icon: Users, end: true },
    ...(role === "admin" ? [{ to: "/equipe", label: "Equipe", icon: UserCog, end: false }] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const itemClass = (isActive: boolean, mini: boolean) =>
    cn(
      "flex items-center font-medium transition-colors",
      mini
        ? "mx-auto h-11 w-11 justify-center rounded-2xl"
        : "gap-3 rounded-full px-4 py-2.5 text-sm",
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop — painel flutuante arredondado */}
      <div className="sticky top-0 hidden h-screen p-2 md:block">
        <aside
          className={cn(
            "flex h-full flex-col rounded-3xl bg-sidebar text-sidebar-foreground shadow-elevated transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-60"
          )}
        >
          {/* Marca */}
          <div className={cn("flex items-center py-5", collapsed ? "justify-center px-0" : "px-5")}>
            {collapsed ? (
              <img
                src="/favicon.jpeg"
                alt="Zephyr"
                className="h-9 w-9 rounded-xl object-cover"
              />
            ) : (
              <ZephyrLogo variant="light" size={26} />
            )}
          </div>

          {/* Navegação */}
          <TooltipProvider delayDuration={0}>
            <nav className="flex-1 space-y-1.5 px-3">
              {nav.map((item) =>
                collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <NavLink to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive, true)}>
                        <item.icon className="h-5 w-5" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive, false)}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              )}
            </nav>
          </TooltipProvider>

          {/* Rodapé */}
          <div className="space-y-1 border-t border-sidebar-border/60 p-3">
            {!collapsed && (
              <div className="px-2 pb-1">
                <p className="truncate text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60">{role ? ROLE_LABEL[role] : ""}</p>
              </div>
            )}
            <button onClick={handleLogout} className={cn("text-sidebar-foreground/70", itemClass(false, collapsed))}>
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn("text-sidebar-foreground/50", itemClass(false, collapsed))}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5 shrink-0" />}
              {!collapsed && <span>Recolher</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* Conteúdo + topo mobile */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <ZephyrLogo variant="dark" size={24} />
          <button onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="space-y-1 border-b bg-sidebar px-3 py-3 text-sidebar-foreground md:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => itemClass(isActive, false)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button onClick={handleLogout} className={cn("text-sidebar-foreground/70", itemClass(false, false))}>
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

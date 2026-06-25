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
import { ZephyrLogo, ZephyrMark } from "@/components/brand/ZephyrLogo";
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

  const NavItems = ({ collapsed }: { collapsed: boolean }) => (
    <TooltipProvider delayDuration={0}>
      <nav className="flex-1 space-y-1.5 px-3">
        {nav.map((item) => (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-full py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "gap-3 px-4",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
      </nav>
    </TooltipProvider>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className={cn("flex items-center py-6", collapsed ? "justify-center px-0" : "px-5")}>
          {collapsed ? <ZephyrMark size={32} /> : <ZephyrLogo variant="light" size={28} />}
        </div>

        <NavItems collapsed={collapsed} />

        <div className="space-y-2 border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="px-1">
              <p className="truncate text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60">{role ? ROLE_LABEL[role] : ""}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center rounded-full py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent",
              collapsed ? "justify-center" : "gap-2 px-3"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sair"}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex w-full items-center rounded-full py-2 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent",
              collapsed ? "justify-center" : "gap-2 px-3"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Recolher"}
          </button>
        </div>
      </aside>

      {/* Conteúdo + topo mobile */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <ZephyrLogo variant="dark" size={24} />
          <button onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="space-y-1 border-b bg-sidebar py-3 text-sidebar-foreground md:hidden">
            <NavItems collapsed={false} />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-6 py-2.5 text-sm text-sidebar-foreground/80"
            >
              <LogOut className="h-4 w-4" /> Sair
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

import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Users, UserCog, LogOut, Menu, X, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ZephyrLogo } from "@/components/brand/ZephyrLogo";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile
  const [hover, setHover] = useState(false); // desktop hover-expand

  const expanded = hover;

  const nav = [
    { to: "/", label: "Clientes", icon: Users, end: true },
    { to: "/acompanhamentos", label: "Acompanhamentos", icon: ClipboardList, end: false },
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
        ? "mx-auto h-12 w-12 justify-center rounded-2xl"
        : "gap-3 rounded-full px-4 py-2.5 text-sm",
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Espaçador fixo (reserva a faixa estreita); a sidebar expande por cima no hover */}
      <div className="hidden w-[88px] shrink-0 md:block">
        <aside
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "fixed bottom-2 left-2 top-2 z-40 flex flex-col rounded-3xl bg-sidebar text-sidebar-foreground shadow-elevated transition-all duration-200",
            expanded ? "w-60" : "w-[72px]"
          )}
        >
          {/* Marca */}
          <div className={cn("flex items-center py-5", expanded ? "px-5" : "justify-center px-0")}>
            {expanded ? (
              <ZephyrLogo variant="light" size={26} />
            ) : (
              <img src="/favicon.jpeg" alt="Zephyr" className="h-10 w-10 rounded-xl object-cover" />
            )}
          </div>

          {/* Navegação */}
          <nav className="flex-1 space-y-1.5 px-3">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive, !expanded)}>
                <item.icon className={expanded ? "h-5 w-5 shrink-0" : "h-6 w-6"} />
                {expanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Rodapé */}
          <div className="space-y-1 border-t border-sidebar-border/60 p-3">
            {expanded && (
              <div className="px-2 pb-1">
                <p className="truncate text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60">{role ? ROLE_LABEL[role] : ""}</p>
              </div>
            )}
            <button onClick={handleLogout} className={cn("text-sidebar-foreground/70", itemClass(false, !expanded))}>
              <LogOut className={expanded ? "h-5 w-5 shrink-0" : "h-6 w-6"} />
              {expanded && <span>Sair</span>}
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

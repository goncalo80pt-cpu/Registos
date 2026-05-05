import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogOut, LayoutDashboard, History, LogIn, CalendarRange, Users } from "lucide-react";

export default function Header({ minimal = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = time.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = time.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <header className="crystal-glass sticky top-0 z-50" data-testid="app-header">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-10 py-4 sm:py-5">
        <Link to="/" className="flex items-center gap-3" data-testid="brand-link">
          <div className="w-10 h-10 rounded-xl bg-[#4A7C59] flex items-center justify-center text-white font-heading text-xl font-semibold shrink-0">
            C
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-heading font-medium text-base sm:text-lg text-[#1F2924] truncate">
              centro.social.de.brito<span className="text-[#4A7C59]">.Registos</span>
            </div>
            <div className="label-up text-[10px]">Entrada · Saída</div>
          </div>
        </Link>

        {minimal ? (
          <div className="hidden sm:flex items-center gap-6">
            <span className="font-heading text-xl text-[#1F2924] tabular-nums" data-testid="header-clock">{fmtTime}</span>
            <span className="text-sm text-[#5C6B62] capitalize hidden md:inline" data-testid="header-date">{fmtDate}</span>
          </div>
        ) : (
          <nav className="flex items-center gap-1 sm:gap-2 md:gap-3 overflow-x-auto max-w-full">
            {user?.is_admin && (
              <>
                <button onClick={() => navigate('/dashboard')} className={`btn-ghost px-4 py-2 text-sm flex items-center gap-2 ${location.pathname==='/dashboard'?'bg-[#F1F2F0]':''}`} data-testid="nav-dashboard">
                  <LayoutDashboard className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
                </button>
                <button onClick={() => navigate('/agenda')} className={`btn-ghost px-4 py-2 text-sm flex items-center gap-2 ${location.pathname==='/agenda'?'bg-[#F1F2F0]':''}`} data-testid="nav-agenda">
                  <CalendarRange className="w-4 h-4" /><span className="hidden sm:inline">Agenda</span>
                </button>
                <button onClick={() => navigate('/utentes')} className={`btn-ghost px-4 py-2 text-sm flex items-center gap-2 ${location.pathname==='/utentes'?'bg-[#F1F2F0]':''}`} data-testid="nav-utentes">
                  <Users className="w-4 h-4" /><span className="hidden sm:inline">Utentes</span>
                </button>
                <button onClick={() => navigate('/saidas')} className={`btn-ghost px-4 py-2 text-sm flex items-center gap-2 ${location.pathname==='/saidas'?'bg-[#F1F2F0]':''}`} data-testid="nav-saidas">
                  <LogOut className="w-4 h-4 rotate-180" /><span className="hidden sm:inline">Saídas</span>
                </button>
                <button onClick={() => navigate('/historico')} className={`btn-ghost px-4 py-2 text-sm flex items-center gap-2 ${location.pathname==='/historico'?'bg-[#F1F2F0]':''}`} data-testid="nav-history">
                  <History className="w-4 h-4" /><span className="hidden sm:inline">Histórico</span>
                </button>
              </>
            )}
            {user ? (
              <>
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#5C6B62] px-2 py-1 bg-[#F1F2F0] rounded-md" data-testid="user-badge">
                  <span className="w-2 h-2 rounded-full bg-[#4A7C59]" />
                  {user.name}{user.scopes && user.scopes !== "all" ? "" : " · acesso total"}
                </span>
                <button onClick={async()=>{await logout(); navigate('/');}} className="btn-ghost px-4 py-2 text-sm flex items-center gap-2" data-testid="logout-btn">
                  <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sair</span>
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className="btn-primary px-4 py-2 text-sm flex items-center gap-2" data-testid="login-btn">
                <LogIn className="w-4 h-4" /><span>Entrar (Admin)</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

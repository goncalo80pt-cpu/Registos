import React, { useState, useEffect, useRef } from "react";
import Header from "../components/Header";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { toast } from "sonner";
import { KeyRound, User as UserIcon } from "lucide-react";

const REMEMBER_KEY = "csb_remember_login";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const autoTriedRef = useRef(false);

  const performLogin = async (n, p) => {
    setSubmitting(true);
    try {
      const res = await api.post("/auth/admin-login", { name: n, password: p });
      if (res.data.session_token) localStorage.setItem("session_token", res.data.session_token);
      setUser(res.data.user);
      toast.success(`Bem-vindo, ${res.data.user.name}`);
      navigate(next, { replace: true });
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Credenciais inválidas");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // On mount: pre-fill from localStorage and (if found) try auto-login once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.name) setName(saved.name);
      if (saved?.password) setPassword(saved.password);
      setRemember(true);
      if (saved?.name && saved?.password && !autoTriedRef.current) {
        autoTriedRef.current = true;
        performLogin(saved.name, saved.password).then(ok => {
          if (!ok) localStorage.removeItem(REMEMBER_KEY);
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginAdmin = async (e) => {
    e.preventDefault();
    if (remember) {
      try {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name, password }));
      } catch { /* ignore */ }
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    await performLogin(name, password);
  };

  const forgetSaved = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setName("");
    setPassword("");
    setRemember(false);
    toast.success("Login guardado removido deste dispositivo.");
  };

  const hasSaved = !!localStorage.getItem(REMEMBER_KEY);

  return (
    <div className="min-h-screen" data-testid="login-page">
      <Header />
      <main className="max-w-md mx-auto px-6 py-16 md:py-24 fade-in-up">
        <div className="card-crisp p-10">
          <div className="label-up mb-3">Administração</div>
          <h1 className="font-heading text-4xl font-light text-[#1F2924] mb-3">Iniciar sessão</h1>
          <p className="text-[#5C6B62] mb-8 text-sm">Entre com o nome e palavra-passe do seu serviço.</p>

          <form onSubmit={loginAdmin} className="space-y-5" data-testid="admin-login-form">
            <div>
              <label className="label-up mb-2 block">Nome</label>
              <div className="relative">
                <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62]" />
                <input
                  className="input-kiosk pl-12"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Erpi Sede / Erpi Paraíso / Lar Residencial / Admin"
                  data-testid="admin-name"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <div>
              <label className="label-up mb-2 block">Palavra-passe</label>
              <input
                type="password"
                className="input-kiosk"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="admin-password"
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none" data-testid="remember-toggle">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-[#E5E7E2] text-[#4A7C59] focus:ring-[#4A7C59] cursor-pointer"
              />
              <span className="text-sm text-[#1F2924] leading-relaxed">
                <strong>Manter sessão iniciada neste dispositivo</strong>
                <span className="block text-xs text-[#5C6B62] mt-0.5">
                  Da próxima vez que abrir o site/app entrará automaticamente. Use apenas em tablets/computadores do serviço.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary px-6 py-5 flex items-center justify-center gap-3 disabled:opacity-60"
              data-testid="admin-submit"
            >
              <KeyRound className="w-5 h-5" />
              {submitting ? "A entrar..." : "Entrar"}
            </button>

            {hasSaved && (
              <button
                type="button"
                onClick={forgetSaved}
                className="w-full text-xs text-[#5C6B62] hover:text-[#C26D5C] underline mt-2"
                data-testid="forget-saved-btn"
              >
                Esquecer login guardado neste dispositivo
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

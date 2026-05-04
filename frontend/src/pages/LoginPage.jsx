import React, { useState } from "react";
import Header from "../components/Header";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { toast } from "sonner";
import { KeyRound, User as UserIcon } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loginAdmin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post("/auth/admin-login", { name, password });
      if (res.data.session_token) localStorage.setItem("session_token", res.data.session_token);
      setUser(res.data.user);
      toast.success(`Bem-vindo, ${res.data.user.name}`);
      navigate(next, { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Credenciais inválidas");
    } finally {
      setSubmitting(false);
    }
  };

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
                  placeholder="Erpi Sede / Erpi Parais / Lar Residencial"
                  data-testid="admin-name"
                  autoComplete="username"
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
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary px-6 py-5 flex items-center justify-center gap-3 disabled:opacity-60"
              data-testid="admin-submit"
            >
              <KeyRound className="w-5 h-5" />
              {submitting ? "A entrar..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

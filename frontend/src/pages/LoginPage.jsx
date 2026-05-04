import React, { useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [tab, setTab] = useState("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginGoogle = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const loginAdmin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post("/auth/admin-login", { email, password });
      if (res.data.session_token) localStorage.setItem("session_token", res.data.session_token);
      setUser(res.data.user);
      toast.success("Sessão iniciada");
      navigate("/dashboard", { replace: true });
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
          <h1 className="font-heading text-4xl font-light text-[#1F2924] mb-8">Iniciar sessão</h1>

          <div className="flex gap-1 p-1 bg-[#F1F2F0] rounded-lg mb-8" role="tablist">
            <button onClick={() => setTab("google")} className={`flex-1 py-3 rounded-md text-sm font-medium transition ${tab==='google'?'bg-white shadow-sm text-[#1F2924]':'text-[#5C6B62]'}`} data-testid="tab-google">Google</button>
            <button onClick={() => setTab("admin")} className={`flex-1 py-3 rounded-md text-sm font-medium transition ${tab==='admin'?'bg-white shadow-sm text-[#1F2924]':'text-[#5C6B62]'}`} data-testid="tab-admin">Admin</button>
          </div>

          {tab === "google" ? (
            <div className="space-y-5">
              <p className="text-[#5C6B62]">Entre com a sua conta Google da instituição. A primeira conta a entrar com o e-mail de administrador terá privilégios.</p>
              <button onClick={loginGoogle} className="w-full btn-primary px-6 py-5 flex items-center justify-center gap-3" data-testid="google-login-btn">
                <ShieldCheck className="w-5 h-5" />
                Entrar com Google
              </button>
            </div>
          ) : (
            <form onSubmit={loginAdmin} className="space-y-5" data-testid="admin-login-form">
              <div>
                <label className="label-up mb-2 block">E-mail</label>
                <input type="email" className="input-kiosk" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@instituicao.pt" data-testid="admin-email" />
              </div>
              <div>
                <label className="label-up mb-2 block">Palavra-passe</label>
                <input type="password" className="input-kiosk" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" data-testid="admin-password" />
              </div>
              <button type="submit" disabled={submitting} className="w-full btn-primary px-6 py-5 flex items-center justify-center gap-3 disabled:opacity-60" data-testid="admin-submit">
                <KeyRound className="w-5 h-5" />
                {submitting ? "A entrar..." : "Entrar"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

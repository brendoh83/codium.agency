"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(
        error.message.includes("Invalid login") || error.message.includes("Email not confirmed")
          ? "E-mail ou senha incorretos, ou a conta ainda não foi confirmada."
          : error.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-lg font-semibold text-copper-100">
            C
          </div>
          <h1 className="text-lg font-semibold tracking-wide text-navy-900">CODIUM</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Gestão da Agência
          </p>
        </div>

        {erro && (
          <div className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</div>
        )}

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-copper-500 focus:ring-2 focus:ring-copper-500/20"
              placeholder="voce@codium.com.br"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-copper-500 focus:ring-2 focus:ring-copper-500/20"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            className="mt-2 w-full rounded-lg bg-navy-900 py-2.5 text-sm font-medium text-white transition hover:bg-navy-950 disabled:opacity-50"
          >
            {carregando ? "Aguarde..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

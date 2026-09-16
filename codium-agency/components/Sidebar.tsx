"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/actions/auth";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/clientes", label: "Clientes", icon: "◍" },
  { href: "/leads", label: "Leads", icon: "◇" },
  { href: "/financeiro", label: "Financeiro", icon: "$" },
  { href: "/despesas", label: "Despesas", icon: "▼" },
  { href: "/historico", label: "Histórico", icon: "▥" },
  { href: "/contratos", label: "Contratos", icon: "▤" },
  { href: "/tarefas", label: "Tarefas", icon: "✓" },
  { href: "/metricas", label: "Métricas", icon: "◔" },
  { href: "/alertas", label: "Alertas", icon: "!" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setAberto(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-copper-500/15 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="w-4 text-center text-copper-500">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-navy-950 px-4 md:hidden">
        <div className="flex items-center gap-2 text-white">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-copper-500 text-xs font-bold">
            C
          </div>
          <span className="text-sm font-semibold tracking-wide">CODIUM</span>
        </div>
        <button
          onClick={() => setAberto(!aberto)}
          className="rounded-md p-2 text-white/80 hover:bg-white/10"
          aria-label="Menu"
        >
          {aberto ? "✕" : "☰"}
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-navy-950 pt-14 transition-transform md:translate-x-0 md:pt-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden items-center gap-2 px-5 py-6 text-white md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-copper-500 text-sm font-bold">
            C
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">CODIUM</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Gestão da Agência
            </div>
          </div>
        </div>

        <div className="mt-2">{nav}</div>

        <div className="mt-auto space-y-2 border-t border-white/10 p-4">
          <div className="truncate text-xs text-slate-400">{email}</div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

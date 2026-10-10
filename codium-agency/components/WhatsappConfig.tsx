"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gruposDisponiveis, iniciarConexao, salvarGrupoEquipe, statusWhatsapp } from "@/actions/whatsapp";

type Status = Awaited<ReturnType<typeof statusWhatsapp>>;

export interface AvisoLinha {
  id: string;
  tipo: string;
  destino: string;
  texto: string;
  ok: boolean;
  erro: string | null;
  created_at: string;
}

const ESTADO: Record<string, string> = {
  open: "Conectado",
  connecting: "Conectando…",
  close: "Desconectado",
  sem_instancia: "Instância ainda não criada",
  nao_configurado: "Servidor não configurado",
  sem_login: "Sem login",
};

export default function WhatsappConfig({ status, avisos }: { status: Status; avisos: AvisoLinha[] }) {
  const router = useRouter();
  const [estado, setEstado] = useState(status.estado);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [pendente, start] = useTransition();

  // enquanto há QR ou código na tela, confere o estado a cada 3 s
  useEffect(() => {
    if (estado === "open" || (!qr && !codigo)) return;
    const t = setInterval(async () => {
      const s = await statusWhatsapp();
      setEstado(s.estado);
      if (s.estado === "open") {
        setQr(null);
        setCodigo(null);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [estado, qr, codigo, router]);

  function conectarAgora(comNumero: boolean) {
    setErro(null);
    start(async () => {
      const r = await iniciarConexao(comNumero ? numero : undefined);
      if (r.erro) return setErro(r.erro);
      setQr(r.qr ?? null);
      setCodigo(r.codigo ?? null);
      setEstado("connecting");
    });
  }

  function carregarGrupos() {
    setErro(null);
    start(async () => {
      const r = await gruposDisponiveis();
      if (r.erro) return setErro(r.erro);
      setGrupos(r.grupos ?? []);
    });
  }

  function escolherEquipe(id: string) {
    const g = grupos?.find((x) => x.id === id);
    if (!g) return;
    start(async () => {
      const r = await salvarGrupoEquipe(g.id, g.nome);
      if (r.erro) return setErro(r.erro);
      setGrupos(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            estado === "open" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"
          }`}
        >
          {ESTADO[estado] ?? estado}
        </span>
        <span className="text-xs text-slate-400">Instância: {status.instancia}</span>
      </div>

      {!status.configurado && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Faltam as variáveis <code>EVOLUTION_URL</code> e <code>EVOLUTION_API_KEY</code> na Vercel.
        </p>
      )}

      {status.configurado && estado !== "open" && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho, e escaneie o QR.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => conectarAgora(false)}
              disabled={pendente}
              className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Gerar QR code
            </button>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ou número com DDI (ex.: 5549999990000)"
              className="input flex-1"
            />
            <button
              onClick={() => conectarAgora(true)}
              disabled={pendente || numero.replace(/\D/g, "").length < 10}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Usar código de pareamento
            </button>
          </div>
          {qr && <img src={qr} alt="QR code do WhatsApp" className="h-56 w-56 rounded-lg border border-slate-200" />}
          {codigo && (
            <p className="text-sm">
              Código de pareamento: <span className="font-mono font-semibold">{codigo}</span>
            </p>
          )}
        </div>
      )}

      {estado === "open" && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="text-xs uppercase text-slate-400">
            Grupo da equipe (recebe aprovações e reprovações)
          </div>
          <div className="text-sm text-navy-900">
            {status.grupoEquipe ? status.grupoEquipe.nome : "Nenhum escolhido"}
          </div>
          {grupos === null ? (
            <button
              onClick={carregarGrupos}
              disabled={pendente}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              {status.grupoEquipe ? "Trocar grupo" : "Escolher grupo"}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder={`Buscar entre ${grupos.length} grupos…`}
                className="input w-full"
              />
              <select
                defaultValue=""
                size={6}
                disabled={pendente}
                onChange={(e) => escolherEquipe(e.target.value)}
                className="input w-full"
              >
                {grupos
                  .filter((g) => g.nome.toLowerCase().includes(filtro.trim().toLowerCase()))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      <div>
        <div className="mb-2 text-xs uppercase text-slate-400">Avisos recentes</div>
        {avisos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum aviso enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            {avisos.map((a) => (
              <li key={a.id} className="flex items-start gap-2 p-2">
                <span className={a.ok ? "text-ok" : "text-danger"}>{a.ok ? "✓" : "✕"}</span>
                <div className="min-w-0">
                  <div className="truncate text-slate-700">{a.texto}</div>
                  {!a.ok && a.erro && <div className="text-danger">{a.erro}</div>}
                  <div className="text-slate-400">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

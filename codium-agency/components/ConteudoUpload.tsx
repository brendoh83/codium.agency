"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarConteudo, registrarNovaVersao, trocarArquivo } from "@/actions/conteudos";

function enviarArquivo(url: string, arquivo: File, onProgresso: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", arquivo.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo."));
    xhr.onerror = () => reject(new Error("Falha de rede no envio do arquivo."));
    xhr.send(arquivo);
  });
}

export default function ConteudoUpload({
  clienteId,
  conteudoId,
  trocar,
  onConcluido,
}: {
  clienteId: string;
  conteudoId?: string;
  trocar?: boolean;
  onConcluido?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const existente = Boolean(conteudoId);
  const novaVersao = existente && !trocar;
  const ocupado = pct !== null;

  async function enviar() {
    setErro(null);
    if (!arquivo) return setErro("Escolha um arquivo.");
    if (!existente && !titulo.trim()) return setErro("Informe um título.");
    setPct(0);
    try {
      const r = await fetch("/api/conteudos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, mime: arquivo.type, tamanho: arquivo.size }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível preparar o envio.");
      await enviarArquivo(j.url, arquivo, setPct);
      const base = { clienteId, key: j.key as string, mime: arquivo.type, tamanho: arquivo.size };
      const res = trocar
        ? await trocarArquivo({ ...base, conteudoId: conteudoId as string })
        : novaVersao
          ? await registrarNovaVersao({ ...base, conteudoId: conteudoId as string })
          : await registrarConteudo({ ...base, titulo });
      if (res.erro) throw new Error(res.erro);
      setTitulo("");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no envio.");
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      {!existente && (
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do conteúdo (ex.: Reels de lançamento)"
          maxLength={200}
          disabled={ocupado}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
        disabled={ocupado}
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={enviar}
          disabled={ocupado}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50"
        >
          {trocar ? "Trocar arquivo" : novaVersao ? "Subir nova versão" : "Enviar conteúdo"}
        </button>
        {pct !== null && <span className="text-sm text-slate-500">{pct}%</span>}
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}

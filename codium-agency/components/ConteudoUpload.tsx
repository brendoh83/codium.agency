"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  registrarCarrossel,
  registrarConteudo,
  registrarNovaVersao,
  registrarNovaVersaoCarrossel,
  trocarArquivo,
  trocarCarrossel,
} from "@/actions/conteudos";
import { MAX_SLIDES, MIN_SLIDES, mimePorArquivo } from "@/lib/conteudos";

/** Falha de rede = a conexão caiu no meio do envio (vale tentar de novo); outras falhas não. */
class FalhaDeRede extends Error {}

const mimeDe = (f: File) => mimePorArquivo(f.name, f.type);

async function enviarArquivo(url: string, arquivo: File, onProgresso: (pct: number) => void) {
  const TENTATIVAS = 3;
  for (let i = 1; ; i++) {
    try {
      return await enviarUmaVez(url, arquivo, onProgresso);
    } catch (e) {
      if (!(e instanceof FalhaDeRede)) throw e;
      if (i >= TENTATIVAS) {
        throw new Error("A conexão caiu durante o envio e não voltou. Confira a internet e tente de novo.");
      }
      onProgresso(0);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

function enviarUmaVez(url: string, arquivo: File, onProgresso: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeDe(arquivo));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo."));
    xhr.onerror = () => reject(new FalhaDeRede("Falha de rede no envio do arquivo."));
    xhr.onabort = () => reject(new FalhaDeRede("Envio interrompido."));
    xhr.send(arquivo);
  });
}

type ItemImagem = { id: string; arquivo: File; previa: string };

export default function ConteudoUpload({
  clienteId,
  conteudoId,
  trocar,
  tipoConteudo,
  onConcluido,
}: {
  clienteId: string;
  conteudoId?: string;
  trocar?: boolean;
  /** Tipo do conteúdo já existente (define se é carrossel). */
  tipoConteudo?: "video" | "imagem" | "carrossel";
  onConcluido?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modoCarrossel, setModoCarrossel] = useState(false);
  const [imagens, setImagens] = useState<ItemImagem[]>([]);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const existente = Boolean(conteudoId);
  const novaVersao = existente && !trocar;
  const ocupado = pct !== null;
  const carrossel = existente ? tipoConteudo === "carrossel" : modoCarrossel;

  // libera as prévias da memória ao sair
  useEffect(() => () => imagens.forEach((i) => URL.revokeObjectURL(i.previa)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function adicionar(files: FileList | null) {
    if (!files) return;
    const novas = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      arquivo: f,
      previa: URL.createObjectURL(f),
    }));
    setImagens((atuais) => [...atuais, ...novas].slice(0, MAX_SLIDES));
    if (inputRef.current) inputRef.current.value = "";
  }

  function mover(idx: number, delta: number) {
    setImagens((atuais) => {
      const alvo = idx + delta;
      if (alvo < 0 || alvo >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
      return copia;
    });
  }

  function remover(id: string) {
    setImagens((atuais) => {
      const sai = atuais.find((i) => i.id === id);
      if (sai) URL.revokeObjectURL(sai.previa);
      return atuais.filter((i) => i.id !== id);
    });
  }

  function soltarSobre(alvoId: string) {
    if (!arrastando || arrastando === alvoId) return;
    setImagens((atuais) => {
      const de = atuais.findIndex((i) => i.id === arrastando);
      const para = atuais.findIndex((i) => i.id === alvoId);
      if (de < 0 || para < 0) return atuais;
      const copia = [...atuais];
      const [mov] = copia.splice(de, 1);
      copia.splice(para, 0, mov);
      return copia;
    });
    setArrastando(null);
  }

  function limpar() {
    setTitulo("");
    setArquivo(null);
    imagens.forEach((i) => URL.revokeObjectURL(i.previa));
    setImagens([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function enviarCarrossel() {
    if (imagens.length < MIN_SLIDES) return setErro(`Escolha pelo menos ${MIN_SLIDES} imagens.`);
    const r = await fetch("/api/conteudos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        arquivos: imagens.map((i) => ({ mime: mimeDe(i.arquivo), tamanho: i.arquivo.size })),
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro ?? "Não foi possível preparar o envio.");
    const itens = j.itens as { key: string; url: string }[];

    // sobe uma por vez, na ordem escolhida; a barra soma todas
    for (let n = 0; n < imagens.length; n++) {
      await enviarArquivo(itens[n].url, imagens[n].arquivo, (p) =>
        setPct(Math.round(((n + p / 100) / imagens.length) * 100))
      );
    }
    const arquivos = imagens.map((img, n) => ({
      key: itens[n].key,
      mime: mimeDe(img.arquivo),
      tamanho: img.arquivo.size,
    }));
    const res = trocar
      ? await trocarCarrossel({ clienteId, conteudoId: conteudoId as string, arquivos })
      : novaVersao
        ? await registrarNovaVersaoCarrossel({ clienteId, conteudoId: conteudoId as string, arquivos })
        : await registrarCarrossel({ clienteId, titulo, arquivos });
    if (res.erro) throw new Error(res.erro);
  }

  async function enviarUnico() {
    if (!arquivo) return setErro("Escolha um arquivo.");
    const r = await fetch("/api/conteudos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, mime: mimeDe(arquivo), tamanho: arquivo.size }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro ?? "Não foi possível preparar o envio.");
    await enviarArquivo(j.url, arquivo, setPct);
    const base = { clienteId, key: j.key as string, mime: mimeDe(arquivo), tamanho: arquivo.size };
    const res = trocar
      ? await trocarArquivo({ ...base, conteudoId: conteudoId as string })
      : novaVersao
        ? await registrarNovaVersao({ ...base, conteudoId: conteudoId as string })
        : await registrarConteudo({ ...base, titulo });
    if (res.erro) throw new Error(res.erro);
  }

  async function enviar() {
    setErro(null);
    if (!existente && !titulo.trim()) return setErro("Informe um título.");
    if (carrossel ? imagens.length === 0 : !arquivo) {
      return setErro(carrossel ? "Escolha as imagens do carrossel." : "Escolha um arquivo.");
    }
    setPct(0);
    try {
      if (carrossel) await enviarCarrossel();
      else await enviarUnico();
      limpar();
      router.refresh();
      onConcluido?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no envio.");
    } finally {
      setPct(null);
    }
  }

  const rotuloBotao = carrossel
    ? trocar
      ? "Trocar as imagens"
      : novaVersao
        ? "Subir nova versão do carrossel"
        : `Enviar carrossel${imagens.length ? ` (${imagens.length} imagens)` : ""}`
    : trocar
      ? "Trocar arquivo"
      : novaVersao
        ? "Subir nova versão"
        : "Enviar conteúdo";

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      {!existente && (
        <div className="flex gap-2 text-xs">
          {[
            { v: false, t: "Arquivo único" },
            { v: true, t: "Carrossel (várias imagens)" },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              disabled={ocupado}
              onClick={() => setModoCarrossel(o.v)}
              className={`rounded-full border px-3 py-1.5 font-medium ${
                modoCarrossel === o.v ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}

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

      {carrossel ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.png,.webp"
            disabled={ocupado || imagens.length >= MAX_SLIDES}
            onChange={(e) => adicionar(e.target.files)}
            className="block w-full text-sm text-slate-600"
          />
          <p className="text-xs text-slate-400">
            De {MIN_SLIDES} a {MAX_SLIDES} imagens. Organize a ordem abaixo antes de enviar: a primeira é a capa.
          </p>
          {imagens.length > 0 && (
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {imagens.map((img, idx) => (
                <li
                  key={img.id}
                  draggable={!ocupado}
                  onDragStart={() => setArrastando(img.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltarSobre(img.id)}
                  onDragEnd={() => setArrastando(null)}
                  className={`overflow-hidden rounded-lg border bg-slate-50 ${
                    arrastando === img.id ? "border-copper-500 opacity-60" : "border-slate-200"
                  }`}
                >
                  <div className="relative aspect-[4/5] bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previa} alt="" draggable={false} className="h-full w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex">
                      <button
                        type="button"
                        onClick={() => mover(idx, -1)}
                        disabled={ocupado || idx === 0}
                        aria-label="Mover para antes"
                        className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(idx, 1)}
                        disabled={ocupado || idx === imagens.length - 1}
                        aria-label="Mover para depois"
                        className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(img.id)}
                      disabled={ocupado}
                      aria-label="Tirar imagem"
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:text-danger disabled:opacity-30"
                    >
                      Tirar
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,.mp4,.mov,.webm,.jpg,.jpeg,.jfif,.png,.webp"
          disabled={ocupado}
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={enviar}
          disabled={ocupado}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50"
        >
          {rotuloBotao}
        </button>
        {pct !== null && <span className="text-sm text-slate-500">{pct}%</span>}
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}

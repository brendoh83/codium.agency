import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAcao, processarFila, type DepsFila, type ItemFila } from "./fila.ts";

const MIN = 60_000;
const hora = new Date("2026-11-14T11:00:00Z");
const em = (min: number) => new Date(hora.getTime() + min * MIN).toISOString();

const post = (extra: Partial<ItemFila["postagem"]> = {}): ItemFila["postagem"] => ({
  id: "p1", estado: "agendada", agendado_para: hora.toISOString(), creation_id: null, ig_media_id: null, tentativas: 0, ...extra,
});

test("decidirAcao: publicar quando agendada, pronta e na hora (borda == agora)", () => {
  assert.equal(decidirAcao({ postagem: post(), pronto: true, agora: hora }), "publicar");
  assert.equal(decidirAcao({ postagem: post(), pronto: true, agora: new Date(hora.getTime() + 2 * MIN) }), "publicar");
});

test("decidirAcao: antes da hora é nada, e só 'agendada' é considerada", () => {
  assert.equal(decidirAcao({ postagem: post(), pronto: true, agora: new Date(hora.getTime() - 1) }), "nada");
  assert.equal(decidirAcao({ postagem: post({ estado: "postando" }), pronto: true, agora: hora }), "nada");
  assert.equal(decidirAcao({ postagem: post({ estado: "postada" }), pronto: false, agora: hora }), "nada");
});

test("decidirAcao: sem aprovação na hora é perdeu_horario", () => {
  assert.equal(decidirAcao({ postagem: post(), pronto: false, agora: hora }), "perdeu_horario");
  assert.equal(decidirAcao({ postagem: post(), pronto: false, agora: new Date(hora.getTime() + 3 * 60 * MIN) }), "perdeu_horario");
});

test("decidirAcao: primeira tentativa com mais de 10 min de atraso = sistema fora", () => {
  assert.equal(decidirAcao({ postagem: post(), pronto: true, agora: new Date(hora.getTime() + 10 * MIN) }), "publicar");
  assert.equal(decidirAcao({ postagem: post(), pronto: true, agora: new Date(hora.getTime() + 10 * MIN + 1) }), "sistema_fora");
});

test("decidirAcao: já em andamento (vídeo processando) continua mesmo atrasado", () => {
  const tarde = new Date(hora.getTime() + 40 * MIN);
  assert.equal(decidirAcao({ postagem: post({ creation_id: "c1" }), pronto: true, agora: tarde }), "publicar");
  assert.equal(decidirAcao({ postagem: post({ tentativas: 1 }), pronto: true, agora: tarde }), "publicar");
});

function item(extra: Partial<ItemFila> = {}): ItemFila {
  return {
    postagem: post(),
    pronto: true,
    faltou: [],
    clienteId: "cli1",
    empresa: "Toque Final",
    titulo: "Reels",
    link: "https://x.app/c/tok",
    conteudo: { tipo: "imagem", legenda: "oi", chaves: ["clientes/c/a.jpg"] },
    conta: { igUserId: "u1", tokenCifrado: "cif", status: "ativa" },
    ...extra,
  };
}

function montar(itens: ItemFila[], opts: { estadoInicial?: Record<string, string>; resultadoIg?: "postada" | "aguardando" | "falhou" } = {}) {
  const estados = new Map<string, string>(itens.map((i) => [i.postagem.id, opts.estadoInicial?.[i.postagem.id] ?? i.postagem.estado]));
  const equipe: string[] = [];
  const cliente: string[] = [];
  const salvos: Record<string, unknown>[] = [];
  let publicacoes = 0;
  const deps: DepsFila = {
    listar: async () => itens,
    reservar: async (id, de, para) => {
      if (estados.get(id) !== de) return false;
      estados.set(id, para);
      return true;
    },
    salvar: async (p) => {
      salvos.push(p);
      if (typeof p.estado === "string") estados.set(String(p.id), p.estado);
    },
    urls: async (chaves) => chaves.map((c) => `https://r2/${c}`),
    token: () => "token-claro",
    publicar: async (i) => {
      publicacoes++;
      const r = opts.resultadoIg ?? "postada";
      if (r === "postada") await deps.salvar({ id: i.postagem.id, estado: "postada", permalink: "https://www.instagram.com/p/X/" });
      if (r === "falhou") await deps.salvar({ id: i.postagem.id, estado: "falhou", erro: "A Meta recusou o pedido." });
      if (r === "aguardando") await deps.salvar({ id: i.postagem.id, estado: "agendada" });
      return r === "falhou" ? { resultado: r, erro: "A Meta recusou o pedido." } : { resultado: r };
    },
    avisarEquipe: async (t) => void equipe.push(t),
    avisarCliente: async (_c, t) => void cliente.push(t),
    agora: () => hora,
  };
  return { deps, equipe, cliente, salvos, estados, publicacoes: () => publicacoes };
}

test("duas execuções ao mesmo tempo publicam uma vez só", async () => {
  const { deps, publicacoes, equipe } = montar([item()]);
  const [a, b] = await Promise.all([processarFila(deps, hora), processarFila(deps, hora)]);
  assert.equal(publicacoes(), 1);
  assert.equal(a.publicadas + b.publicadas, 1);
  assert.equal(equipe.length, 1);
  assert.match(equipe[0], /Postado: Toque Final/);
});

test("não pronto na hora: perdeu horário, avisa cliente e equipe uma única vez", async () => {
  const it = item({ pronto: false, faltou: ["legenda"] });
  const { deps, equipe, cliente, estados, publicacoes } = montar([it]);
  const r1 = await processarFila(deps, hora);
  const r2 = await processarFila(deps, hora);
  assert.deepEqual(r1, { publicadas: 0, perdidas: 1, falhas: 0 });
  assert.deepEqual(r2, { publicadas: 0, perdidas: 0, falhas: 0 });
  assert.equal(estados.get("p1"), "perdeu_horario");
  assert.equal(publicacoes(), 0);
  assert.equal(cliente.length, 1);
  assert.match(cliente[0], /Olá, Toque Final/);
  assert.equal(equipe.length, 1);
  assert.match(equipe[0], /Faltou aprovar a legenda/);
});

test("falha ao postar avisa só a equipe com o erro", async () => {
  const { deps, equipe, cliente } = montar([item()], { resultadoIg: "falhou" });
  const r = await processarFila(deps, hora);
  assert.equal(r.falhas, 1);
  assert.equal(cliente.length, 0);
  assert.match(equipe[0], /Falhou ao postar: Toque Final/);
  assert.match(equipe[0], /A Meta recusou o pedido/);
});

test("aguardando (vídeo processando) não avisa ninguém", async () => {
  const { deps, equipe, cliente } = montar([item()], { resultadoIg: "aguardando" });
  const r = await processarFila(deps, hora);
  assert.deepEqual(r, { publicadas: 0, perdidas: 0, falhas: 0 });
  assert.equal(equipe.length + cliente.length, 0);
});

test("sistema fora: não posta, vira falhou e avisa só a equipe", async () => {
  const atrasada = item({ postagem: post({ agendado_para: em(-30) }) });
  const { deps, equipe, cliente, estados, publicacoes } = montar([atrasada]);
  const r = await processarFila(deps, hora);
  assert.deepEqual(r, { publicadas: 0, perdidas: 0, falhas: 1 });
  assert.equal(publicacoes(), 0);
  assert.equal(estados.get("p1"), "falhou");
  assert.equal(cliente.length, 0);
  assert.match(equipe[0], /Sistema fora do ar: Toque Final/);
  assert.match(equipe[0], /Poste manualmente/);
});

test("sem conta do Instagram ou pedindo reconexão: falha e avisa a equipe", async () => {
  const semConta = item({ conta: null });
  const { deps, equipe, publicacoes } = montar([semConta]);
  const r = await processarFila(deps, hora);
  assert.equal(r.falhas, 1);
  assert.equal(publicacoes(), 0);
  assert.match(equipe[0], /Instagram/);

  const reconectar = item({ conta: { igUserId: "u", tokenCifrado: "c", status: "reconectar" } });
  const m2 = montar([reconectar]);
  assert.equal((await processarFila(m2.deps, hora)).falhas, 1);
  assert.match(m2.equipe[0], /reconect/i);
});

test("um item que quebra não derruba os outros", async () => {
  const bom = item({ postagem: post({ id: "p2" }), titulo: "Bom" });
  const { deps, equipe } = montar([item(), bom]);
  const original = deps.publicar;
  deps.publicar = async (i) => {
    if (i.postagem.id === "p1") throw new Error("boom");
    return original(i);
  };
  const r = await processarFila(deps, hora);
  assert.equal(r.publicadas, 1);
  assert.ok(equipe.some((t) => t.includes("Postado") && t.includes("Bom")));
});

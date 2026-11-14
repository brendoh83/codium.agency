import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoLembrete } from "./lembretes.ts";

const H = 3600_000, M = 60_000;
const base = new Date("2026-11-13T12:00:00Z");
const com = (o: Partial<Parameters<typeof proximoLembrete>[0]>) =>
  proximoLembrete({ agora: base, agendadoPara: new Date(base.getTime() + 12 * H), ultimoAviso: base, abriuLinkEm: null, lembretesEnviados: 0, ...o });

test("abriu o link depois do ultimo aviso: +20 min", () => {
  const abriu = new Date(base.getTime() + 5 * M);
  assert.equal(com({ abriuLinkEm: abriu })?.getTime(), abriu.getTime() + 20 * M);
});
test("abriu antes do ultimo aviso nao conta", () => {
  assert.equal(com({ abriuLinkEm: new Date(base.getTime() - M) })?.getTime(), base.getTime() + 4 * H);
});
test("restante 12h: intervalo 4h", () => assert.equal(com({})?.getTime(), base.getTime() + 4 * H));
test("restante 30 min: piso 20 min", () =>
  assert.equal(com({ agendadoPara: new Date(base.getTime() + 30 * M) })?.getTime(), base.getTime() + 20 * M));
test("restante 30 dias: teto 6h", () =>
  assert.equal(com({ agendadoPara: new Date(base.getTime() + 30 * 24 * H) })?.getTime(), base.getTime() + 6 * H));
test("6 lembretes: null", () => assert.equal(com({ lembretesEnviados: 6 }), null));
test("horario ja passou: null", () => assert.equal(com({ agendadoPara: new Date(base.getTime() - M) }), null));
test("reagendar para depois recalcula", () => {
  const a = com({});
  const b = com({ agendadoPara: new Date(base.getTime() + 15 * H) });
  assert.equal(b!.getTime() - a!.getTime(), 1 * H);
});

import { processarLembretes, type ItemLembrete } from "./lembretes.ts";

const agoraL = new Date("2026-11-13T12:00:00Z");
const maisH = (h: number) => new Date(agoraL.getTime() + h * 3600_000).toISOString();

function itemL(extra: Partial<ItemLembrete> = {}, post: Partial<ItemLembrete["postagem"]> = {}): ItemLembrete {
  return {
    postagem: { id: "p1", agendado_para: maisH(12), lembretes: 0, ultimo_aviso_em: agoraL.toISOString(), aviso_correcao_em: null, ...post },
    faltou: ["midia", "legenda", "data"],
    reprovadas: [],
    clienteId: "c1",
    empresa: "Toque Final",
    titulo: "Reels",
    link: "https://x.app/c/t",
    abriuLinkEm: null,
    ...extra,
  };
}

function montarL(itens: ItemLembrete[], opts: { falharCliente?: boolean } = {}) {
  const cliente: string[] = [];
  const equipe: string[] = [];
  const marcados: string[] = [];
  const correcoes: string[] = [];
  return {
    cliente, equipe, marcados, correcoes,
    deps: {
      listar: async () => itens,
      avisarCliente: async (_c: string, t: string) => {
        if (opts.falharCliente) throw new Error("whatsapp caiu");
        cliente.push(t);
      },
      avisarEquipe: async (t: string) => void equipe.push(t),
      marcarLembrete: async (id: string) => void marcados.push(id),
      marcarCorrecao: async (id: string) => void correcoes.push(id),
    },
  };
}

const T = (h: number) => new Date(agoraL.getTime() + h * 3600_000);

test("lembretes: envia só os vencidos", async () => {
  const vencido = itemL({}, { id: "v" });
  const naoVenceu = itemL({}, { id: "n" });
  const { deps, cliente, marcados } = montarL([vencido, naoVenceu]);
  // vencido: último aviso há 6h (18h até a postagem => intervalo 6h); naoVenceu: aviso agora
  vencido.postagem.ultimo_aviso_em = T(-6).toISOString();
  const r = await processarLembretes(deps, agoraL);
  assert.deepEqual(r, { lembretes: 1, correcoes: 0 });
  assert.deepEqual(marcados, ["v"]);
  assert.equal(cliente.length, 1);
  assert.match(cliente[0], /Falta sua aprovação, Toque Final/);
});

test("lembretes: conteúdo pronto (nada faltando) não recebe", async () => {
  const it = itemL({ faltou: [] });
  it.postagem.ultimo_aviso_em = T(-10).toISOString();
  const { deps, cliente } = montarL([it]);
  assert.deepEqual(await processarLembretes(deps, agoraL), { lembretes: 0, correcoes: 0 });
  assert.equal(cliente.length, 0);
});

test("lembretes: horário que já passou não recebe", async () => {
  const it = itemL({}, { agendado_para: T(-1).toISOString() });
  it.postagem.ultimo_aviso_em = T(-10).toISOString();
  const { deps, cliente } = montarL([it]);
  assert.deepEqual(await processarLembretes(deps, agoraL), { lembretes: 0, correcoes: 0 });
  assert.equal(cliente.length, 0);
});

test("lembretes: cliente abriu o link depois do último aviso, 20 min depois lembra com 'jaViu'", async () => {
  const it = itemL({ abriuLinkEm: T(-0.5).toISOString() });
  it.postagem.ultimo_aviso_em = T(-1).toISOString();
  const { deps, cliente } = montarL([it]);
  const r = await processarLembretes(deps, agoraL);
  assert.equal(r.lembretes, 1);
  assert.match(cliente[0], /Vimos que você abriu/);
});

test("lembretes: parte reprovada não cobra o cliente; a equipe é avisada uma vez perto do horário", async () => {
  const it = itemL({ reprovadas: ["legenda"], faltou: ["legenda"] }, { agendado_para: maisH(1.5) });
  it.postagem.ultimo_aviso_em = T(-10).toISOString();
  const { deps, cliente, equipe, correcoes } = montarL([it]);
  const r = await processarLembretes(deps, agoraL);
  assert.deepEqual(r, { lembretes: 0, correcoes: 1 });
  assert.equal(cliente.length, 0);
  assert.match(equipe[0], /Correção pendente: Toque Final/);
  assert.deepEqual(correcoes, ["p1"]);

  const ja = itemL({ reprovadas: ["legenda"], faltou: ["legenda"] }, { agendado_para: maisH(1.5), aviso_correcao_em: T(-0.1).toISOString() });
  const m2 = montarL([ja]);
  assert.deepEqual(await processarLembretes(m2.deps, agoraL), { lembretes: 0, correcoes: 0 });
});

test("lembretes: parte reprovada com mais de 2h pela frente ainda não avisa a equipe", async () => {
  const it = itemL({ reprovadas: ["midia"], faltou: ["midia"] }, { agendado_para: maisH(5) });
  const { deps, equipe } = montarL([it]);
  assert.deepEqual(await processarLembretes(deps, agoraL), { lembretes: 0, correcoes: 0 });
  assert.equal(equipe.length, 0);
});

test("lembretes: falha do WhatsApp não derruba o ciclo nem marca como enviado", async () => {
  const a = itemL({}, { id: "a" });
  const b = itemL({}, { id: "b" });
  a.postagem.ultimo_aviso_em = T(-6).toISOString();
  b.postagem.ultimo_aviso_em = T(-6).toISOString();
  const { deps, marcados } = montarL([a, b], { falharCliente: true });
  const r = await processarLembretes(deps, agoraL);
  assert.deepEqual(r, { lembretes: 0, correcoes: 0 });
  assert.equal(marcados.length, 0);
});

test("lembretes: depois de 6 lembretes para de cobrar", async () => {
  const it = itemL({}, { lembretes: 6 });
  it.postagem.ultimo_aviso_em = T(-10).toISOString();
  const { deps, cliente } = montarL([it]);
  assert.deepEqual(await processarLembretes(deps, agoraL), { lembretes: 0, correcoes: 0 });
  assert.equal(cliente.length, 0);
});

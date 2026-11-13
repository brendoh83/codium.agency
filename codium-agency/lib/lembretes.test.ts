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

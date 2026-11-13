import { test } from "node:test";
import assert from "node:assert/strict";
import { validarLegenda, dataHoraSaoPauloParaUtc, validarAgendamento } from "./agendamento.ts";

test("validarLegenda: vazia, limite 2200 e 30 hashtags", () => {
  assert.ok(validarLegenda("   "));
  assert.equal(validarLegenda("a".repeat(2200)), null);
  assert.ok(validarLegenda("a".repeat(2201)));
  assert.equal(validarLegenda(Array.from({ length: 30 }, (_, i) => `#t${i}`).join(" ")), null);
  assert.ok(validarLegenda(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")));
});

test("dataHoraSaoPauloParaUtc: 8h em Sao Paulo = 11h UTC; invalida = null", () => {
  assert.equal(dataHoraSaoPauloParaUtc("2026-11-14T08:00"), "2026-11-14T11:00:00.000Z");
  assert.equal(dataHoraSaoPauloParaUtc("2026-11-14T23:30"), "2026-11-15T02:30:00.000Z");
  assert.equal(dataHoraSaoPauloParaUtc("lixo"), null);
  assert.equal(dataHoraSaoPauloParaUtc("2026-02-30T08:00"), null);
  assert.equal(dataHoraSaoPauloParaUtc(""), null);
});

test("validarAgendamento: recusa passado, aceita futuro", () => {
  const agora = new Date("2026-11-13T12:00:00Z");
  assert.ok(validarAgendamento("2026-11-13T11:59:00.000Z", agora));
  assert.equal(validarAgendamento("2026-11-13T12:01:00.000Z", agora), null);
  assert.ok(validarAgendamento("invalida", agora));
});

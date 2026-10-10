import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dividirIgual, faltaNoCaixa, mesesDaSerie, situacaoDespesa, validarCobertura, vencimentoDoMes,
} from "./despesas.ts";

test("vencimentoDoMes: dia do mês, com dia 29–31 virando o último dia", () => {
  assert.equal(vencimentoDoMes("2026-10-01", 15), "2026-10-15");
  assert.equal(vencimentoDoMes("2027-02-01", 31), "2027-02-28");
  assert.equal(vencimentoDoMes("2028-02-01", 30), "2028-02-29");
  assert.equal(vencimentoDoMes("2026-04-01", 31), "2026-04-30");
});

test("mesesDaSerie: fixa vai até o horizonte; variável respeita a quantidade de meses", () => {
  assert.deepEqual(mesesDaSerie({ inicio: "2026-10-01", tipo: "fixa", meses: null, ate: "2026-12-01" }), [
    "2026-10-01", "2026-11-01", "2026-12-01",
  ]);
  assert.deepEqual(mesesDaSerie({ inicio: "2026-11-01", tipo: "variavel", meses: 2, ate: "2027-06-01" }), [
    "2026-11-01", "2026-12-01",
  ]);
  assert.deepEqual(mesesDaSerie({ inicio: "2026-11-01", tipo: "variavel", meses: 6, ate: "2027-01-01" }), [
    "2026-11-01", "2026-12-01", "2027-01-01",
  ]);
  assert.deepEqual(mesesDaSerie({ inicio: "2027-02-01", tipo: "fixa", meses: null, ate: "2026-12-01" }), []);
});

test("faltaNoCaixa", () => {
  assert.equal(faltaNoCaixa(70, 1570), 0);
  assert.equal(faltaNoCaixa(1600, 1500), 100);
  assert.equal(faltaNoCaixa(100, 0), 100);
  assert.equal(faltaNoCaixa(100, -30), 100);
});

test("dividirIgual: meio a meio sem perder centavo", () => {
  assert.deepEqual(dividirIgual(100), { brendo: 50, victor: 50 });
  assert.deepEqual(dividirIgual(0.01), { brendo: 0.01, victor: 0 });
  const d = dividirIgual(100.01);
  assert.equal(Math.round((d.brendo + d.victor) * 100), 10001);
});

test("validarCobertura: soma tem que fechar a falta", () => {
  assert.equal(validarCobertura(100, [{ socio: "victor", valor: 100 }]), null);
  assert.equal(validarCobertura(100, [{ socio: "brendo", valor: 10 }, { socio: "victor", valor: 90 }]), null);
  assert.match(validarCobertura(100, [{ socio: "brendo", valor: 10 }])!, /soma/i);
  assert.match(validarCobertura(100, [{ socio: "terceiro" as any, valor: 100 }])!, /sócio/i);
  assert.match(validarCobertura(100, [{ socio: "brendo", valor: -5 }, { socio: "victor", valor: 105 }])!, /valor/i);
  assert.equal(validarCobertura(0, []), null);
});

test("situacaoDespesa", () => {
  const hoje = new Date("2026-10-15T12:00:00Z");
  assert.equal(situacaoDespesa({ pago: true, vencimento: "2026-10-01" }, hoje), "paga");
  assert.equal(situacaoDespesa({ pago: false, vencimento: "2026-10-14" }, hoje), "atrasada");
  assert.equal(situacaoDespesa({ pago: false, vencimento: "2026-10-15" }, hoje), "a_pagar");
  assert.equal(situacaoDespesa({ pago: false, vencimento: null }, hoje), "a_pagar");
});

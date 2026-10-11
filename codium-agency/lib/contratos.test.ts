import { test } from "node:test";
import assert from "node:assert/strict";
import { competenciasDoContrato, dataFimDoContrato } from "./contratos.ts";

const base = { desde: "2026-10-01", ate: "2027-03-01" };

test("contrato de 3 meses gera 3 competências", () => {
  assert.deepEqual(competenciasDoContrato({ inicio: "2026-10-05", meses: 3, ...base }), [
    "2026-10-01", "2026-11-01", "2026-12-01",
  ]);
});
test("contrato de 1 mês gera 1", () => {
  assert.deepEqual(competenciasDoContrato({ inicio: "2026-10-20", meses: 1, ...base }), ["2026-10-01"]);
});
test("7, 10 e 24 meses respeitam o número (24 limitado pelo horizonte)", () => {
  assert.equal(competenciasDoContrato({ inicio: "2026-10-01", meses: 7, ...base }).length, 6);
  assert.equal(competenciasDoContrato({ inicio: "2026-10-01", meses: 7, desde: "2026-10-01", ate: "2027-12-01" }).length, 7);
  assert.equal(competenciasDoContrato({ inicio: "2026-10-01", meses: 10, desde: "2026-10-01", ate: "2028-12-01" }).length, 10);
  assert.equal(competenciasDoContrato({ inicio: "2026-10-01", meses: 24, desde: "2026-10-01", ate: "2030-12-01" }).length, 24);
});
test("meses passados não são gerados, mas contam para o fim do contrato", () => {
  assert.deepEqual(competenciasDoContrato({ inicio: "2026-08-10", meses: 3, ...base }), ["2026-10-01"]);
});
test("recorrente vai até o horizonte", () => {
  assert.equal(competenciasDoContrato({ inicio: "2026-08-10", meses: null, ...base }).length, 6);
});
test("data fim", () => {
  assert.equal(dataFimDoContrato("2026-10-31", 1), "2026-11-30");
  assert.equal(dataFimDoContrato("2026-10-05", 12), "2027-10-05");
});

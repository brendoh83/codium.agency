import { test } from "node:test";
import assert from "node:assert/strict";
import { diasDeAtraso } from "./format.ts";

test("diasDeAtraso: pago depois do vencimento", () => {
  assert.equal(diasDeAtraso("2026-09-25", "2026-10-05"), 10);
  assert.equal(diasDeAtraso("2026-09-25", "2026-09-26"), 1);
});

test("diasDeAtraso: em dia, antecipado, sem data ou data inválida = 0", () => {
  assert.equal(diasDeAtraso("2026-09-25", "2026-09-25"), 0);
  assert.equal(diasDeAtraso("2026-09-25", "2026-09-20"), 0);
  assert.equal(diasDeAtraso("2026-09-25", null), 0);
  assert.equal(diasDeAtraso("2026-09-25", "lixo"), 0);
});

test("diasDeAtraso ignora horário e atravessa virada de mês e de ano", () => {
  assert.equal(diasDeAtraso("2026-12-28", "2027-01-03T10:00:00Z"), 6);
});

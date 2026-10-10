import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveAgrupar, linkDoCliente, textoConteudoNovo, textoDecisao, textoNovaVersao, JANELA_MIN,
} from "./avisos.ts";

const link = "https://codium-agency.vercel.app/c/abc123XYZ0";

test("conteúdo novo: singular e plural", () => {
  assert.equal(
    textoConteudoNovo({ empresa: "Alecrim Store", titulo: "Reels de lançamento", pendentes: 1, link }),
    `📌 Alecrim Store: novo conteúdo para aprovar: «Reels de lançamento». Veja aqui: ${link}`
  );
  assert.equal(
    textoConteudoNovo({ empresa: "Alecrim Store", titulo: "x", pendentes: 4, link }),
    `📌 Alecrim Store: 4 conteúdos aguardando aprovação. Veja aqui: ${link}`
  );
  assert.match(textoConteudoNovo({ empresa: "A", titulo: "T", pendentes: 0, link }), /novo conteúdo/);
});

test("nova versão", () => {
  assert.equal(
    textoNovaVersao({ empresa: "Alecrim Store", titulo: "Reels", link }),
    `🔄 Alecrim Store: nova versão de «Reels» para aprovar. Veja aqui: ${link}`
  );
});

test("decisão: aprovado e reprovado com motivo", () => {
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "aprovado" }),
    "✅ Alecrim Store aprovou «Reels»"
  );
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "reprovado", motivo: "  cortar os 3 primeiros segundos  " }),
    "❌ Alecrim Store reprovou «Reels»: cortar os 3 primeiros segundos"
  );
});

test("decisão: motivo longo é cortado em 500 caracteres e quebras viram espaço", () => {
  const t = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "a".repeat(800) });
  assert.ok(t.length < 560);
  assert.ok(t.endsWith("…"));
  const t2 = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "linha 1\n\nlinha 2" });
  assert.ok(!t2.includes("\n"));
  assert.ok(t2.endsWith("linha 1 linha 2"));
});

test("decisão reprovada sem motivo não deixa dois-pontos sobrando", () => {
  assert.equal(
    textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "   " }),
    "❌ A reprovou «T»"
  );
});

test("deveAgrupar: só dentro da janela de 10 minutos", () => {
  const agora = new Date("2026-10-10T12:00:00Z");
  assert.equal(JANELA_MIN, 10);
  assert.equal(deveAgrupar(null, agora), false);
  assert.equal(deveAgrupar(undefined, agora), false);
  assert.equal(deveAgrupar("2026-10-10T11:55:00Z", agora), true);
  assert.equal(deveAgrupar("2026-10-10T11:50:00Z", agora), false);
  assert.equal(deveAgrupar("2026-10-10T11:40:00Z", agora), false);
  assert.equal(deveAgrupar("lixo", agora), false);
  assert.equal(deveAgrupar("2026-10-10T12:30:00Z", agora), false);
});

test("linkDoCliente tira barra final da origem", () => {
  assert.equal(linkDoCliente("https://x.app/", "tok"), "https://x.app/c/tok");
  assert.equal(linkDoCliente("https://x.app", "tok"), "https://x.app/c/tok");
});

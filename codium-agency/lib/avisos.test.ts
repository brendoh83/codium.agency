import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveAgrupar, linkDoCliente, quandoPostar, textoAprovouPartes, textoConfirmacaoCliente, textoConteudoNovo,
  textoDecisao, textoDecisaoParte, textoNovaVersao, JANELA_MIN,
} from "./avisos.ts";

const link = "https://codium-agency.vercel.app/c/abc123XYZ0";
const sab = "2026-11-14T11:00:00.000Z"; // sáb 14/11 08:00 em São Paulo
const qua = "2026-11-18T11:00:00.000Z";

test("quandoPostar: dia da semana, data e hora de São Paulo", () => {
  assert.equal(quandoPostar(sab), "sáb, 14/11 às 08:00");
  assert.equal(quandoPostar(qua), "qua, 18/11 às 08:00");
});

test("conteúdo novo: um, com data", () => {
  assert.equal(
    textoConteudoNovo({ empresa: "Alecrim Store", titulo: "Reels de lançamento", pendentes: 1, link, agendadoPara: sab }),
    `Olá, Alecrim Store! 👋 Tem conteúdo novo para você aprovar:\n\n*«Reels de lançamento»*\n📅 Posta sáb, 14/11 às 08:00\n\nAprove por aqui:\n${link}`
  );
});

test("conteúdo novo: um, sem data (conteúdo antigo)", () => {
  assert.equal(
    textoConteudoNovo({ empresa: "A", titulo: "T", pendentes: 0, link }),
    `Olá, A! 👋 Tem conteúdo novo para você aprovar:\n\n*«T»*\n\nAprove por aqui:\n${link}`
  );
});

test("conteúdo novo: vários com lista", () => {
  assert.equal(
    textoConteudoNovo({ empresa: "A", titulo: "x", pendentes: 3, link, titulos: ["Reels", "Promoção", "Dica"] }),
    `Olá, A! 👋 Você tem *3 conteúdos* para aprovar:\n\n• «Reels»\n• «Promoção»\n• «Dica»\n\nAprove por aqui:\n${link}`
  );
  assert.match(textoConteudoNovo({ empresa: "A", titulo: "x", pendentes: 4, link }), /\*4 conteúdos\*/);
});

test("nova versão", () => {
  assert.equal(
    textoNovaVersao({ empresa: "Alecrim Store", titulo: "Reels", link }),
    `🔄 Olá, Alecrim Store! Ajustamos *«Reels»* e ele está pronto para você revisar.\n\nAprove por aqui:\n${link}`
  );
});

test("confirmação para o cliente: aprovou, reprovou, sugeriu", () => {
  assert.equal(
    textoConfirmacaoCliente({ empresa: "Toque Final", titulo: "Reels", tipo: "aprovou", agendadoPara: sab }),
    "✅ Recebemos a sua aprovação, Toque Final! Obrigado. 🙌\n\n«Reels»\n📅 Posta sáb, 14/11 às 08:00"
  );
  assert.match(textoConfirmacaoCliente({ empresa: "A", titulo: "T", tipo: "aprovou" }), /«T»$/);
  assert.match(textoConfirmacaoCliente({ empresa: "A", titulo: "T", tipo: "reprovou" }), /pedido de ajuste, A/);
  assert.match(textoConfirmacaoCliente({ empresa: "A", titulo: "T", tipo: "sugeriu" }), /sugestão de data, A/);
});

test("decisão (versão antiga): aprovado e reprovado com motivo", () => {
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "aprovado" }),
    "✅ *Alecrim Store aprovou*\n«Reels»"
  );
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "reprovado", motivo: "  cortar os 3 primeiros segundos  " }),
    "❌ *Alecrim Store reprovou*\n«Reels»\n\n_cortar os 3 primeiros segundos_"
  );
});

test("decisão: motivo longo é cortado em 500 caracteres e quebras viram espaço", () => {
  const t = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "a".repeat(800) });
  assert.ok(t.length < 560);
  assert.ok(t.endsWith("…_"));
  const t2 = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "linha 1\n\nlinha 2" });
  assert.ok(t2.endsWith("_linha 1 linha 2_"));
});

test("decisão reprovada sem motivo não deixa linha vazia sobrando", () => {
  assert.equal(
    textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "   " }),
    "❌ *A reprovou*\n«T»"
  );
});

test("parte aprovada e reprovada", () => {
  assert.equal(
    textoDecisaoParte({ empresa: "Toque Final", titulo: "Reels", parte: "legenda", decisao: "aprovado" }),
    "✅ *Toque Final aprovou a legenda*\n«Reels»"
  );
  assert.equal(
    textoDecisaoParte({ empresa: "A", titulo: "X", parte: "midia", decisao: "reprovado", motivo: "trocar  a edição" }),
    "❌ *A reprovou a mídia*\n«X»\n\n_trocar a edição_"
  );
  const longo = textoDecisaoParte({ empresa: "A", titulo: "X", parte: "legenda", decisao: "reprovado", motivo: "a".repeat(600) });
  assert.ok(longo.endsWith("…_"));
  assert.ok(longo.length < 600);
});

test("sugestão de data mostra agora, sugerida e recado", () => {
  assert.equal(
    textoDecisaoParte({
      empresa: "A", titulo: "X", parte: "data", decisao: "reprovado",
      agendadoPara: sab, sugeridaPara: qua, motivo: "quarta fica melhor",
    }),
    "📅 *A sugeriu outra data*\n«X»\n\nAgora: sáb, 14/11 às 08:00\nSugerida: qua, 18/11 às 08:00\n_quarta fica melhor_\n\nConfirme no dashboard."
  );
  assert.equal(
    textoDecisaoParte({ empresa: "A", titulo: "X", parte: "data", decisao: "aprovado" }),
    "✅ *A aprovou a data*\n«X»"
  );
});

test("aprovar tudo: uma mensagem; só algumas partes lista só elas", () => {
  assert.equal(
    textoAprovouPartes({ empresa: "A", titulo: "X", partes: ["midia", "legenda", "data"], agendadoPara: sab }),
    "✅ *A aprovou tudo*\n«X»\n\nMídia, legenda e data\n📅 Posta sáb, 14/11 às 08:00"
  );
  assert.equal(
    textoAprovouPartes({ empresa: "A", titulo: "X", partes: ["midia", "legenda"] }),
    "✅ *A aprovou a mídia e a legenda*\n«X»"
  );
  assert.equal(
    textoAprovouPartes({ empresa: "A", titulo: "X", partes: ["data"] }),
    "✅ *A aprovou a data*\n«X»"
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

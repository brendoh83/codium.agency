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

import { textoFalhaPostagem, textoPerdeuHorarioCliente, textoPerdeuHorarioEquipe, textoPostada, textoSistemaFora } from "./avisos.ts";

test("perdeu o horário: cliente com nome e link", () => {
  assert.equal(
    textoPerdeuHorarioCliente({ empresa: "Toque Final", titulo: "Reels", link }),
    `Olá, Toque Final! 👋 «Reels» não foi postado porque faltou a sua aprovação.\n\nSe puder aprovar agora, a gente já vê o melhor dia e horário para postar:\n${link}`
  );
});

test("perdeu o horário: equipe diz o que faltou e quando seria", () => {
  assert.equal(
    textoPerdeuHorarioEquipe({ empresa: "Toque Final", titulo: "Reels", faltou: ["legenda"], agendadoPara: sab }),
    "⚠️ *Não foi postado: Toque Final*\n«Reels»\n\nFaltou aprovar a legenda até sáb, 14/11 às 08:00.\nEscolha uma nova data no dashboard."
  );
  assert.match(
    textoPerdeuHorarioEquipe({ empresa: "A", titulo: "X", faltou: ["midia", "data"], agendadoPara: sab }),
    /Faltou aprovar a mídia e a data até/
  );
});

test("postado e falha para a equipe", () => {
  assert.equal(
    textoPostada({ empresa: "Toque Final", titulo: "Reels", link: "https://www.instagram.com/p/X/" }),
    "🚀 *Postado: Toque Final*\n«Reels»\n\nhttps://www.instagram.com/p/X/"
  );
  assert.equal(textoPostada({ empresa: "A", titulo: "X", link: null }), "🚀 *Postado: A*\n«X»");
  assert.equal(
    textoFalhaPostagem({ empresa: "A", titulo: "X", erro: "A Meta recusou o pedido." }),
    "🛑 *Falhou ao postar: A*\n«X»\n\nMotivo: A Meta recusou o pedido.\nTente de novo no dashboard."
  );
});

test("sistema fora do ar: pede para postar manualmente", () => {
  assert.equal(
    textoSistemaFora({ empresa: "Toque Final", titulo: "Reels", agendadoPara: sab }),
    "🛑 *Sistema fora do ar: Toque Final*\nTinha a postagem de «Reels» para sáb, 14/11 às 08:00, mas o sistema ficou fora do ar e não foi possível postar.\n\nPoste manualmente."
  );
});

import { textoCorrecaoAtrasada, textoLembrete } from "./avisos.ts";

test("lembrete: cita quando posta (hoje, amanhã ou dia da semana) e o link", () => {
  const agora = new Date("2026-11-13T15:00:00Z"); // sex 12:00 em São Paulo
  assert.equal(
    textoLembrete({ empresa: "Toque Final", titulo: "Reels", agendadoPara: new Date("2026-11-14T11:00:00Z"), link, jaViu: false, agora }),
    `⏰ *Falta sua aprovação, Toque Final*\n«Reels»\n\nEstá agendado para amanhã às 08:00.\nAprove por aqui:\n${link}`
  );
  assert.match(
    textoLembrete({ empresa: "A", titulo: "X", agendadoPara: new Date("2026-11-13T21:30:00Z"), link, jaViu: false, agora }),
    /Está agendado para hoje às 18:30\./
  );
  assert.match(
    textoLembrete({ empresa: "A", titulo: "X", agendadoPara: new Date("2026-11-18T11:00:00Z"), link, jaViu: false, agora }),
    /Está agendado para qua, 18\/11 às 08:00\./
  );
});

test("lembrete: versão diferente quando o cliente já abriu o link", () => {
  const agora = new Date("2026-11-13T15:00:00Z");
  const t = textoLembrete({ empresa: "A", titulo: "X", agendadoPara: new Date("2026-11-14T11:00:00Z"), link, jaViu: true, agora });
  assert.match(t, /Vimos que você abriu/);
  assert.match(t, /amanhã às 08:00/);
});

test("correção atrasada: avisa a equipe quantas horas faltam", () => {
  assert.equal(
    textoCorrecaoAtrasada({ empresa: "Toque Final", titulo: "Reels", horas: 2 }),
    "⏳ *Correção pendente: Toque Final*\n«Reels»\n\nO cliente reprovou uma parte e faltam 2 horas para postar. Suba a correção no dashboard."
  );
  assert.match(textoCorrecaoAtrasada({ empresa: "A", titulo: "X", horas: 1 }), /falta 1 hora para postar/);
  assert.match(textoCorrecaoAtrasada({ empresa: "A", titulo: "X", horas: 0 }), /falta menos de 1 hora para postar/);
});

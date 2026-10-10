import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveR2, estadoConteudo, mensagemErro, separarFeed, tipoPorMime, validarArquivo, versaoAtual,
  MAX_BYTES, type Conteudo, type Versao,
} from "./conteudos.ts";

const v = (numero: number, decisao: Versao["decisao"], extra: Partial<Versao> = {}): Versao => ({
  id: `v${numero}`, numero, mime: "video/mp4", created_at: "2026-10-01T00:00:00Z",
  expirada: false, decisao, motivo: decisao === "reprovado" ? "x" : null,
  decidido_em: decisao ? "2026-10-02T00:00:00Z" : null, ...extra,
});
const c = (id: string, versoes: Versao[], created_at = "2026-10-01T00:00:00Z"): Conteudo => ({
  id, titulo: id, tipo: "video", created_at, versoes,
});

test("estado vem da versão de maior número", () => {
  assert.equal(estadoConteudo(c("a", [v(1, null)])), "pendente");
  assert.equal(estadoConteudo(c("a", [v(1, "reprovado")])), "reprovado");
  assert.equal(estadoConteudo(c("a", [v(1, "reprovado"), v(2, null)])), "pendente");
  assert.equal(estadoConteudo(c("a", [v(2, "aprovado"), v(1, "reprovado")])), "aprovado");
});

test("conteúdo sem versões é tratado como pendente", () => {
  assert.equal(estadoConteudo(c("a", [])), "pendente");
  assert.equal(versaoAtual(c("a", [])), undefined);
});

test("separarFeed: topo = pendentes e reprovados (mais novos primeiro); aprovados por decisão mais recente", () => {
  const p = c("p", [v(1, null)], "2026-10-05T00:00:00Z");
  const r = c("r", [v(1, "reprovado")], "2026-10-06T00:00:00Z");
  const a1 = c("a1", [v(1, "aprovado", { decidido_em: "2026-10-03T00:00:00Z" })]);
  const a2 = c("a2", [v(1, "aprovado", { decidido_em: "2026-10-04T00:00:00Z" })]);
  const { topo, aprovados } = separarFeed([p, a1, r, a2]);
  assert.deepEqual(topo.map((x) => x.id), ["r", "p"]);
  assert.deepEqual(aprovados.map((x) => x.id), ["a2", "a1"]);
});

test("tipoPorMime", () => {
  assert.equal(tipoPorMime("video/mp4"), "video");
  assert.equal(tipoPorMime("image/jpeg"), "imagem");
  assert.equal(tipoPorMime("application/x-msdownload"), null);
  assert.equal(tipoPorMime(""), null);
});

test("validarArquivo rejeita tipo inválido, tamanho 0, negativo, NaN e acima do limite", () => {
  assert.equal(validarArquivo("video/mp4", 1000), null);
  assert.equal(validarArquivo("image/png", MAX_BYTES), null);
  assert.ok(validarArquivo("application/x-msdownload", 1000));
  assert.ok(validarArquivo("video/mp4", 0));
  assert.ok(validarArquivo("video/mp4", -5));
  assert.ok(validarArquivo("video/mp4", Number.NaN));
  assert.ok(validarArquivo("video/mp4", MAX_BYTES + 1));
});

test("chaveR2 usa a extensão do mime e o prefixo do cliente", () => {
  assert.equal(chaveR2("cli-1", "uuid-1", "video/mp4"), "clientes/cli-1/uuid-1.mp4");
  assert.equal(chaveR2("cli-1", "uuid-2", "video/quicktime"), "clientes/cli-1/uuid-2.mov");
  assert.equal(chaveR2("cli-1", "uuid-3", "image/jpeg"), "clientes/cli-1/uuid-3.jpg");
});

test("mensagemErro traduz erros do banco e tem fallback", () => {
  assert.match(mensagemErro("motivo obrigatorio"), /motivo/i);
  assert.match(mensagemErro("ja respondida"), /já foi respondido/i);
  assert.match(mensagemErro("arquivo expirado"), /expirou/i);
  assert.match(mensagemErro("versao antiga"), /mais nova/i);
  assert.match(mensagemErro("qualquer coisa"), /tente/i);
});

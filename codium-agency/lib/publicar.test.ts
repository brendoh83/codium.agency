import { test } from "node:test";
import assert from "node:assert/strict";
import { publicarPostagem, type IgPublicar, type Postagem } from "./publicar.ts";

const agora = () => new Date("2026-11-14T11:00:00Z");

function montar(opts: {
  status?: ("em_andamento" | "pronto" | "erro")[];
  falharCriar?: Error;
  falharPublicar?: Error;
}) {
  const chamadas: string[] = [];
  const salvos: Record<string, unknown>[] = [];
  const status = [...(opts.status ?? ["pronto"])];
  const ig: IgPublicar = {
    criarContainer: async (i) => {
      chamadas.push(`criar:${i.tipo}${i.filhos ? `:${i.filhos.join("+")}` : ""}`);
      if (opts.falharCriar) throw opts.falharCriar;
      return { id: i.tipo === "item_carrossel" ? `item${chamadas.length}` : "container1" };
    },
    statusContainer: async () => {
      chamadas.push("status");
      return status.length > 1 ? status.shift()! : status[0];
    },
    publicarContainer: async () => {
      chamadas.push("publicar");
      if (opts.falharPublicar) throw opts.falharPublicar;
      return { id: "media1" };
    },
    permalink: async () => "https://www.instagram.com/p/ABC/",
  };
  const deps = {
    ig,
    salvar: async (p: Record<string, unknown>) => {
      chamadas.push(`salvar:${Object.keys(p).filter((k) => k !== "id").join(",")}`);
      salvos.push(p);
    },
    agora,
  };
  return { deps, chamadas, salvos };
}

const base: Postagem = { id: "p1", creation_id: null, ig_media_id: null, tentativas: 0 };
const imagem = { tipo: "imagem" as const, legenda: "oi", urls: ["https://r2/a.jpg"] };

test("imagem: cria, publica e marca postada com o link", async () => {
  const { deps, chamadas, salvos } = montar({});
  const r = await publicarPostagem(deps, { postagem: base, conteudo: imagem, igUserId: "u1" });
  assert.deepEqual(r, { resultado: "postada" });
  assert.deepEqual(chamadas.filter((c) => !c.startsWith("salvar")), ["criar:imagem", "status", "publicar"]);
  const final = salvos.at(-1)!;
  assert.equal(final.estado, "postada");
  assert.equal(final.ig_media_id, "media1");
  assert.equal(final.permalink, "https://www.instagram.com/p/ABC/");
  assert.equal(final.postado_em, "2026-11-14T11:00:00.000Z");
});

test("já tem creation_id: não cria outro container (retomada após queda)", async () => {
  const { deps, chamadas } = montar({});
  await publicarPostagem(deps, { postagem: { ...base, creation_id: "ja-criado" }, conteudo: imagem, igUserId: "u1" });
  assert.ok(!chamadas.some((c) => c.startsWith("criar")));
  assert.ok(chamadas.includes("publicar"));
});

test("já tem ig_media_id: não publica de novo (nunca posta duas vezes)", async () => {
  const { deps, chamadas, salvos } = montar({});
  const r = await publicarPostagem(deps, { postagem: { ...base, ig_media_id: "ja-postado" }, conteudo: imagem, igUserId: "u1" });
  assert.equal(r.resultado, "postada");
  assert.deepEqual(chamadas, []);
  assert.equal(salvos.length, 0);
});

test("container em andamento: não publica e volta para agendada", async () => {
  const { deps, chamadas, salvos } = montar({ status: ["em_andamento"] });
  const r = await publicarPostagem(deps, { postagem: base, conteudo: { ...imagem, tipo: "video" }, igUserId: "u1" });
  assert.equal(r.resultado, "aguardando");
  assert.ok(!chamadas.includes("publicar"));
  assert.equal(salvos.at(-1)!.estado, "agendada");
  assert.equal(salvos.some((s) => s.creation_id === "container1"), true);
});

test("erro na 3ª tentativa vira falhou com a mensagem", async () => {
  const { deps, salvos } = montar({ falharCriar: new Error("A Meta recusou o pedido.") });
  const r = await publicarPostagem(deps, { postagem: { ...base, tentativas: 2 }, conteudo: imagem, igUserId: "u1" });
  assert.deepEqual(r, { resultado: "falhou", erro: "A Meta recusou o pedido." });
  assert.equal(salvos.at(-1)!.estado, "falhou");
  assert.equal(salvos.at(-1)!.tentativas, 3);
});

test("erro antes da 3ª tentativa: volta para agendada e conta a tentativa", async () => {
  const { deps, salvos } = montar({ falharPublicar: new Error("rede") });
  const r = await publicarPostagem(deps, { postagem: { ...base, tentativas: 0 }, conteudo: imagem, igUserId: "u1" });
  assert.equal(r.resultado, "aguardando");
  assert.equal(salvos.at(-1)!.estado, "agendada");
  assert.equal(salvos.at(-1)!.tentativas, 1);
});

test("carrossel de 3: três itens, depois o pai, nessa ordem", async () => {
  const { deps, chamadas } = montar({});
  await publicarPostagem(deps, {
    postagem: base,
    conteudo: { tipo: "carrossel", legenda: "x", urls: ["u1", "u2", "u3"] },
    igUserId: "u1",
  });
  const criacoes = chamadas.filter((c) => c.startsWith("criar"));
  assert.equal(criacoes.length, 4);
  assert.deepEqual(criacoes.slice(0, 3), ["criar:item_carrossel", "criar:item_carrossel", "criar:item_carrossel"]);
  assert.match(criacoes[3], /^criar:carrossel:item1\+item2\+item3$/);
});

test("vídeo usa reels", async () => {
  const { deps, chamadas } = montar({});
  await publicarPostagem(deps, { postagem: base, conteudo: { tipo: "video", legenda: "x", urls: ["v"] }, igUserId: "u1" });
  assert.ok(chamadas.includes("criar:reels"));
});

test("creation_id é salvo antes de publicar", async () => {
  const { deps, chamadas } = montar({});
  await publicarPostagem(deps, { postagem: base, conteudo: imagem, igUserId: "u1" });
  const iSalvar = chamadas.findIndex((c) => c.startsWith("salvar:creation_id"));
  const iPublicar = chamadas.indexOf("publicar");
  assert.ok(iSalvar >= 0 && iSalvar < iPublicar);
});

test("container com erro: limpa o creation_id para recriar na próxima", async () => {
  const { deps, salvos } = montar({ status: ["erro"] });
  const r = await publicarPostagem(deps, { postagem: { ...base, creation_id: "velho" }, conteudo: imagem, igUserId: "u1" });
  assert.equal(r.resultado, "aguardando");
  assert.equal(salvos.some((s) => "creation_id" in s && s.creation_id === null), true);
});

test("permalink que falha não impede de marcar como postada", async () => {
  const { deps, salvos } = montar({});
  deps.ig.permalink = async () => {
    throw new Error("x");
  };
  const r = await publicarPostagem(deps, { postagem: base, conteudo: imagem, igUserId: "u1" });
  assert.equal(r.resultado, "postada");
  assert.equal(salvos.at(-1)!.permalink, null);
});

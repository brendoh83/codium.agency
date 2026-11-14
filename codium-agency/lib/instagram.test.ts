import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assinarState, lerState, perfil, renovar, tornarLongo, trocarCodigo, urlAutorizacao, SCOPES,
} from "./instagram.ts";

const segredo = "segredo-de-teste";
const agora = 1_800_000_000_000;

const resp = (corpo: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

function fetchFalso(corpo: unknown, status = 200) {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return resp(corpo, status);
  }) as typeof globalThis.fetch;
  return { fetch, chamadas };
}

test("state: válido, adulterado e expirado", () => {
  const s = assinarState({ clienteId: "c-1", segredo, agora });
  assert.deepEqual(lerState(s, segredo, agora + 60_000), { clienteId: "c-1" });
  assert.equal(lerState(s, "outro", agora), null);
  assert.equal(lerState(s.replace("c-1", "c-2"), segredo, agora), null);
  assert.equal(lerState(s, segredo, agora + 11 * 60_000), null);
  assert.equal(lerState("lixo", segredo, agora), null);
});

test("urlAutorizacao leva client_id, redirect_uri, scope com as 3 permissões e state", () => {
  const u = new URL(urlAutorizacao({ appId: "123", redirectUri: "https://x.app/api/instagram/callback", state: "abc" }));
  assert.equal(u.origin + u.pathname, "https://www.instagram.com/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "123");
  assert.equal(u.searchParams.get("redirect_uri"), "https://x.app/api/instagram/callback");
  assert.equal(u.searchParams.get("state"), "abc");
  assert.equal(u.searchParams.get("response_type"), "code");
  const scope = u.searchParams.get("scope")!;
  for (const p of SCOPES) assert.ok(scope.includes(p));
  assert.equal(SCOPES.length, 3);
});

test("trocarCodigo: caminho feliz e erro da Meta em português sem vazar segredo", async () => {
  const ok = fetchFalso({ access_token: "curto", user_id: 99 });
  const r = await trocarCodigo(
    { fetch: ok.fetch },
    { appId: "1", appSecret: "SEGREDO", redirectUri: "https://x/cb", codigo: "cod#_" }
  );
  assert.deepEqual(r, { token: "curto", igUserId: "99" });
  assert.equal(ok.chamadas[0].url, "https://api.instagram.com/oauth/access_token");
  assert.match(String(ok.chamadas[0].init?.body), /code=cod%23_/);

  const ruim = fetchFalso({ error_type: "OAuthException", error_message: "Invalid authorization code SEGREDO" }, 400);
  await assert.rejects(
    trocarCodigo({ fetch: ruim.fetch }, { appId: "1", appSecret: "SEGREDO", redirectUri: "x", codigo: "c" }),
    (e: Error) => /Meta/.test(e.message) && !e.message.includes("SEGREDO")
  );
});

test("tornarLongo e renovar devolvem token e data de vencimento", async () => {
  const f = fetchFalso({ access_token: "longo", expires_in: 5184000 });
  const l = await tornarLongo({ fetch: f.fetch, agora: () => agora }, { appSecret: "s", token: "curto" });
  assert.equal(l.token, "longo");
  assert.equal(l.expiraEm, new Date(agora + 5184000 * 1000).toISOString());
  assert.match(f.chamadas[0].url, /ig_exchange_token/);

  const r = fetchFalso({ access_token: "renovado", expires_in: 5184000 });
  const rr = await renovar({ fetch: r.fetch, agora: () => agora }, "longo");
  assert.equal(rr.token, "renovado");
  assert.match(r.chamadas[0].url, /ig_refresh_token/);
});

test("renovar com token revogado vira erro claro", async () => {
  const f = fetchFalso({ error: { message: "Error validating access token", code: 190 } }, 400);
  await assert.rejects(renovar({ fetch: f.fetch, agora: () => agora }, "t"), /reconect/i);
});

test("perfil: Business ou Creator passa; conta pessoal é recusada", async () => {
  const ok = fetchFalso({ user_id: "7", username: "toquefinal", account_type: "BUSINESS" });
  assert.deepEqual(await perfil({ fetch: ok.fetch }, "t"), { igUserId: "7", username: "toquefinal", tipoConta: "BUSINESS" });
  const criador = fetchFalso({ user_id: "7", username: "x", account_type: "MEDIA_CREATOR" });
  assert.equal((await perfil({ fetch: criador.fetch }, "t")).tipoConta, "MEDIA_CREATOR");
  const pessoal = fetchFalso({ user_id: "7", username: "x", account_type: "PERSONAL" });
  await assert.rejects(perfil({ fetch: pessoal.fetch }, "t"), /Profissional|Business|Criador/i);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cifrar, decifrar } from "./cripto.ts";

// chaves só de teste, geradas na hora (nunca usar a chave real aqui)
const chave = randomBytes(32).toString("hex");
const outra = randomBytes(32).toString("hex");

test("cifrar e decifrar: ida e volta", () => {
  const c = cifrar("IGAAtoken-secreto", chave);
  assert.notEqual(c, "IGAAtoken-secreto");
  assert.equal(c.split(".").length, 3);
  assert.equal(decifrar(c, chave), "IGAAtoken-secreto");
});

test("mesmo texto cifrado duas vezes dá resultados diferentes", () => {
  assert.notEqual(cifrar("x", chave), cifrar("x", chave));
});

test("chave errada falha", () => {
  assert.throws(() => decifrar(cifrar("x", chave), outra));
});

test("dado adulterado falha", () => {
  const [iv, tag, dados] = cifrar("texto longo para adulterar", chave).split(".");
  const ruim = Buffer.from(dados, "base64url");
  ruim[0] ^= 1;
  assert.throws(() => decifrar(`${iv}.${tag}.${ruim.toString("base64url")}`, chave));
});

test("chave com tamanho errado é recusada", () => {
  assert.throws(() => cifrar("x", "abc"));
});

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function chaveDe(hex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Chave de criptografia inválida (esperado 64 caracteres hex).");
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM. Formato: iv.tag.dados (base64url). */
export function cifrar(texto: string, chaveHex: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDe(chaveHex), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(cifrado: string, chaveHex: string): string {
  const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !dados) throw new Error("Dado cifrado inválido.");
  if (tag.length !== 16) throw new Error("Dado cifrado inválido.");
  const d = createDecipheriv("aes-256-gcm", chaveDe(chaveHex), iv, { authTagLength: 16 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

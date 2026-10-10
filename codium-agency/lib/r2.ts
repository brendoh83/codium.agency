// somente servidor
import { AwsClient } from "aws4fetch";

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 não configurado: faltam variáveis de ambiente R2_*");
  }
  return {
    aws: new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    }),
    base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
  };
}

async function assinar(method: "PUT" | "GET", key: string, expiraSeg: number): Promise<string> {
  const { aws, base } = config();
  const caminho = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${base}/${caminho}`);
  url.searchParams.set("X-Amz-Expires", String(expiraSeg));
  const assinada = await aws.sign(new Request(url, { method }), { aws: { signQuery: true } });
  return assinada.url;
}

export async function apagarObjeto(key: string): Promise<void> {
  const { aws, base } = config();
  const caminho = key.split("/").map(encodeURIComponent).join("/");
  const r = await aws.fetch(`${base}/${caminho}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`R2 recusou apagar o arquivo (${r.status})`);
}

export const urlUpload = (key: string) => assinar("PUT", key, 900);
export const urlLeitura = (key: string) => assinar("GET", key, 3600);

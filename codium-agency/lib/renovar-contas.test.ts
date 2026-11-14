import { test } from "node:test";
import assert from "node:assert/strict";
import { renovarContas, type ContaRenovavel } from "./renovar-contas.ts";

const agora = new Date("2026-11-13T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000).toISOString();

function montar(contas: ContaRenovavel[], renovarFn: (t: string) => Promise<{ token: string; expiraEm: string }>) {
  const salvos: { id: string; token_cifrado?: string; token_expira_em?: string; status?: string }[] = [];
  return {
    salvos,
    deps: {
      listar: async () => contas,
      renovar: renovarFn,
      salvar: async (id: string, p: { token_cifrado?: string; token_expira_em?: string; status?: string }) => {
        salvos.push({ id, ...p });
      },
      decifrar: (c: string) => `claro:${c}`,
      cifrar: (t: string) => `cif:${t}`,
      agora: () => agora,
    },
  };
}

test("renova só as que vencem em até 10 dias", async () => {
  const { deps, salvos } = montar(
    [
      { id: "perto", token_cifrado: "a", token_expira_em: dias(5), status: "ativa" },
      { id: "limite", token_cifrado: "b", token_expira_em: dias(10), status: "ativa" },
      { id: "longe", token_cifrado: "c", token_expira_em: dias(40), status: "ativa" },
    ],
    async (t) => ({ token: `novo-${t}`, expiraEm: dias(60) })
  );
  const r = await renovarContas(deps);
  assert.deepEqual(r, { renovadas: 2, falhas: 0 });
  assert.deepEqual(salvos.map((s) => s.id).sort(), ["limite", "perto"]);
  assert.equal(salvos.find((s) => s.id === "perto")!.token_cifrado, "cif:novo-claro:a");
  assert.equal(salvos.find((s) => s.id === "perto")!.token_expira_em, dias(60));
});

test("a Meta recusa: marca reconectar e segue com as outras", async () => {
  const { deps, salvos } = montar(
    [
      { id: "ruim", token_cifrado: "a", token_expira_em: dias(2), status: "ativa" },
      { id: "boa", token_cifrado: "b", token_expira_em: dias(2), status: "ativa" },
    ],
    async (t) => {
      if (t === "claro:a") throw new Error("A chave do Instagram expirou ou foi revogada. Reconecte o Instagram.");
      return { token: "ok", expiraEm: dias(60) };
    }
  );
  const r = await renovarContas(deps);
  assert.deepEqual(r, { renovadas: 1, falhas: 1 });
  assert.deepEqual(salvos.find((s) => s.id === "ruim"), { id: "ruim", status: "reconectar" });
});

test("conta que já está em reconectar é ignorada", async () => {
  const { deps, salvos } = montar(
    [{ id: "x", token_cifrado: "a", token_expira_em: dias(1), status: "reconectar" }],
    async () => ({ token: "n", expiraEm: dias(60) })
  );
  assert.deepEqual(await renovarContas(deps), { renovadas: 0, falhas: 0 });
  assert.equal(salvos.length, 0);
});

test("chave já vencida também tenta e, falhando, vira reconectar", async () => {
  const { deps, salvos } = montar(
    [{ id: "v", token_cifrado: "a", token_expira_em: dias(-1), status: "ativa" }],
    async () => {
      throw new Error("expirada");
    }
  );
  assert.deepEqual(await renovarContas(deps), { renovadas: 0, falhas: 1 });
  assert.equal(salvos[0].status, "reconectar");
});

test("falha passageira (rede) com a chave ainda válida não pede reconexão", async () => {
  const { deps, salvos } = montar(
    [{ id: "r", token_cifrado: "a", token_expira_em: dias(3), status: "ativa" }],
    async () => {
      throw new Error("fetch failed");
    }
  );
  assert.deepEqual(await renovarContas(deps), { renovadas: 0, falhas: 1 });
  assert.equal(salvos.length, 0);
});

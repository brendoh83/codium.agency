"use client";

import { useTransition } from "react";
import { removerEmailPermitido } from "@/actions/usuarios";

export default function EmailsPermitidosConfig({ emails }: { emails: any[] }) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {emails.map((e) => (
        <div
          key={e.email}
          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <div>
            <div className="font-medium text-navy-900">{e.apelido || e.email}</div>
            {e.apelido && <div className="text-xs text-slate-400">{e.email}</div>}
          </div>
          <button
            onClick={() => {
              if (confirm(`Remover o acesso de ${e.email}? A pessoa não vai mais conseguir criar conta com esse e-mail (uma conta já existente não é apagada).`)) {
                startTransition(() => removerEmailPermitido(e.email));
              }
            }}
            className="text-xs text-slate-300 hover:text-danger"
          >
            Remover
          </button>
        </div>
      ))}
      {emails.length === 0 && (
        <p className="text-sm text-slate-400">Nenhum e-mail autorizado ainda.</p>
      )}
    </div>
  );
}

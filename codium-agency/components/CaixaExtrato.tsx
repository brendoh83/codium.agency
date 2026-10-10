import { formatBRL } from "@/lib/format";

export interface CaixaMes {
  saldo_inicial: number;
  entradas: number;
  saidas_despesas: number;
  saidas_retiradas: number;
  saldo_final: number;
}

export interface DespesaLinha {
  id: string;
  descricao: string;
  categoria: string | null;
  tipo: string;
  valor: number;
  pago: boolean;
  vencimento: string | null;
}

function Linha({
  rotulo,
  valor,
  sinal,
  forte,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  sinal?: "+" | "−" | "=";
  forte?: boolean;
  detalhe?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${forte ? "border-t border-slate-200 pt-2.5" : ""}`}>
      <div className="min-w-0">
        <span className={`text-sm ${forte ? "font-semibold text-navy-900" : "text-slate-600"}`}>
          {sinal && <span className="mr-1.5 text-slate-400">{sinal}</span>}
          {rotulo}
        </span>
        {detalhe && <span className="ml-2 text-xs text-slate-400">{detalhe}</span>}
      </div>
      <span className={`shrink-0 text-sm ${forte ? "font-semibold text-navy-900" : "text-slate-700"}`}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}

export default function CaixaExtrato({
  mesLabel,
  caixa,
  despesas,
}: {
  mesLabel: string;
  caixa: CaixaMes;
  despesas: DespesaLinha[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-navy-900">Caixa — {mesLabel}</h2>
      <p className="mb-3 text-xs text-slate-400">Para onde o caixa foi. O saldo final passa para o mês seguinte.</p>

      <Linha rotulo="Saldo anterior" valor={caixa.saldo_inicial} />
      <Linha rotulo="Entrou no mês (10% dos pagamentos recebidos)" valor={caixa.entradas} sinal="+" />

      {despesas.filter((d) => d.pago).length === 0 ? (
        <Linha rotulo="Despesas pagas no mês" valor={0} sinal="−" />
      ) : (
        despesas
          .filter((d) => d.pago)
          .map((d) => (
            <Linha
              key={d.id}
              rotulo={d.descricao}
              valor={d.valor}
              sinal="−"
              detalhe={[d.categoria, d.tipo === "fixa" ? "fixa" : "variável"].filter(Boolean).join(" · ")}
            />
          ))
      )}
      {caixa.saidas_retiradas > 0 && (
        <Linha rotulo="Retiradas dos sócios acima da parte deles" valor={caixa.saidas_retiradas} sinal="−" />
      )}

      <Linha rotulo="Saldo final do caixa" valor={caixa.saldo_final} sinal="=" forte />

      {despesas.some((d) => !d.pago) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Despesas ainda a pagar (não saíram do caixa)</p>
          {despesas
            .filter((d) => !d.pago)
            .map((d) => (
              <Linha
                key={d.id}
                rotulo={d.descricao}
                valor={d.valor}
                detalhe={d.vencimento ? `vence ${d.vencimento.split("-").reverse().join("/")}` : undefined}
              />
            ))}
        </div>
      )}
    </div>
  );
}

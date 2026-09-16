"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL, formatDate, monthLabel } from "@/lib/format";
import {
  atualizarCliente,
  atualizarRelacionamento,
  atualizarServicosCliente,
  excluirCliente,
  registrarEventoSaude,
  resolverEventoSaude,
} from "@/actions/clientes";
import { marcarPagamentoRecebido, desfazerPagamento } from "@/actions/pagamentos";
import { criarContrato, encerrarContrato } from "@/actions/contratos";
import { DivisaoPreview } from "@/components/ClienteForm";

const ABAS = ["Geral", "Financeiro", "Contratos", "Relacionamento & Saúde", "Tarefas"] as const;

export default function ClienteDetalhe({
  cliente,
  servicos,
  clienteServicos,
  contratos,
  pagamentos,
  saudeEventos,
  saude,
  satisfacaoHistorico,
  tarefas,
}: any) {
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Geral");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-navy-900">{cliente.empresa}</h1>
            <StatusBadge status={cliente.status} />
            {saude && <StatusBadge status={saude.classificacao} />}
          </div>
          <p className="text-sm text-slate-500">
            {cliente.responsavel} {cliente.cidade ? `· ${cliente.cidade}` : ""}{" "}
            {cliente.nicho ? `· ${cliente.nicho}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clientes"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ← Voltar
          </Link>
          <button
            onClick={() => {
              if (confirm(`Excluir ${cliente.empresa}? Essa ação não pode ser desfeita.`)) {
                startTransition(() => excluirCliente(cliente.id));
              }
            }}
            className="rounded-lg border border-danger/30 bg-white px-3 py-2 text-xs font-medium text-danger hover:bg-danger/5"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-200/60 p-1">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
              aba === a ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {aba === "Geral" && (
        <AbaGeral cliente={cliente} servicos={servicos} clienteServicos={clienteServicos} />
      )}
      {aba === "Financeiro" && (
        <AbaFinanceiro cliente={cliente} pagamentos={pagamentos} pending={pending} startTransition={startTransition} />
      )}
      {aba === "Contratos" && <AbaContratos cliente={cliente} contratos={contratos} />}
      {aba === "Relacionamento & Saúde" && (
        <AbaRelacionamento
          cliente={cliente}
          saude={saude}
          saudeEventos={saudeEventos}
          satisfacaoHistorico={satisfacaoHistorico}
          startTransition={startTransition}
        />
      )}
      {aba === "Tarefas" && <AbaTarefas cliente={cliente} tarefas={tarefas} />}
    </div>
  );
}

function Card({ title, children, action }: any) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function AbaGeral({ cliente, servicos, clienteServicos }: any) {
  const servicoIdsAtuais = clienteServicos.map((cs: any) => cs.servico_id);
  const [selecionados, setSelecionados] = useState<string[]>(servicoIdsAtuais);
  const composicaoInicial: Record<string, string> = {};
  clienteServicos.forEach((cs: any) => (composicaoInicial[cs.servico_id] = String(cs.valor_composicao)));
  const [composicao, setComposicao] = useState<Record<string, string>>(composicaoInicial);
  const [valorMensal, setValorMensal] = useState(String(cliente.valor_mensal ?? 0));
  const [pctBrendo, setPctBrendo] = useState(String(cliente.pct_brendo ?? 50));

  const valorMensalNum = Number(String(valorMensal).replace(",", ".")) || 0;
  const pctBrendoNum = Math.min(100, Math.max(0, Number(String(pctBrendo).replace(",", ".")) || 0));
  const pctVictorNum = Math.round((100 - pctBrendoNum) * 100) / 100;

  const atualizarClienteComId = atualizarCliente.bind(null, cliente.id);
  const atualizarServicosComId = atualizarServicosCliente.bind(null, cliente.id);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="Informações gerais">
        <form action={atualizarClienteComId} className="space-y-3">
          <Field label="Nome da empresa" name="empresa" defaultValue={cliente.empresa} />
          <Field label="Responsável" name="responsavel" defaultValue={cliente.responsavel} />
          <Field label="WhatsApp" name="whatsapp" defaultValue={cliente.whatsapp} />
          <Field label="Instagram" name="instagram" defaultValue={cliente.instagram} />
          <Field label="Cidade" name="cidade" defaultValue={cliente.cidade} />
          <Field label="Nicho" name="nicho" defaultValue={cliente.nicho} />
          <Field label="Plano" name="plano" defaultValue={cliente.plano} />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select name="status" defaultValue={cliente.status} className="input">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Valor mensal</label>
              <input
                name="valor_mensal"
                value={valorMensal}
                onChange={(e) => setValorMensal(e.target.value)}
                className="input"
              />
            </div>
            <Field label="Dia de pagamento" name="dia_pagamento" defaultValue={cliente.dia_pagamento} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Observações</label>
            <textarea name="observacoes" defaultValue={cliente.observacoes} rows={3} className="input" />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Divisão de ganhos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">% Brendo</label>
                <input
                  name="pct_brendo"
                  value={pctBrendo}
                  onChange={(e) => setPctBrendo(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  % Victor (completa 100%)
                </label>
                <input className="input bg-slate-50 text-slate-500" value={pctVictorNum} readOnly />
                <input type="hidden" name="pct_victor" value={pctVictorNum} />
              </div>
            </div>
            <DivisaoPreview valorMensal={valorMensalNum} pctBrendo={pctBrendoNum} pctVictor={pctVictorNum} />
          </div>

          <SubmitButton>Salvar alterações</SubmitButton>
        </form>
      </Card>

      <Card title="Serviços contratados">
        <form action={atualizarServicosComId} className="space-y-2">
          {servicos.map((s: any) => {
            const ativo = selecionados.includes(s.id);
            return (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  ativo ? "border-navy-900 bg-copper-100/30" : "border-slate-200"
                }`}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="servicos"
                    value={s.id}
                    checked={ativo}
                    onChange={() =>
                      setSelecionados((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                      )
                    }
                  />
                  {s.nome}
                </label>
                {ativo && (
                  <input
                    className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Valor (R$)"
                    name={`valor_servico_${s.id}`}
                    value={composicao[s.id] ?? ""}
                    onChange={(e) => setComposicao((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
          <p className="pt-1 text-xs text-slate-400">
            A soma da composição alimenta o relatório de receita por serviço da agência.
          </p>
          <SubmitButton>Salvar serviços</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function AbaFinanceiro({ cliente, pagamentos, startTransition }: any) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Plano" value={cliente.plano || "—"} />
        <MiniStat label="Valor mensal" value={formatBRL(cliente.valor_mensal)} />
        <MiniStat label="Dia de pagamento" value={`Dia ${cliente.dia_pagamento ?? "—"}`} />
        <MiniStat
          label="Próximo pagamento"
          value={
            pagamentos.find((p: any) => p.status_efetivo !== "pago")
              ? formatDate(pagamentos.find((p: any) => p.status_efetivo !== "pago").vencimento)
              : "—"
          }
        />
      </div>

      <Card title="Histórico de pagamentos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">Competência</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Pago em</th>
                <th className="py-2 pr-3">Brendo</th>
                <th className="py-2 pr-3">Victor</th>
                <th className="py-2 pr-3">Caixa</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagamentos.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">{monthLabel(p.competencia)}</td>
                  <td className="py-2 pr-3">{formatDate(p.vencimento)}</td>
                  <td className="py-2 pr-3 font-medium">{formatBRL(p.valor)}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={p.status_efetivo} />
                  </td>
                  <td className="py-2 pr-3">{p.data_pagamento ? formatDate(p.data_pagamento) : "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {p.status_efetivo === "pago" ? formatBRL(p.liquido_brendo) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {p.status_efetivo === "pago" ? formatBRL(p.liquido_victor) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {p.status_efetivo === "pago" ? formatBRL(p.caixa_total) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {p.status_efetivo === "pago" ? (
                      <button
                        className="text-xs text-slate-400 hover:text-danger"
                        onClick={() => startTransition(() => desfazerPagamento(p.id, cliente.id))}
                      >
                        Desfazer
                      </button>
                    ) : (
                      <button
                        className="rounded-md bg-ok/10 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/20"
                        onClick={() => startTransition(() => marcarPagamentoRecebido(p.id, cliente.id))}
                      >
                        Marcar recebido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pagamentos.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Nenhum pagamento gerado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AbaContratos({ cliente, contratos }: any) {
  const criar = criarContrato.bind(null, cliente.id);
  const DURACAO_LABEL: Record<string, string> = {
    "1_mes": "1 mês",
    "3_meses": "3 meses",
    "6_meses": "6 meses",
    "12_meses": "12 meses",
    recorrente: "Recorrente",
  };

  function statusVencimento(dataFim: string | null) {
    if (!dataFim) return { label: "Ativo", tone: "ativo" };
    const dias = Math.round(
      (new Date(dataFim + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
    if (dias < 0) return { label: "Vencido", tone: "atrasado" };
    if (dias <= 7) return { label: `Vence em ${dias}d`, tone: "atrasado" };
    if (dias <= 15) return { label: `Vence em ${dias}d`, tone: "pendente" };
    if (dias <= 30) return { label: `Vence em ${dias}d`, tone: "pendente" };
    return { label: "Ativo", tone: "ativo" };
  }

  return (
    <div className="space-y-5">
      <Card title="Novo contrato">
        <form action={criar} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="Tipo" name="tipo" defaultValue={cliente.plano} />
          <Field label="Data de início" name="data_inicio" type="date" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Duração</label>
            <select name="duracao" className="input" defaultValue="recorrente">
              <option value="recorrente">Recorrente</option>
              <option value="1_mes">1 mês</option>
              <option value="3_meses">3 meses</option>
              <option value="6_meses">6 meses</option>
              <option value="12_meses">12 meses</option>
            </select>
          </div>
          <Field label="Valor" name="valor" defaultValue={cliente.valor_mensal} />
          <Field label="Data de término (se houver)" name="data_fim" type="date" />
          <div className="flex items-end md:col-span-3">
            <SubmitButton>Adicionar contrato</SubmitButton>
          </div>
        </form>
      </Card>

      <Card title="Contratos do cliente">
        <div className="space-y-3">
          {contratos.map((c: any) => {
            const sv = c.status === "ativo" ? statusVencimento(c.data_fim) : { label: "Encerrado", tone: "encerrado" };
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <div className="text-sm font-medium text-navy-900">{c.tipo || "Contrato"}</div>
                  <div className="text-xs text-slate-400">
                    {DURACAO_LABEL[c.duracao]} · Início {formatDate(c.data_inicio)}
                    {c.data_fim ? ` · Término ${formatDate(c.data_fim)}` : ""} · {formatBRL(c.valor)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={sv.tone} />
                  {c.status === "ativo" && (
                    <form action={encerrarContrato.bind(null, c.id, cliente.id)}>
                      <button className="text-xs text-slate-400 hover:text-danger">Encerrar</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {contratos.length === 0 && <p className="text-sm text-slate-400">Nenhum contrato cadastrado.</p>}
        </div>
      </Card>
    </div>
  );
}

function AbaRelacionamento({ cliente, saude, saudeEventos, satisfacaoHistorico, startTransition }: any) {
  const atualizar = atualizarRelacionamento.bind(null, cliente.id);
  const registrar = registrarEventoSaude.bind(null, cliente.id);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="Relacionamento">
        <form action={atualizar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Satisfação (0-10)" name="satisfacao_atual" defaultValue={cliente.satisfacao_atual} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Temperatura</label>
              <select name="temperatura" defaultValue={cliente.temperatura} className="input">
                <option value="saudavel">🟢 Saudável</option>
                <option value="atencao">🟡 Atenção</option>
                <option value="risco">🔴 Risco</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Último contato" name="ultimo_contato" type="date" defaultValue={cliente.ultimo_contato} />
            <Field label="Última reunião" name="ultima_reuniao" type="date" defaultValue={cliente.ultima_reuniao} />
            <Field label="Próxima reunião" name="proxima_reuniao" type="date" defaultValue={cliente.proxima_reuniao} />
          </div>
          {saude?.tem_trafego_pago && (
            <Field
              label="Nota do resultado de campanhas (0-10)"
              name="resultado_campanha_nota"
              defaultValue={cliente.resultado_campanha_nota}
            />
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Observações</label>
            <textarea
              name="observacoes_relacionamento"
              defaultValue={cliente.observacoes_relacionamento}
              rows={3}
              className="input"
            />
          </div>
          <SubmitButton>Salvar</SubmitButton>
        </form>

        {satisfacaoHistorico.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Histórico de satisfação</h3>
            <div className="space-y-1 text-sm">
              {satisfacaoHistorico.map((s: any) => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-slate-500">{monthLabel(s.competencia)}</span>
                  <span className="font-medium text-navy-900">{s.nota}/10</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Saúde do cliente">
        {saude && (
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-slate-50 p-3">
            <div className="text-3xl font-semibold text-navy-900">{saude.score}</div>
            <div>
              <StatusBadge status={saude.classificacao} />
              <p className="mt-1 text-xs text-slate-400">
                {saude.pagamentos_atrasados > 0 && `${saude.pagamentos_atrasados} pagamento(s) atrasado(s). `}
                {saude.reclamacoes_abertas > 0 && `${saude.reclamacoes_abertas} reclamação(ões) aberta(s). `}
                {saude.entregas_pendentes > 0 && `${saude.entregas_pendentes} entrega(s) pendente(s).`}
                {saude.pagamentos_atrasados === 0 &&
                  saude.reclamacoes_abertas === 0 &&
                  saude.entregas_pendentes === 0 &&
                  "Nenhuma pendência registrada."}
              </p>
            </div>
          </div>
        )}

        <form action={registrar} className="mb-4 flex flex-wrap gap-2">
          <select name="tipo" className="input w-40">
            <option value="reclamacao">Reclamação</option>
            <option value="entrega_pendente">Entrega pendente</option>
            <option value="elogio">Elogio</option>
            <option value="outro">Outro</option>
          </select>
          <input name="descricao" placeholder="Descrição breve" className="input flex-1" />
          <input type="date" name="data" className="input w-40" defaultValue={new Date().toISOString().slice(0, 10)} />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-medium text-white hover:bg-navy-950">
            Registrar
          </button>
        </form>

        <div className="space-y-2">
          {saudeEventos.map((e: any) => (
            <div
              key={e.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                e.resolvido ? "border-slate-100 text-slate-400" : "border-slate-200"
              }`}
            >
              <div>
                <span className="mr-2 font-medium capitalize">{e.tipo.replace("_", " ")}</span>
                {e.descricao}
                <span className="ml-2 text-xs text-slate-400">{formatDate(e.data)}</span>
              </div>
              {!e.resolvido && (
                <button
                  className="text-xs text-copper-600 hover:underline"
                  onClick={() => startTransition(() => resolverEventoSaude(cliente.id, e.id))}
                >
                  Marcar resolvido
                </button>
              )}
            </div>
          ))}
          {saudeEventos.length === 0 && <p className="text-sm text-slate-400">Nenhum evento registrado.</p>}
        </div>
      </Card>
    </div>
  );
}

function AbaTarefas({ cliente, tarefas }: any) {
  return (
    <Card title={`Tarefas de ${cliente.empresa}`}>
      <div className="space-y-2">
        {tarefas.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
            <div>
              <div className="font-medium text-navy-900">{t.titulo}</div>
              <div className="text-xs text-slate-400">
                {formatDate(t.data)} · {t.responsavel || "sem responsável"}
              </div>
            </div>
            <StatusBadge status={t.status} />
          </div>
        ))}
        {tarefas.length === 0 && <p className="text-sm text-slate-400">Nenhuma tarefa vinculada a este cliente.</p>}
      </div>
      <Link href="/tarefas" className="mt-3 inline-block text-xs font-medium text-copper-600 hover:underline">
        Gerenciar tarefas →
      </Link>
    </Card>
  );
}

function Field({ label, name, type = "text", defaultValue }: any) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type={type} name={name} defaultValue={defaultValue ?? ""} className="input" />
    </div>
  );
}
function SubmitButton({ children }: any) {
  return (
    <button
      type="submit"
      className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-medium text-white hover:bg-navy-950"
    >
      {children}
    </button>
  );
}
function MiniStat({ label, value }: any) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <div className="text-[11px] uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-navy-900">{value}</div>
    </div>
  );
}

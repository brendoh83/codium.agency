export type StatusCliente = "ativo" | "pausado" | "cancelado";
export type Temperatura = "saudavel" | "atencao" | "risco";
export type StatusPagamento = "pago" | "pendente" | "atrasado";
export type StatusTarefa = "a_fazer" | "em_andamento" | "concluido";
export type StatusLead = "novo" | "em_contato" | "proposta" | "fechado" | "perdido";
export type StatusContrato = "ativo" | "encerrado";
export type DuracaoContrato = "1_mes" | "3_meses" | "6_meses" | "12_meses" | "recorrente";
export type TipoTarefa =
  | "reuniao"
  | "entrega"
  | "criativo"
  | "campanha"
  | "gravacao"
  | "relatorio"
  | "cobranca"
  | "outros";

export interface Servico {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  empresa: string;
  responsavel: string | null;
  whatsapp: string | null;
  instagram: string | null;
  cidade: string | null;
  nicho: string | null;
  data_inicio: string;
  status: StatusCliente;
  observacoes: string | null;
  plano: string | null;
  valor_mensal: number;
  dia_pagamento: number | null;
  satisfacao_atual: number | null;
  ultimo_contato: string | null;
  ultima_reuniao: string | null;
  proxima_reuniao: string | null;
  temperatura: Temperatura;
  observacoes_relacionamento: string | null;
  resultado_campanha_nota: number | null;
  pct_brendo: number;
  pct_victor: number;
  created_at: string;
  updated_at: string;
}

export interface ClienteServico {
  id: string;
  cliente_id: string;
  servico_id: string;
  valor_composicao: number;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  tipo: string | null;
  data_inicio: string;
  data_fim: string | null;
  duracao: DuracaoContrato;
  valor: number;
  status: StatusContrato;
}

export interface Pagamento {
  id: string;
  cliente_id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: StatusPagamento;
  status_efetivo?: StatusPagamento;
  data_pagamento: string | null;
  pct_brendo_aplicado?: number | null;
  pct_victor_aplicado?: number | null;
  bruto_brendo?: number | null;
  bruto_victor?: number | null;
  caixa_corte_brendo?: number | null;
  caixa_corte_victor?: number | null;
  liquido_brendo?: number | null;
  liquido_victor?: number | null;
  caixa_total?: number | null;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string | null;
  tipo: "fixa" | "variavel";
  data: string;
  mes_referencia: string;
  observacao: string | null;
  created_at: string;
}

export interface FechamentoMensal {
  mes: string;
  faturamento_total: number;
  total_recebido: number;
  total_brendo: number;
  total_victor: number;
  total_caixa: number;
  despesas_fixas: number;
  despesas_variaveis: number;
  despesas_totais: number;
  saldo_caixa: number;
  fechado_em: string;
  fechado_por: string | null;
}

export interface Tarefa {
  id: string;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: TipoTarefa;
  data: string;
  responsavel: string | null;
  status: StatusTarefa;
}

export interface Lead {
  id: string;
  nome: string;
  empresa: string | null;
  responsavel: string | null;
  whatsapp: string | null;
  instagram: string | null;
  cidade: string | null;
  nicho: string | null;
  servico_interesse: string | null;
  valor_potencial: number | null;
  data_entrada: string;
  observacoes: string | null;
  status: StatusLead;
  cliente_id: string | null;
}

export interface SaudeCliente {
  cliente_id: string;
  satisfacao_atual: number | null;
  tem_trafego_pago: boolean;
  resultado_campanha_nota: number | null;
  pagamentos_atrasados: number;
  reclamacoes_abertas: number;
  entregas_pendentes: number;
  score: number;
  classificacao: Temperatura;
}

export interface Alerta {
  tipo: string;
  nivel: "critico" | "atencao" | "positivo";
  mensagem: string;
  cliente_id: string | null;
  referencia_id: string | null;
  data_ref: string | null;
}

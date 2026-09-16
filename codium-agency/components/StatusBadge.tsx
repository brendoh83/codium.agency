const STYLES: Record<string, string> = {
  ativo: "bg-ok/10 text-ok border-ok/30",
  pago: "bg-ok/10 text-ok border-ok/30",
  saudavel: "bg-ok/10 text-ok border-ok/30",
  concluido: "bg-ok/10 text-ok border-ok/30",
  fechado: "bg-ok/10 text-ok border-ok/30",

  pausado: "bg-warn/10 text-warn border-warn/30",
  pendente: "bg-warn/10 text-warn border-warn/30",
  atencao: "bg-warn/10 text-warn border-warn/30",
  em_andamento: "bg-warn/10 text-warn border-warn/30",
  em_contato: "bg-warn/10 text-warn border-warn/30",
  proposta: "bg-warn/10 text-warn border-warn/30",
  a_fazer: "bg-slate-100 text-slate-600 border-slate-300",

  cancelado: "bg-danger/10 text-danger border-danger/30",
  atrasado: "bg-danger/10 text-danger border-danger/30",
  risco: "bg-danger/10 text-danger border-danger/30",
  perdido: "bg-danger/10 text-danger border-danger/30",
  encerrado: "bg-slate-100 text-slate-500 border-slate-300",

  novo: "bg-navy-900/10 text-navy-900 border-navy-900/30",
};

const LABELS: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  cancelado: "Cancelado",
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  novo: "Novo",
  em_contato: "Em contato",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
  encerrado: "Encerrado",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-300";
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${style}`}
    >
      {label}
    </span>
  );
}

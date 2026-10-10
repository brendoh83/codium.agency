// Abertura da página pública do cliente (/c/[token]) e seu esqueleto de carregamento.
// Componente de servidor: só CSS, sem estado.

function Anel() {
  // Eco discreto do anel da logo, cortado no canto superior direito.
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 text-copper-500 motion-safe:animate-fade-in sm:-right-16"
    >
      <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.6" />
    </svg>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative pb-7 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-1rem] top-0 h-56 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(244,229,220,0.7),transparent_60%)]"
      />
      <Anel />
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.webp"
          alt="Codium Marketing Agency"
          width={60}
          height={48}
          className="h-12 w-auto"
        />
        {children}
      </div>
    </header>
  );
}

export function AberturaCliente({
  empresa,
  aguardando,
  aprovados,
}: {
  empresa: string;
  aguardando: number;
  aprovados: number;
}) {
  return (
    <Moldura>
      <p className="mt-7 flex items-center gap-3 text-[10.5px] font-medium uppercase tracking-[0.28em] text-copper-700 motion-safe:animate-fade-up">
        <span aria-hidden className="h-px w-6 bg-copper-500" />
        Aprovação de conteúdos
      </p>
      <h1 className="mt-3 break-words font-display text-[34px] font-medium leading-[1.1] tracking-[-0.01em] text-navy-900 motion-safe:animate-fade-up motion-safe:[animation-delay:80ms]">
        <span className="italic text-copper-600">Olá,</span> {empresa}
      </h1>
      <p className="mt-3 max-w-[30ch] text-[14.5px] leading-relaxed text-muted-ink motion-safe:animate-fade-up motion-safe:[animation-delay:160ms]">
        Revise cada peça com calma e aprove ou peça ajustes em poucos toques.
      </p>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-4 text-[13px] motion-safe:animate-fade-up motion-safe:[animation-delay:240ms]">
        {aguardando > 0 ? (
          <p className="flex items-center gap-2.5 font-medium text-navy-900">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-copper-500 ring-4 ring-copper-100" />
            {aguardando === 1 ? "1 conteúdo aguardando sua aprovação" : `${aguardando} aguardando sua aprovação`}
          </p>
        ) : (
          <p className="flex items-center gap-2 font-medium text-navy-900">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 text-copper-600">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tudo em dia
          </p>
        )}
        {aprovados > 0 && (
          <p className="shrink-0 tabular-nums text-muted-ink">
            {aprovados} {aprovados === 1 ? "aprovado" : "aprovados"}
          </p>
        )}
      </div>
    </Moldura>
  );
}

export function AberturaEsqueleto() {
  return (
    <Moldura>
      <div className="mt-7 h-3 w-44 rounded-full skeleton" />
      <div className="mt-4 h-9 w-64 max-w-full rounded-md skeleton" />
      <div className="mt-4 h-3.5 w-56 rounded-full skeleton" />
      <div className="mt-2 h-3.5 w-40 rounded-full skeleton" />
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <div className="h-3.5 w-48 rounded-full skeleton" />
        <div className="h-3.5 w-16 rounded-full skeleton" />
      </div>
    </Moldura>
  );
}

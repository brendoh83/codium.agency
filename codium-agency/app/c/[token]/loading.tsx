import { AberturaEsqueleto } from "@/components/AberturaCliente";

export default function Carregando() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando conteúdos"
      className="mx-auto max-w-xl overflow-x-clip px-4 pb-[calc(4rem+env(safe-area-inset-bottom))]"
    >
      <AberturaEsqueleto />
      <div className="mb-3 flex items-center gap-3">
        <div className="h-4 w-28 rounded-full skeleton" />
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-xl">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[4/5] skeleton" />
        ))}
      </div>
    </main>
  );
}

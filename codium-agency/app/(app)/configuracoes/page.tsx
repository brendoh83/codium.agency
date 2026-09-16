import { createClient } from "@/lib/supabase/server";
import { criarServico } from "@/actions/servicos";
import { adicionarEmailPermitido } from "@/actions/usuarios";
import ServicosConfig from "@/components/ServicosConfig";
import EmailsPermitidosConfig from "@/components/EmailsPermitidosConfig";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const [{ data: servicos }, { data: profile }, { data: emailsPermitidos }] = await Promise.all([
    supabase.from("servicos").select("*").order("nome"),
    supabase.from("profiles").select("*"),
    supabase.from("emails_permitidos").select("*").order("criado_em"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Configurações</h1>
        <p className="text-sm text-slate-500">Catálogo de serviços e usuários do sistema</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Catálogo de serviços</h2>
        <p className="mb-4 text-xs text-slate-400">
          Serviços que podem ser selecionados ao cadastrar um cliente (combináveis entre si).
        </p>
        <ServicosConfig servicos={servicos ?? []} />
        <form action={criarServico} className="mt-4 flex gap-2">
          <input name="nome" placeholder="Novo serviço" required className="input flex-1" />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-medium text-white hover:bg-navy-950">
            Adicionar
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Usuários com conta criada</h2>
        <div className="space-y-2">
          {(profile ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-navy-900">{p.nome || p.email}</div>
                <div className="text-xs text-slate-400">{p.email}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">
                {p.papel}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Por enquanto todo novo usuário entra como administrador. Perfis de equipe com acesso
          limitado serão liberados numa próxima etapa.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Acesso ao sistema</h2>
        <p className="mb-4 text-xs text-slate-400">
          Só e-mails desta lista conseguem criar conta na tela de login — mesmo tentando direto
          pela API, sem passar pela tela. Adicione aqui o e-mail de quem mais deve ter acesso.
        </p>
        <EmailsPermitidosConfig emails={emailsPermitidos ?? []} />
        <form action={adicionarEmailPermitido} className="mt-4 flex flex-wrap gap-2">
          <input name="email" type="email" placeholder="email@exemplo.com" required className="input flex-1" />
          <input name="apelido" placeholder="Nome (opcional)" className="input flex-1" />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-medium text-white hover:bg-navy-950">
            Autorizar e-mail
          </button>
        </form>
      </div>
    </div>
  );
}

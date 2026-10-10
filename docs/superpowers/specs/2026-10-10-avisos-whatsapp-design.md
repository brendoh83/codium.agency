# Avisos no WhatsApp para conteúdos — design

Data: 2026-10-10. Projeto: dashboard Codium (`codium-agency/`, Next.js 14, Supabase `ssroxcrywymmusresjsn`, Vercel).
Depende de: aba Conteúdos (spec `2026-10-09-conteudos-aprovacao-design.md`).

## Objetivo
Avisar por WhatsApp, em grupos, os dois momentos do fluxo de aprovação, sem que a equipe precise lembrar de mandar:
1. Conteúdo novo ou nova versão enviado → aviso no **grupo do cliente**.
2. Cliente aprova ou reprova → aviso no **grupo da equipe**, com o motivo na reprovação.

## Decisões (confirmadas com o dono)
- Envio pelo servidor **Evolution** já existente (`EVOLUTION_URL`, v2, header `apikey`), usado também pelo Rastreador de Leads. Instância nova e própria da agência, nome padrão `codium-agencia`.
- Número que envia: o número pessoal do dono para testes; depois troca por um chip da agência (a troca é só reconectar a instância pelo QR).
- Destinos são **grupos** (JID `...@g.us`): um grupo por cliente e um grupo da equipe. Não se usa o campo WhatsApp do cliente.
- Tudo configurado dentro do dashboard (Configurações → WhatsApp e a página do cliente em Conteúdos); nenhuma chave passa pelo chat.
- Falha no WhatsApp **nunca** impede a ação principal (upload, troca, aprovação).
- Agrupamento: para o mesmo cliente, aviso de conteúdo novo só sai se não houve outro aviso enviado com sucesso nos últimos **10 minutos**.
- Trocar arquivo (correção antes da resposta do cliente) **não** avisa.
- Cliente sem grupo escolhido não recebe aviso.

## Mensagens
- Conteúdo novo, 1 pendente: `📌 {empresa}: novo conteúdo para aprovar: «{título}». Veja aqui: {link}`
- Conteúdo novo, vários pendentes: `📌 {empresa}: {N} conteúdos aguardando aprovação. Veja aqui: {link}`
- Nova versão: `🔄 {empresa}: nova versão de «{título}» para aprovar. Veja aqui: {link}`
- Aprovado (equipe): `✅ {empresa} aprovou «{título}»`
- Reprovado (equipe): `❌ {empresa} reprovou «{título}»: {motivo}`
- Reenvio manual: mesmo texto do conteúdo novo, ignora a regra dos 10 minutos.

## Dados (Supabase)
- `clientes.whatsapp_grupo_id text null`, `clientes.whatsapp_grupo_nome text null`.
- `app_config(chave text primary key, valor text not null)`: chaves `whatsapp_instancia`, `whatsapp_grupo_equipe_id`, `whatsapp_grupo_equipe_nome`. RLS: só `authenticated`.
- `avisos_whatsapp(id uuid pk, tipo text, cliente_id uuid null, destino text, texto text, ok boolean, erro text null, created_at timestamptz default now())`. RLS: só `authenticated`. Mantém só os últimos 200 registros.
- Funções `SECURITY DEFINER`, executáveis por `anon`, **validadas pelo token do link do cliente** (a decisão do cliente acontece sem login):
  - `dados_aviso_decisao(p_token, p_versao_id)` → `{empresa, titulo, grupo_equipe_id, instancia}` ou `null`.
  - `registrar_aviso(p_token, p_tipo, p_destino, p_texto, p_ok, p_erro)`: grava no log, só para token válido.

## Servidor
- `lib/whatsapp.ts` (somente servidor), mesmas chamadas já em uso no Rastreador: `criarInstancia`, `conectar` (QR ou código de pareamento), `estadoConexao`, e novas: `listarGrupos` (`GET /group/fetchAllGroups/{instancia}?getParticipants=false`) e `enviarTexto` (`POST /message/sendText/{instancia}` com `{number: jid, text}`). Os formatos exatos de grupos e envio são confirmados contra o servidor real na implementação.
- `lib/avisos.ts` (lógica pura, testável): montagem das mensagens, regra dos 10 minutos, escolha de singular/plural.
- Pontos de disparo: `registrarConteudo`, `registrarNovaVersao` (grupo do cliente) e `responderVersao` (grupo da equipe), sempre **depois** de a ação principal dar certo e dentro de `try/catch`.
- Instância criada com `groupsIgnore: false` (o Rastreador usa `true`), sem webhooks.

## Interface
- **Configurações → WhatsApp** (nova seção): estado da conexão; botão para criar e conectar (QR code, com opção de código de pareamento); lista para escolher o grupo da equipe; lista dos **últimos avisos** com sucesso ou erro.
- **Conteúdos → página do cliente**: lista para escolher o grupo do cliente (com o nome do grupo gravado) e botão **Avisar de novo no grupo**.

## Variáveis de ambiente (Vercel, projeto `codium-agency`)
`EVOLUTION_URL` (config), `EVOLUTION_API_KEY` (secret, colada pelo dono). Opcional: `EVOLUTION_INSTANCE` (padrão `codium-agencia`).

## Riscos aceitos
- API não oficial: número com envio automático pode ser banido; mitigação: baixo volume, agrupamento, chip da agência depois.
- Bugs de pareamento do Baileys já vistos no Rastreador; plano B é o código de pareamento.
- O número que envia precisa estar em todos os grupos de cliente e no grupo da equipe.
- Se o Evolution cair, avisos falham e ficam no log; o resto do sistema segue.

## Fora do escopo
Resposta do cliente pelo WhatsApp, avisos de pagamento e de despesa (virão com o módulo financeiro), mensagens privadas ao cliente, templates da API oficial.

# Conteúdos para aprovação — design

Data: 2026-10-09. Projeto: dashboard Codium (`codium-agency/`, Next.js 14 App Router, Vercel).

## Objetivo
Substituir o fluxo "manda o vídeo no grupo do WhatsApp, cliente baixa e responde" por uma página por cliente, acessada por link, onde o cliente vê os conteúdos, aprova ou reprova (com motivo). O dashboard administra o envio e serve de acervo temporário (arquivos expiram em 30 dias).

## Decisões
- Arquivos no **Cloudflare R2**; metadados e aprovações no Supabase `codium-agency`.
- Página do cliente é uma rota pública `/c/<token>` no mesmo projeto, sem sidebar, **sem login**.
- Token do link: aleatório, **curto (10 caracteres, base62)**, não derivado do nome do cliente. É a única proteção do acesso, então não pode ser adivinhável. Regenerável pelo dashboard.
- Retenção: arquivo apagado **30 dias após o upload** (regra de lifecycle do R2). Registro de aprovação e motivo permanece no banco.
- Reprovação gera **nova versão do mesmo conteúdo**; o motivo anterior fica no histórico ao lado.
- Aprovar exige **caixa de confirmação** ("Deseja aprovar este conteúdo? Sim / Não"). Reprovar exige motivo não vazio.
- Estimativa de uso: cerca de 50 GB/mês ingeridos, cerca de 50 GB armazenados em regime, cerca de R$ 3–4/mês.

## Dados (Supabase)
- `clientes.link_token text unique` (novo).
- `conteudos(id uuid pk, cliente_id fk, titulo text, tipo text check in ('video','imagem'), created_at)`.
- `conteudo_versoes(id uuid pk, conteudo_id fk, numero int, r2_key text, mime text, tamanho bigint, created_at, expira_em timestamptz, decisao text null check in ('aprovado','reprovado'), motivo text null, decidido_em timestamptz null)`, unique `(conteudo_id, numero)`.
- RLS ligado nas duas tabelas novas. Acesso do dashboard via usuário autenticado.
- Estado do conteúdo = decisão da versão de maior `numero`: sem decisão = pendente; reprovado = continua no topo aguardando nova versão; aprovado = desce para o feed com tarja verde.

## Funções do banco (SECURITY DEFINER, executáveis por anon)
- `feed_cliente(p_token)`: valida o token e devolve conteúdos, versões, decisões e motivos. Não devolve dados de outro cliente.
- `responder_versao(p_token, p_versao_id, p_decisao, p_motivo)`: valida que a versão pertence ao cliente do token e ainda não foi decidida; exige motivo se `reprovado`.

## Dashboard
- Sidebar: **Conteúdos** → lista de clientes → página do cliente.
- Página do cliente: upload (vídeo/imagem), lista de conteúdos com histórico de versões e motivos, **Subir nova versão** em conteúdo reprovado, **Copiar link**, **Gerar link novo**.
- Rota server (autenticada) emite URL pré-assinada de PUT para o R2; o navegador envia o arquivo direto ao R2. Após o PUT, o dashboard registra a versão no banco.

## Página do cliente (`/c/<token>`)
- Topo: pendentes e reprovados. Cada um com player/imagem, **Aprovar** (com confirmação) e **Reprovar** (campo de motivo obrigatório).
- Abaixo: aprovados com tarja verde, rolando até os mais antigos.
- Versão nova mostra "Nova versão atualizada" e o motivo anterior ao lado.
- Versão com arquivo expirado mostra "arquivo expirado", mantendo status e histórico.
- Leitura: o servidor gera URL pré-assinada de GET (validade curta) a cada abertura. Arquivos nunca ficam públicos.

## Infra e configuração
- Middleware libera `/c/*` (hoje redireciona tudo sem sessão para `/login`).
- Bucket R2 privado com CORS permitindo PUT a partir da origem do dashboard e regra de expiração de 30 dias.
- Variáveis de ambiente na Vercel: conta, chave de acesso, segredo e nome do bucket do R2. Cadastradas pelo dono da conta, nunca coladas em chat.
- Nova dependência para assinar URLs S3 (cliente S3 leve).

## Fora da primeira versão
Aviso automático por WhatsApp, comentários em conversa, várias mídias por conteúdo, download pelo cliente, geração de miniaturas, transcodificação.

## Riscos aceitos
- Quem tiver o link pode aprovar ou reprovar (sem login, por decisão do dono).
- Conteúdo não decidido em 30 dias perde o arquivo e precisa de novo upload.

## Pendências do dono
Criar conta Cloudflare (exige cartão), bucket R2 e chave de API; cadastrar as variáveis na Vercel.

## Estado
Implementado e em produção em 2026-10-10 (commit 1772c6c). Testado ponta a ponta: upload real no R2, aprovação, reprovação com motivo, nova versão. Regra de 30 dias ativa no bucket `codium-conteudos`.

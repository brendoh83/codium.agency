# Agendamento e postagem no Instagram a partir da aba Conteúdos — design

Data: 2026-11-13. Autor da ideia: Brendo (Codium). Fase 1 = programar, aprovar e postar. Fase 2 = relatórios.

## Intenção e por quê

A aba Conteúdos hoje serve só para o cliente aprovar arquivos. A equipe ainda posta à mão depois,
e o cliente demora a responder. Queremos que o dash seja a central: a equipe sobe mídia + legenda +
data/hora; o cliente aprova no mesmo link de hoje (`/c/<token>`); aprovado, o sistema posta sozinho no
Instagram do cliente na hora marcada. Se o cliente não aprova, o número do dash cobra no grupo do
cliente até a data. Na fase 2, o dash puxa os números de cada perfil para alimentar um relatório mensal
para o cliente e dizer quais conteúdos deram certo.

## Objetivos

- Subir conteúdo com legenda (e hashtags dentro da legenda) e data/hora de postagem.
- O cliente vê mídia + legenda no feed dele e responde por partes: aprovar tudo, reprovar só a mídia,
  ou reprovar só a legenda (escrevendo o que mudar). Parte aprovada continua aprovada.
- Postar sozinho na hora marcada, só se mídia e legenda estiverem aprovadas.
- Cobrar a aprovação no grupo do cliente (WhatsApp) antes da data.
- Conectar o Instagram do cliente uma vez, pelo dash, e criar/ligar a conta dele no AutoDM.
- Tudo que sobe pelo sistema é "nosso"; o resto do perfil é "do cliente" (usado na fase 2).

## Não-objetivos (fase 1)

- Relatórios, métricas e "qual vídeo trouxe seguidores" (fase 2).
- Stories, comentário automático, edição de Reels dentro do dash.
- Guardar a senha do Instagram do cliente. Nunca.
- Vender para outras agências (exigiria revisão do app na Meta).

## Anti-objetivos (seria falha mesmo funcionando)

- Postar algo que o cliente não aprovou por completo.
- Postar duas vezes o mesmo conteúdo.
- Perder o horário em silêncio: se não der para postar, a equipe fica sabendo na hora.

## Restrições conhecidas

- Meta (API do Instagram com Instagram Login): só contas Business/Creator; postar = criar o item e depois
  publicar; limite de 100 posts por API por 24 h; a mídia precisa estar numa URL que a Meta consegue
  abrir na hora (usamos link assinado do R2); carrossel de 2 a 10 itens; Reels em H.264/AAC é o mais seguro.
- O Instagram não agenda sozinho: guardamos a data e disparamos nós mesmos (fila com tarefa a cada minuto,
  como o AutoDM já faz).
- Testadores: contas adicionadas como testador do app funcionam sem revisão da Meta. Limite de testadores e
  se postar/puxar números funciona assim sem revisão: **a confirmar na prática com a Toque Final antes de
  construir o resto**. No AutoDM, comentários exigiram revisão mesmo na conta própria.
- Dashboard e AutoDM são bancos diferentes (Supabase `codium-agency` e `autodm`). Rastreador é um terceiro.
- WhatsApp: instância Evolution já existente e grupo do cliente já cadastrado no dash.

## Abordagens consideradas

1. **Dashboard é o dono da conexão e da fila (escolhida).** Conecta o Instagram no dash, guarda a chave de
   acesso no banco do dash, posta e (fase 2) puxa métricas dali. Ao conectar, avisa o AutoDM para
   criar/ligar a conta do cliente. Prós: um lugar só para aprovação, agenda e publicação; o dash já tem o
   WhatsApp, o R2 e o fluxo de aprovação. Contras: duas cópias da chave (dash e AutoDM) para manter em dia.
2. **AutoDM é o dono; o dash só pede para postar.** O AutoDM já tem conexão com Instagram, fila e contas
   múltiplas. Prós: não duplica a conexão. Contras: aprovação num sistema e postagem em outro, com rede
   entre bancos em toda postagem; falha do AutoDM derruba a postagem; AutoDM vira peça crítica da agência.
3. **Ferramenta externa de agendamento (Buffer, Later etc.).** Mais rápido, mas é mensalidade por perfil,
   não integra com nossa aprovação nem com o AutoDM. Descartada.

Escolhida: 1. A chave que o AutoDM recebe é uma cópia enviada por canal protegido; renovação acontece nos
dois lados (ver Pendências do construtor).

## Fluxo

1. Equipe sobe mídia + legenda + data/hora (aba do cliente). Estado: **aguardando aprovação**.
2. Aviso no grupo do cliente com o link (já existe).
3. Cliente abre o link e vê mídia + legenda + "Posta em dd/mm às hh:mm". Escolhe:
   - **Aprovar tudo**; ou
   - **Reprovar mídia** (motivo em texto); ou
   - **Reprovar legenda** (motivo em texto); ou os dois.
4. Aviso no grupo da equipe dizendo qual parte foi aprovada ou reprovada e por quê.
5. Parte reprovada volta para a equipe: mídia nova = subir de novo (versão nova da mídia); legenda nova =
   editar o texto no dash, **sem subir a mídia de novo**. Só a parte alterada volta para aprovação.
6. Com mídia e legenda aprovadas, o conteúdo fica **agendado**. Na hora marcada o sistema posta
   (**postando → postado** ou **falhou**).
7. Se a equipe alterar uma parte já aprovada, só ela volta para aprovação.

### Cobrança automática (nossa proposta; ajustável)

- Se não estiver aprovado, o número do dash escreve no grupo do cliente: 24 h antes, 6 h antes e 1 h antes
  da postagem (só os horários que ainda não passaram quando o conteúdo foi subido). Texto curto, com o link.
- Se reprovado e ninguém subiu a correção até 2 h antes, avisa o grupo da equipe.
- Cobrança para quando o conteúdo é aprovado, excluído ou reagendado (recalcula).

### Horário chegou sem aprovação (nossa proposta)

Não posta. Avisa a equipe no grupo, marca **perdeu o horário** e a equipe escolhe nova data (a aprovação
anterior continua válida se nada mudou).

## Aprovação em partes (mudança no que existe)

Hoje cada versão tem uma decisão só. Passa a ter duas (mídia e legenda), cada uma com histórico próprio de
reprovações e motivos. O estado do conteúdo é derivado: tudo aprovado = pronto para agendar. A regra
"versão nova substitui a anterior" continua valendo, agora por parte.

## Conexão do Instagram e ligação com o AutoDM

- Botão "Conectar Instagram" na aba do cliente. Abre a tela de login da Meta (o login do cliente é digitado
  lá; o sistema só recebe a chave de acesso, que é renovada antes de vencer).
- Depois de conectar, o dash pergunta: "Esse cliente já tem conta no AutoDM?" com a lista de contas
  existentes para escolher (evita duplicar). Se não tiver, cria uma. O Rastreador faz o mesmo ao conectar
  WhatsApp. A ligação é por escolha na lista, nunca por nome igual.
- Se a chave vencer ou a Meta pedir novo login, aparece alerta no dash e no grupo da equipe.

## Postagem

- Tipos da fase 1: imagem única, carrossel (já existe na aba), Reels (vídeo).
- Postagem idempotente: guarda o identificador do item criado na Meta antes de publicar; se cair no meio,
  a nova tentativa continua dele em vez de criar outro.
- Tentativas: até 3, com intervalo; falhou de vez = alerta para a equipe com o motivo da Meta.
- Vídeo: usar o original; se a Meta recusar o formato, gerar uma cópia compatível no servidor Hetzner
  (já temos conversor).

## Fase 2 (fora deste documento, só intenção)

Puxar alcance, curtidas, comentários, salvamentos, compartilhamentos por conteúdo; visitas ao perfil,
cliques no link da bio e seguidores por mês; relatório mensal por cliente; comparar conteúdos nossos com os
do próprio cliente; ideias baseadas no que deu certo. Pontos incertos a verificar: quantos seguidores veio
de cada vídeo e separar orgânico de anúncio (o Rastreador já tem acesso à API de anúncios da Meta).

## O que fica para o construtor

- Confirmar na Meta (com a Toque Final): postar e puxar métricas como testador, limite de testadores,
  permissões exatas a pedir ao app.
- Como o AutoDM cria a conta hoje quando o WhatsApp conecta, e reaproveitar para o Instagram.
- Onde guardar a chave de acesso (criptografada) e como renovar nos dois lados.
- Tarefa a cada minuto no banco do dash (como o AutoDM: pg_cron chamando uma rota com segredo).
- Detalhes de texto das mensagens de cobrança e da tela do cliente.

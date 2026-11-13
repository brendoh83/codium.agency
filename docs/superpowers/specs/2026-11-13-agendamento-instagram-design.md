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
- O cliente vê mídia + legenda + data da postagem e responde por partes: aprovar tudo, reprovar só a mídia,
  só a legenda, ou sugerir outra data (escrevendo o que mudar). Parte aprovada continua aprovada.
- Postar sozinho na hora marcada, só se mídia e legenda estiverem aprovadas.
- Cobrar a aprovação no grupo do cliente (WhatsApp) antes da data.
- Conectar o Instagram do cliente uma vez, pelo dash, e criar/ligar a conta dele no AutoDM.
- Tudo que sobe pelo sistema é "nosso"; o resto do perfil é "do cliente" (usado na fase 2).

## Onde fica

Tudo dentro do dashboard, na aba Conteúdos: ao abrir o cliente (ex.: Toque Final), a tela de hoje (subir
conteúdo para aprovação) ganha legenda, hashtags e data/hora de postagem. A página do cliente (`/c/<token>`)
continua a mesma, mostrando mídia + legenda + data de postagem.

## Visão maior (não é desta fase)

O número do WhatsApp conectado ao dash vira uma assistente da agência: além de cobrar aprovação, mais
tarde cobrar pagamentos e enviar nota fiscal para os clientes que pedem. O módulo de mensagens desta fase
deve ser reaproveitável para isso, mas nada disso entra agora.

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
   - **Reprovar legenda** (motivo em texto); ou os dois; ou
   - **Sugerir outra data** (dia/hora e recado).
4. Aviso no grupo da equipe dizendo qual parte foi aprovada ou reprovada e por quê.
5. Parte reprovada volta para a equipe: mídia nova = subir de novo (versão nova da mídia); legenda nova =
   editar o texto no dash, **sem subir a mídia de novo**. Só a parte alterada volta para aprovação.
6. Com mídia e legenda aprovadas, o conteúdo fica **agendado**. Na hora marcada o sistema posta
   (**postando → postado** ou **falhou**).
7. Se a equipe alterar uma parte já aprovada, só ela volta para aprovação.

### Cobrança automática (o número do dash age como assistente)

Não é por horas fixas: depende de quanto tempo falta para a postagem. Há conteúdo gravado às 17 h que
precisa sair às 19h30, e conteúdo marcado para a semana que vem.

- **Ao subir:** o pedido de aprovação vai na hora para o grupo do cliente, com o link (como hoje).
- **Cobrança por "visualizou":** o sistema registra quando o cliente abriu o link de aprovação (isso é
  certo; o "visto" azul do WhatsApp em grupo só aparece quando todo mundo viu, então não serve de sinal).
  Se o cliente abriu e, passados cerca de 20 minutos, nada foi decidido, o número manda um lembrete
  citando a data da postagem ("está agendado para amanhã às 8h, falta sua aprovação").
- **Sem abrir o link:** os lembretes ficam mais próximos conforme a postagem se aproxima, em proporção ao
  tempo que resta (com intervalo mínimo entre eles para não encher o grupo). Detalhe da cadência é do
  construtor; a regra é: quanto mais perto da data, mais insistente.
- Se reprovado e ninguém subiu a correção perto do horário, avisa o grupo da equipe.
- A cobrança para quando o conteúdo é aprovado, excluído ou reagendado (recalcula).

### Horário chegou sem aprovação

Não posta. O número escreve no grupo do cliente algo como: "Não foi postado porque ainda falta sua
aprovação. Se puder aprovar agora, a gente já vê o melhor horário para postar." A equipe também é avisada,
o conteúdo fica **perdeu o horário** e a equipe escolhe a nova data (aprovações já dadas continuam).

### Cliente quer outra data

O cliente vê "Posta em dd/mm às hh:mm". Se quiser outro dia ("não posta amanhã, deixa pra quarta"), usa
**Sugerir outra data**, escolhe dia/hora e pode escrever um recado. Vai para o grupo da equipe; a equipe
confirma no dash (a data não muda sozinha). A data é a terceira parte da aprovação, ao lado de mídia e legenda.

## Aprovação em partes (mudança no que existe)

Hoje cada versão tem uma decisão só. Passa a ter três (mídia, legenda e data), cada uma com histórico próprio de
reprovações e motivos. Exemplos dados: "legenda ok, mas quero a edição diferente" → só a mídia volta
para edição e aprovação; "troque a legenda" → só a legenda fica pendente. O estado do conteúdo é derivado: tudo aprovado = pronto para agendar. A regra
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

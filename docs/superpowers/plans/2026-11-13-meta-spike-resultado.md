# Resultado do spike da Meta (2026-11-13)

Conta testada: `codium.agencia` (Business, testadora do Instagram do app AutoDM, id `1695827711514044`; app do Instagram `1773060370780530`). Token gerado pelo painel, API `graph.instagram.com/v23.0`.

| Pergunta | Resposta |
|---|---|
| Funciona sem revisão da Meta? | **Sim**, como testador, para postar e puxar números |
| Limite de testadores | **50** por app (tela "0 de 50"); hoje 2 contas |
| Permissões usadas | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights` (as duas últimas adicionadas ao app em 2026-11-13, status "Pronto para teste") |
| Postar imagem | OK: container -> status `FINISHED` -> `media_publish` -> permalink |
| Carrossel / Reels | **Não testados**; testar com o sistema pronto (Toque Final) |
| Apagar post pela API | **Não suportado** (erro 100/33); só a equipe apaga no app do Instagram |
| Insights por mídia | reach, likes, comments, saved, shares, views, total_interactions |
| Insights da conta | reach (dia), follower_count (dia), profile_views, website_clicks (total_value) |
| Seguidores ganhos por mídia | Não existe métrica pronta; só diferença de `follower_count` |

Consequência para o plano: "cancelar" só vale antes de postar; depois de postada a equipe apaga à mão. Publicação por testador funciona com a conta do próprio cliente adicionada como testadora (cada cliente aceita o convite em Instagram > Apps e sites).

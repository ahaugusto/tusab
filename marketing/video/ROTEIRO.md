# Vídeo de divulgação do Tusab — roteiro

Formato: 1920×1080, 30 fps, **sem narração** (legendas grandes, pensado para tocar mudo no LinkedIn).
Tudo o que aparece do app é **gravado de verdade**: buscas reais em fontes públicas, indexação real e respostas reais do assistente (modelo local gemma3:4b via Ollama). Os trechos de espera estão acelerados.

Gerar: `node gravar.cjs` (com o backend em 127.0.0.1:8001 e `TUSAB_DATA_DIR` temporário) e depois `node montar.cjs`.
Música opcional: coloque `musica.mp3` (com licença para uso comercial) nesta pasta antes de rodar `montar.cjs`.

| # | Cena | Duração | Legenda / texto | Locução sugerida (se for narrar) |
|---|---|---|---|---|
| 1 | Gancho | ~6 s | "Vídeos. PDFs. Leis. Artigos. Planilhas. Tudo guardado. Nada encontrado." | "Você guarda vídeos, PDFs, leis, artigos… e na hora de achar a resposta?" |
| 2 | Virada | ~4 s | "E se tudo isso respondesse às suas perguntas?" | "E se tudo isso pudesse responder às suas perguntas?" |
| 3 | Logo | ~5 s | TUSAB · Index · Augment · Chat — "Sua base de conhecimento com IA, no seu computador." | "Esse é o Tusab: a sua base de conhecimento com IA, rodando no seu computador." |
| 4 | Home | ~5 s | "Escolha como começar" | — |
| 5 | YouTube | ~7 s | "Cole o link de um canal do YouTube" → "As transcrições viram uma base pesquisável" | "Cole o link de um canal e as transcrições viram uma base pesquisável." |
| 6 | Fontes públicas | ~6 s | "Ou busque em fontes públicas — sem cadastro, sem chave" | "Ou busque em dezenas de fontes públicas, sem cadastro e sem chave." |
| 7 | Números | ~5 s | 70 fontes · 11 áreas · 0 cadastros | — |
| 8 | Educação | ~14 s | "Nova área: Educação" → "Marque várias fontes. Filtre por país, tipo e instituição." | "Escolha várias fontes de uma vez e filtre por país, tipo e instituição." |
| 9 | Busca real | ~8 s (acelerada) | "Busca, baixa e indexa — automático" | "O Tusab busca, baixa e indexa tudo sozinho." |
| 10 | Resultado | ~3 s | "Pronto: sua base está indexada" | — |
| 11 | Dados abertos | ~25 s | "Mais de 40 portais de dados abertos" → "Escolha quais estados, órgãos ou países" → "Cada resultado traz a lista de arquivos" | "E mais de quarenta portais de dados abertos do governo, com a lista de arquivos de cada conjunto." |
| 12 | Jurisprudência | ~5 s | "STF, TCU e TST — sem dados das partes" | "Jurisprudência com inteiro teor, sem dados pessoais das partes." |
| 13 | Chat | ~25 s | "Pergunte em linguagem natural" → "Cada resposta traz a fonte" | "Agora é só perguntar. Cada resposta vem com a fonte." |
| 14 | Tabela e planilha | ~20 s | "Peça uma tabela" → "Baixe como planilha .xlsx" | "Peça uma tabela e baixe como planilha, pronta para usar." |
| 15 | Privacidade | ~5 s | "Roda no seu computador. Seus dados não saem dele." | "Tudo roda no seu computador. Seus dados não saem dele." |
| 16 | Perfis | ~6 s | Estudante · Professor · Pesquisador · Especialista | "Para estudantes, professores, pesquisadores e especialistas." |
| 17 | Chamada | ~6 s | "Comece agora." — Windows e macOS — github.com/ahaugusto/tusab | "Baixe o Tusab para Windows e macOS." |

## Cuidados de honestidade (não alterar sem checar)
- Não afirmar que é gratuito nem "open source": a licença é Elastic License 2.0 (código disponível para leitura e auditoria).
- "70 fontes / 11 áreas" vem do registro real (`tusab_engine/motor/fontes/`); atualizar o cartão `numeros` se o número mudar.
- O demo usa um canal fictício (`@canal-de-aulas`) só para mostrar o campo; nenhuma marca ou canal de terceiros aparece.

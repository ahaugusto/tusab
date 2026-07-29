# Avisos de terceiros

O Tusab é construído sobre bibliotecas open-source. Nenhuma foi modificada
(fork) — todas são usadas via gerenciador de pacotes (`pip`/`npm`), nos
termos de suas licenças originais. Esta lista cobre as dependências
diretas com uso mais substancial no produto; não é exaustiva de toda a
árvore de dependências transitivas (ver `requirements-lock.txt` e
`*/package-lock.json` para a lista completa).

## Backend (Python)

| Biblioteca | Licença | Uso no Tusab |
|---|---|---|
| [FastAPI](https://github.com/tiangolo/fastapi) | MIT | Framework da API REST |
| [Uvicorn](https://github.com/encode/uvicorn) | BSD-3-Clause | Servidor ASGI |
| [rank-bm25](https://github.com/dorianbrown/rank_bm25) | Apache-2.0 | Índice BM25Okapi — fundação do RAG |
| [sentence-transformers](https://github.com/UKPLab/sentence-transformers) | Apache-2.0 | CrossEncoder (Busca Ampla) + embeddings do KeyBERT |
| [PyTorch](https://github.com/pytorch/pytorch) | BSD-3-Clause | Backend de inferência do sentence-transformers |
| [KeyBERT](https://github.com/MaartenGr/KeyBERT) | MIT | Extração de frases-chave para enriquecimento do corpus BM25 |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense | Extração de transcrições do YouTube — roda localmente, no IP do usuário |
| [pdfplumber](https://github.com/jsvine/pdfplumber) | MIT | Extração de texto de PDF (upload, arXiv, Câmara dos Deputados) |
| [python-docx](https://github.com/python-openxml/python-docx) | MIT | Leitura/geração de DOCX |
| [trafilatura](https://github.com/adbar/trafilatura) (Adrien Barbaresi) | Apache-2.0 | Extração de conteúdo principal de página web avulsa — respeita `robots.txt` |
| [pandas](https://github.com/pandas-dev/pandas) | BSD-3-Clause | Manipulação de CSV/relatórios |
| [reportlab](https://github.com/MrBitBucket/reportlab-mirror) | BSD-3-Clause | Geração de PDF de relatório |
| [cryptography](https://github.com/pyca/cryptography) | Apache-2.0 / BSD | Suporte a `safeStorage`/DPAPI |
| Anthropic SDK, OpenAI SDK, google-genai | MIT / Apache-2.0 | Clientes para provedores de LLM externos (opcionais) |

## Frontend (JavaScript)

| Biblioteca | Licença | Uso no Tusab |
|---|---|---|
| [React](https://github.com/facebook/react) | MIT | Framework de UI |
| [Vite](https://github.com/vitejs/vite) | MIT | Build tool |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | Estilização |
| [Framer Motion](https://github.com/framer/motion) | MIT | Animações |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Ícones |
| [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) | MIT | Renderização de Markdown no chat |
| [i18next](https://github.com/i18next/i18next) | MIT | Internacionalização PT/EN/ES |
| [PostHog](https://github.com/PostHog/posthog-js) | MIT | Telemetria opt-in |

## Desktop

| Biblioteca | Licença | Uso no Tusab |
|---|---|---|
| [Electron](https://github.com/electron/electron) | MIT | Runtime desktop |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Empacotamento do instalador NSIS |
| [electron-updater](https://github.com/electron-userland/electron-builder) | MIT | Auto-update via GitHub Releases |

## Modelos locais (via Ollama)

| Modelo | Licença | Uso no Tusab |
|---|---|---|
| [ms-marco-MiniLM-L-6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-6-v2) | Apache-2.0 | CrossEncoder da Busca Ampla |
| [Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-1B) | Llama 3.2 Community License | Modelo padrão do chat via Ollama (opcional — usuário pode trocar) |

---

Se você mantém uma das bibliotecas acima e acha que a atribuição está
incorreta ou incompleta, abra uma [issue](https://github.com/ahaugusto/tusab/issues).

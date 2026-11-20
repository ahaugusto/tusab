# Avisos de terceiros

O Tusab é construído sobre bibliotecas open-source. Nenhuma foi modificada
(fork): todas são usadas via `npm`, nos termos das licenças originais.
Esta lista cobre as dependências diretas. O pacote `.mcpb` leva o texto
completo de todas as licenças, incluindo as dependências transitivas, em
`THIRD_PARTY_NOTICES.txt` (gerado por `tusab-mcp/scripts/gerar-licencas.mjs`).

## Extensão (`tusab-mcp/`)

| Biblioteca | Licença | Uso no Tusab |
|---|---|---|
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | Servidor MCP (stdio) |
| [SQLite Wasm](https://github.com/sqlite/sqlite-wasm) | Apache-2.0 | Índice de busca (FTS5) |
| [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | Apache-2.0 | Texto e páginas de PDF |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | BSD-2-Clause | Texto de documentos Word |
| [read-excel-file](https://gitlab.com/catamphetamine/read-excel-file) | MIT | Leitura de planilhas |
| [write-excel-file](https://gitlab.com/catamphetamine/write-excel-file) | MIT | Tabela de vídeos (XLSX) |
| [PDFKit](https://github.com/foliojs/pdfkit) | MIT | Relatório em PDF |
| [fflate](https://github.com/101arrowz/fflate) | MIT | Zip da base e `.tusab` |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | MIT | Respostas XML de fontes públicas |
| [Zod](https://github.com/colinhacks/zod) | MIT | Validação dos parâmetros das ferramentas |

## Tela (`web_interface/`, compilada para dentro do pacote)

| Biblioteca | Licença | Uso no Tusab |
|---|---|---|
| [React](https://github.com/facebook/react) | MIT | Interface |
| [Vite](https://github.com/vitejs/vite) | MIT | Build |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | Estilização |
| [Framer Motion](https://github.com/framer/motion) | MIT | Animações |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Ícones |
| [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm), [remark-breaks](https://github.com/remarkjs/remark-breaks) | MIT | Markdown |
| [i18next](https://github.com/i18next/i18next) | MIT | Português, inglês e espanhol |
| [axios](https://github.com/axios/axios) | MIT | Chamadas à API local do plugin |
| [Mermaid](https://github.com/mermaid-js/mermaid) | MIT | Diagramas dos materiais (mapa mental, fluxograma, linha do tempo). Traz D3 (ISC), Cytoscape (MIT), KaTeX (MIT), DOMPurify (MPL-2.0 ou Apache-2.0; usado sob Apache-2.0) e outras; o layout opcional `elk` (elkjs, EPL-2.0) fica fora do pacote |

## Baixado na hora do uso (não vai no pacote)

| Programa | Licença | Uso no Tusab |
|---|---|---|
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense | Transcrições do YouTube, no IP do usuário. Baixado do repositório oficial, com conferência SHA-256 |

O app desktop (descontinuado em 19/11/2026) usava outras bibliotecas (Python, Electron, modelos locais). A lista dele está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/blob/desktop-final/THIRD_PARTY_NOTICES.md).

---

Se você mantém uma das bibliotecas acima e acha que a atribuição está
incorreta ou incompleta, abra uma [issue](https://github.com/criaugu/tusab/issues).

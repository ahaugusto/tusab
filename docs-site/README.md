# Documentação do Tusab (docs-site)

Site de documentação do Tusab, construído com [Docusaurus](https://docusaurus.io/). Publicado automaticamente no GitHub Pages a cada push na `main` que altere esta pasta (`.github/workflows/deploy-docs.yml`).

## Rodar localmente

```bash
npm install
npm run start
```

Abre em `http://localhost:3000` com hot reload.

## Build de produção

```bash
npm run build
```

Gera arquivos estáticos em `build/`. Servir localmente com `npm run serve`.

## Estrutura

```
docs-site/
  docs/               páginas de documentação (Markdown), organizadas por sidebars.js
  src/pages/           homepage customizada
  static/img/          logo e favicon do Tusab
  docusaurus.config.js configuração do site (navbar, footer, tema)
  sidebars.js           ordem e agrupamento das páginas na barra lateral
```

## Publicação

Automática via GitHub Actions (`deploy-docs.yml`) — build + deploy no GitHub Pages a cada push relevante na `main`. Para publicar manualmente, dispare o workflow pela aba Actions do GitHub ("Run workflow").

## Limpeza pendente

Este projeto foi criado via `create-docusaurus` e ainda tem alguns arquivos de exemplo do template que não fazem parte da documentação real do Tusab (excluídos do build via `docs.exclude` e `blog: false` em `docusaurus.config.js`, mas ainda presentes no repositório):

- `docs/tutorial-basics/`, `docs/tutorial-extras/`, `docs/intro.mdx` — tutorial padrão do Docusaurus
- `blog/` — posts de exemplo (blog desabilitado no site)
- `src/pages/markdown-page.mdx` — página de exemplo avulsa

Pode apagar essas pastas/arquivos manualmente quando conveniente — não afetam o site publicado.

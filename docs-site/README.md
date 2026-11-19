# Documentação do Tusab (docs-site)

Site de documentação técnica do Tusab, construído com [Docusaurus](https://docusaurus.io/) e publicado em
https://criaugu.github.io/tusab/. A publicação é automática no GitHub Pages a cada push na `main` que altere esta pasta
(`.github/workflows/deploy-docs.yml`).

## Rodar localmente

```bash
npm install
npm run start                  # português (idioma padrão)
npm run start -- --locale en   # inglês
```

Abre em `http://localhost:3000` com recarga automática. No modo `start`, só um idioma é servido por vez.

## Build de produção

```bash
npm run build
```

Gera os arquivos estáticos dos dois idiomas em `build/` (`build/` = português, `build/en/` = inglês). O build falha se
houver link interno quebrado (`onBrokenLinks: 'throw'`). Para ver o resultado: `npm run serve`.

## Estrutura

```
docs-site/
  docs/                                          páginas em português (Markdown)
  i18n/en/docusaurus-plugin-content-docs/current/ as mesmas páginas em inglês, com os mesmos caminhos
  i18n/en/docusaurus-plugin-content-docs/current.json   rótulos das categorias da barra lateral em inglês
  i18n/en/docusaurus-theme-classic/              barra superior e rodapé em inglês
  i18n/en/code.json                              textos da página inicial em inglês
  src/pages/index.js                             página inicial
  static/img/                                    logo e favicon do Tusab
  docusaurus.config.js                           configuração (barra superior, rodapé, idiomas)
  sidebars.js                                    ordem e agrupamento das páginas
```

Toda página nova em `docs/` precisa da versão em inglês no mesmo caminho em `i18n/en/.../current/`. Ao criar ou
renomear uma categoria em `sidebars.js`, rode `npm run write-translations -- --locale en` e traduza o rótulo novo em
`current.json`.

## Publicação

Automática via GitHub Actions (`deploy-docs.yml`). Para publicar manualmente, dispare o workflow pela aba Actions do
GitHub ("Run workflow").

// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Tusab',
  tagline: 'Seu mentor digital. Seus dados. Sua máquina.',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://ahaugusto.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/tusab/',

  // GitHub pages deployment config.
  organizationName: 'ahaugusto', // GitHub org/user name.
  projectName: 'tusab', // Repo name.
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Metadata útil mesmo sem i18n multi-idioma habilitado.
  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/', // documentação é a home do site
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/ahaugusto/tusab/tree/main/docs-site/',
          // Conteúdo de demonstração do template Docusaurus — não faz parte
          // da documentação real do Tusab. Excluído em vez de apagado porque
          // o ambiente de scaffolding não tem permissão de delete neste volume.
          exclude: [
            '**/tutorial-basics/**',
            '**/tutorial-extras/**',
            'intro.mdx',
          ],
        },
        blog: false, // Tusab usa CHANGELOG.md no repositório principal, não blog
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/tusab-logo.png',
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Tusab',
        logo: {
          alt: 'Logo Tusab',
          src: 'img/tusab-logo-navbar.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentação',
          },
          {
            href: 'https://github.com/ahaugusto/tusab',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://github.com/ahaugusto/tusab/releases/latest',
            label: 'Download',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentação',
            items: [
              {label: 'Introdução', to: '/intro'},
              {label: 'Instalação', to: '/instalacao'},
              {label: 'Arquitetura', to: '/arquitetura/visao-geral'},
              {label: 'Segurança', to: '/seguranca'},
            ],
          },
          {
            title: 'Projeto',
            items: [
              {label: 'Repositório no GitHub', href: 'https://github.com/ahaugusto/tusab'},
              {label: 'Changelog completo', href: 'https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md'},
              {label: 'Issues', href: 'https://github.com/ahaugusto/tusab/issues'},
              {label: 'Licença (Elastic License 2.0)', href: 'https://github.com/ahaugusto/tusab/blob/main/LICENSE'},
            ],
          },
          {
            title: 'CriAugu',
            items: [
              {label: 'Site do Tusab', href: 'https://tusab.solutions'},
              {label: 'Augusto Brasil no LinkedIn', href: 'https://linkedin.com/in/augustoalvesbrasil'},
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} CriAugu — CNPJ 65.131.075/0001-57. Documentação construída com Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['powershell', 'python', 'bash', 'json'],
      },
    }),
};

export default config;

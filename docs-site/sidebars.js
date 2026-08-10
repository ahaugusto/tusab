// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    'instalacao',
    'perfis-e-jornadas',
    {
      type: 'category',
      label: 'Funcionalidades',
      collapsed: false,
      items: [
        'funcionalidades/extracao-youtube',
        'funcionalidades/repositorio-multi-fonte',
        'funcionalidades/assistente-rag',
        'funcionalidades/modo-estudo',
        'funcionalidades/mcp-server',
      ],
    },
    {
      type: 'category',
      label: 'Arquitetura técnica',
      items: [
        'arquitetura/visao-geral',
        'arquitetura/dados-e-armazenamento',
        'arquitetura/decisoes-tecnicas',
      ],
    },
    'seguranca',
    'privacidade',
    'acessibilidade',
    'design-system',
    {
      type: 'category',
      label: 'Desenvolvimento',
      items: [
        'desenvolvimento/setup',
        'desenvolvimento/build-e-testes',
      ],
    },
    'contribuindo',
    'changelog',
    'licenca',
  ],
};

export default sidebars;

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    'instalacao',
    'ferramentas-mcp',
    'biblioteca-de-prompts',
    'tela',
    {
      type: 'category',
      label: 'Funcionalidades',
      collapsed: false,
      items: [
        'funcionalidades/extracao-youtube',
        'funcionalidades/repositorio-multi-fonte',
        'funcionalidades/fontes-publicas',
        'funcionalidades/estudo',
        'funcionalidades/originais-e-imagens',
        'funcionalidades/idiomas',
        'funcionalidades/economia-de-tokens',
      ],
    },
    'perfis-e-jornadas',
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
    {
      type: 'category',
      label: 'App desktop (descontinuado)',
      collapsed: true,
      items: [
        'desktop/visao-geral',
        'desktop/instalacao',
        'desktop/assistente-rag',
        'desktop/modo-estudo',
        'desktop/mcp-server',
        'desktop/decisoes-tecnicas',
        'desktop/desenvolvimento',
      ],
    },
  ],
};

export default sidebars;

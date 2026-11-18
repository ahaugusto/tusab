// Nomes próprios do catálogo de fontes e rótulos que são iguais em pt, en e es.
// Entram nos dicionários como "texto → o mesmo texto", para o teste saber que foram vistos.
export const MESMO_TEXTO = [
  'arXiv', 'arXiv (Cornell)', 'OpenAlex', 'DataCite', 'DOAJ', 'Zenodo', 'Zenodo (CERN/OpenAIRE)', 'Crossref',
  'HAL (Archive Ouverte)', 'Open Library', 'Internet Archive', 'Agência Brasil (EBC)', 'EBC', 'GitHub', 'GitLab',
  'Codeberg', 'Hugging Face — Modelos', 'Hugging Face', 'Hugging Face — Datasets', 'Datasets', 'Hugging Face — Papers',
  'Papers', 'Stack Overflow', 'Stack Exchange', 'Hacker News', 'Y Combinator', 'Banco Central do Brasil',
  'IPEA — Repositório do Conhecimento', 'IPEA', 'IBGE', 'data.europa.eu', 'data.gov.uk', 'IBICT', 'OasisBR (IBICT)',
  'CAPES', 'EduCAPES', 'Wikimedia', 'Wikilivros', 'Wikiversidade', 'Câmara dos Deputados', 'Senado Federal', 'STF',
  'Supremo Tribunal Federal', 'TCU', 'Tribunal de Contas da União', 'TST', 'Tribunal Superior do Trabalho',
  'Assembleia Legislativa de Minas Gerais', 'Ministério da Saúde', 'ANVISA', 'Fiocruz ARCA', 'Fiocruz', 'INCA',
  'UNA-SUS ARES', 'UNA-SUS', 'PubMed', 'ClinicalTrials.gov', 'UniProt', 'Europe PMC', 'EMBL-EBI', 'openFDA', 'NASA Earthdata',
  'NASA', 'NASA Technical Reports Server', 'USGS Publications Warehouse', 'CERN Open Data', 'CERN', 'INSPIRE-HEP',
  'INSPIRE (CERN, DESY, Fermilab, SLAC)', 'Art Institute of Chicago', 'The Metropolitan Museum of Art',
  'Cleveland Museum of Art', 'Project Gutenberg', 'Wiktionary', 'WhatsApp (Android)', 'WhatsApp (iOS)', 'Zoom', 'Otter.ai',
  'Microsoft Teams', 'Link', 'Original', 'Fiocruz', 'BVS Ministério da Saúde',
];

export const mesmo = () => Object.fromEntries(MESMO_TEXTO.map((x) => [x, x]));

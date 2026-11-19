// Gera mcpb-resources/en-US.json e es-ES.json: o que o Claude Desktop mostra na tela de extensões
// (nome, descrição, ferramentas e atalhos) em inglês e espanhol. O manifest.json fica em pt-BR
// (default_locale). Os atalhos usam os mesmos textos de src/nucleo/prompts.js.
// Rodar depois de mudar ferramentas ou prompts: node scripts/gerar-recursos-manifesto.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS, PROMPTS } from '../src/nucleo/prompts.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const manifesto = JSON.parse(fs.readFileSync(`${raiz}manifest.json`, 'utf8'));

const TEXTOS = {
  'en-US': {
    lng: 'en',
    description: 'Tusab inside your AI: extract YouTube channels on this computer and query the base with citations to the exact minute.',
    long_description: 'Tusab extracts transcripts from YouTube channels, playlists and videos on this computer, from your own IP, and organizes everything in a local folder. Your AI tool queries this base and cites the video and the minute. The Tusab screen opens in the browser, served by this computer. Nothing goes through CriAugu servers: only the excerpts the AI queries go to the AI you chose.',
    keywords: ['knowledge', 'youtube', 'transcripts', 'rag', 'local-first', 'sqlite'],
    projeto: 'project',
    abrir: ['Opens the Tusab screen in the browser.', 'Open the Tusab panel.'],
    tools: {
      tusab_buscar: 'Searches the local base and returns excerpts with source, minute and link.',
      tusab_listar_projetos: 'Lists the projects, with sources, excerpts and extraction coverage.',
      tusab_ler_fonte: 'Reads a source in order, starting from a given minute.',
      tusab_ler_original: 'Opens the original file of a document (an image, or pages of a PDF) when the text is not enough.',
      tusab_adicionar_youtube: 'Extracts a channel, playlist or video on this computer and indexes it.',
      tusab_adicionar_arquivo: 'Adds a .txt or .md file to the project texts.',
      tusab_fontes_publicas: 'Lists the 70 public sources (arXiv, PubMed, Brazilian Chamber of Deputies, IBGE...) by area.',
      tusab_buscar_fonte_publica: 'Searches a public source for a topic and saves the results in the project.',
      tusab_salvar_estudo: 'Saves flashcards, sticky notes or a summary created by the AI, to review in other conversations.',
      tusab_revisao_hoje: 'Lists the flashcards due today (spaced repetition).',
      tusab_registrar_revisao: 'Records the grade of a reviewed flashcard.',
      tusab_novidades_semana: 'Lists what was added to the project in the last 7 days.',
      tusab_economia: 'Shows how many tokens Tusab saved the AI (excerpts only × whole sources). Local estimate.',
      tusab_status: 'Shows the repository, the running extraction and the queue.',
      tusab_abrir_painel: 'Opens the Tusab screen in the browser, served by this computer.',
    },
  },
  'es-ES': {
    lng: 'es',
    description: 'Tusab dentro de tu IA: extrae canales de YouTube en este ordenador y consulta la base con citas al minuto exacto.',
    long_description: 'Tusab extrae transcripciones de canales, listas y videos de YouTube en este ordenador, desde tu propia IP, y lo organiza todo en una carpeta local. Tu herramienta de IA consulta esa base y cita el video y el minuto. La pantalla de Tusab se abre en el navegador, servida por este ordenador. Nada pasa por servidores de CriAugu: solo los fragmentos que la IA consulta van a la IA que elegiste.',
    keywords: ['conocimiento', 'youtube', 'transcripciones', 'rag', 'local-first', 'sqlite'],
    projeto: 'proyecto',
    abrir: ['Abre la pantalla de Tusab en el navegador.', 'Abre el panel de Tusab.'],
    tools: {
      tusab_buscar: 'Busca en la base local y devuelve fragmentos con fuente, minuto y enlace.',
      tusab_listar_projetos: 'Lista los proyectos, con fuentes, fragmentos y cobertura de las extracciones.',
      tusab_ler_fonte: 'Lee una fuente en orden, a partir de un minuto.',
      tusab_ler_original: 'Abre el archivo original de un documento (una imagen o páginas de un PDF) cuando el texto no basta.',
      tusab_adicionar_youtube: 'Extrae un canal, una lista o un video en este ordenador y lo indexa.',
      tusab_adicionar_arquivo: 'Añade un archivo .txt o .md a los textos del proyecto.',
      tusab_fontes_publicas: 'Lista las 70 fuentes públicas (arXiv, PubMed, Cámara de Diputados de Brasil, IBGE...) por área.',
      tusab_buscar_fonte_publica: 'Busca un tema en una fuente pública y guarda los resultados en el proyecto.',
      tusab_salvar_estudo: 'Guarda flashcards, notas adhesivas o un resumen creados por la IA, para repasar en otras conversaciones.',
      tusab_revisao_hoje: 'Lista las flashcards que vencen hoy (repaso espaciado).',
      tusab_registrar_revisao: 'Registra la nota de una flashcard repasada.',
      tusab_novidades_semana: 'Lista lo que entró en el proyecto en los últimos 7 días.',
      tusab_economia: 'Muestra cuántos tokens ahorró Tusab a la IA (solo fragmentos × fuentes completas). Estimación local.',
      tusab_status: 'Muestra el repositorio, la extracción en curso y la cola.',
      tusab_abrir_painel: 'Abre la pantalla de Tusab en el navegador, servida por este ordenador.',
    },
  },
};

fs.mkdirSync(`${raiz}mcpb-resources`, { recursive: true });
for (const [locale, x] of Object.entries(TEXTOS)) {
  const faltando = manifesto.tools.filter((tl) => !x.tools[tl.name]).map((tl) => tl.name);
  if (faltando.length) throw new Error(`${locale}: ferramentas sem tradução: ${faltando.join(', ')}`);
  const prompts = manifesto.prompts.map((pm) => {
    if (pm.name === 'abrir_tusab') return { name: pm.name, description: x.abrir[0], text: x.abrir[1] };
    const p = PROMPTS.find((y) => y.id === pm.name);
    if (!p) throw new Error(`prompt ${pm.name} do manifesto não existe em prompts.js`);
    const txt = p.textos[x.lng];
    return { name: pm.name, description: txt.descricao, text: `${txt.titulo} — ${x.projeto} \${arguments.projeto}` };
  });
  const recurso = {
    display_name: 'Tusab',
    description: x.description,
    long_description: x.long_description,
    keywords: x.keywords,
    tools: manifesto.tools.map((tl) => ({ name: tl.name, description: x.tools[tl.name] })),
    prompts,
  };
  fs.writeFileSync(`${raiz}mcpb-resources/${locale}.json`, `${JSON.stringify(recurso, null, 2)}\n`);
  console.log(`${locale}: ${recurso.tools.length} ferramentas, ${prompts.length} atalhos (categorias: ${Object.keys(CATEGORIAS).length})`);
}

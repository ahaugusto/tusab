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
    description: "Your study and research notebook inside your AI: build a base on this computer from YouTube, documents and 70 public sources, ask with citations to the minute or the page, and study with flashcards, quizzes and mind maps that stay saved.",
    long_description: "Tusab turns Claude (or another MCP-compatible AI) into a study and research notebook connected to **your** sources, kept on this computer.\n\n**Build your base**\n- **YouTube:** transcripts of channels, playlists and videos, extracted on this computer, from your own IP, with automatic channel updates.\n- **Documents:** PDF, Word, Excel, CSV, TXT/Markdown, web pages and FHIR, with the original file kept.\n- **70 public sources** in 11 areas: arXiv, PubMed, SciELO, Brazilian Chamber and Senate, Supreme Court, IBGE, Central Bank, open data portals and others, with no sign-up or key.\n\n**Ask with citations**\n- The AI fetches only the right excerpts and cites the source: the video and the minute, with a link, or the PDF page.\n- It uses fewer tokens than attaching whole sources, and Tusab shows how much it saved.\n\n**Study, teach and create**\n- **Library with 41 ready-made prompts**, 20 of them based on evidence-based techniques (pretest, interleaved practice, backward design, PRISMA, pre-mortem…), to study, teach, research and decide, with the suggested AI model for each task.\n- **What the AI creates stays saved in Tusab:** flashcards with spaced repetition, summaries, quizzes, mind maps and lesson plans, which open drawn in the Materials tab.\n\n**On the Tusab screen** (in the browser, served by this computer): extraction, repository, materials and export or import of the base (.tusab, zip, spreadsheet and PDF). In Portuguese, English and Spanish.\n\n**Privacy:** the base stays on this computer. Nothing goes through CriAugu servers; only the excerpts the AI queries go to the AI you chose.",
    keywords: ["study", "research", "youtube", "transcripts", "flashcards", "citations", "public sources", "local-first"],
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
    description: "Tu cuaderno de estudio e investigación dentro de la IA: arma una base en este ordenador con YouTube, documentos y 70 fuentes públicas, pregunta con citas al minuto o a la página y estudia con flashcards, quizzes y mapas mentales que quedan guardados.",
    long_description: "Tusab convierte a Claude (u otra IA compatible con MCP) en un cuaderno de estudio e investigación conectado a **tus** fuentes, guardadas en este ordenador.\n\n**Arma tu base**\n- **YouTube:** transcripciones de canales, listas y videos, extraídas en este ordenador, desde tu propia IP, con actualización automática de los canales.\n- **Documentos:** PDF, Word, Excel, CSV, TXT/Markdown, páginas web y FHIR, con el archivo original guardado.\n- **70 fuentes públicas** en 11 áreas: arXiv, PubMed, SciELO, Cámara y Senado de Brasil, Supremo Tribunal, IBGE, Banco Central, portales de datos abiertos y otras, sin registro ni clave.\n\n**Pregunta con citas**\n- La IA busca solo los fragmentos correctos y cita la fuente: el video y el minuto, con enlace, o la página del PDF.\n- Gasta menos tokens que adjuntar las fuentes enteras, y Tusab muestra cuánto ahorró.\n\n**Estudia, enseña y produce**\n- **Biblioteca con 41 prompts listos**, 20 de ellos basados en técnicas con evidencia (pre-test, práctica intercalada, planificación inversa, PRISMA, pre-mortem…), para estudiar, enseñar, investigar y decidir, con el modelo de IA sugerido para cada tarea.\n- **Lo que genera la IA queda guardado en Tusab:** flashcards con repaso espaciado, resúmenes, quizzes, mapas mentales y planes de clase, que se abren dibujados en la pestaña Materiales.\n\n**En la pantalla de Tusab** (en el navegador, servida por este ordenador): extracción, repositorio, materiales y exportación o importación de la base (.tusab, zip, hoja de cálculo y PDF). En portugués, inglés y español.\n\n**Privacidad:** la base queda en este ordenador. Nada pasa por servidores de CriAugu; solo los fragmentos que consulta la IA van a la IA que elegiste.",
    keywords: ["estudio", "investigación", "youtube", "transcripciones", "flashcards", "citas", "fuentes públicas", "local-first"],
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

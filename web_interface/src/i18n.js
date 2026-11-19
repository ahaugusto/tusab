import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';
import { MODO_EXTENSAO } from './constants';

// Modo extensão: o espaço do "Estudo" vira a "Biblioteca de Prompts" (a IA do usuário gera
// cards, quizzes e resumos; o Tusab entrega o pedido certo). Só os rótulos mudam aqui.
const EXTENSAO = {
  pt: {
    'repo.hint_body': 'Aqui ficam os arquivos do YouTube e tudo que você adicionar. A sua IA consulta esta base pelo Tusab, sempre com a fonte de cada trecho.',
    'tabs.estudo': 'Biblioteca de Prompts',
    'home.section_study': 'Pedir à sua IA',
    'home.card_estudo_title': 'Biblioteca de Prompts',
    'home.card_estudo_desc': 'Pedidos prontos para a sua IA criar flashcards, quizzes, resumos e mais, citando a sua base',
  },
  en: {
    'repo.hint_body': 'This is where YouTube files and everything else you add live. Your AI queries this base through Tusab, always citing the source of each excerpt.',
    'tabs.estudo': 'Prompt Library',
    'home.section_study': 'Ask your AI',
    'home.card_estudo_title': 'Prompt Library',
    'home.card_estudo_desc': 'Ready requests for your AI to create flashcards, quizzes, summaries and more, citing your base',
  },
  es: {
    'repo.hint_body': 'Aquí quedan los archivos de YouTube y todo lo que agregues. Tu IA consulta esta base a través de Tusab, siempre con la fuente de cada fragmento.',
    'tabs.estudo': 'Biblioteca de prompts',
    'home.section_study': 'Pedir a tu IA',
    'home.card_estudo_title': 'Biblioteca de prompts',
    'home.card_estudo_desc': 'Pedidos listos para que tu IA cree flashcards, quizzes, resúmenes y más, citando tu base',
  },
};
const traducao = (lng, base) => (MODO_EXTENSAO ? { ...base, ...EXTENSAO[lng] } : base);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: traducao('pt', pt) },
      en: { translation: traducao('en', en) },
      es: { translation: traducao('es', es) },
    },
    fallbackLng: 'pt',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;

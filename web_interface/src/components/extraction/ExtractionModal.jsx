/**
 * @file ExtractionModal.jsx
 * @description Three-step extraction modal: (1) project name, (2) channel URL (when needed), (3) content types
 * @module components/extraction/ExtractionModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Zap, Loader2, Search, Stethoscope } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';
import { getCanalInfo } from '../../services/api';

/**
 * ExtractionModal — always starts with project name.
 * Step 1: Project name (pre-filled from channel handle, editable)
 * Step 2: Channel URL (skipped when channel already configured and not modoFila) — ou busca arXiv (perfil Pesquisador)
 * Step 3: Content types + auto-update — ou quantidade de resultados (arXiv)
 */
function ExtractionModal({ onClose, onConfirm, onConfirmArxiv, onConfirmFhir, darkMode, canalNome = '', canalUrlInicial = '', projetos = [], modoFila = false, perfil = '' }) {
  const { t } = useTranslation();

  // Toggle de fonte — só visível para o perfil Pesquisador. Busca acadêmica no
  // arXiv inspirada no projeto open-source OpenScience (synthetic-sciences/openscience)
  // — ver tusab_engine/motor/arxiv.py. Busca de estudos clínicos via FHIR
  // (ResearchStudy) — ver tusab_engine/motor/fhir.py.
  const podeUsarArxiv = perfil === 'pesquisador' && !modoFila;
  const podeUsarFhir  = perfil === 'pesquisador' && !modoFila;
  const podeEscolherFonte = podeUsarArxiv || podeUsarFhir;
  const [sourceType, setSourceType] = React.useState('youtube'); // 'youtube' | 'arxiv' | 'fhir'

  // Step arXiv: query de busca + quantidade de resultados
  const [arxivQuery,      setArxivQuery]      = React.useState('');
  const [arxivMaxResults, setArxivMaxResults] = React.useState(20);

  // Step FHIR: query de busca (ResearchStudy) + quantidade de resultados
  const [fhirQuery,      setFhirQuery]      = React.useState('');
  const [fhirMaxResults, setFhirMaxResults] = React.useState(20);

  const ALL_TYPES = [
    { id: 'Videos',    label: t('ops.type_videos'),    icon: '🎬' },
    { id: 'Shorts',    label: t('ops.type_shorts'),    icon: '⚡' },
    { id: 'Ao_Vivo',  label: t('ops.type_lives'),     icon: '🔴' },
    { id: 'Podcasts',  label: t('ops.type_podcasts'),  icon: '🎙️' },
    { id: 'Cursos',    label: t('ops.type_courses'),   icon: '📚' },
    { id: 'Playlists', label: t('ops.type_playlists'), icon: '▶️' },
  ];

  // Canal já configurado e não é modoFila — step de URL é pulado
  const canalJaConfigurado = !!canalNome && !modoFila;

  // Sequência de steps por modo:
  //   Normal sem canal:   URL(2) → Projeto(1) → Fontes(3)  — não, ordem original: Projeto(1) → URL(2) → Fontes(3)
  //   Normal com canal:   Projeto(1) → Fontes(3)
  //   modoFila:           URL(2) → Projeto(1) → Fontes(3)
  const totalSteps = 3;

  // Step interno: 'url' | 'projeto' | 'fontes'
  // Perfil Pesquisador sempre passa por 'url' primeiro — mesmo com canal já
  // configurado — para poder ver e escolher o toggle YouTube/arXiv/FHIR.
  const stepInicial = modoFila ? 'url' : (canalJaConfigurado && !podeEscolherFonte) ? 'projeto' : 'url';
  const [step, setStep] = React.useState(stepInicial);

  // modoFila: começa vazio — nome vem do handle da URL inserida
  // Normal: pré-preenchido com canalNome do canal já configurado
  const [projetoNome,               setProjetoNome]               = React.useState(modoFila ? '' : (canalNome || ''));
  const [nomeEditadoManual,         setNomeEditadoManual]         = React.useState(!modoFila && !!canalNome);
  const [projetoExistenteSelecionado, setProjetoExistenteSelecionado] = React.useState(false);

  // Step URL: channel URL
  const [canalUrl, setCanalUrl] = React.useState('');

  // Mapa de cobertura pré-extração
  const [canalInfo,        setCanalInfo]        = React.useState(null);
  const [canalInfoLoading, setCanalInfoLoading] = React.useState(false);

  // Step fontes: content types
  const [selected, setSelected] = React.useState(ALL_TYPES.map(t => t.id));
  const allSelected = selected.length === ALL_TYPES.length;

  // Auto-update
  const [autoUpdate,        setAutoUpdate]        = React.useState(false);
  const [autoUpdateConsent, setAutoUpdateConsent] = React.useState(false);
  const [autoUpdateFreq,    setAutoUpdateFreq]    = React.useState('semanal');

  const toggle = (id) => setSelected(prev =>
    prev.includes(id)
      ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
      : [...prev, id]
  );

  // Deriva handle da URL — funciona com ou sem https://
  const extrairHandle = (url) => {
    const s = url.trim();
    // Tenta regex direto antes de usar URL parser (cobre casos sem protocolo)
    const m = s.match(/[@/]([a-zA-Z0-9_.\-]{2,100})\/?$/);
    if (m) return m[1].replace(/^@/, '');
    try {
      const u = new URL(s.startsWith('http') ? s : 'https://' + s);
      const partes = u.pathname.split('/').filter(Boolean);
      if (partes.length > 0) return partes[partes.length - 1].replace(/^@/, '');
    } catch (_) {}
    return '';
  };

  // Atualiza sugestão em tempo real conforme URL muda (só se usuário não editou manualmente)
  React.useEffect(() => {
    if (step === 'url' && !nomeEditadoManual) {
      const handle = extrairHandle(canalUrl);
      setProjetoNome(handle || '');
    }
  }, [canalUrl]);

  // Busca mapa de cobertura com debounce de 800ms quando URL parece válida
  React.useEffect(() => {
    if (step !== 'url') return;
    const url = canalUrl.trim();
    const ytRe = /^https:\/\/(www\.)?youtube\.com\/@[a-zA-Z0-9_.\-]{1,100}\/?$/;
    if (!ytRe.test(url)) { setCanalInfo(null); return; }
    setCanalInfo(null);
    setCanalInfoLoading(true);
    const timer = setTimeout(() => {
      getCanalInfo(url)
        .then(r => setCanalInfo(r.data))
        .catch(() => setCanalInfo(null))
        .finally(() => setCanalInfoLoading(false));
    }, 800);
    return () => { clearTimeout(timer); setCanalInfoLoading(false); };
  }, [canalUrl, step]);

  const avancar = () => {
    if (step === 'url') {
      if (sourceType === 'arxiv' || sourceType === 'fhir') { setStep('projeto'); return; }
      // Garante que o nome está atualizado com o handle da URL ao avançar
      if (!nomeEditadoManual) {
        const handle = extrairHandle(canalUrl);
        setProjetoNome(handle || '');
      }
      setStep('projeto');
    } else if (step === 'projeto') {
      setStep('fontes');
    }
  };

  const voltar = () => {
    if (step === 'fontes') setStep('projeto');
    else if (step === 'projeto') { if (modoFila || !canalJaConfigurado || sourceType === 'arxiv' || sourceType === 'fhir') setStep('url'); }
  };

  const handleConfirm = () => {
    const nome = projetoNome.trim() || canalNome;
    const urlChanged = !!canalUrl.trim();
    const autoUpdateConfig = autoUpdate && autoUpdateConsent
      ? { enabled: true, frequencia: autoUpdateFreq }
      : { enabled: false };
    onConfirm(selected, nome, urlChanged ? canalUrl.trim() : undefined, autoUpdateConfig);
  };

  const handleConfirmArxiv = () => {
    const nome = projetoNome.trim();
    onConfirmArxiv(arxivQuery.trim(), arxivMaxResults, nome);
  };

  const handleConfirmFhir = () => {
    const nome = projetoNome.trim();
    onConfirmFhir(fhirQuery.trim(), fhirMaxResults, nome);
  };

  const podeAvancarArxivQuery = arxivQuery.trim().length >= 2;
  const podeAvancarFhirQuery  = fhirQuery.trim().length >= 2;

  // Step visual para a barra de progresso
  // Com canal já configurado, o step 'url' só é revisitado se o Pesquisador
  // trocar para a fonte arXiv/FHIR — nesse caso a sequência volta a ter 3 passos.
  const pulaStepUrl = canalJaConfigurado && !modoFila && sourceType !== 'arxiv' && sourceType !== 'fhir';
  const stepVisualMap = modoFila
    ? { url: 1, projeto: 2, fontes: 3 }
    : pulaStepUrl
      ? { projeto: 1, fontes: 2 }
      : { url: 1, projeto: 2, fontes: 3 };
  const stepVisual = stepVisualMap[step] || 1;
  const totalStepsVisual = pulaStepUrl ? 2 : 3;

  const stepLabel = step === 'url'
    ? (sourceType === 'arxiv' ? t('extraction.arxiv_step_title') : sourceType === 'fhir' ? t('extraction.fhir_step_title') : 'Canal do YouTube')
    : step === 'projeto'
    ? 'Nome do projeto'
    : sourceType === 'arxiv' ? t('extraction.arxiv_results_title') : sourceType === 'fhir' ? t('extraction.fhir_results_title') : t('ops.types_modal_title');

  const stepSub = step === 'url'
    ? (sourceType === 'arxiv' ? t('extraction.arxiv_step_sub') : sourceType === 'fhir' ? t('extraction.fhir_step_sub') : 'Informe a URL do canal que deseja adicionar à fila.')
    : step === 'projeto'
    ? 'Dê um nome ao projeto. Pode ser o canal ou algo mais amplo.'
    : sourceType === 'arxiv' ? t('extraction.arxiv_results_sub') : sourceType === 'fhir' ? t('extraction.fhir_results_sub') : t('ops.types_modal_subtitle');

  const temVoltar = step === 'projeto' ? (modoFila || !canalJaConfigurado || sourceType === 'arxiv' || sourceType === 'fhir') : step === 'fontes';
  const podeAvancarUrl = sourceType === 'arxiv' ? podeAvancarArxivQuery : sourceType === 'fhir' ? podeAvancarFhirQuery : canalUrl.trim().length > 0;
  const podeAvancarProjeto = projetoNome.trim().length > 0;

  // Detecta se o canal já existe em algum projeto (para exibir alerta)
  const canalHandle = (canalNome || extrairHandle(canalUrl)).toLowerCase().replace(/^@/, '');
  const projetoComCanalExistente = projetos.find(p =>
    p.canais && p.canais.some(c => c.toLowerCase().replace(/^@/, '') === canalHandle)
  );

  // Chips vs select: mais de 4 projetos vira select
  const usarSelect = projetos.length > 4;

  return (
    <ModalWrapper onClose={onClose} label={stepLabel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-2xl max-w-sm w-full shadow-2xl border flex flex-col ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
        style={{ maxHeight: 'min(90vh, 680px)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {stepLabel}
            </h2>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {stepSub}
            </p>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}
            aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-5">
            {Array.from({ length: totalStepsVisual }, (_, i) => i + 1).map(n => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= stepVisual ? 'bg-primary' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`} />
            ))}
          </div>

          {/* ── Toggle de fonte — apenas perfil Pesquisador ── */}
          {podeEscolherFonte && step === 'url' && (
            <div className={`flex items-center gap-1 mb-4 p-1 rounded-xl border ${darkMode ? 'bg-white/3 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <button
                onClick={() => setSourceType('youtube')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${BTN_FOCUS}
                  ${sourceType === 'youtube' ? 'bg-primary text-white shadow-sm' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                🎬 {t('extraction.source_youtube')}
              </button>
              {podeUsarArxiv && (
                <button
                  onClick={() => setSourceType('arxiv')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${BTN_FOCUS}
                    ${sourceType === 'arxiv' ? 'bg-primary text-white shadow-sm' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Search size={12} aria-hidden="true" /> {t('extraction.source_arxiv')}
                </button>
              )}
              {podeUsarFhir && (
                <button
                  onClick={() => setSourceType('fhir')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${BTN_FOCUS}
                    ${sourceType === 'fhir' ? 'bg-primary text-white shadow-sm' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Stethoscope size={12} aria-hidden="true" /> {t('extraction.source_fhir')}
                </button>
              )}
            </div>
          )}

          {/* ── Step busca arXiv ── */}
          {step === 'url' && sourceType === 'arxiv' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.arxiv_query_label')}
                </label>
                <input
                  type="text"
                  value={arxivQuery}
                  onChange={e => setArxivQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && podeAvancarArxivQuery) avancar(); }}
                  placeholder={t('extraction.arxiv_query_placeholder')}
                  autoFocus
                  maxLength={300}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
                <p className={`text-[10px] mt-1.5 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('extraction.arxiv_query_hint')}
                </p>
              </div>
              <button
                onClick={avancar}
                disabled={!podeAvancarArxivQuery}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                Próximo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* ── Step busca FHIR (ResearchStudy) ── */}
          {step === 'url' && sourceType === 'fhir' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.fhir_query_label')}
                </label>
                <input
                  type="text"
                  value={fhirQuery}
                  onChange={e => setFhirQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && podeAvancarFhirQuery) avancar(); }}
                  placeholder={t('extraction.fhir_query_placeholder')}
                  autoFocus
                  maxLength={300}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
                <p className={`text-[10px] mt-1.5 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('extraction.fhir_query_hint')}
                </p>
              </div>
              <button
                onClick={avancar}
                disabled={!podeAvancarFhirQuery}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                Próximo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* ── Step URL (YouTube) ── */}
          {step === 'url' && sourceType === 'youtube' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  URL do canal
                </label>
                <input
                  type="url"
                  value={canalUrl}
                  onChange={e => setCanalUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && podeAvancarUrl) avancar(); }}
                  placeholder="https://www.youtube.com/@canal"
                  autoFocus
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
              </div>
              {/* Mapa de cobertura */}
              {canalInfoLoading && (
                <div className={`flex items-center gap-2 py-2 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  Verificando canal…
                </div>
              )}
              {canalInfo && !canalInfo.error && (
                <div className={`rounded-xl border p-3 mb-4 space-y-2 ${darkMode ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Visão geral do canal
                  </p>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <strong>{canalInfo.total_videos}</strong> vídeos encontrados
                    {canalInfo.views_total > 0 && <> · <strong>{(canalInfo.views_total / 1e6).toFixed(1)}M</strong> views</>}
                  </p>
                  {canalInfo.topicos?.length > 0 && (
                    <div>
                      <p className={`text-[10px] mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tópicos mais frequentes:</p>
                      <div className="flex flex-wrap gap-1">
                        {canalInfo.topicos.slice(0, 12).map(t => (
                          <span key={t.termo}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${darkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                            {t.termo} <span className={`opacity-50`}>{t.frequencia}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={avancar}
                disabled={!podeAvancarUrl}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                Próximo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* ── Step Projeto ── */}
          {step === 'projeto' && (
            <>
              <div className="mb-4 space-y-3">
                <div>
                  <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nome do projeto <span className="text-red-500" aria-label="obrigatório">*</span>
                  </label>
                  {projetoExistenteSelecionado ? (
                    /* Projeto existente selecionado — mostra card de confirmação */
                    <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        <span className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{projetoNome}</span>
                      </div>
                      <button
                        onClick={() => { setProjetoExistenteSelecionado(false); setProjetoNome(''); setNomeEditadoManual(false); }}
                        className={`text-[10px] font-semibold shrink-0 transition-colors ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'} ${BTN_FOCUS}`}>
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={projetoNome}
                        onChange={e => { setProjetoNome(e.target.value); setNomeEditadoManual(true); setProjetoExistenteSelecionado(false); }}
                        onKeyDown={e => { if (e.key === 'Enter' && podeAvancarProjeto) avancar(); }}
                        placeholder="Ex: FGV, Marketing Digital, Estudos 2026…"
                        autoFocus
                        maxLength={120}
                        className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                      />
                      {modoFila && projetoNome.trim() && !nomeEditadoManual && (
                        <p className={`text-[10px] mt-1 px-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Sugerido pela URL — edite à vontade
                        </p>
                      )}
                      {!projetoNome.trim() && (
                        <p className="text-[10px] text-red-500 mt-1 px-1">Campo obrigatório</p>
                      )}
                    </>
                  )}
                </div>

                {/* Alerta: canal já extraído anteriormente */}
                {projetoComCanalExistente && (
                  <div className={`rounded-xl p-3 border text-[10px] leading-relaxed ${darkMode ? 'bg-amber-500/8 border-amber-500/25 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <p className="font-bold mb-0.5">⚠️ Canal já extraído</p>
                    <p>
                      <strong>@{canalHandle}</strong> já está no projeto <strong>{projetoComCanalExistente.nome}</strong>.
                      Você pode adicionar ao mesmo projeto (vídeos novos serão extraídos) ou criar um projeto com outro nome.
                    </p>
                  </div>
                )}

                {/* Hint sobre estrutura de pastas — oculto quando projeto existente selecionado */}
                {!projetoExistenteSelecionado && <div className={`rounded-xl p-3 border text-[10px] leading-relaxed space-y-1 ${darkMode ? 'bg-white/3 border-white/8 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  <p className={`font-bold text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Estrutura de pastas</p>
                  <p><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>📁 {projetoNome.trim() || 'Projeto'}</span> → {sourceType === 'arxiv' ? 'documents → arXiv' : sourceType === 'fhir' ? 'documents → FHIR' : 'youtube → Canal'}</p>
                  <p className="opacity-70">O projeto agrupa canais e documentos. Um projeto pode conter vários canais.</p>
                </div>}

                {/* Projetos existentes: chips (≤4) ou select (>4) */}
                {projetos.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-bold mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Ou adicionar a um projeto existente:
                    </p>
                    {usarSelect ? (
                      <select
                        value={projetos.some(p => p.nome === projetoNome) ? projetoNome : ''}
                        onChange={e => { if (e.target.value) { setProjetoNome(e.target.value); setNomeEditadoManual(true); setProjetoExistenteSelecionado(true); } }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${BTN_FOCUS}
                          ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
                        <option value="">— selecione um projeto —</option>
                        {projetos.map(p => (
                          <option key={p.nome} value={p.nome}>{p.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {projetos.map(p => {
                          const ativo = projetoNome === p.nome;
                          return (
                            <button
                              key={p.nome}
                              onClick={() => { setProjetoNome(p.nome); setNomeEditadoManual(true); setProjetoExistenteSelecionado(true); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${BTN_FOCUS}
                                ${ativo
                                  ? 'bg-primary border-primary text-white shadow-md shadow-primary/30 scale-[1.03]'
                                  : darkMode ? 'bg-white/5 border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/8' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-primary/5'}`}>
                              {ativo && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                              {p.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {temVoltar && (
                  <button onClick={voltar}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                      ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Voltar
                  </button>
                )}
                <button
                  onClick={avancar}
                  disabled={!podeAvancarProjeto}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  Próximo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </>
          )}

          {/* ── Step Fontes (arXiv) — quantidade de resultados ── */}
          {step === 'fontes' && sourceType === 'arxiv' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.arxiv_max_results_label')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={arxivMaxResults}
                  onChange={e => setArxivMaxResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <p className={`text-[10px] mt-1.5 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('extraction.arxiv_max_results_hint')}
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={voltar}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Voltar
                </button>
                <button
                  onClick={handleConfirmArxiv}
                  className={`flex-2 flex-1 flex items-center justify-center gap-2 min-h-[48px] py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  <Search size={15} aria-hidden="true" />
                  {t('extraction.arxiv_start_confirm')}
                </button>
              </div>
            </>
          )}

          {/* ── Step Fontes (FHIR) — quantidade de resultados ── */}
          {step === 'fontes' && sourceType === 'fhir' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.fhir_max_results_label')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={fhirMaxResults}
                  onChange={e => setFhirMaxResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <p className={`text-[10px] mt-1.5 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('extraction.fhir_max_results_hint')}
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={voltar}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Voltar
                </button>
                <button
                  onClick={handleConfirmFhir}
                  className={`flex-2 flex-1 flex items-center justify-center gap-2 min-h-[48px] py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  <Stethoscope size={15} aria-hidden="true" />
                  {t('extraction.fhir_start_confirm')}
                </button>
              </div>
            </>
          )}

          {/* ── Step Fontes (YouTube) ── */}
          {step === 'fontes' && sourceType === 'youtube' && (
            <>
              {/* Select-all toggle */}
              <button
                onClick={() => setSelected(allSelected ? [ALL_TYPES[0].id] : ALL_TYPES.map(t => t.id))}
                className={`w-full text-left text-[11px] font-bold flex items-center gap-2 mb-3 px-1 transition-colors ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'} ${BTN_FOCUS}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${allSelected ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                  {allSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {t('ops.types_select_all')}
              </button>

              {/* Checkbox list */}
              <div className="space-y-1 mb-5">
                {ALL_TYPES.map(({ id, label, icon }) => {
                  const checked = selected.includes(id);
                  return (
                    <button key={id} onClick={() => toggle(id)}
                      role="checkbox" aria-checked={checked}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                        ${checked
                          ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                          : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                        ${checked ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
                      <span className={`text-xs font-semibold ${checked ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Auto-update panel ── */}
              <div className={`rounded-xl border mb-4 overflow-hidden ${darkMode ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50'}`}>
                <button
                  onClick={() => setAutoUpdate(v => !v)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${BTN_FOCUS}
                    ${autoUpdate ? darkMode ? 'bg-cyan-500/10' : 'bg-cyan-50' : ''}`}>
                  <div className={`w-8 h-4 rounded-full flex items-center shrink-0 transition-colors px-0.5
                    ${autoUpdate ? 'bg-cyan-500 justify-end' : darkMode ? 'bg-white/15 justify-start' : 'bg-slate-300 justify-start'}`}>
                    <div className="w-3 h-3 rounded-full bg-white shadow-sm transition-all" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${autoUpdate ? 'text-cyan-600' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Auto-Update — novos vídeos automaticamente
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-snug ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Verifica e indexa novos vídeos na frequência escolhida
                    </p>
                  </div>
                  <span className="text-base shrink-0" aria-hidden="true">🌐</span>
                </button>

                {autoUpdate && (
                  <div className={`px-3 pb-3 pt-2 border-t space-y-3 ${darkMode ? 'border-white/8' : 'border-slate-200'}`}>
                    <div>
                      <p className={`text-[10px] font-bold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Periodicidade da verificação</p>
                      <div className="flex gap-1.5">
                        {[
                          { id: 'ao_abrir', label: 'Ao abrir' },
                          { id: 'diario',   label: 'Diária'   },
                          { id: 'semanal',  label: 'Semanal'  },
                          { id: 'mensal',   label: 'Mensal'   },
                        ].map(f => (
                          <button key={f.id} onClick={() => setAutoUpdateFreq(f.id)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${BTN_FOCUS}
                              ${autoUpdateFreq === f.id
                                ? 'bg-cyan-500 border-cyan-500 text-white'
                                : darkMode ? 'border-white/15 text-slate-300 hover:border-cyan-500/40' : 'border-slate-200 text-slate-500 hover:border-cyan-400'}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setAutoUpdateConsent(v => !v)}
                      className={`w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-2 transition-colors border ${BTN_FOCUS}
                        ${autoUpdateConsent
                          ? darkMode ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'
                          : darkMode ? 'border-white/8 hover:border-white/20' : 'border-slate-100 hover:border-slate-300'}`}>
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                        ${autoUpdateConsent ? 'bg-cyan-500 border-cyan-500' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                        {autoUpdateConsent && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      <p className={`text-[10px] leading-relaxed ${autoUpdateConsent ? darkMode ? 'text-cyan-300' : 'text-cyan-700' : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Entendo que o Tusab vai se conectar à internet <strong>apenas para verificar se há vídeos novos</strong>. Nenhum dado pessoal é transmitido. As transcrições continuam sendo processadas localmente.
                      </p>
                    </button>

                    {!autoUpdateConsent && (
                      <p className={`text-[10px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Marque o consentimento acima para ativar a busca automática.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex gap-2">
                <button onClick={voltar}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-2 flex-1 flex items-center justify-center gap-2 min-h-[48px] py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  <Zap size={15} aria-hidden="true" />
                  {t('ops.start_confirm')}
                </button>
              </div>
            </>
          )}

        </div>{/* fim scroll */}
      </motion.div>
    </ModalWrapper>
  );
}

export default ExtractionModal;

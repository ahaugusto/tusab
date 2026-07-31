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
import { X, Zap, Loader2, Search } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';
import CanalUrlSearchInput from './CanalUrlSearchInput';
import { getCanalInfo, criarProjeto } from '../../services/api';

/**
 * ExtractionModal — always starts with project name.
 * Step 1: Project name (pre-filled from channel handle, editable)
 * Step 2: Channel URL (skipped when channel already configured and not modoFila) — ou busca em fonte pública (perfil Pesquisador)
 * Step 3: Content types + auto-update — ou quantidade de resultados (fonte pública)
 */
function ExtractionModal({ onClose, onConfirm, onConfirmFonte, darkMode, canalNome = '', canalUrlInicial = '', projetos = [], modoFila = false, perfil = '', regras = {}, sourceTypeInicial = '', areasFontes = {}, areaSelecionada = '' }) {
  const { t } = useTranslation();

  // Toggle de fonte — gated em regras.fontes_publicas (não em perfil
  // diretamente), pra uma única flag em usePerfil.js controlar a visibilidade
  // em todo o app. Busca em fontes públicas por área de conhecimento —
  // registro genérico em tusab_engine/motor/fontes/, 9 áreas de domínio +
  // "Buscadores gerais" pros multidisciplinares (arXiv, OpenAlex, DataCite,
  // DOAJ, Zenodo — arXiv originalmente inspirado no projeto open-source
  // OpenScience/synthetic-sciences; hoje compartilhado com o futuro vertical
  // Tusab Saúde, não exclusivo dele — ver agents/_historia.md).
  const podeUsarFontesPublicas = !!regras.fontes_publicas && !modoFila;
  const podeEscolherFonte = podeUsarFontesPublicas;
  // sourceTypeInicial: quando o usuário já escolheu a fonte na tela principal
  // da aba Extração (seletor visível pro perfil Pesquisador), o modal abre já
  // na fonte certa em vez de forçar escolher de novo aqui dentro.
  const [sourceType, setSourceType] = React.useState(sourceTypeInicial || 'youtube'); // 'youtube' | 'fonte-publica'

  // areasFontes/areaSelecionada vêm de App.jsx (carregados e escolhidos já na
  // aba Extração, antes do modal abrir) — aqui só resta escolher a fonte
  // dentro da área já definida.
  const [fonteSelecionada, setFonteSelecionada] = React.useState(areasFontes[areaSelecionada]?.fontes[0]?.id || '');
  React.useEffect(() => {
    const fontes = areasFontes[areaSelecionada]?.fontes || [];
    if (!fontes.some(f => f.id === fonteSelecionada)) setFonteSelecionada(fontes[0]?.id || '');
  }, [areaSelecionada, areasFontes]);
  const fonteAtual = areasFontes[areaSelecionada]?.fontes.find(f => f.id === fonteSelecionada) || null;

  // Step fonte pública: query de busca + quantidade de resultados + filtros
  // opcionais (autor/data) — só exibidos se a fonte escolhida os suportar
  // (FONTE_META.suporta_autor/suporta_data).
  const [fonteQuery,      setFonteQuery]      = React.useState('');
  const [fonteMaxResults, setFonteMaxResults] = React.useState(20);
  const [fonteDataInicio, setFonteDataInicio] = React.useState('');
  const [fonteDataFim,    setFonteDataFim]    = React.useState('');
  const [fonteAutor,      setFonteAutor]      = React.useState('');

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
  // Perfil Pesquisador só é forçado a passar por 'url' quando o toggle
  // YouTube/Base pública realmente vai aparecer ali (sourceTypeInicial vazio,
  // ou seja, o modal abriu "cru"). Quando a fonte já veio pré-escolhida da
  // aba (sourceTypeInicial preenchido) e o canal já está confirmado, pular
  // direto pra 'projeto' como qualquer outro perfil — repetir a verificação
  // do canal aqui não tem mais função, já que o toggle está escondido.
  const stepInicial = modoFila
    ? 'url'
    : (canalJaConfigurado && (!podeEscolherFonte || sourceTypeInicial))
      ? 'projeto'
      : 'url';
  const [step, setStep] = React.useState(stepInicial);

  // modoFila: começa vazio — nome vem do handle da URL inserida
  // Normal: pré-preenchido com canalNome do canal já configurado
  const [projetoNome,               setProjetoNome]               = React.useState(modoFila ? '' : (canalNome || ''));
  const [nomeEditadoManual,         setNomeEditadoManual]         = React.useState(!modoFila && !!canalNome);
  const [projetoExistenteSelecionado, setProjetoExistenteSelecionado] = React.useState(false);

  // Step URL: channel URL
  const [canalUrl, setCanalUrl] = React.useState(canalUrlInicial);
  // Nome real do canal quando escolhido via busca por nome — extrairHandle()
  // só consegue extrair algo legível de URLs com @handle; pra URLs
  // /channel/UC... (canais sem handle público) o "handle" derivado seria o
  // ID cru. { url, nome } comparado por igualdade de URL pra não vazar pra
  // uma URL diferente que o usuário digite depois.
  const [nomeConhecidoPara, setNomeConhecidoPara] = React.useState(null);

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
      const nome = (nomeConhecidoPara && nomeConhecidoPara.url === canalUrl) ? nomeConhecidoPara.nome : extrairHandle(canalUrl);
      setProjetoNome(nome || '');
    }
  }, [canalUrl, nomeConhecidoPara]);

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
      if (sourceType === 'fonte-publica') { setStep('projeto'); return; }
      // Garante que o nome está atualizado com o handle da URL ao avançar
      if (!nomeEditadoManual) {
        const nome = (nomeConhecidoPara && nomeConhecidoPara.url === canalUrl) ? nomeConhecidoPara.nome : extrairHandle(canalUrl);
        setProjetoNome(nome || '');
      }
      setStep('projeto');
    } else if (step === 'projeto') {
      setStep('fontes');
    }
  };

  const voltar = () => {
    if (step === 'fontes') setStep('projeto');
    else if (step === 'projeto') { if (modoFila || !canalJaConfigurado || sourceType === 'fonte-publica') setStep('url'); }
  };

  const handleConfirm = () => {
    const nome = projetoNome.trim() || canalNome;
    const urlChanged = !!canalUrl.trim();
    const autoUpdateConfig = autoUpdate && autoUpdateConsent
      ? { enabled: true, frequencia: autoUpdateFreq }
      : { enabled: false };
    onConfirm(selected, nome, urlChanged ? canalUrl.trim() : undefined, autoUpdateConfig);
  };

  // /fontes/{id}/search exige que o projeto já exista em disco (mesmo
  // contrato de /neural/upload) e recusa criar sozinho — diferente do fluxo
  // YouTube, onde o motor cria a pasta como efeito colateral da extração.
  // Sem chamar /neural/projeto antes, a busca falhava com "Projeto não
  // encontrado" e o usuário ficava travado sem next-step.
  const [criandoProjetoBusca, setCriandoProjetoBusca] = React.useState(false);
  const [erroProjetoBusca,    setErroProjetoBusca]    = React.useState('');

  const handleConfirmFontePublica = async () => {
    const nome = projetoNome.trim();
    setErroProjetoBusca('');
    setCriandoProjetoBusca(true);
    try {
      const res = await criarProjeto(nome);
      if (res.data?.error) { setErroProjetoBusca(res.data.message || 'Erro ao criar projeto'); return; }
      onConfirmFonte(fonteSelecionada, fonteQuery.trim(), fonteMaxResults, nome, fonteDataInicio, fonteDataFim, fonteAutor.trim());
    } catch {
      setErroProjetoBusca('Não foi possível criar o projeto. Tente novamente.');
    } finally {
      setCriandoProjetoBusca(false);
    }
  };

  const podeAvancarFonteQuery = fonteQuery.trim().length >= 2 && !!fonteSelecionada;

  // Step visual para a barra de progresso
  // Com canal já configurado, o step 'url' só é revisitado se o Pesquisador
  // trocar pra uma fonte pública — nesse caso a sequência volta a ter 3 passos.
  const pulaStepUrl = canalJaConfigurado && !modoFila && sourceType !== 'fonte-publica';
  const stepVisualMap = modoFila
    ? { url: 1, projeto: 2, fontes: 3 }
    : pulaStepUrl
      ? { projeto: 1, fontes: 2 }
      : { url: 1, projeto: 2, fontes: 3 };
  const stepVisual = stepVisualMap[step] || 1;
  const totalStepsVisual = pulaStepUrl ? 2 : 3;

  const stepLabel = step === 'url'
    ? (sourceType === 'fonte-publica' ? (fonteAtual ? t('extraction.public_search_in', { nome: fonteAtual.nome }) : t('extraction.public_search_title')) : t('extraction.youtube_channel_title'))
    : step === 'projeto'
    ? t('extraction.project_name_label')
    : sourceType === 'fonte-publica' ? t('extraction.fonte_results_title') : t('ops.types_modal_title');

  const stepSub = step === 'url'
    ? (sourceType === 'fonte-publica' ? (areaSelecionada ? t(`extraction.area_${areaSelecionada}`, areasFontes[areaSelecionada]?.nome || '') : '') : t('extraction.enter_channel_url_subtitle'))
    : step === 'projeto'
    ? t('extraction.project_name_subtitle')
    : sourceType === 'fonte-publica' ? t('extraction.results_how_many', { nome: fonteAtual?.nome || t('extraction.fonte_label') }) : t('ops.types_modal_subtitle');

  const temVoltar = step === 'projeto' ? (modoFila || !canalJaConfigurado || sourceType === 'fonte-publica') : step === 'fontes';
  const podeAvancarUrl = sourceType === 'fonte-publica' ? podeAvancarFonteQuery : canalUrl.trim().length > 0;
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
            aria-label={t('extraction.close_aria')}>
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

          {/* ── Toggle de fonte — apenas perfil Pesquisador, e só quando o modal
              abre "cru" (sem fonte pré-escolhida na tela anterior). Quando
              sourceTypeInicial vem preenchido, a escolha já foi feita na aba —
              repetir o toggle aqui era redundante e confuso (mesma estrutura
              em dois lugares). */}
          {podeEscolherFonte && step === 'url' && !sourceTypeInicial && (
            <div className={`flex items-center gap-1 mb-4 p-1 rounded-xl border ${darkMode ? 'bg-white/3 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <button
                onClick={() => setSourceType('youtube')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${BTN_FOCUS}
                  ${sourceType === 'youtube' ? 'bg-primary text-white shadow-sm' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                🎬 {t('extraction.source_youtube')}
              </button>
              {podeUsarFontesPublicas && (
                <button
                  onClick={() => setSourceType('fonte-publica')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${BTN_FOCUS}
                    ${sourceType === 'fonte-publica' ? 'bg-primary text-white shadow-sm' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Search size={12} aria-hidden="true" /> {t('extraction.source_public')}
                </button>
              )}
            </div>
          )}

          {/* ── Step busca em fonte pública (fonte → tema + filtros) — a área já
              foi escolhida na aba Extração, antes de abrir o modal ── */}
          {step === 'url' && sourceType === 'fonte-publica' && (
            <>
              <div className="mb-4">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.fonte_label')}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(areasFontes[areaSelecionada]?.fontes || []).map(f => {
                    const ativo = f.id === fonteSelecionada;
                    return (
                      <button key={f.id} onClick={() => setFonteSelecionada(f.id)}
                        className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${BTN_FOCUS}
                          ${ativo
                            ? darkMode ? 'bg-primary/15 border-primary text-white' : 'bg-primary/5 border-primary text-slate-800'
                            : darkMode ? 'bg-white/3 border-white/10 text-slate-300 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <span className={`text-[11px] font-bold block ${ativo ? 'text-primary' : ''}`}>{f.nome}</span>
                        <span className="text-[10px] leading-snug block mt-0.5 opacity-70">{f.descricao}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.fonte_query_label')}
                </label>
                <input
                  type="text"
                  value={fonteQuery}
                  onChange={e => setFonteQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && podeAvancarFonteQuery) avancar(); }}
                  placeholder={t('extraction.fonte_query_placeholder')}
                  autoFocus
                  maxLength={300}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
              </div>

              {fonteAtual?.suporta_autor && (
                <div className="mb-4">
                  <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('extraction.fonte_autor_label')}
                  </label>
                  <input
                    type="text"
                    value={fonteAutor}
                    onChange={e => setFonteAutor(e.target.value)}
                    placeholder={t('extraction.fonte_autor_placeholder')}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                  />
                </div>
              )}

              {fonteAtual?.suporta_data && (
                <div className="mb-4">
                  <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('extraction.date_filter_label')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={fonteDataInicio}
                      onChange={e => setFonteDataInicio(e.target.value)}
                      max={fonteDataFim || undefined}
                      style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className={`text-[11px] shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('extraction.fonte_date_to')}</span>
                    <input
                      type="date"
                      value={fonteDataFim}
                      onChange={e => setFonteDataFim(e.target.value)}
                      min={fonteDataInicio || undefined}
                      style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={avancar}
                disabled={!podeAvancarFonteQuery}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                {t('extraction.next')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* ── Step URL (YouTube) ── */}
          {step === 'url' && sourceType === 'youtube' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.channel_url_label')}
                </label>
                <CanalUrlSearchInput
                  darkMode={darkMode}
                  value={canalUrl}
                  onChange={setCanalUrl}
                  onSelectCanal={canal => setNomeConhecidoPara({ url: canal.url, nome: canal.nome })}
                  onEnter={() => podeAvancarUrl && avancar()}
                  placeholder="https://www.youtube.com/@canal"
                  inputSize={13}
                  autoFocus
                />
              </div>
              {/* Mapa de cobertura */}
              {canalInfoLoading && (
                <div className={`flex items-center gap-2 py-2 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  {t('extraction.checking_channel')}
                </div>
              )}
              {canalInfo && !canalInfo.error && (
                <div className={`rounded-xl border p-3 mb-4 space-y-2 ${darkMode ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('extraction.channel_overview')}
                  </p>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <strong>{t('extraction.videos_found', { count: canalInfo.total_videos })}</strong>
                    {canalInfo.views_total > 0 && <> · <strong>{(canalInfo.views_total / 1e6).toFixed(1)}M</strong> views</>}
                  </p>
                  {canalInfo.topicos?.length > 0 && (
                    <div>
                      <p className={`text-[10px] mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('extraction.top_topics')}</p>
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
                {t('extraction.next')}
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
                    {t('extraction.project_name_label')} <span className="text-red-500" aria-label={t('extraction.required_field')}>*</span>
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
                        {t('extraction.switch_project')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={projetoNome}
                        onChange={e => { setProjetoNome(e.target.value); setNomeEditadoManual(true); setProjetoExistenteSelecionado(false); }}
                        onKeyDown={e => { if (e.key === 'Enter' && podeAvancarProjeto) avancar(); }}
                        placeholder={t('extraction.project_name_placeholder')}
                        autoFocus
                        maxLength={120}
                        className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                      />
                      {modoFila && projetoNome.trim() && !nomeEditadoManual && (
                        <p className={`text-[10px] mt-1 px-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {t('extraction.project_name_suggested')}
                        </p>
                      )}
                      {!projetoNome.trim() && (
                        <p className="text-[10px] text-red-500 mt-1 px-1">{t('extraction.required_field')}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Alerta: canal já extraído anteriormente */}
                {projetoComCanalExistente && (
                  <div className={`rounded-xl p-3 border text-[10px] leading-relaxed ${darkMode ? 'bg-amber-500/8 border-amber-500/25 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <p className="font-bold mb-0.5">{t('extraction.channel_already_extracted_title')}</p>
                    <p>
                      {t('extraction.channel_already_extracted_body', { handle: canalHandle, projeto: projetoComCanalExistente.nome })}
                    </p>
                  </div>
                )}

                {/* Hint sobre estrutura de pastas — oculto quando projeto existente selecionado */}
                {!projetoExistenteSelecionado && <div className={`rounded-xl p-3 border text-[10px] leading-relaxed space-y-1 ${darkMode ? 'bg-white/3 border-white/8 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  <p className={`font-bold text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('extraction.folder_structure_title')}</p>
                  <p><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>📁 {projetoNome.trim() || t('header.channel')}</span> → {sourceType === 'fonte-publica' ? `documents → ${fonteAtual?.nome || t('extraction.fonte_label')}` : `youtube → ${t('extraction.youtube_channel_title')}`}</p>
                  <p className="opacity-70">{t('extraction.folder_structure_hint')}</p>
                </div>}

                {/* Projetos existentes: chips (≤4) ou select (>4) */}
                {projetos.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-bold mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('extraction.add_to_existing_project')}
                    </p>
                    {usarSelect ? (
                      <select
                        value={projetos.some(p => p.nome === projetoNome) ? projetoNome : ''}
                        onChange={e => { if (e.target.value) { setProjetoNome(e.target.value); setNomeEditadoManual(true); setProjetoExistenteSelecionado(true); } }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${BTN_FOCUS}
                          ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
                        <option value="" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{t('extraction.select_project_placeholder')}</option>
                        {projetos.map(p => (
                          <option key={p.nome} value={p.nome} className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{p.nome}</option>
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
                    {t('extraction.back')}
                  </button>
                )}
                <button
                  onClick={avancar}
                  disabled={!podeAvancarProjeto}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  {t('extraction.next')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </>
          )}

          {/* ── Step Fontes (fonte pública) — quantidade de resultados ── */}
          {step === 'fontes' && sourceType === 'fonte-publica' && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('extraction.results_count_label')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={fonteMaxResults}
                  onChange={e => setFonteMaxResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <p className={`text-[10px] mt-1.5 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('extraction.results_count_hint')}
                </p>
              </div>

              {erroProjetoBusca && (
                <p role="alert" className="text-[11px] text-danger mb-3">{erroProjetoBusca}</p>
              )}
              <div className="flex gap-2">
                <button onClick={voltar} disabled={criandoProjetoBusca}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {t('extraction.back')}
                </button>
                <button
                  onClick={handleConfirmFontePublica} disabled={criandoProjetoBusca}
                  className={`flex-2 flex-1 flex items-center justify-center gap-2 min-h-[48px] py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  {criandoProjetoBusca ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
                  {t('extraction.fonte_start_confirm')}
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
                      {t('extraction.autoupdate_title')}
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-snug ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('extraction.autoupdate_subtitle')}
                    </p>
                  </div>
                  <span className="text-base shrink-0" aria-hidden="true">🌐</span>
                </button>

                {autoUpdate && (
                  <div className={`px-3 pb-3 pt-2 border-t space-y-3 ${darkMode ? 'border-white/8' : 'border-slate-200'}`}>
                    <div>
                      <p className={`text-[10px] font-bold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t('extraction.autoupdate_frequency_label')}</p>
                      <div className="flex gap-1.5">
                        {[
                          { id: 'ao_abrir', label: t('extraction.freq_on_open') },
                          { id: 'diario',   label: t('extraction.freq_daily')   },
                          { id: 'semanal',  label: t('extraction.freq_weekly')  },
                          { id: 'mensal',   label: t('extraction.freq_monthly') },
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
                        {t('extraction.autoupdate_consent')}
                      </p>
                    </button>

                    {!autoUpdateConsent && (
                      <p className={`text-[10px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('extraction.autoupdate_consent_hint')}
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
                  {t('extraction.back')}
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

/**
 * @file ExtractionModal.jsx
 * @description Three-step extraction modal: (1) project name, (2) channel URL (when needed), (3) content types
 * @module components/extraction/ExtractionModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';

/**
 * ExtractionModal — always starts with project name.
 * Step 1: Project name (pre-filled from channel handle, editable)
 * Step 2: Channel URL (skipped when channel already configured and not modoFila)
 * Step 3: Content types + auto-update
 */
function ExtractionModal({ onClose, onConfirm, darkMode, canalNome = '', canalUrlInicial = '', projetos = [], modoFila = false }) {
  const { t } = useTranslation();

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

  // Steps: 1=Projeto, 2=URL (se necessário), 3=Fontes
  const totalSteps = canalJaConfigurado ? 2 : 3;

  // modoFila começa no step 2 (URL) — projeto é preenchido depois com handle da URL
  const [step, setStep] = React.useState(modoFila ? 2 : 1);

  // Step 1: project name — pré-preenchido com handle do canal
  const [projetoNome,       setProjetoNome]       = React.useState(canalNome || '');
  const [nomeEditadoManual, setNomeEditadoManual] = React.useState(!!canalNome);

  // Step 2: channel URL
  const [canalUrl, setCanalUrl] = React.useState('');

  // Step 3: content types
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

  // Deriva handle da URL para pré-preencher projeto
  const extrairHandle = (url) => {
    try {
      const u = new URL(url.trim());
      const partes = u.pathname.split('/').filter(Boolean);
      if (partes.length > 0) return partes[partes.length - 1].replace(/^@/, '');
    } catch (_) {}
    return '';
  };

  const avancar = () => {
    if (step === 1) {
      setStep(canalJaConfigurado ? 3 : 2);
    } else if (step === 2) {
      // Pré-preenche nome do projeto com handle da URL se usuário não editou
      if (!nomeEditadoManual && canalUrl.trim()) {
        const handle = extrairHandle(canalUrl);
        if (handle) setProjetoNome(handle);
      }
      setStep(3);
    }
  };

  const voltar = () => {
    if (step === 3) setStep(canalJaConfigurado ? 1 : 2);
    else if (step === 2) setStep(1);
  };

  const handleConfirm = () => {
    const nome = projetoNome.trim() || canalNome;
    const urlChanged = !!canalUrl.trim();
    const autoUpdateConfig = autoUpdate && autoUpdateConsent
      ? { enabled: true, frequencia: autoUpdateFreq }
      : { enabled: false };
    onConfirm(selected, nome, urlChanged ? canalUrl.trim() : undefined, autoUpdateConfig);
  };

  // Step visual para a barra de progresso
  const stepVisual = step === 1 ? 1 : step === 2 ? 2 : totalSteps;

  const stepLabel = step === 1
    ? 'Nome do projeto'
    : step === 2
    ? 'Canal do YouTube'
    : t('ops.types_modal_title');

  const stepSub = step === 1
    ? 'Dê um nome ao projeto. Pode ser o canal ou algo mais amplo.'
    : step === 2
    ? 'Informe a URL do canal que deseja extrair.'
    : t('ops.types_modal_subtitle');

  const temVoltar = step > 1;
  const podeAvancar1 = projetoNome.trim().length > 0;
  const podeAvancar2 = canalUrl.trim().length > 0;

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
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= stepVisual ? 'bg-primary' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`} />
            ))}
          </div>

          {/* ── Step 1: Nome do projeto ── */}
          {step === 1 && (
            <>
              <div className="mb-4 space-y-3">
                <div>
                  <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nome do projeto <span className="text-red-500" aria-label="obrigatório">*</span>
                  </label>
                  <input
                    type="text"
                    value={projetoNome}
                    onChange={e => { setProjetoNome(e.target.value); setNomeEditadoManual(true); }}
                    placeholder="Ex: FGV, Marketing Digital, Estudos 2026…"
                    autoFocus
                    maxLength={120}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                  />
                  {!projetoNome.trim() && (
                    <p className="text-[10px] text-red-500 mt-1 px-1">Campo obrigatório</p>
                  )}
                </div>

                {/* Hint sobre estrutura de pastas */}
                <div className={`rounded-xl p-3 border text-[10px] leading-relaxed space-y-1 ${darkMode ? 'bg-white/3 border-white/8 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  <p className={`font-bold text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Estrutura de pastas</p>
                  <p><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>📁 {projetoNome.trim() || 'Projeto'}</span> → youtube → Canal</p>
                  <p className="opacity-70">O projeto agrupa canais e documentos. Um projeto pode conter vários canais.</p>
                </div>

                {/* Projetos existentes como sugestão */}
                {projetos.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-bold mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Ou adicionar a um projeto existente:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {projetos.map(p => (
                        <button
                          key={p.nome}
                          onClick={() => { setProjetoNome(p.nome); setNomeEditadoManual(true); }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${BTN_FOCUS}
                            ${projetoNome === p.nome
                              ? 'bg-primary/15 border-primary/30 text-primary'
                              : darkMode ? 'bg-white/5 border-white/15 text-slate-300 hover:border-white/30' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                          {p.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={avancar}
                disabled={!podeAvancar1}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                Próximo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* ── Step 2: Canal URL ── */}
          {step === 2 && (
            <>
              <div className="mb-5">
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  URL do canal
                </label>
                <input
                  type="url"
                  value={canalUrl}
                  onChange={e => setCanalUrl(e.target.value)}
                  placeholder="https://www.youtube.com/@canal"
                  autoFocus
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
                {canalUrlInicial && (
                  <p className={`text-[10px] mt-1.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Canal atual: <span className={`font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{canalUrlInicial}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={voltar}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Voltar
                </button>
                <button
                  onClick={avancar}
                  disabled={!podeAvancar2}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
                  Próximo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Content types ── */}
          {step === 3 && (
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

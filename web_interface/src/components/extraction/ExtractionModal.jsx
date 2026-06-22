/**
 * @file ExtractionModal.jsx
 * @description Three-step extraction modal: (1) channel URL, (2) project, (3) content types
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

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ExtractionModal — adaptive modal: 2 steps (URL → Fontes) for normal extraction,
 * 3 steps (URL → Projeto → Fontes) when queuing or changing channel.
 *
 * @param {Object}   props
 * @param {Function} props.onClose           - callback to dismiss the modal without confirming
 * @param {Function} props.onConfirm         - callback(fontes: string[], projetoNome: string, canalUrl?: string)
 * @param {boolean}  props.darkMode          - dark/light theme flag
 * @param {string}   props.canalNome         - name of the configured channel (pre-fills project)
 * @param {string}   props.canalUrlInicial   - URL already configured (pre-fills step 1 input)
 * @param {Array}    props.projetos          - existing projects array [{ nome, tipo }]
 * @param {boolean}  props.modoFila          - true = enqueue mode, shows project step
 * @returns {JSX.Element}
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

  // Steps: 1=URL, 2=Projeto (só no modoFila), 3=Fontes
  // Sempre começa no step 1 — usuário deve confirmar o canal antes de extrair.
  const totalSteps = modoFila ? 3 : 2;
  const [step, setStep] = React.useState(1);

  // Step 1: channel URL — começa vazio, sem pré-preenchimento
  const [canalUrl, setCanalUrl] = React.useState('');

  // Step 2 (modoFila): project selection
  // Pré-seleciona o projeto do canal atual se existir na lista
  const projetoExistente = projetos.find(p => p.nome === canalNome);
  const [projetoSel,  setProjetoSel]  = React.useState(projetoExistente ? canalNome : '');
  const [novoNome,    setNovoNome]    = React.useState(canalNome || '');
  const [criandoNovo, setCriandoNovo] = React.useState(!projetoExistente);
  // Controla se o handle da URL já foi pré-preenchido (evita sobrescrever edição manual)
  const [handlePreenchido, setHandlePreenchido] = React.useState(!!canalNome);

  // Step fontes
  const [selected, setSelected] = React.useState(ALL_TYPES.map(t => t.id));
  const allSelected = selected.length === ALL_TYPES.length;

  // Auto-update
  const [autoUpdate,          setAutoUpdate]          = React.useState(false);
  const [autoUpdateConsent,   setAutoUpdateConsent]   = React.useState(false);
  const [autoUpdateFreq,      setAutoUpdateFreq]      = React.useState('semanal'); // 'diario' | 'semanal' | 'mensal'

  const toggle = (id) => setSelected(prev =>
    prev.includes(id)
      ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
      : [...prev, id]
  );

  // Deriva handle do canal a partir da URL (ex: "@FGV", "FGV")
  const extrairHandleUrl = (url) => {
    try {
      const u = new URL(url.trim());
      const partes = u.pathname.split('/').filter(Boolean);
      if (partes.length > 0) return partes[partes.length - 1].replace(/^@/, '');
    } catch (_) {}
    return '';
  };

  // Avança para a próxima etapa (pula projeto se não for modoFila)
  const avancar = () => {
    if (step === 1) {
      // Pré-preenche o nome do projeto com o handle da URL, mas apenas se o usuário
      // ainda não editou manualmente o campo (handlePreenchido === false)
      if (!handlePreenchido) {
        const handle = extrairHandleUrl(canalUrl);
        if (handle) {
          setNovoNome(handle);
          setHandlePreenchido(true);
        }
      }
      setStep(modoFila ? 2 : 3);
    } else if (step === 2) { setStep(3); }
  };
  const voltar = () => {
    if (step === 3) { setStep(modoFila ? 2 : 1); }
    else if (step === 2) { setStep(1); }
  };

  const handleConfirm = () => {
    const nome = modoFila
      ? (criandoNovo ? novoNome.trim() : projetoSel.trim())
      : canalNome; // sem fila: usa o canal configurado como projeto
    const urlChanged = !!canalUrl.trim();
    const autoUpdateConfig = autoUpdate && autoUpdateConsent
      ? { enabled: true, frequencia: autoUpdateFreq }
      : { enabled: false };
    onConfirm(selected, nome, urlChanged ? canalUrl.trim() : undefined, autoUpdateConfig);
  };

  const temVoltar = step !== 1;
  const stepVisual = step === 1 ? 1 : step === 2 ? 2 : totalSteps;
  const stepLabel = step === 1
    ? 'Canal do YouTube'
    : step === 2
    ? 'Salvar em qual projeto?'
    : t('ops.types_modal_title');
  const stepSub = step === 1
    ? 'Informe a URL do canal que deseja extrair.'
    : step === 2
    ? 'Escolha um projeto existente ou crie um novo.'
    : t('ops.types_modal_subtitle');

  return (
    <ModalWrapper onClose={onClose} label={stepLabel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-2xl max-w-sm w-full shadow-2xl border flex flex-col ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
        style={{ maxHeight: 'min(90vh, 680px)' }}
      >
        {/* Header — fixo */}
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

        {/* ── Step 1: Canal URL ── */}
        {step === 1 && (
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
            <button
              onClick={avancar}
              disabled={!canalUrl.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
              Próximo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </>
        )}

        {/* ── Step 2: Project selection ── */}
        {step === 2 && (
          <>
            <div className="space-y-1.5 mb-4">
              {/* Option: new project */}
              <button
                onClick={() => setCriandoNovo(true)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                  ${criandoNovo
                    ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                    : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors
                  ${criandoNovo ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                  {criandoNovo && <span className="w-2 h-2 rounded-full bg-white block" />}
                </div>
                <span className="text-lg leading-none shrink-0">✨</span>
                <span className={`text-sm font-semibold ${criandoNovo ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Novo projeto</span>
              </button>

              {criandoNovo && (
                <div>
                  <label className={`text-[10px] font-bold block mb-1 px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nome do projeto <span className="text-red-500" aria-label="obrigatório">*</span>
                  </label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={e => {
                      setNovoNome(e.target.value);
                      // Marca que o usuário editou manualmente — não sobrescrever mais
                      setHandlePreenchido(true);
                    }}
                    placeholder="Nome do projeto (obrigatório)"
                    autoFocus
                    className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`}
                  />
                  {!novoNome.trim() && (
                    <p className="text-[10px] text-red-500 mt-1 px-1">Campo obrigatório</p>
                  )}
                </div>
              )}

              {/* Existing projects */}
              {projetos.map(p => (
                <button
                  key={p.nome}
                  onClick={() => { setCriandoNovo(false); setProjetoSel(p.nome); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                    ${!criandoNovo && projetoSel === p.nome
                      ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                      : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors
                    ${!criandoNovo && projetoSel === p.nome ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                    {!criandoNovo && projetoSel === p.nome && <span className="w-2 h-2 rounded-full bg-white block" />}
                  </div>
                  <span className="text-lg leading-none shrink-0">{p.tipo === 'youtube' ? '📺' : '📁'}</span>
                  <span className={`text-sm font-semibold truncate ${!criandoNovo && projetoSel === p.nome ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {p.tipo === 'youtube' ? `@${p.nome}` : p.nome}
                  </span>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <button onClick={voltar}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Voltar
              </button>
              <button
                onClick={avancar}
                disabled={criandoNovo ? !novoNome.trim() : !projetoSel.trim()}
                className={`flex-2 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
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
              {/* Toggle row */}
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

              {/* Expanded config — shown when toggle is on */}
              {autoUpdate && (
                <div className={`px-3 pb-3 pt-2 border-t space-y-3 ${darkMode ? 'border-white/8' : 'border-slate-200'}`}>

                  {/* Frequency selector — always visible when toggle is on */}
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

                  {/* Consent checkbox — required to confirm */}
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
              {temVoltar && (
                <button onClick={voltar}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Voltar
                </button>
              )}
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

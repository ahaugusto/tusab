/**
 * @file ConfigurarIAModal.jsx
 * @description Modal mínimo de configuração do motor de IA — para perfis sem aba Agente
 *   (estudante, professor). Oferece duas opções: Ollama local ou chave de API externa.
 *   Não expõe configurações avançadas (personas, num_ctx, etc.) — só o essencial para o chat funcionar.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';

const PROVIDERS = [
  { id: 'gemini',    label: 'Google Gemini',    keyUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'openai',    label: 'OpenAI',           keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic Claude', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'groq',      label: 'Groq (gratuito)',  keyUrl: 'https://console.groq.com/keys' },
];

function ConfigurarIAModal({
  darkMode,
  ollamaStatus,
  agentProvider,
  agentApiKey,
  useExternalProvider,
  setUseExternalProvider,
  setAgentProvider,
  setAgentApiKey,
  handleTestKey,
  testKeyResult,
  testingKey,
  savingConfig,
  handleSaveConfig,
  onClose,
}) {
  const { t } = useTranslation();
  const [localProvider, setLocalProvider] = React.useState(agentProvider || 'gemini');
  const [localKey,      setLocalKey]      = React.useState(agentApiKey || '');
  const [modoExterno,   setModoExterno]   = React.useState(useExternalProvider || false);
  const [showKey,       setShowKey]       = React.useState(false);
  const [salvando,      setSalvando]      = React.useState(false);
  const [salvoOk,       setSalvoOk]       = React.useState(false);

  const ollamaOk = !!ollamaStatus?.running;

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (modoExterno) {
        setUseExternalProvider(true);
        setAgentProvider(localProvider);
        setAgentApiKey(localKey);
        await handleSaveConfig({ provider: localProvider, api_key: localKey });
      } else {
        setUseExternalProvider(false);
        setAgentProvider('ollama');
        setAgentApiKey('');
        await handleSaveConfig({ provider: 'ollama', api_key: '' });
      }
      setSalvoOk(true);
      setTimeout(() => { setSalvoOk(false); onClose(); }, 900);
    } catch { /* ignore */ }
    setSalvando(false);
  };

  const providerSel = PROVIDERS.find(p => p.id === localProvider) || PROVIDERS[0];

  const card = (active, onClick, children) => (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all ${
        active
          ? darkMode ? 'border-primary/60 bg-primary/10' : 'border-violet-400 bg-violet-50'
          : darkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
      }`}>
      {children}
    </button>
  );

  const labelCls = `text-[11px] font-bold block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`;
  const inputCls = `w-full px-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
    darkMode
      ? 'bg-white/5 border-white/15 text-white placeholder-slate-600 focus:border-primary/60'
      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-300 focus:border-violet-400'
  }`;

  return createPortal(
    <ModalWrapper darkMode={darkMode} onClose={onClose} maxWidth="max-w-sm">
      <div className="p-5 space-y-4">
        <div>
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {t('ia_modal.title')}
          </h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('ia_modal.subtitle')}
          </p>
        </div>

        {/* Opção 1 — Ollama local */}
        {card(!modoExterno, () => setModoExterno(false),
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              !modoExterno
                ? 'border-primary bg-primary'
                : darkMode ? 'border-white/30' : 'border-slate-300'
            }`}>
              {!modoExterno && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {t('ia_modal.ollama_label')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  ollamaOk
                    ? 'bg-green-500/15 text-green-400'
                    : darkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'
                }`}>
                  {ollamaOk ? t('ia_modal.ollama_running') : t('ia_modal.ollama_offline')}
                </span>
              </div>
              <p className={`text-[11px] mt-1 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('ia_modal.ollama_desc')}
              </p>
              {!ollamaOk && (
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:underline">
                  {t('ia_modal.ollama_install')}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Opção 2 — Provedor externo */}
        {card(modoExterno, () => setModoExterno(true),
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              modoExterno
                ? 'border-primary bg-primary'
                : darkMode ? 'border-white/30' : 'border-slate-300'
            }`}>
              {modoExterno && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {t('ia_modal.external_label')}
              </span>
              <p className={`text-[11px] mt-1 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('ia_modal.external_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Sub-campos do provedor externo */}
        {modoExterno && (
          <div className="space-y-3 pl-1">
            <div>
              <label className={labelCls}>{t('ia_modal.provider_label')}</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setLocalProvider(p.id)}
                    className={`text-[11px] font-bold px-3 py-2 rounded-xl border transition-colors text-left ${
                      localProvider === p.id
                        ? darkMode ? 'bg-primary/20 border-primary/50 text-white' : 'bg-violet-100 border-violet-400 text-violet-700'
                        : darkMode ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>{t('ia_modal.key_label')}</label>
                <a
                  href={providerSel.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  {t('ia_modal.get_key')}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={localKey}
                  onChange={e => setLocalKey(e.target.value)}
                  placeholder="sk-..."
                  className={inputCls}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                  {showKey ? '●●●' : 'abc'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
              darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || (modoExterno && !localKey.trim())}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 bg-primary text-white hover:bg-primary/85">
            {salvoOk ? '✓ ' + t('ia_modal.saved') : salvando ? t('ia_modal.saving') : t('ia_modal.save')}
          </button>
        </div>
      </div>
    </ModalWrapper>,
    document.body
  );
}

export default ConfigurarIAModal;

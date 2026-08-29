/**
 * @file OllamaSetup.jsx
 * @description Ollama local model status card with download, refresh and advanced model selector
 * @module components/assistente/OllamaSetup
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RefreshCw, ChevronDown, Settings2, ExternalLink, Info, Loader2, AlertTriangle, Trash2, Brain } from 'lucide-react';
import { fetchOllamaStatus, pullOllamaModel, deleteOllamaModel } from '../../services/api';

// Modelos principais — exibidos no onboarding (isStandby=false) e na lista expandida
// desc é uma i18n key (extraction.*/ollama.*) resolvida em render, não texto solto
const MODELOS_PRINCIPAIS = [
  ['llama3.2:1b',    'Llama 3.2 1B',    '~1.3 GB', 'ollama.model_llama32_1b_desc'],
  ['llama3.2:3b',    'Llama 3.2 3B',    '~2.0 GB', 'ollama.model_llama32_3b_desc'],
  ['gemma3:4b',      'Gemma 3 4B',      '~3.3 GB', 'ollama.model_gemma3_4b_desc'],
];

// Modelos com "thinking" nativo (qwen3, deepseek-r1) — desde que o backend
// passou a mandar think:false em toda chamada /api/generate (chat.py,
// summarize.py, router_estudo.py, scheduler.py), o modelo não gasta tokens
// raciocinando e não vaza <think> na resposta. Sem filtro por tamanho: a
// escolha de baixar ou não é do usuário, não nossa — só listamos as opções.
const MODELOS_EXTRAS = [
  ['gemma3:1b',        'Gemma 3 1B',        '~815 MB', 'ollama.model_gemma3_1b_desc'],
  ['phi4-mini:3.8b',   'Phi-4 Mini 3.8B',   '~2.5 GB', 'ollama.model_phi4_mini_desc'],
  ['qwen3:4b',         'Qwen 3 4B',         '~2.5 GB', 'ollama.model_qwen3_4b_desc'],
  ['mistral:7b',       'Mistral 7B',        '~4.1 GB', 'ollama.model_mistral7b_desc'],
  ['llama3.1:8b',      'Llama 3.1 8B',      '~4.7 GB', 'ollama.model_llama31_8b_desc'],
  ['qwen2.5:7b',       'Qwen 2.5 7B',       '~4.7 GB', 'ollama.model_qwen25_7b_desc'],
  ['deepseek-r1:8b',   'DeepSeek-R1 8B',    '~4.9 GB', 'ollama.model_deepseek_r1_8b_desc'],
  ['qwen3:8b',         'Qwen 3 8B',         '~5.2 GB', 'ollama.model_qwen3_8b_desc'],
  ['mistral-nemo:12b', 'Mistral Nemo 12B',  '~7.1 GB', 'ollama.model_mistral_nemo12b_desc'],
  ['gemma3:12b',       'Gemma 3 12B',       '~8.1 GB', 'ollama.model_gemma3_12b_desc'],
  ['qwen2.5:14b',      'Qwen 2.5 14B',      '~9.0 GB', 'ollama.model_qwen25_14b_desc'],
  ['deepseek-r1:14b',  'DeepSeek-R1 14B',   '~9.0 GB', 'ollama.model_deepseek_r1_14b_desc'],
  ['phi4:14b',         'Phi-4 14B',         '~9.1 GB', 'ollama.model_phi4_14b_desc'],
  ['qwen3:14b',        'Qwen 3 14B',        '~9.3 GB', 'ollama.model_qwen3_14b_desc'],
  ['gemma3:27b',       'Gemma 3 27B',       '~17 GB',  'ollama.model_gemma3_27b_desc'],
  ['llama3.3:70b',     'Llama 3.3 70B',     '~43 GB',  'ollama.model_llama33_70b_desc'],
];

// Lista completa para uso na aba Agente (isStandby=true) — exibe todos
const MODELOS_SUGERIDOS = [...MODELOS_PRINCIPAIS, ...MODELOS_EXTRAS];

// Modelos com thinking nativo — mesmo critério do comentário acima (qwen3,
// deepseek-r1). Usado pra mostrar o toggle "Mostrar raciocínio" direto no
// card do modelo, já que em qualquer outro modelo o toggle não teria efeito.
function isModeloThinking(id) {
  return id.startsWith('qwen3:') || id.startsWith('deepseek-r1:');
}

function formatarTempo(segundos) {
  if (segundos < 60) return `~${Math.ceil(segundos)}s`;
  const min = Math.ceil(segundos / 60);
  return `~${min} min`;
}

function OllamaSetup({
  darkMode,
  ollamaStatus, setOllamaStatus,
  btnFocus,
  ollamaModel, onModelChange,
  isStandby = false,
  // Estado de download — controlado pelo AgentTab para persistir entre trocas de aba
  pullProgress, pulling, pullingModel, pullStartTime,
  onBaixarModelo,
  mostrarRaciocinio, onToggleMostrarRaciocinio,
  // Tailwind lg:/sm: reagem à largura da JANELA, não do container — num modal
  // estreito (ex.: Onboarding, max-w-md) 3 colunas ficariam espremidas mesmo
  // com a janela larga. Cada chamador decide quantas colunas cabem no seu
  // próprio espaço; 3 é o padrão (painel largo da aba Configurações).
  maxCols = 3,
}) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [refreshing,   setRefreshing]   = React.useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = React.useState(null); // id do modelo pendente de confirmação
  const [excluindoModelo,   setExcluindoModelo]   = React.useState(null); // id do modelo sendo excluído agora

  // preload.js expõe process.platform via window.tusab.platform — usado só
  // pra decidir o link/rótulo de download do Ollama (instalador difere por SO).
  const isMac = window.tusab?.platform === 'darwin';

  // Tempo restante estimado — calculado localmente a partir dos props (ephemeral, não precisa persistir)
  const [tempoRestante, setTempoRestante] = React.useState(null);

  const hasModel  = ollamaStatus.models && ollamaStatus.models.length > 0;
  const modelName = (ollamaStatus.running && hasModel)
    ? (ollamaModel && ollamaStatus.models.includes(ollamaModel) ? ollamaModel : ollamaStatus.models[0])
    : null;

  const refresh = async () => {
    setRefreshing(true);
    try { const r = await fetchOllamaStatus(); setOllamaStatus(r.data); } catch {}
    setRefreshing(false);
  };

  React.useEffect(() => { refresh(); }, []);

  // Estima tempo restante durante download
  React.useEffect(() => {
    if (!pullingModel || !pullProgress || pullProgress.pct <= 0 || !pullStartTime) {
      setTempoRestante(null);
      return;
    }
    const elapsed = (Date.now() - pullStartTime) / 1000;
    const pct = pullProgress.pct;
    if (pct < 2) { setTempoRestante(null); return; }
    const totalEstimado = elapsed / (pct / 100);
    const restante = totalEstimado - elapsed;
    setTempoRestante(restante > 5 ? restante : null);
  }, [pullProgress, pullStartTime, pullingModel]);

  const handleExcluirModelo = async (id) => {
    setExcluindoModelo(id);
    try {
      await deleteOllamaModel(id);
      await refresh();
    } finally {
      setExcluindoModelo(null);
      setConfirmarExclusao(null);
    }
  };

  const startPull = async () => {
    if (onBaixarModelo) {
      onBaixarModelo('llama3.2:1b');
    } else {
      await pullOllamaModel().catch(() => {});
    }
  };

  const cardBg = ollamaStatus.running
    ? (darkMode ? 'bg-secondary/5 border-secondary/20'   : 'bg-emerald-50 border-emerald-200')
    : (darkMode ? 'bg-amber-500/5 border-amber-500/20'   : 'bg-amber-50 border-amber-200');

  const jaConfigurado = ollamaStatus.running && hasModel;

  return (
    <div className="space-y-3">

      {/* Bloco explicativo — só quando Ollama não está pronto */}
      {!jaConfigurado && (
        <div className={`rounded-xl p-3.5 border flex gap-2.5 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Info size={13} className={`shrink-0 mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <div className="space-y-1.5 min-w-0">
            <p className={`text-[11px] font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('ollama.explainer_title')}</p>
            <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('ollama.explainer_body')}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              <a href="https://ollama.com" target="_blank" rel="noreferrer"
                className={`flex items-center gap-1 text-[10px] font-medium underline underline-offset-2 ${darkMode ? 'text-primary/80 hover:text-primary' : 'text-violet-600 hover:text-violet-800'}`}>
                ollama.com <ExternalLink size={9} />
              </a>
              <a href="https://github.com/ollama/ollama" target="_blank" rel="noreferrer"
                className={`flex items-center gap-1 text-[10px] font-medium underline underline-offset-2 ${darkMode ? 'text-primary/80 hover:text-primary' : 'text-violet-600 hover:text-violet-800'}`}>
                GitHub <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Card de status */}
      <div className={`rounded-xl p-4 space-y-3 border ${cardBg}`}>
        <div className="flex items-center gap-2">
          {ollamaStatus.running ? (
            <div className={`w-2 h-2 rounded-full shrink-0 ${isStandby ? 'bg-slate-400' : 'bg-secondary animate-pulse'}`} />
          ) : (
            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
          )}
          <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {ollamaStatus.running
              ? isStandby ? t('ollama.status_standby') : t('ollama.status_active')
              : t('ollama.status_not_detected')}
          </span>
          {ollamaStatus.running && isStandby && (
            <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('ollama.standby_hint')}
            </span>
          )}
        </div>

        {!ollamaStatus.running && (
          <div className="space-y-2.5">
            <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-amber-300/80' : 'text-amber-800'}`}>
              {t('ollama.not_found_body')}
            </p>
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('ollama.not_found_hint')}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={isMac ? 'https://ollama.com/download/mac' : 'https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe'}
                target="_blank" rel="noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors
                  ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>
                {isMac ? t('ollama.download_mac') : t('ollama.download_win')}
              </a>
              <button onClick={refresh} disabled={refreshing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors disabled:opacity-60
                  ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? t('ollama.checking') : t('ollama.already_installed')}
              </button>
            </div>
          </div>
        )}

        {ollamaStatus.running && !hasModel && !pulling && (
          <div className="space-y-2">
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('ollama.no_model_body')}
            </p>
            <div className="flex gap-2">
              <button onClick={startPull}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 focus:ring-2 focus:ring-primary focus:ring-offset-0 ${btnFocus}`}>
                {t('ollama.download_default_model')}
              </button>
              <button onClick={refresh} title={t('ollama.check_again_title')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        )}

        {pulling && pullProgress && (
          <div className="space-y-1">
            <div className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-white/10' : 'bg-emerald-200'}`}>
              <div className="h-1.5 rounded-full bg-secondary transition-all duration-300" style={{ width: `${pullProgress.pct}%` }} />
            </div>
            <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{pullProgress.message}</p>
          </div>
        )}

        {ollamaStatus.running && hasModel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-[11px] font-medium text-secondary`}>
                <CheckCircle2 size={13} />
                {t('ollama.ready_prefix')}<span className="font-mono">{modelName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  title={t('ollama.switch_model_title')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <Settings2 size={10} />
                  {t('ollama.switch_model_btn')}
                  <ChevronDown size={10} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={refresh} disabled={refreshing} title={t('ollama.refresh_models_title')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-60
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? t('ollama.refreshing') : t('common.refresh')}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className={`rounded-lg p-3 space-y-1.5 border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                <label className={`block text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t('ollama.active_model_label')}</label>
                <select
                  value={modelName}
                  onChange={e => onModelChange && onModelChange(e.target.value)}
                  className={`w-full text-[11px] rounded-lg px-2 py-1.5 border font-mono outline-none ${darkMode ? 'bg-[#1a2035] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                  {ollamaStatus.models.map(m => (
                    <option key={m} value={m} className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de modelos sugeridos */}
      {(!jaConfigurado || showAdvanced) && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('ollama.available_models_title')}
          </p>
          <a href="https://ollama.com/library" target="_blank" rel="noreferrer"
            className={`flex items-center gap-0.5 text-[9px] underline underline-offset-2 ${darkMode ? 'text-primary/70 hover:text-primary' : 'text-violet-500 hover:text-violet-700'}`}>
            {t('ollama.view_all')} <ExternalLink size={8} />
          </a>
        </div>

        <div className={`grid grid-cols-1 ${maxCols >= 2 ? 'sm:grid-cols-2' : ''} ${maxCols >= 3 ? 'lg:grid-cols-3' : ''} gap-2`}>
          {/* isStandby (Ollama não é o provedor ativo) OU showAdvanced (usuário
              pediu pra expandir "Trocar modelo") — os dois sinalizam "quero ver
              mais opções", não só o primeiro. Sem showAdvanced aqui, quem já usa
              Ollama nunca via os modelos extras mesmo expandindo a seção. */}
          {(isStandby || showAdvanced ? MODELOS_SUGERIDOS : MODELOS_PRINCIPAIS).map(([id, label, size, desc]) => {
            const instalado    = ollamaStatus.running && ollamaStatus.models?.includes(id);
            const baixandoEste = pullingModel === id;
            const isAtivo      = ollamaStatus.running && modelName === id && instalado;
            const thinking     = isModeloThinking(id);
            return (
              <div key={id} className={`flex flex-col gap-2 p-2.5 rounded-lg border transition-colors
                ${darkMode ? 'bg-white/3 border-white/8 hover:border-white/15' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{label}</span>
                    <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{size}</span>
                    {instalado && !isAtivo && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>{t('ollama.badge_installed')}</span>
                    )}
                    {isAtivo && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${darkMode ? 'bg-secondary/30 text-secondary' : 'bg-emerald-200 text-emerald-800'}`}>{t('ollama.badge_active')}</span>
                    )}
                  </div>
                  <p className={`text-[9px] mt-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{t(desc)}</p>
                </div>

                {thinking && onToggleMostrarRaciocinio && (
                  <button
                    onClick={() => instalado && onToggleMostrarRaciocinio()}
                    disabled={!instalado}
                    title={instalado ? t('ollama.thinking_toggle_title') : t('ollama.thinking_toggle_disabled_title')}
                    className={`flex items-center justify-between gap-2 px-1.5 py-1 -mx-1.5 rounded transition-colors disabled:cursor-not-allowed
                      ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                    <span className={`flex items-center gap-1 text-[9px] font-semibold
                      ${instalado ? darkMode ? 'text-slate-300' : 'text-slate-600' : darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      <Brain size={10} />
                      {t('ollama.thinking_toggle_label')}
                    </span>
                    <span className={`w-6 h-3.5 rounded-full flex items-center shrink-0 transition-colors px-0.5
                      ${instalado && mostrarRaciocinio
                        ? 'bg-primary justify-end'
                        : `justify-start ${darkMode ? 'bg-white/15' : 'bg-slate-300'} ${!instalado ? 'opacity-40' : ''}`}`}>
                      <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all" />
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-end gap-1.5 mt-auto">
                  {!instalado ? (
                    <button
                      disabled={!!pullingModel || !ollamaStatus.running}
                      onClick={() => onBaixarModelo && onBaixarModelo(id)}
                      title={!ollamaStatus.running ? t('ollama.install_required_title') : undefined}
                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-colors disabled:opacity-40 focus:ring-2 focus:ring-primary focus:ring-offset-0
                        ${baixandoEste
                          ? darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700 border border-violet-300'
                          : darkMode ? 'bg-primary/15 text-primary hover:bg-primary/25' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
                      {baixandoEste
                        ? <><Loader2 size={9} className="animate-spin" /> {pullProgress?.pct > 0 ? `${pullProgress.pct}%` : t('ollama.downloading_ellipsis')}</>
                        : <>{t('ollama.download_btn')}</>}
                    </button>
                  ) : confirmarExclusao === id ? (
                    <div className="shrink-0 flex items-center gap-1">
                      <span className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('ollama.delete_confirm_short')}</span>
                      <button
                        onClick={() => handleExcluirModelo(id)}
                        disabled={excluindoModelo === id}
                        className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold transition-colors disabled:opacity-50 focus:ring-2 focus:ring-primary focus:ring-offset-0
                          ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                        {excluindoModelo === id ? <Loader2 size={9} className="animate-spin" /> : t('ollama.delete_confirm_yes')}
                      </button>
                      <button
                        onClick={() => setConfirmarExclusao(null)}
                        disabled={excluindoModelo === id}
                        className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold transition-colors disabled:opacity-50 focus:ring-2 focus:ring-primary focus:ring-offset-0
                          ${darkMode ? 'bg-white/8 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {t('ollama.delete_confirm_no')}
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => !isAtivo && onModelChange && onModelChange(id)}
                        disabled={isAtivo}
                        className={`shrink-0 text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:cursor-default focus:ring-2 focus:ring-primary focus:ring-offset-0
                          ${isAtivo
                            ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
                            : darkMode
                              ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
                              : 'bg-primary-button text-white border border-primary-button shadow-sm hover:bg-primary-button/90'}`}>
                        {isAtivo ? t('ollama.badge_active_full') : t('ollama.use_btn')}
                      </button>
                      <button
                        onClick={() => setConfirmarExclusao(id)}
                        title={t('ollama.delete_model_title')}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-0
                          ${darkMode ? 'text-slate-500 hover:text-danger hover:bg-danger/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progresso de download com tempo estimado */}
        {pullingModel && pullProgress && pullProgress.status === 'pulling' && (
          <div className={`rounded-lg p-3 space-y-2 border ${darkMode ? 'bg-primary/8 border-primary/20' : 'bg-violet-50 border-violet-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold ${darkMode ? 'text-primary' : 'text-violet-700'}`}>
                {t('ollama.downloading_model', { model: pullingModel })}
              </span>
              <span className={`text-[10px] font-mono ${darkMode ? 'text-primary' : 'text-violet-600'}`}>
                {pullProgress.pct}%
              </span>
            </div>
            <div className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-white/10' : 'bg-violet-200'}`}>
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pullProgress.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              {pullProgress.message && (
                <p className={`text-[9px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {pullProgress.message}
                </p>
              )}
              {tempoRestante && (
                <p className={`text-[9px] shrink-0 ml-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('ollama.time_remaining_suffix', { time: formatarTempo(tempoRestante) })}
                </p>
              )}
            </div>
            <p className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('ollama.large_model_hint')}
            </p>
          </div>
        )}
        {pullingModel && pullProgress?.status === 'done' && (
          <p className={`text-[10px] font-bold text-center ${darkMode ? 'text-secondary' : 'text-emerald-600'}`}>
            {t('ollama.install_success', { model: pullingModel })}
          </p>
        )}
        {pullingModel && pullProgress?.status === 'error' && (
          <p className={`text-[10px] font-bold text-center text-red-500`}>
            {t('ollama.error_prefix', { message: pullProgress.message })}
          </p>
        )}
      </div>
      )}

    </div>
  );
}

export default OllamaSetup;

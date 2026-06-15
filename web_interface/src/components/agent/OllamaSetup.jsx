/**
 * @file OllamaSetup.jsx
 * @description Ollama local model status card with download, refresh and advanced model selector
 * @module components/agent/OllamaSetup
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { CheckCircle2, RefreshCw, ChevronDown, Settings2, ExternalLink, Info } from 'lucide-react';
import { fetchOllamaStatus, pullOllamaModel, fetchOllamaPullProgress } from '../../services/api';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * OllamaSetup — shows Ollama daemon status, model download controls,
 * and an advanced settings panel for switching between installed models.
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode        - dark/light theme flag
 * @param {Object}   props.ollamaStatus    - current Ollama status { running, models }
 * @param {Function} props.setOllamaStatus - state setter for ollamaStatus
 * @param {string}   props.btnFocus        - Tailwind focus-visible ring classes
 * @param {string}   props.ollamaModel     - currently selected model name from config
 * @param {Function} props.onModelChange   - callback when user selects a different model
 * @returns {JSX.Element}
 */
function OllamaSetup({ darkMode, ollamaStatus, setOllamaStatus, btnFocus, ollamaModel, onModelChange }) {
  const [pullProgress,  setPullProgress]  = React.useState(null);
  const [pulling,       setPulling]       = React.useState(false);
  const [showAdvanced,  setShowAdvanced]  = React.useState(false);

  const hasModel  = ollamaStatus.models && ollamaStatus.models.length > 0;
  const modelName = ollamaModel || (hasModel ? ollamaStatus.models[0] : 'llama3.2:1b');

  /** Refreshes Ollama status from backend */
  const refresh = () =>
    fetchOllamaStatus().then(r => setOllamaStatus(r.data)).catch(() => {});

  React.useEffect(() => { refresh(); }, []);

  /** Polls pull progress every 800ms while a download is in progress */
  React.useEffect(() => {
    if (!pulling) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetchOllamaPullProgress();
        setPullProgress(r.data);
        if (r.data.status === 'done' || r.data.status === 'error') {
          setPulling(false);
          const s = await fetchOllamaStatus();
          setOllamaStatus(s.data);
        }
      } catch {}
    }, 800);
    return () => clearInterval(iv);
  }, [pulling]);

  /** Initiates model download via backend */
  const startPull = async () => {
    setPulling(true);
    setPullProgress({ status: 'pulling', pct: 0, message: 'Iniciando...' });
    await pullOllamaModel().catch(() => {});
  };

  return (
    <div className="space-y-3">

      {/* What is Ollama — hint */}
      <div className={`rounded-xl p-3.5 border flex gap-2.5 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
        <Info size={13} className={`shrink-0 mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <div className="space-y-1.5 min-w-0">
          <p className={`text-[11px] font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>O que é o Ollama?</p>
          <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            O <strong className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Ollama</strong> é um serviço que roda modelos de IA diretamente no seu computador — sem internet, sem custo por uso e sem enviar dados para servidores externos. É a forma recomendada de usar o Brain'IAC.
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
            <a href="https://ollama.com/library" target="_blank" rel="noreferrer"
              className={`flex items-center gap-1 text-[10px] font-medium underline underline-offset-2 ${darkMode ? 'text-primary/80 hover:text-primary' : 'text-violet-600 hover:text-violet-800'}`}>
              Biblioteca de modelos <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>

    <div className={`rounded-xl p-4 space-y-3 border ${darkMode ? 'bg-secondary/5 border-secondary/20' : 'bg-emerald-50 border-emerald-200'}`}>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${ollamaStatus.running ? 'bg-secondary animate-pulse' : 'bg-slate-400'}`} />
        <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {ollamaStatus.running ? 'Ollama ativo' : 'Ollama não detectado'}
        </span>
      </div>

      {!ollamaStatus.running && (
        <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          O Ollama será iniciado automaticamente pelo app. Se não iniciar, instale em{' '}
          <a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">ollama.com</a>.
        </p>
      )}

      {/* Download prompt when running but no model */}
      {ollamaStatus.running && !hasModel && !pulling && (
        <div className="space-y-2">
          <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Nenhum modelo detectado. Baixe o <strong>llama3.2:1b</strong> (~1.3 GB) ou verifique se ja instalou.
          </p>
          <div className="flex gap-2">
            <button onClick={startPull}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-secondary/20 text-secondary hover:bg-secondary/30 ${btnFocus}`}>
              Baixar Modelo
            </button>
            <button onClick={refresh} title="Verificar novamente"
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Pull progress bar */}
      {pulling && pullProgress && (
        <div className="space-y-1">
          <div className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-white/10' : 'bg-emerald-200'}`}>
            <div className="h-1.5 rounded-full bg-secondary transition-all duration-300" style={{ width: `${pullProgress.pct}%` }} />
          </div>
          <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{pullProgress.message}</p>
        </div>
      )}

      {/* Ready state */}
      {ollamaStatus.running && hasModel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 text-[11px] font-medium text-secondary`}>
              <CheckCircle2 size={13} />
              Pronto: <span className="font-mono">{modelName}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                title="Configurações avançadas"
                className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                <Settings2 size={10} />
                <ChevronDown size={10} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={refresh} title="Atualizar"
                className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                <RefreshCw size={11} />
              </button>
            </div>
          </div>

          {/* Advanced settings panel */}
          {showAdvanced && (
            <div className={`rounded-lg p-3 space-y-2 border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Configurações Avançadas
              </p>
              <div className="space-y-1.5">
                <label className={`block text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Modelo ativo
                </label>
                <select
                  value={modelName}
                  onChange={e => onModelChange && onModelChange(e.target.value)}
                  className={`w-full text-[11px] rounded-lg px-2 py-1.5 border font-mono outline-none ${darkMode ? 'bg-white/8 border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                  {ollamaStatus.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Para adicionar modelos, execute no terminal:{' '}
                  <span className="font-mono">ollama pull nome-do-modelo</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

export default OllamaSetup;

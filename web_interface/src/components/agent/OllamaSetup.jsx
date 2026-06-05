/**
 * @file OllamaSetup.jsx
 * @description Ollama local model status card with download and refresh controls
 * @module components/agent/OllamaSetup
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { fetchOllamaStatus, pullOllamaModel, fetchOllamaPullProgress } from '../../services/api';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * OllamaSetup — shows Ollama daemon status and lets the user download the default model
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode       - dark/light theme flag
 * @param {Object}   props.ollamaStatus   - current Ollama status { running, models }
 * @param {Function} props.setOllamaStatus - state setter for ollamaStatus
 * @param {string}   props.btnFocus       - Tailwind focus-visible ring classes
 * @returns {JSX.Element}
 */
function OllamaSetup({ darkMode, ollamaStatus, setOllamaStatus, btnFocus }) {
  const [pullProgress, setPullProgress] = React.useState(null);
  const [pulling, setPulling]           = React.useState(false);

  const hasModel  = ollamaStatus.models && ollamaStatus.models.length > 0;
  const modelName = hasModel ? ollamaStatus.models[0] : 'llama3.2:1b';

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

      {/* Ready state */}
      {ollamaStatus.running && hasModel && (
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-[11px] font-medium text-secondary`}>
            <CheckCircle2 size={13} /> Pronto: <span className="font-mono">{modelName}</span>
          </div>
          <button onClick={refresh} title="Atualizar"
            className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <RefreshCw size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export default OllamaSetup;

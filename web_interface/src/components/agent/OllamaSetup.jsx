/**
 * @file OllamaSetup.jsx
 * @description Ollama local model status card with download, refresh and advanced model selector
 * @module components/agent/OllamaSetup
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { CheckCircle2, RefreshCw, ChevronDown, Settings2, ExternalLink, Info, Loader2, AlertTriangle } from 'lucide-react';
import { fetchOllamaStatus, pullOllamaModel, fetchOllamaPullProgress } from '../../services/api';

// Modelos sugeridos: [id, label, tamanho, descrição curta]
const MODELOS_SUGERIDOS = [
  ['llama3.2:1b',    'Llama 3.2 1B',    '~1.3 GB', 'Rápido, leve, ideal para PCs modestos'],
  ['llama3.2:3b',    'Llama 3.2 3B',    '~2.0 GB', 'Bom equilíbrio velocidade/qualidade'],
  ['gemma3:4b',      'Gemma 3 4B',      '~3.3 GB', 'Google, ótimo em português'],
  ['llama3.1:8b',    'Llama 3.1 8B',    '~4.7 GB', 'Qualidade superior, requer 8 GB RAM'],
  ['qwen2.5:7b',     'Qwen 2.5 7B',     '~4.7 GB', 'Alibaba, multilíngue, muito capaz'],
  ['mistral:7b',     'Mistral 7B',      '~4.1 GB', 'Rápido e preciso para RAG'],
  ['phi4-mini:3.8b', 'Phi-4 Mini 3.8B', '~2.5 GB', 'Microsoft, eficiente em raciocínio'],
  ['gemma3:12b',     'Gemma 3 12B',     '~8.1 GB', 'Google, alta qualidade, 16 GB RAM'],
];

// Tamanhos aproximados em GB para estimar tempo restante
const TAMANHOS_GB = {
  'llama3.2:1b': 1.3, 'llama3.2:3b': 2.0, 'gemma3:4b': 3.3,
  'llama3.1:8b': 4.7, 'qwen2.5:7b': 4.7, 'mistral:7b': 4.1,
  'phi4-mini:3.8b': 2.5, 'gemma3:12b': 8.1,
};

function formatarTempo(segundos) {
  if (segundos < 60) return `~${Math.ceil(segundos)}s`;
  const min = Math.ceil(segundos / 60);
  return `~${min} min`;
}

function OllamaSetup({ darkMode, ollamaStatus, setOllamaStatus, btnFocus, ollamaModel, onModelChange, isStandby = false }) {
  const [pullProgress,  setPullProgress]  = React.useState(null);
  const [pulling,       setPulling]       = React.useState(false);
  const [showAdvanced,  setShowAdvanced]  = React.useState(false);
  const [pullingModel,  setPullingModel]  = React.useState(null);
  const [refreshing,    setRefreshing]    = React.useState(false);
  const [pullStartTime, setPullStartTime] = React.useState(null);
  const [tempoRestante, setTempoRestante] = React.useState(null);

  const hasModel  = ollamaStatus.models && ollamaStatus.models.length > 0;
  // Só usa modelo padrão se Ollama estiver rodando — evita chip "ativo" falso
  const modelName = ollamaStatus.running
    ? (ollamaModel || (hasModel ? ollamaStatus.models[0] : 'llama3.2:1b'))
    : null;

  const refresh = async () => {
    setRefreshing(true);
    try { const r = await fetchOllamaStatus(); setOllamaStatus(r.data); } catch {}
    setRefreshing(false);
  };

  React.useEffect(() => { refresh(); }, []);

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

  const startPull = async () => {
    setPulling(true);
    setPullProgress({ status: 'pulling', pct: 0, message: 'Iniciando...' });
    await pullOllamaModel().catch(() => {});
  };

  const handleBaixar = async (id) => {
    setPullingModel(id);
    setPullStartTime(Date.now());
    setTempoRestante(null);
    setPullProgress({ status: 'pulling', pct: 0, message: 'Iniciando download...', model: id });

    // Verifica se Ollama está rodando antes de tentar baixar
    const status = await fetchOllamaStatus().catch(() => null);
    if (!status?.data?.running) {
      setPullProgress({ status: 'error', pct: 0, message: 'Ollama não está rodando. Instale em ollama.com e tente novamente.', model: id });
      setTimeout(() => { setPullingModel(null); setPullProgress(null); }, 5000);
      return;
    }

    try {
      await pullOllamaModel(id);
    } catch {
      setPullProgress({ status: 'error', pct: 0, message: 'Erro ao iniciar download.', model: id });
      setTimeout(() => { setPullingModel(null); setPullProgress(null); }, 3000);
      return;
    }
    const iv = setInterval(async () => {
      try {
        const r = await fetchOllamaPullProgress();
        const p = r.data;
        setPullProgress(p);
        if (p.status === 'done' || p.status === 'error') {
          clearInterval(iv);
          setTempoRestante(null);
          const s = await fetchOllamaStatus().catch(() => null);
          if (s?.data) setOllamaStatus(s.data);
          setTimeout(async () => {
            const s2 = await fetchOllamaStatus().catch(() => null);
            if (s2?.data) setOllamaStatus(s2.data);
            setPullingModel(null);
            setPullProgress(null);
            setPullStartTime(null);
          }, 3000);
        }
      } catch {}
    }, 800);
    setTimeout(() => { clearInterval(iv); setPullingModel(null); setPullProgress(null); }, 900000);
  };

  // Cores do card de status: verde se ativo, amarelo se não detectado
  const cardBg     = ollamaStatus.running
    ? (darkMode ? 'bg-secondary/5 border-secondary/20'   : 'bg-emerald-50 border-emerald-200')
    : (darkMode ? 'bg-amber-500/5 border-amber-500/20'   : 'bg-amber-50 border-amber-200');

  return (
    <div className="space-y-3">

      {/* O que é o Ollama */}
      <div className={`rounded-xl p-3.5 border flex gap-2.5 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
        <Info size={13} className={`shrink-0 mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <div className="space-y-1.5 min-w-0">
          <p className={`text-[11px] font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>O que é o Ollama?</p>
          <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            O <strong className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Ollama</strong> roda modelos de IA direto no seu computador — sem internet, sem custo e sem enviar dados para servidores externos.
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

      {/* Card de status do Ollama */}
      <div className={`rounded-xl p-4 space-y-3 border ${cardBg}`}>

        {/* Indicador de status */}
        <div className="flex items-center gap-2">
          {ollamaStatus.running ? (
            <div className={`w-2 h-2 rounded-full shrink-0 ${isStandby ? 'bg-slate-400' : 'bg-secondary animate-pulse'}`} />
          ) : (
            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
          )}
          <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {ollamaStatus.running
              ? isStandby ? 'Ollama em standby' : 'Ollama ativo'
              : 'Ollama não detectado'}
          </span>
          {ollamaStatus.running && isStandby && (
            <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              — provedor externo ativo
            </span>
          )}
        </div>

        {/* Ollama não detectado — alerta com instrução clara */}
        {!ollamaStatus.running && (
          <div className="space-y-2.5">
            <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-amber-300/80' : 'text-amber-800'}`}>
              O Ollama não foi encontrado neste computador. Ele é necessário para rodar modelos de IA localmente.
            </p>
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Após instalar, reabra o Tusab. Alternativamente, use uma chave de API externa abaixo.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe"
                target="_blank" rel="noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors
                  ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>
                ↓ Baixar Ollama (.exe)
              </a>
              <button onClick={refresh} disabled={refreshing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors disabled:opacity-60
                  ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Verificando…' : 'Já instalei'}
              </button>
            </div>
          </div>
        )}

        {ollamaStatus.running && !hasModel && !pulling && (
          <div className="space-y-2">
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Nenhum modelo detectado. Baixe o <strong>llama3.2:1b</strong> (~1.3 GB) para começar.
            </p>
            <div className="flex gap-2">
              <button onClick={startPull}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-secondary/20 text-secondary hover:bg-secondary/30 ${btnFocus}`}>
                Baixar llama3.2:1b
              </button>
              <button onClick={refresh} title="Verificar novamente"
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
                Pronto: <span className="font-mono">{modelName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  title="Trocar modelo ativo"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <Settings2 size={10} />
                  Trocar modelo
                  <ChevronDown size={10} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={refresh} disabled={refreshing} title="Atualizar lista de modelos"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-60
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Atualizando…' : 'Atualizar'}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className={`rounded-lg p-3 space-y-1.5 border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                <label className={`block text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Modelo ativo</label>
                <select
                  value={modelName}
                  onChange={e => onModelChange && onModelChange(e.target.value)}
                  style={darkMode ? { colorScheme: 'dark' } : {}}
                  className={`w-full text-[11px] rounded-lg px-2 py-1.5 border font-mono outline-none ${darkMode ? 'bg-[#1a2035] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                  {ollamaStatus.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>{/* fim card status */}

      {/* Lista de modelos sugeridos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Modelos disponíveis
          </p>
          <a href="https://ollama.com/library" target="_blank" rel="noreferrer"
            className={`flex items-center gap-0.5 text-[9px] underline underline-offset-2 ${darkMode ? 'text-primary/70 hover:text-primary' : 'text-violet-500 hover:text-violet-700'}`}>
            Ver todos <ExternalLink size={8} />
          </a>
        </div>

        <div className="space-y-1">
          {MODELOS_SUGERIDOS.map(([id, label, size, desc]) => {
            const instalado    = ollamaStatus.running && ollamaStatus.models?.includes(id);
            const baixandoEste = pullingModel === id;
            // Chip "ativo" só aparece se Ollama está rodando E modelo está instalado
            const isAtivo      = ollamaStatus.running && modelName === id && instalado;
            return (
              <div key={id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors
                ${instalado
                  ? darkMode ? 'bg-secondary/8 border-secondary/20' : 'bg-emerald-50 border-emerald-200'
                  : darkMode ? 'bg-white/3 border-white/8 hover:border-white/15' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{label}</span>
                    <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{size}</span>
                    {instalado && !isAtivo && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>instalado</span>
                    )}
                    {isAtivo && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${darkMode ? 'bg-secondary/30 text-secondary' : 'bg-emerald-200 text-emerald-800'}`}>✓ ativo</span>
                    )}
                  </div>
                  <p className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{desc}</p>
                </div>

                {!instalado ? (
                  <button
                    disabled={!!pullingModel || !ollamaStatus.running}
                    onClick={() => handleBaixar(id)}
                    title={!ollamaStatus.running ? 'Instale o Ollama para baixar modelos' : undefined}
                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-colors disabled:opacity-40
                      ${baixandoEste
                        ? darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700 border border-violet-300'
                        : darkMode ? 'bg-primary/15 text-primary hover:bg-primary/25' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
                    {baixandoEste
                      ? <><Loader2 size={9} className="animate-spin" /> {pullProgress?.pct > 0 ? `${pullProgress.pct}%` : 'Baixando…'}</>
                      : <>↓ Baixar</>}
                  </button>
                ) : (
                  <button
                    onClick={() => !isAtivo && onModelChange && onModelChange(id)}
                    disabled={isAtivo}
                    className={`shrink-0 text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:cursor-default
                      ${isAtivo
                        ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
                        : darkMode
                          ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
                          : 'bg-primary text-white border border-primary shadow-sm hover:bg-primary/90'}`}>
                    {isAtivo ? '✓ Ativo' : 'Usar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Progresso de download com tempo estimado */}
        {pullingModel && pullProgress && pullProgress.status === 'pulling' && (
          <div className={`rounded-lg p-3 space-y-2 border ${darkMode ? 'bg-primary/8 border-primary/20' : 'bg-violet-50 border-violet-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold ${darkMode ? 'text-primary' : 'text-violet-700'}`}>
                Baixando {pullingModel}…
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
                  {formatarTempo(tempoRestante)} restante
                </p>
              )}
            </div>
            <p className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Modelos grandes podem levar vários minutos dependendo da sua conexão.
            </p>
          </div>
        )}
        {pullingModel && pullProgress?.status === 'done' && (
          <p className={`text-[10px] font-bold text-center ${darkMode ? 'text-secondary' : 'text-emerald-600'}`}>
            ✓ {pullingModel} instalado com sucesso!
          </p>
        )}
        {pullingModel && pullProgress?.status === 'error' && (
          <p className={`text-[10px] font-bold text-center text-red-500`}>
            Erro: {pullProgress.message}
          </p>
        )}

      </div>

    </div>
  );
}

export default OllamaSetup;

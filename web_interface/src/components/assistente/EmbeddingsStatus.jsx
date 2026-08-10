/**
 * @file EmbeddingsStatus.jsx
 * @description Status do modelo de embeddings (busca vetorial) e botão de download via Ollama
 * @module components/assistente/EmbeddingsStatus
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { fetchOllamaStatus, pullOllamaModel, fetchOllamaPullProgress } from '../../services/api';

const EMBED_MODEL = 'nomic-embed-text';

function temModeloEmbedding(models) {
  return (models || []).some((m) => m.split(':')[0] === EMBED_MODEL);
}

// Card mínimo e autocontido — não reusa o estado de pull do OllamaSetup
// (pullProgress/pulling/pullingModel lifted em AssistenteTab) porque este
// componente é deliberadamente independente dele (ver plano da Fase 1 de
// embeddings): baixar o modelo de embedding é uma ação avulsa, não parte do
// fluxo de escolha de modelo de chat. O backend só tem UM slot global de
// progresso (state.ollama_pull_progress) — o filtro por data.model abaixo
// evita que este card mostre progresso de um pull de modelo de chat alheio.
export default function EmbeddingsStatus({ darkMode, ollamaStatus, setOllamaStatus, btnFocus = '' }) {
  const { t } = useTranslation();
  const [pulling, setPulling] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const statusRegionRef = React.useRef(null);

  const instalado = !!(ollamaStatus?.running && temModeloEmbedding(ollamaStatus.models));

  // Ao clicar "Baixar", o próprio <button> desmonta (substituído pelo bloco
  // de progresso) — sem isso o foco do teclado reverte silenciosamente pro
  // <body>, desorientando quem navega sem mouse. Move o foco pra dentro da
  // região de status (aria-live), que é exatamente o que vai ser anunciado.
  React.useEffect(() => {
    if (pulling && statusRegionRef.current) {
      statusRegionRef.current.focus();
    }
  }, [pulling]);

  React.useEffect(() => {
    if (!pulling) return;
    let cancelado = false;
    const interval = setInterval(async () => {
      // Checagem independente do slot de progresso: o backend só tem UM
      // slot global (state.ollama_pull_progress) — se o usuário também
      // baixar um modelo de chat pelo OllamaSetup ao mesmo tempo, o slot
      // pode ficar preso mostrando o progresso do OUTRO modelo até o fim.
      // Consultar /api/tags direto (via fetchOllamaStatus) é a fonte de
      // verdade real de "o modelo já está instalado", desacoplada do slot.
      try {
        const statusResp = await fetchOllamaStatus();
        if (cancelado) return;
        if (temModeloEmbedding(statusResp.data.models)) {
          setOllamaStatus && setOllamaStatus(statusResp.data);
          setPulling(false);
          setProgress(null);
          return;
        }
      } catch { /* status falhou nesta rodada, tenta de novo no próximo tick */ }

      try {
        const { data } = await fetchOllamaPullProgress();
        if (cancelado) return;
        if (data.model && data.model.split(':')[0] !== EMBED_MODEL) return; // progresso de outro modelo — mantém o último estado nosso
        setProgress(data);
        if (data.status === 'error') setPulling(false);
      } catch { /* poll falhou nesta rodada, tenta de novo no próximo tick */ }
    }, 1200);
    return () => { cancelado = true; clearInterval(interval); };
  }, [pulling]);

  const handleBaixar = async () => {
    setPulling(true);
    setProgress({ status: 'pulling', pct: 0, message: '' });
    try {
      await pullOllamaModel(EMBED_MODEL);
    } catch {
      setPulling(false);
    }
  };

  // Sem Ollama rodando, embeddings não fazem sentido como oferta — o card de
  // status do OllamaSetup já cobre esse estado com a orientação de instalar.
  if (!ollamaStatus?.running) return null;

  return (
    <div
      className={`rounded-xl p-3.5 space-y-2 border ${
        instalado
          ? darkMode ? 'bg-secondary/5 border-secondary/20' : 'bg-emerald-50 border-emerald-200'
          : darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'
      }`}
    >
      {/* Header estático (ícone + título) — deliberadamente FORA da região
          aria-live abaixo: não muda com o progresso do download, então não
          deve ser reanunciado a cada tick do polling (1200ms). */}
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" size={13} className={`shrink-0 ${instalado ? 'text-secondary' : darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {t('assistente.embeddings_title')}
        </span>
        {/* Decorativo — o estado "instalado" já está no texto de descrição abaixo;
            aria-hidden evita anúncio redundante duplicado pelo leitor de tela. */}
        {instalado && <CheckCircle2 aria-hidden="true" size={12} className="text-secondary shrink-0" />}
      </div>

      {/* Região de status dinâmico: descrição + botão/progresso/erro. Isolada
          num aria-live próprio (em vez de envolver o card inteiro) pra só
          anunciar o que de fato muda — não o header estático acima.
          tabIndex={-1} + ref permite foco programático (ver handleBaixar/
          useEffect acima) sem entrar na ordem normal de Tab. */}
      <div ref={statusRegionRef} tabIndex={-1} aria-live="polite" className="space-y-2 outline-none">
        <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
          {instalado ? t('assistente.embeddings_desc_ativo') : t('assistente.embeddings_desc_inativo')}
        </p>

        {!instalado && !pulling && (
          <div className="space-y-1">
            <button
              onClick={handleBaixar}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors bg-primary/15 text-primary hover:bg-primary/25 focus:ring-2 focus:ring-primary focus:ring-offset-0 ${btnFocus}`}
            >
              {t('assistente.embeddings_download_btn')}
            </button>
            {progress?.status === 'error' && (
              <p className={`text-[10px] ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                {t('assistente.embeddings_download_error')}
              </p>
            )}
          </div>
        )}

        {pulling && progress && (
          <div className="space-y-1">
            <div
              role="progressbar"
              aria-valuenow={progress.pct || 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={progress.message ? `${progress.pct || 0}% — ${progress.message}` : `${progress.pct || 0}%`}
              aria-label={t('assistente.embeddings_progressbar_label')}
              className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-white/10' : 'bg-emerald-200'}`}
            >
              <div
                className="h-1.5 rounded-full bg-secondary transition-all duration-300"
                style={{ width: `${progress.pct || 0}%` }}
              />
            </div>
            <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {progress.message || t('assistente.embeddings_downloading')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

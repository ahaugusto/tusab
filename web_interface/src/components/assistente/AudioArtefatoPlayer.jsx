// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2, Loader2, AlertCircle } from 'lucide-react';
import { ttsStatus, gerarAudioArtefato } from '../../services/api';

/**
 * AudioArtefatoPlayer — botão "Ouvir" que sintetiza (ou serve do cache já
 * persistido em disco) o áudio de um artefato de Estudo, e troca pra um
 * player <audio controls> real assim que o blob chega. Usado tanto no
 * resultado "ao vivo" (EstudoTab) quanto ao reabrir um card salvo do kanban
 * (EstudoArtefatoModal) — mesmo endpoint, mesma UI nos dois lugares.
 *
 * Some silenciosamente (retorna null) se a stack de TTS local (Pocket TTS,
 * build Beta/Enterprise) não estiver disponível nesta instalação.
 */
export default function AudioArtefatoPlayer({ darkMode, projeto, artefatoId, borderColor }) {
  const { t } = useTranslation();
  const [disponivel, setDisponivel] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [audioUrl,   setAudioUrl]   = useState(null);
  const [erro,       setErro]       = useState(null);
  const urlRef = useRef(null);

  const border    = borderColor ?? (darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0');
  const textSecond = darkMode ? '#94a3b8' : '#64748b';

  useEffect(() => {
    ttsStatus().then(r => setDisponivel(!!r.data?.disponivel)).catch(() => setDisponivel(false));
  }, []);

  // Reseta o player ao trocar de artefato — evita mostrar o áudio de um card
  // antigo enquanto o novo ainda não foi buscado.
  useEffect(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setAudioUrl(null);
    setErro(null);
  }, [artefatoId]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  if (!disponivel || !artefatoId) return null;

  const handleGerar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      const resp = await gerarAudioArtefato(projeto, artefatoId);
      if (resp.data.type && resp.data.type.includes('application/json')) {
        JSON.parse(await resp.data.text()); // corpo de erro — mensagem genérica é suficiente aqui
        throw new Error('tts_error');
      }
      const url = URL.createObjectURL(resp.data);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setAudioUrl(url);
    } catch {
      setErro(t('estudo.tts_error'));
    } finally {
      setCarregando(false);
    }
  };

  if (audioUrl) {
    return <audio controls autoPlay src={audioUrl} style={{ width: '100%', height: '32px', marginBottom: '12px' }} />;
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={handleGerar}
        disabled={carregando}
        title={t('estudo.tts_button_title')}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
          border: `1px solid ${border}`, background: 'transparent',
          color: textSecond, cursor: carregando ? 'default' : 'pointer',
          opacity: carregando ? 0.6 : 1,
        }}>
        {carregando
          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
          : <Volume2 size={12} aria-hidden="true" />}
        {carregando ? t('estudo.tts_generating') : t('estudo.tts_listen')}
      </button>
      {erro && (
        <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={11} aria-hidden="true" /> {erro}
        </p>
      )}
    </div>
  );
}

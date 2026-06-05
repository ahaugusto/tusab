/**
 * @file useStatus.js
 * @description Custom hook for polling extraction engine status every 2 seconds
 * @module hooks/useStatus
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useEffect } from 'react';
import { fetchStatus } from '../services/api';

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_STATUS = {
  is_running: false,
  is_paused: false,
  canal_url: '',
  drive_status: 'nao_autenticado',
  drive_auth_error: null,
  stats: {
    videos_processed: 0,
    videos_total: 0,
    videos_sem_legenda: 0,
    videos_legenda_curta: 0,
    files_generated: 0,
    status: 'Ocioso',
    progress: 0,
    canal_nome: '',
    idioma_detectado: '',
  },
  logs: [],
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useStatus — polls /status endpoint and returns live extraction state
 *
 * @returns {{ status: Object, setStatus: Function }}
 */
export function useStatus() {
  const [status, setStatus] = useState(DEFAULT_STATUS);

  useEffect(() => {
    /** Polls /status every 2 seconds and updates state only on changes */
    const interval = setInterval(async () => {
      try {
        const res = await fetchStatus();
        setStatus(prev =>
          JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data
        );
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { status, setStatus };
}

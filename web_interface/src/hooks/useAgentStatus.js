/**
 * @file useAgentStatus.js
 * @description Custom hook for polling agent/RAG status every 3 seconds
 * @module hooks/useAgentStatus
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useEffect, useRef } from 'react';
import { fetchAgentStatus } from '../services/api';

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_AGENT_STATUS = {
  configured: false,
  provider: '',
  canal_indexado: '',
  index_count: 0,
  indexed: false,
  indexing: false,
  index_logs: [],
  canais_indexados: [],
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAgentStatus — polls /agent/status endpoint every 3 seconds
 *
 * @returns {{ agentStatus: Object, setAgentStatus: Function }}
 */
export function useAgentStatus() {
  const [agentStatus, setAgentStatus] = useState(DEFAULT_AGENT_STATUS);
  const [indexingDoneCount, setIndexingDoneCount] = useState(0);
  const prevIndexingRef = useRef(false);

  const refetchAgentStatus = async () => {
    try {
      const res = await fetchAgentStatus();
      const next = res.data;
      // Detecta transição indexing: true → false aqui, na fonte de verdade
      if (prevIndexingRef.current && !next.indexing) {
        setIndexingDoneCount(c => c + 1);
      }
      prevIndexingRef.current = next.indexing;
      setAgentStatus(next);
    } catch {}
  };

  useEffect(() => {
    refetchAgentStatus();
    const interval = setInterval(refetchAgentStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return { agentStatus, setAgentStatus, refetchAgentStatus, indexingDoneCount };
}

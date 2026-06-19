/**
 * @file useAgentStatus.js
 * @description Custom hook for polling agent/RAG status every 3 seconds
 * @module hooks/useAgentStatus
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetchAgentStatus();
        setAgentStatus(res.data);
      } catch {}
    };
    poll(); // fetch imediato na montagem
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  return { agentStatus, setAgentStatus };
}

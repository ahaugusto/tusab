/**
 * @file LogLine.jsx
 * @description Single log entry row with colour-coded severity and timestamp
 * @module components/shared/LogLine
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * logMeta — derives display colour and accessibility label from a log message
 *
 * @param {string}  msg      - raw log message text
 * @param {boolean} darkMode - dark/light theme flag
 * @returns {{ color: string, label: string }}
 */
export function logMeta(msg, darkMode) {
  if (msg.includes('✅') || msg.includes('OK!') || msg.includes('CUMPRIDA') || msg.includes('FINALIZADO') || msg.includes('LOCAL CONCLUÍDA'))
    return { color: 'text-secondary font-medium', label: 'sucesso' };
  if (msg.includes('❌') || msg.includes('Erro') || msg.includes('ERRO'))
    return { color: 'text-danger font-medium', label: 'erro' };
  if (msg.includes('⚠️') || msg.includes('Ignorado') || msg.includes('Inconsist') || msg.includes('PULADO'))
    return { color: 'text-warning', label: 'aviso' };
  if (msg.includes('⏸️') || msg.includes('Pausa'))
    return { color: 'text-warning', label: 'pausa' };
  if (msg.includes('🧠') || msg.includes('ENGINE') || msg.includes('==='))
    return { color: `${darkMode ? 'text-violet-300' : 'text-violet-700'} font-semibold`, label: 'sistema' };
  if (msg.includes('📡') || msg.includes('mapeado') || msg.includes('Mapeando'))
    return { color: darkMode ? 'text-cyan-300' : 'text-cyan-700', label: 'mapeamento' };
  if (msg.includes('☁️') || msg.includes('Drive') || msg.includes('⬆️') || msg.includes('🔄'))
    return { color: darkMode ? 'text-violet-300' : 'text-violet-600', label: 'drive' };
  if (msg.includes('🛑') || msg.includes('Cancelamento'))
    return { color: 'text-danger font-medium', label: 'cancelado' };
  return { color: darkMode ? 'text-slate-300' : 'text-slate-600', label: 'info' };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * LogLine — renders a single log entry with timestamp and coloured message
 *
 * @param {Object} props
 * @param {{ timestamp: string, message: string }} props.log - log entry object
 * @param {boolean} props.darkMode - dark/light theme flag
 * @returns {JSX.Element}
 */
function LogLine({ log, darkMode }) {
  const { color, label } = logMeta(log.message, darkMode);

  return (
    <div className="flex gap-3 group hover:bg-white/5 px-1 py-0.5 rounded" role="listitem">
      <span className={`font-mono font-bold shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>[{log.timestamp}]</span>
      <span className={`font-mono text-xs break-all ${color}`}>
        <span className="sr-only">[{label}] </span>{log.message}
      </span>
    </div>
  );
}

export default LogLine;

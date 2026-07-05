/**
 * @file StatCard.jsx
 * @description Metric card with icon, label, value and optional folder-open button
 * @module components/shared/StatCard
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StatCard — displays a single statistic with icon, label and value
 *
 * @param {Object}   props
 * @param {React.ElementType} props.icon    - Lucide icon component
 * @param {string}   props.label            - stat label text
 * @param {string|number} props.value       - stat value to display
 * @param {string}   props.color            - Tailwind color token (e.g. 'primary')
 * @param {string}   [props.sub]            - optional subtitle below value
 * @param {Function} [props.onOpen]         - optional callback for folder-open button
 * @param {boolean}  props.darkMode         - dark/light theme flag
 * @returns {JSX.Element}
 */
// Classes estáticas por cor — interpolação `bg-${color}/15` seria purgada pelo
// Tailwind JIT (a classe não existe em texto no bundle). Novas cores: adicionar aqui.
const COLOR_CLASSES = {
  primary:   'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  accent:    'bg-accent/15 text-accent',
  warning:   'bg-warning/15 text-warning',
  danger:    'bg-danger/15 text-danger',
};

function StatCard({ icon: Icon, label, value, color, sub, onOpen, darkMode }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={`${label}: ${value}`}
      className={`p-4 lg:p-5 rounded-2xl flex items-center gap-4 border transition-all ${darkMode ? 'bg-white/5 border-white/10 hover:border-primary/40' : 'bg-white border-slate-200 shadow-md hover:border-primary/40'}`}
    >
      <div className={`p-3 rounded-xl shrink-0 ${COLOR_CLASSES[color] || COLOR_CLASSES.primary}`} aria-hidden="true">
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold uppercase tracking-widest truncate ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{label}</p>
        <p className={`font-bold truncate ${typeof value === 'string' && value.length > 8 ? 'text-base lg:text-lg' : 'text-xl lg:text-2xl'} ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{sub}</p>}
      </div>
      {onOpen && (
        <button
          onClick={onOpen}
          title={t('stats.open_folder')}
          className={`p-2 rounded-lg shrink-0 transition-colors ${darkMode ? 'text-slate-500 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
        >
          <FolderOpen size={15} />
        </button>
      )}
    </div>
  );
}

export default StatCard;

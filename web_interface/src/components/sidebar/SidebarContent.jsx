/**
 * @file SidebarContent.jsx
 * @description Drive authentication toggle row (used inside the extraction sidebar)
 * @module components/sidebar/SidebarContent
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2, ShieldCheck, ShieldOff, ShieldAlert, AlertTriangle,
} from 'lucide-react';

// ─── DriveToggle (internal sub-component) ────────────────────────────────────

/**
 * DriveToggle — compact toggle row for Google Drive authentication state
 *
 * @param {Object}   props
 * @param {string}   props.driveStatus      - 'autenticado' | 'em_progresso' | 'sem_credenciais' | 'nao_autenticado' | 'erro'
 * @param {string}   props.driveAuthError   - error message from last auth attempt
 * @param {Function} props.onAuth           - callback to start Drive OAuth
 * @param {Function} props.onCancel         - callback to cancel ongoing auth
 * @param {Function} [props.onDisconnect]   - callback to disconnect Drive (delete token)
 * @param {boolean}  props.isRunning        - whether extraction is currently running
 * @param {boolean}  props.darkMode         - dark/light theme flag
 * @param {string}   props.btnFocus         - Tailwind focus-visible ring classes
 * @returns {JSX.Element}
 */
export function DriveToggle({ driveStatus, driveAuthError, onAuth, onCancel, onDisconnect, isRunning, darkMode, btnFocus }) {
  const { t } = useTranslation();

  const isOn           = driveStatus === 'autenticado' || driveStatus === 'em_progresso';
  const isLoading      = driveStatus === 'em_progresso';
  const noCredentials  = driveStatus === 'sem_credenciais';
  const toggleDisabled = noCredentials || isRunning;

  /** Handles the toggle switch click */
  const handleToggle = () => {
    if (isLoading) { onCancel(); return; }
    if (driveStatus === 'autenticado') { onDisconnect?.(); return; }
    if (!isOn) { onAuth(); }
  };

  const statusColor = driveStatus === 'autenticado'
    ? 'text-secondary'
    : driveStatus === 'em_progresso'
    ? 'text-primary'
    : darkMode ? 'text-slate-500' : 'text-slate-600';

  const statusIcon = driveStatus === 'autenticado'
    ? <ShieldCheck size={14} aria-hidden="true" />
    : driveStatus === 'em_progresso'
    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
    : noCredentials
    ? <ShieldAlert size={14} aria-hidden="true" />
    : <ShieldOff size={14} aria-hidden="true" />;

  const statusLabel = driveStatus === 'autenticado'
    ? t('drive.connected')
    : driveStatus === 'em_progresso'
    ? t('drive.waiting')
    : noCredentials
    ? t('drive.no_credentials_title')
    : t('drive.not_authenticated');

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
        ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}
        role="status" aria-label={t('drive.title')}>

        <div className={`flex items-center gap-2 min-w-0 ${statusColor}`}>
          {statusIcon}
          <div className="min-w-0">
            <p className={`text-[11px] font-bold truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('drive.title')}</p>
            <p className={`text-[10px] truncate ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>

        <button
          role="switch"
          aria-checked={isOn}
          aria-label={t('drive.aria_open_browser')}
          disabled={toggleDisabled}
          onClick={handleToggle}
          className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200
            disabled:cursor-not-allowed
            ${isOn
              ? driveStatus === 'autenticado' ? 'bg-secondary' : 'bg-primary'
              : darkMode ? 'bg-white/20' : 'bg-slate-300'}
            ${btnFocus}`}>
          {isLoading
            ? <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" aria-hidden="true" />
            : <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
                ${isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />}
        </button>
      </div>

      {(driveStatus === 'erro' || driveAuthError) && (
        <p className="text-[10px] text-danger flex items-center gap-1 px-1" role="alert">
          <AlertTriangle size={10} aria-hidden="true" />
          {driveAuthError || t('drive.error_fallback')}
        </p>
      )}

      {noCredentials && (
        <p className="text-[10px] text-warning flex items-center gap-1 px-1" role="alert">
          <AlertTriangle size={10} aria-hidden="true" /> {t('drive.no_credentials_reinstall')}
        </p>
      )}

      {isLoading && (
        <button onClick={onCancel}
          className={`w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors
            ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
          {t('drive.cancel_auth')}
        </button>
      )}
    </div>
  );
}


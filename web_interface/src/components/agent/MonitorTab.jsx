/**
 * @file MonitorTab.jsx
 * @description Painel de observabilidade — RAM, CPU e histórico do processo Tusab
 * @module components/agent/MonitorTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import { fetchMetrics } from '../../services/api';
import { BTN_FOCUS } from '../../constants';

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, max, color }) {
  const width = 200;
  const height = 40;
  if (!data || data.length < 2) return null;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Gauge bar ────────────────────────────────────────────────────────────────

function GaugeBar({ value, max, color, darkMode }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full h-1.5 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonitorTab({ darkMode, btnFocus }) {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState(null);
  const [error, setError]     = useState('');
  const [paused, setPaused]   = useState(false);
  const intervalRef           = useRef(null);

  const load = async () => {
    try {
      const res = await fetchMetrics();
      setMetrics(res.data);
      setError('');
    } catch {
      setError(t('monitor.error_load'));
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => {
      if (!paused) load();
    }, 2000);
    return () => clearInterval(intervalRef.current);
  }, [paused]);

  const cur      = metrics?.current;
  const hist     = metrics?.history ?? [];
  const ramHist  = hist.map(h => h.ram_mb);
  const cpuHist  = hist.map(h => h.sys_cpu ?? h.cpu_pct);
  const maxRam   = Math.max(...ramHist, 1);

  const card = `rounded-2xl border p-4 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`;
  const label = `text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const value = `text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`;
  const unit  = `text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('monitor.title')}</h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('monitor.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${BTN_FOCUS}
            ${paused
              ? darkMode ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-primary/10 text-primary border border-primary/20'
              : darkMode ? 'bg-white/8 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          <RefreshCw size={11} className={paused ? '' : 'animate-spin'} style={{ animationDuration: '3s' }} />
          {paused ? t('monitor.paused') : t('monitor.live')}
        </button>
      </div>

      {error && (
        <p className={`text-[11px] px-3 py-2 rounded-xl border ${darkMode ? 'bg-red-900/20 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {error}
        </p>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">

        {/* RAM */}
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={14} className="text-violet-400" />
            <span className={label}>{t('monitor.card_ram')}</span>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className={value}>{cur ? cur.ram_mb.toFixed(0) : '—'}</span>
            <span className={`${unit} mb-1`}>MB</span>
          </div>
          <GaugeBar value={cur?.ram_mb ?? 0} max={Math.max(maxRam * 1.2, 512)} color="#a78bfa" darkMode={darkMode} />
          <div className="mt-3">
            <Sparkline data={ramHist} max={Math.max(maxRam * 1.2, 512)} color="#a78bfa" />
          </div>
        </div>

        {/* CPU */}
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-sky-400" />
            <span className={label}>{t('monitor.card_cpu_sys')}</span>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className={value}>{cur ? (cur.sys_cpu ?? cur.cpu_pct).toFixed(0) : '—'}</span>
            <span className={`${unit} mb-1`}>%</span>
          </div>
          <GaugeBar value={cur?.sys_cpu ?? cur?.cpu_pct ?? 0} max={100} color="#38bdf8" darkMode={darkMode} />
          <div className="mt-3">
            <Sparkline data={cpuHist} max={100} color="#38bdf8" />
          </div>
          {cur?.cpu_pct !== undefined && (
            <p className={`mt-2 text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('monitor.process_prefix')} {cur.cpu_pct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Histórico — tabela compacta */}
      {hist.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${darkMode ? 'border-white/8' : 'border-slate-100'}`}>
            <Activity size={13} className="text-slate-400" />
            <span className={label}>{t('monitor.history_title')} ({hist.length} {t('monitor.samples_suffix')})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                  <th className="px-4 py-1.5 text-left font-semibold">{t('monitor.col_time')}</th>
                  <th className="px-4 py-1.5 text-right font-semibold">{t('monitor.col_ram')}</th>
                  <th className="px-4 py-1.5 text-right font-semibold">{t('monitor.col_cpu_sys')}</th>
                  <th className="px-4 py-1.5 text-right font-semibold">{t('monitor.col_cpu_proc')}</th>
                </tr>
              </thead>
              <tbody>
                {[...hist].reverse().slice(0, 20).map((h, i) => (
                  <tr key={h.ts}
                    className={`border-t transition-colors ${darkMode
                      ? `border-white/5 ${i === 0 ? 'bg-white/4' : 'hover:bg-white/4'}`
                      : `border-slate-50 ${i === 0 ? 'bg-primary/3' : 'hover:bg-slate-50'}`
                    }`}>
                    <td className={`px-4 py-1.5 font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(h.ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-mono ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
                      {h.ram_mb.toFixed(1)}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-mono ${darkMode ? 'text-sky-300' : 'text-sky-600'}`}>
                      {(h.sys_cpu ?? h.cpu_pct).toFixed(1)}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-mono ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {h.cpu_pct.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`px-4 py-2 text-[10px] border-t ${darkMode ? 'border-white/8 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            {t('monitor.footer')}
          </p>
        </div>
      )}

      {/* Nota */}
      <p className={`text-[10px] px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
        {t('monitor.note')}
      </p>
    </div>
  );
}

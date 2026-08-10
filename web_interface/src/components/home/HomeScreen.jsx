/**
 * @file HomeScreen.jsx
 * @description Landing / home screen with two source paths and utility navigation cards
 * @module components/home/HomeScreen
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import CircuitBackground from './CircuitBackground';

function HomeScreen({ darkMode, history, repositorio, agentStatus, ollamaStatus, btnFocus, onNavigate, onNavigatePesquisaAcademica, onAddFiles, onToggleTheme, onChangeLang, onImportBase, onOpenChatExpandido, regras }) {
  const { t, i18n: homeI18n } = useTranslation();
  const currentLang = homeI18n.language.startsWith('pt') ? 'pt' : homeI18n.language.startsWith('en') ? 'en' : 'es';

  const totalDocs    = (repositorio.documentos?.length || 0) + (repositorio.textos?.length || 0);
  const totalArquivos = (repositorio.youtube?.length || 0) + totalDocs;
  const totalCanais  = history.length;
  const configured   = agentStatus.configured;
  const indexed      = agentStatus.canais_indexados?.length > 0;
  const ollamaOk     = ollamaStatus?.running && ollamaStatus?.models?.length > 0;
  const agentReady   = configured || ollamaOk;

  const perfil = regras?._perfil ?? 'profissional';
  const isEstudante   = perfil === 'estudante';
  const isProfessor   = perfil === 'professor';
  const isPesquisador = perfil === 'pesquisador';

  // ── Source cards (top, side-by-side) ──────────────────────────────────────
  const sourceBase = darkMode
    ? 'bg-[#0C1122]/95 border-white/10 hover:bg-[#0E1428]/95 hover:border-white/20'
    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300';

  // Cards de fonte variam por perfil
  let sourceCards;

  if (isEstudante) {
    // Estudante: destaque para importar base + acesso ao repositório
    sourceCards = [
      {
        id:     'importar',
        icon:   '📦',
        title:  t('home.source_import_title'),
        sub:    t('home.source_import_sub'),
        desc:   totalArquivos > 0
          ? t('home.card_repo_done', { count: totalArquivos })
          : t('home.source_import_desc'),
        badge:  totalArquivos > 0 ? String(totalArquivos) : null,
        action: onImportBase,
        highlight: true,
      },
      {
        id:     'arquivos',
        icon:   '📁',
        title:  t('home.source_files_title'),
        sub:    t('home.source_files_sub'),
        desc:   totalDocs > 0
          ? t('home.card_repo_done', { count: totalDocs })
          : t('home.source_files_desc'),
        badge:  totalDocs > 0 ? String(totalDocs) : null,
        action: onAddFiles,
        highlight: false,
      },
    ];
  } else if (isProfessor) {
    // Professor: extrair canal + exportar base
    sourceCards = [
      {
        id:     'youtube',
        icon:   '📺',
        title:  t('home.source_youtube_title'),
        sub:    'YouTube',
        desc:   totalCanais > 0
          ? t('home.card_extract_done', { count: totalCanais })
          : t('home.source_youtube_desc'),
        badge:  totalCanais > 0 ? String(totalCanais) : null,
        action: () => onNavigate('extracao'),
        highlight: false,
      },
      {
        id:     'exportar',
        icon:   '🎒',
        title:  t('home.source_export_title'),
        sub:    t('home.source_export_sub'),
        desc:   totalCanais > 0
          ? t('home.source_export_desc_ready', { count: totalCanais })
          : t('home.source_export_desc'),
        badge:  totalCanais > 0 ? String(totalCanais) : null,
        action: () => onNavigate('repositorio'),
        highlight: totalCanais > 0,
      },
    ];
  } else if (isPesquisador) {
    // Pesquisador: YouTube + Arquivos (+ Pesquisa acadêmica quando
    // regras.fontes_publicas estiver ligado). fonte_externa só é gravado pelo
    // backend em documentos baixados via /fontes/{id}/search — nunca em
    // upload manual — então contar por "tem fonte_externa" cobre qualquer
    // fonte registrada (arXiv, OpenAlex, ...) sem precisar listar cada uma.
    const totalPesquisaAcademica = (repositorio.documentos || [])
      .filter(d => !!d.fonte_externa).length;
    sourceCards = [
      {
        id:     'youtube',
        icon:   '📺',
        iconSize: 'text-4xl',
        title:  t('home.source_youtube_title'),
        sub:    'YouTube',
        desc:   totalCanais > 0
          ? t('home.card_extract_done', { count: totalCanais })
          : t('home.source_youtube_desc'),
        badge:  totalCanais > 0 ? String(totalCanais) : null,
        action: () => onNavigate('extracao'),
        highlight: false,
      },
      ...(regras?.fontes_publicas ? [{
        id:     'pesquisa-academica',
        icon:   '🔬',
        title:  t('home.source_pesquisa_title', 'Pesquisa acadêmica'),
        sub:    'arXiv, OpenAlex e mais',
        desc:   totalPesquisaAcademica > 0
          ? t('home.card_repo_done', { count: totalPesquisaAcademica })
          : t('home.source_pesquisa_desc', 'Busque artigos científicos'),
        badge:  totalPesquisaAcademica > 0 ? String(totalPesquisaAcademica) : null,
        action: onNavigatePesquisaAcademica,
        highlight: false,
      }] : []),
      {
        id:     'arquivos',
        icon:   '📁',
        iconSize: 'text-4xl',
        title:  t('home.source_files_title'),
        sub:    t('home.source_files_sub'),
        desc:   totalDocs > 0
          ? t('home.card_repo_done', { count: totalDocs })
          : t('home.source_files_desc'),
        badge:  totalDocs > 0 ? String(totalDocs) : null,
        action: onAddFiles,
        highlight: false,
      },
    ];
  } else {
    // Especialista: padrão original
    sourceCards = [
      {
        id:     'youtube',
        icon:   '📺',
        title:  t('home.source_youtube_title'),
        sub:    'YouTube',
        desc:   totalCanais > 0
          ? t('home.card_extract_done', { count: totalCanais })
          : t('home.source_youtube_desc'),
        badge:  totalCanais > 0 ? String(totalCanais) : null,
        action: () => onNavigate('extracao'),
        highlight: false,
      },
      {
        id:     'arquivos',
        icon:   '📁',
        title:  t('home.source_files_title'),
        sub:    t('home.source_files_sub'),
        desc:   totalDocs > 0
          ? t('home.card_repo_done', { count: totalDocs })
          : t('home.source_files_desc'),
        badge:  totalDocs > 0 ? String(totalDocs) : null,
        action: onAddFiles,
        highlight: false,
      },
    ];
  }

  // ── Utility cards (below) ─────────────────────────────────────────────────
  const allUtilityCards = [
    {
      id:     'repositorio',
      icon:   '📚',
      title:  t('home.card_repo_title'),
      desc:   totalArquivos > 0 ? t('home.card_repo_done', { count: totalArquivos }) : t('home.card_repo_desc'),
      badge:  totalArquivos > 0 ? String(totalArquivos) : null,
      color:  'accent',
      perfis: ['estudante', 'professor', 'pesquisador', 'profissional'],
    },
    {
      id:     'visao-geral',
      icon:   '🗺️',
      title:  t('tabs.overview'),
      desc:   totalArquivos > 0
        ? `${t('home.card_overview_files', { count: totalArquivos })} · ${t('home.card_overview_projects', { count: totalCanais })}`
        : t('overview.subtitle'),
      badge:  null,
      color:  'secondary',
      perfis: ['pesquisador', 'profissional'],
    },
    {
      id:     'agente',
      icon:   '⚙️',
      title:  t('home.card_assistente_title'),
      desc:   configured ? (indexed ? t('home.card_assistente_ready') : t('home.card_assistente_index')) : t('home.card_assistente_desc'),
      badge:  configured ? '✓' : null,
      color:  configured && indexed ? 'secondary' : 'primary',
      alert:  !agentReady,
      perfis: ['estudante', 'professor', 'pesquisador', 'profissional'],
    },
  ];

  const utilityCards = allUtilityCards.filter(c => c.perfis.includes(perfil));

  const badgeClass = (color) => color === 'secondary'
    ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
    : darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700';

  const highlightBase = darkMode
    ? 'bg-[#0C1122]/95 border-primary/50 hover:bg-[#0E1428]/95 hover:border-primary/70'
    : 'bg-white border-violet-300 shadow-sm hover:shadow-md hover:border-violet-400';

  // Idioma/tema/assinatura — vivem junto do logo (coluna esquerda no desktop,
  // abaixo da logo mobile em telas estreitas), não mais soltos ao fim dos cards.
  const footerControls = (
    <div className="flex flex-col items-center gap-3 mt-4">
      <div className="flex items-center gap-2">
        <div className={`flex items-center rounded-lg border px-2 py-1.5 gap-1.5 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-slate-500' : 'text-slate-500'}>
            <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
          </svg>
          <select value={currentLang} onChange={e => onChangeLang(e.target.value)}
            className={`text-[11px] font-bold bg-transparent border-none outline-none cursor-pointer pr-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <option value="pt" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>PT</option>
            <option value="en" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>EN</option>
            <option value="es" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>ES</option>
          </select>
        </div>
        <button onClick={onToggleTheme}
          aria-label={t(darkMode ? 'footer.light' : 'footer.dark')}
          title={t(darkMode ? 'footer.light' : 'footer.dark')}
          className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-white/10 border-white/20 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
          {darkMode
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          }
        </button>
      </div>
      <p className={`text-[11px] ${darkMode ? 'text-slate-700' : 'text-slate-400'}`}>
        {t('home.by')}
      </p>
    </div>
  );

  return (
    <div className={`flex-1 flex overflow-hidden relative ${darkMode ? 'bg-[#080C18]' : 'bg-slate-50'}`}>
      <CircuitBackground darkMode={darkMode} interactive />

      {/* Left — logo (tablet+) */}
      <div className={`hidden md:flex flex-col items-center justify-center w-1/2 px-8 lg:px-12 border-r ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
        <img
          src={darkMode ? '/logo_dark_mode.svg' : '/logo_light_mode.svg'}
          alt="Tusab — Index.Augment.Chat"
          className="w-full max-w-xs lg:max-w-sm object-contain object-top"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <p className={`mt-2 text-sm text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('home.tagline')}
        </p>
        {footerControls}
      </div>

      {/* Right — cards + footer */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-6 overflow-y-auto">

        {/* Mobile logo (shown only when left panel is hidden) */}
        <div className="flex md:hidden flex-col items-center mb-6">
          <img
            src={darkMode ? '/logo_dark_mode.svg' : '/logo_light_mode.svg'}
            alt="Tusab"
            className="w-32 h-32 object-contain"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <p className={`mt-2 text-sm text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('home.tagline')}
          </p>
          {footerControls}
        </div>

        <div className="w-full max-w-md space-y-3">

          {/* ── Source section ── */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {isEstudante ? t('home.section_source_estudante') : t('home.section_source')}
            </p>
            <div className={`grid gap-3 ${sourceCards.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {sourceCards.map(card => (
                <button
                  key={card.id}
                  onClick={card.action}
                  className={`relative p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${btnFocus} ${card.highlight ? highlightBase : sourceBase}`}>
                  {card.badge && (
                    <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass('primary')}`}>
                      {card.badge}
                    </span>
                  )}
                  <div className="w-8 h-8 flex items-center justify-center mb-2">
                    {typeof card.icon === 'string'
                      ? <span className={`${card.iconSize || 'text-2xl'} leading-none`}>{card.icon}</span>
                      : <card.icon size={24} className={darkMode ? 'text-slate-300' : 'text-slate-600'} aria-hidden="true" />}
                  </div>
                  <p className={`text-xs font-bold leading-tight ${card.highlight ? darkMode ? 'text-primary' : 'text-violet-700' : darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
                  {card.sub && (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {(Array.isArray(card.sub) ? card.sub : [card.sub]).map(s => (
                        <span key={s} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${badgeClass('primary')}`}>{s}</span>
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 leading-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Talk section (só aparece com base indexada — chat sem contexto não tem valor) ── */}
          {indexed && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('home.section_talk')}
              </p>
              <button
                onClick={onOpenChatExpandido}
                className={`relative w-full p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnFocus} ${agentReady ? highlightBase : darkMode ? 'bg-[#0C1122]/95 border-white/10 hover:bg-[#0E1428]/95 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0">💬</span>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('home.card_chat_title')}</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {agentReady ? t('home.card_chat_ready') : t('home.card_chat_desc')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Study section (mesmo gate — Estudo também precisa de base indexada) ── */}
          {indexed && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('home.section_study')}
              </p>
              <button
                onClick={() => onNavigate('estudo')}
                className={`relative w-full p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnFocus} ${darkMode ? 'bg-[#0C1122]/95 border-white/10 hover:bg-[#0E1428]/95 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0">🎓</span>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('home.card_estudo_title')}</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('home.card_estudo_desc')}</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Utility section ── */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('home.section_manage')}
            </p>
            <div className="space-y-2">
              {utilityCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => (card.action ? card.action() : onNavigate(card.id))}
                  className={`relative w-full p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnFocus}
                    ${card.alert
                      ? darkMode ? 'bg-[#0C1122]/95 border-amber-500/40 hover:bg-[#0E1428]/95 hover:border-amber-500/60' : 'bg-white border-amber-200 hover:border-amber-300 shadow-sm'
                      : darkMode ? 'bg-[#0C1122]/95 border-white/10 hover:bg-[#0E1428]/95 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                  {card.alert && (
                    <span className={`absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      {t('home.card_configure')}
                    </span>
                  )}
                  {!card.alert && card.badge && (
                    <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass(card.color)}`}>
                      {card.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{card.icon}</span>
                    <div>
                      <p className={`text-xs font-bold ${card.alert ? darkMode ? 'text-amber-300' : 'text-amber-800' : darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
                      <p className={`text-[10px] mt-0.5 ${card.alert ? darkMode ? 'text-amber-500/80' : 'text-amber-600' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default HomeScreen;

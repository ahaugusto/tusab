/**
 * @file FontesSelector.jsx
 * @description Seleção de fontes públicas dentro de uma área, na modal de extração:
 *   filtros (Brasil/Internacional, tipo de conteúdo, texto), fontes da mesma
 *   instituição agrupadas (ex.: Hugging Face → Modelos/Datasets/Papers) e
 *   sub-seleção de portais (estados, países, órgãos) nas fontes que a declaram.
 *   A taxonomia (regiao, tipos, instituicao, grupo, variante, subfontes) vem do
 *   backend — ver TAXONOMIA em tusab_engine/motor/fontes/__init__.py.
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BTN_FOCUS } from '../../constants';

const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Chip({ ativo, onClick, children, darkMode, title }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} title={title}
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${BTN_FOCUS}
        ${ativo
          ? 'bg-primary-button border-primary-button text-white'
          : darkMode ? 'bg-white/5 border-white/15 text-slate-300 hover:border-white/30' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
      {children}
    </button>
  );
}

export default function FontesSelector({ area, selecionadas, setSelecionadas, subfontesSel, setSubfontesSel, darkMode }) {
  const { t } = useTranslation();
  const fontes = area?.fontes || [];
  const tiposDaArea = area?.tipos || {};

  const [regiao, setRegiao] = React.useState('todas');   // 'todas' | 'br' | 'int'
  const [tipo, setTipo] = React.useState('');            // '' = todos
  const [texto, setTexto] = React.useState('');

  // Filtros só aparecem quando ajudam: região só se a área tem as duas,
  // tipo só se há mais de um, texto só em áreas grandes.
  const temBr = fontes.some(f => f.regiao === 'br');
  const temInt = fontes.some(f => f.regiao === 'int');
  const tiposIds = Object.keys(tiposDaArea);
  const mostrarTexto = fontes.length > 6;

  const visiveis = fontes.filter(f =>
    (regiao === 'todas' || f.regiao === regiao) &&
    (!tipo || (f.tipos || []).includes(tipo)) &&
    (!texto.trim() || semAcento(`${f.nome} ${f.instituicao || ''} ${f.grupo || ''} ${f.variante || ''} ${f.descricao}`).includes(semAcento(texto.trim())))
  );
  const ocultasSelecionadas = selecionadas.filter(id => !visiveis.some(f => f.id === id)).length;

  // Agrupa preservando a ordem do backend: o grupo entra na posição do 1º membro.
  const blocos = [];
  const porGrupo = {};
  visiveis.forEach(f => {
    if (f.grupo) {
      if (!porGrupo[f.grupo]) { porGrupo[f.grupo] = { grupo: f.grupo, membros: [] }; blocos.push(porGrupo[f.grupo]); }
      porGrupo[f.grupo].membros.push(f);
    } else {
      blocos.push({ fonte: f });
    }
  });

  const alternar = (id) => setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const alternarGrupo = (membros) => {
    const ids = membros.map(m => m.id);
    const todos = ids.every(id => selecionadas.includes(id));
    setSelecionadas(prev => todos ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };
  const todasVisiveis = visiveis.length > 0 && visiveis.every(f => selecionadas.includes(f.id));
  const alternarTodas = () => {
    const ids = visiveis.map(f => f.id);
    setSelecionadas(prev => todasVisiveis ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  const subSel = (f) => subfontesSel[f.id] ?? f.subfontes;   // padrão: todas
  const alternarSub = (f, nome) => setSubfontesSel(prev => {
    const atual = prev[f.id] ?? f.subfontes;
    const prox = atual.includes(nome) ? atual.filter(x => x !== nome) : [...atual, nome];
    return { ...prev, [f.id]: prox };
  });

  const corTexto = darkMode ? 'text-slate-400' : 'text-slate-500';

  const linhaFonte = (f, recuo) => {
    const marcada = selecionadas.includes(f.id);
    const rotulo = recuo && f.variante ? f.variante : f.nome;
    return (
      <div key={f.id}>
        <label className={`flex items-start gap-2 py-1.5 cursor-pointer transition-colors ${recuo ? 'pl-7 pr-2.5' : 'px-2.5'}
          ${marcada ? (darkMode ? 'bg-primary/10' : 'bg-primary/5') : (darkMode ? 'hover:bg-white/3' : 'hover:bg-slate-50')}`}>
          <input type="checkbox" checked={marcada} onChange={() => alternar(f.id)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer" />
          <span className="min-w-0">
            <span className={`text-[11px] font-bold block leading-tight ${marcada ? 'text-primary' : darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{rotulo}</span>
            <span className={`text-[10px] leading-snug block ${corTexto}`}>{t(`extraction.fonte_${f.id}_desc`, f.descricao)}</span>
          </span>
        </label>
        {marcada && f.subfontes?.length > 0 && (
          <div className={`pb-2 ${recuo ? 'pl-12' : 'pl-8'} pr-2.5`} role="group" aria-label={f.subfontes_rotulo}>
            <p className={`text-[10px] font-semibold mb-1 ${corTexto}`}>
              {t('extraction.subfontes_label', '{{rotulo}} consultados', { rotulo: f.subfontes_rotulo })}
              {' · '}
              <button type="button" className={`text-primary hover:underline rounded ${BTN_FOCUS}`}
                onClick={() => setSubfontesSel(prev => ({ ...prev, [f.id]: subSel(f).length === f.subfontes.length ? [] : f.subfontes }))}>
                {subSel(f).length === f.subfontes.length ? t('extraction.fontes_clear') : t('extraction.fontes_select_all')}
              </button>
            </p>
            <div className="flex flex-wrap gap-1">
              {f.subfontes.map(nome => (
                <Chip key={nome} ativo={subSel(f).includes(nome)} onClick={() => alternarSub(f, nome)} darkMode={darkMode}>{nome}</Chip>
              ))}
            </div>
            {subSel(f).length === 0 && (
              <p className="text-[10px] text-red-500 mt-1">{t('extraction.subfontes_vazio', 'Nenhum marcado: a busca consulta todos.')}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {(temBr && temInt) || tiposIds.length > 1 || mostrarTexto ? (
        <div className="space-y-1.5 mb-2">
          {temBr && temInt && (
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('extraction.filtro_regiao', 'Região')}>
              <Chip ativo={regiao === 'todas'} onClick={() => setRegiao('todas')} darkMode={darkMode}>{t('extraction.filtro_todas', 'Todas')}</Chip>
              <Chip ativo={regiao === 'br'} onClick={() => setRegiao('br')} darkMode={darkMode}>{t('extraction.filtro_brasil', 'Brasil')}</Chip>
              <Chip ativo={regiao === 'int'} onClick={() => setRegiao('int')} darkMode={darkMode}>{t('extraction.filtro_internacional', 'Internacional')}</Chip>
            </div>
          )}
          {tiposIds.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('extraction.filtro_tipo', 'Tipo de conteúdo')}>
              <Chip ativo={!tipo} onClick={() => setTipo('')} darkMode={darkMode}>{t('extraction.filtro_todos_tipos', 'Todos os tipos')}</Chip>
              {tiposIds.map(id => (
                <Chip key={id} ativo={tipo === id} onClick={() => setTipo(tipo === id ? '' : id)} darkMode={darkMode}>
                  {t(`extraction.tipo_${id}`, tiposDaArea[id])}
                </Chip>
              ))}
            </div>
          )}
          {mostrarTexto && (
            <input type="search" value={texto} onChange={e => setTexto(e.target.value)}
              placeholder={t('extraction.filtro_texto', 'Filtrar por nome ou instituição…')}
              aria-label={t('extraction.filtro_texto', 'Filtrar por nome ou instituição…')}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/15 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`} />
          )}
        </div>
      ) : null}

      <div className="flex items-baseline justify-between mb-1.5">
        <span id="fontes-legenda" className={`text-[11px] font-bold ${corTexto}`}>
          {t('extraction.fontes_label_multi')}
        </span>
        {visiveis.length > 2 && (
          <button type="button" onClick={alternarTodas}
            className={`text-[10px] font-semibold text-primary hover:underline rounded ${BTN_FOCUS}`}>
            {todasVisiveis ? t('extraction.fontes_clear') : t('extraction.fontes_select_all')}
          </button>
        )}
      </div>

      <div role="group" aria-labelledby="fontes-legenda"
        className={`rounded-lg border divide-y max-h-64 overflow-y-auto ${darkMode ? 'border-white/10 divide-white/8' : 'border-slate-200 divide-slate-100'}`}>
        {blocos.length === 0 && (
          <p className={`px-2.5 py-3 text-[11px] ${corTexto}`}>{t('extraction.filtro_sem_resultado', 'Nenhuma fonte com esses filtros.')}</p>
        )}
        {blocos.map(b => {
          if (b.fonte) return linhaFonte(b.fonte, false);
          if (b.membros.length === 1) return linhaFonte(b.membros[0], false);
          const marcados = b.membros.filter(m => selecionadas.includes(m.id)).length;
          return (
            <div key={b.grupo} role="group" aria-label={b.grupo}>
              <label className={`flex items-center gap-2 px-2.5 pt-1.5 pb-0.5 cursor-pointer ${darkMode ? 'hover:bg-white/3' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={marcados === b.membros.length}
                  ref={el => { if (el) el.indeterminate = marcados > 0 && marcados < b.membros.length; }}
                  onChange={() => alternarGrupo(b.membros)}
                  className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer" />
                <span className={`text-[11px] font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{b.grupo}</span>
                <span className={`text-[10px] ${corTexto}`}>{t('extraction.grupo_n_opcoes', '{{n}} opções', { n: b.membros.length })}</span>
              </label>
              {b.membros.map(m => linhaFonte(m, true))}
            </div>
          );
        })}
      </div>

      {ocultasSelecionadas > 0 && (
        <p className={`text-[10px] mt-1 px-1 ${corTexto}`}>
          {t('extraction.filtro_ocultas', '{{n}} fonte(s) marcada(s) fora do filtro atual continuam na busca.', { n: ocultasSelecionadas })}
        </p>
      )}
    </div>
  );
}

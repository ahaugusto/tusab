/**
 * @file EconomiaTokens.jsx
 * @description Modo extensão: janela "Economia de tokens", aberta por um botão na Biblioteca de Prompts.
 *   Explica em linguagem simples o que o Tusab economiza, mostra o contador local das consultas reais
 *   (GET /api/economia-tokens) e guia um teste em 3 passos com as perguntas do próprio usuário
 *   (POST /api/economia-tokens/medir). Estimativa por caracteres (~4 por token); só agregados
 *   ficam gravados, nunca as perguntas.
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import axios from 'axios';
import { Gauge, RotateCcw, X } from 'lucide-react';
import { API_BASE } from '../../constants';
import { listarProjetos } from '../../services/api';
import { localeFor } from '../../utils/locale';
import ModalWrapper from '../shared/ModalWrapper';

export default function EconomiaTokens({ darkMode, btnFocus, projetoInicial = '', onFechar }) {
  const { t, i18n } = useTranslation();
  const num = (n) => Number(n || 0).toLocaleString(localeFor(i18n.resolvedLanguage));
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');
  const [confirmarZerar, setConfirmarZerar] = useState(false);
  const [projetos, setProjetos] = useState([]);
  const [projeto, setProjeto] = useState(projetoInicial);
  const [perguntas, setPerguntas] = useState('');
  const [medindo, setMedindo] = useState(false);
  const [teste, setTeste] = useState(null);
  const [erroTeste, setErroTeste] = useState('');

  const carregar = useCallback(() => {
    axios.get(`${API_BASE}/economia-tokens`).then((r) => setResumo(r.data)).catch(() => setErro(t('ext.economia.erro_contador')));
  }, [t]);

  useEffect(() => {
    carregar();
    listarProjetos().then((r) => {
      const nomes = (r.data?.projetos || []).filter((p) => p.n_arquivos > 0).map((p) => p.nome);
      setProjetos(nomes);
      setProjeto((atual) => (atual && nomes.includes(atual) ? atual : nomes[0] || ''));
    }).catch(() => {});
  }, [carregar]);

  const zerar = async () => {
    await axios.post(`${API_BASE}/economia-tokens/zerar`).catch(() => {});
    setConfirmarZerar(false);
    carregar();
  };

  const medir = async (e) => {
    e.preventDefault();
    setMedindo(true);
    setErroTeste('');
    setTeste(null);
    try {
      const r = await axios.post(`${API_BASE}/economia-tokens/medir`, { projeto, perguntas }, { timeout: 120000 });
      if (r.data?.error) throw new Error(r.data.message);
      setTeste(r.data);
    } catch (err) {
      setErroTeste(err?.response?.data?.message || err.message);
    } finally {
      setMedindo(false);
    }
  };

  const sec = darkMode ? 'text-slate-400' : 'text-slate-500';
  const forte = darkMode ? 'text-white' : 'text-slate-800';
  const bloco = `rounded-xl border p-4 space-y-3 ${darkMode ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50/60'}`;
  const campo = `rounded-xl border px-3 py-2 text-xs ${btnFocus} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`;
  const btnSec = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${btnFocus} ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-white'}`;
  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider ${sec}`;
  const td = `px-3 py-2 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`;
  const nPerguntas = perguntas.split(/\r?\n/).filter((l) => l.trim()).length;
  const destaque = { verde: <strong className="text-emerald-500" />, b: <strong /> };
  const Passo = ({ n, children }) => (
    <span className="flex items-center gap-2 text-[11px] font-bold">
      <span aria-hidden="true" className="w-5 h-5 rounded-full bg-primary-button text-white text-[10px] flex items-center justify-center shrink-0">{n}</span>
      {children}
    </span>
  );
  const Stat = ({ rotulo, valor, verde }) => (
    <div className={`rounded-xl border px-3 py-2.5 ${darkMode ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-white'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${sec}`}>{rotulo}</p>
      <p className={`text-lg font-bold ${verde ? 'text-emerald-500' : forte}`}>{valor}</p>
    </div>
  );

  // Barras do resultado: o maior valor (projeto inteiro) ocupa a largura toda.
  const barras = teste ? [
    { chave: 'tusab', rotulo: t('ext.economia.col_tusab'), valor: teste.total.tokens_tusab, cor: 'bg-emerald-500' },
    { chave: 'fontes', rotulo: t('ext.economia.col_fontes'), valor: teste.total.tokens_fontes_inteiras, cor: darkMode ? 'bg-slate-400' : 'bg-slate-400' },
    { chave: 'projeto', rotulo: t('ext.economia.col_projeto'), valor: teste.total.tokens_projeto_inteiro, cor: darkMode ? 'bg-slate-600' : 'bg-slate-300' },
  ] : [];
  const maior = Math.max(1, ...barras.map((b) => b.valor));

  return (
    <ModalWrapper onClose={onFechar} label={t('ext.economia.titulo')}>
      <div className={`rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`p-2 rounded-xl shrink-0 ${darkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
              <Gauge size={16} className="text-emerald-500" aria-hidden="true" />
            </span>
            <div>
              <h2 id="titulo-economia" className={`text-base font-bold ${forte}`}>{t('ext.economia.titulo')}</h2>
              <p className={`text-xs mt-0.5 ${sec}`}>{t('ext.economia.subtitulo')}</p>
            </div>
          </div>
          <button onClick={onFechar} aria-label={t('ext.comum.fechar')} className={`p-1.5 rounded-lg ${btnFocus} ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 1. Como funciona */}
        <section className={bloco} aria-labelledby="eco-como">
          <h3 id="eco-como" className={`text-xs font-bold ${forte}`}>{t('ext.economia.como_titulo')}</h3>
          <ul className={`text-xs space-y-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <li><Trans i18nKey="ext.economia.como_sem" components={destaque} /></li>
            <li><Trans i18nKey="ext.economia.como_com" components={destaque} /></li>
            <li className={sec}>{t('ext.economia.como_estimativa')}</li>
          </ul>
        </section>

        {/* 2. Uso real até agora */}
        <section className={bloco} aria-labelledby="eco-uso">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="eco-uso" className={`text-xs font-bold ${forte}`}>{t('ext.economia.uso_titulo')}</h3>
              <p className={`text-[11px] mt-0.5 ${sec}`}>{t('ext.economia.uso_texto')}</p>
            </div>
            {resumo?.consultas > 0 && (
              confirmarZerar ? (
                <span className="flex gap-1.5 shrink-0">
                  <button onClick={() => setConfirmarZerar(false)} className={btnSec}>{t('ext.comum.cancelar')}</button>
                  <button onClick={zerar} data-acao="confirmar-zerar" className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 ${btnFocus}`}>{t('ext.economia.zerar')}</button>
                </span>
              ) : (
                <button onClick={() => setConfirmarZerar(true)} className={`shrink-0 ${btnSec}`} data-acao="zerar">
                  <RotateCcw size={12} aria-hidden="true" /> {t('ext.economia.zerar_contador')}
                </button>
              )
            )}
          </div>
          {erro && <p role="alert" className="text-xs text-red-500">{erro}</p>}
          {resumo && (resumo.consultas > 0 ? (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              <Stat rotulo={t('ext.economia.consultas')} valor={num(resumo.consultas)} />
              <Stat rotulo={t('ext.economia.enviados')} valor={num(resumo.tokens_enviados)} />
              <Stat rotulo={t('ext.economia.sem_tusab')} valor={num(resumo.tokens_sem_tusab)} />
              <Stat rotulo={t('ext.economia.economia')} valor={`${num(resumo.economia_percentual)}%`} verde />
            </div>
          ) : (
            <p className={`text-xs ${sec}`} data-estado="sem-consultas">{t('ext.economia.sem_consultas')}</p>
          ))}
        </section>

        {/* 3. Teste em 3 passos */}
        <form onSubmit={medir} className={bloco} aria-labelledby="eco-teste">
          <div>
            <h3 id="eco-teste" className={`text-xs font-bold ${forte}`}>{t('ext.economia.teste_titulo')}</h3>
            <p className={`text-[11px] mt-0.5 ${sec}`}>{t('ext.economia.teste_explicacao')}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <Passo n={1}>{t('ext.economia.passo_projeto')}</Passo>
            <select value={projeto} onChange={(e) => setProjeto(e.target.value)} className={`${campo} max-w-sm`} required>
              {!projetos.length && <option value="">{t('ext.economia.sem_projetos')}</option>}
              {projetos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Passo n={2}>{t('ext.economia.passo_perguntas')}</Passo>
            <textarea value={perguntas} onChange={(e) => setPerguntas(e.target.value)} rows={5} required data-campo="perguntas"
              className={`${campo} leading-relaxed`} placeholder={t('ext.economia.perguntas_exemplo')} />
            <span className={`text-[11px] ${sec}`}>{t('ext.economia.n_perguntas', { count: nPerguntas })}</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <Passo n={3}>{t('ext.economia.passo_medir')}</Passo>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={medindo || !projeto || !nPerguntas} data-acao="medir"
                className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary-button text-white hover:bg-primary-button/85 disabled:opacity-40 ${btnFocus}`}>
                {medindo ? t('ext.economia.medindo') : t('ext.economia.medir')}
              </button>
              {erroTeste && <p role="alert" className="text-xs text-red-500">{erroTeste}</p>}
            </div>
          </div>

          <div aria-live="polite">
            {teste && (
              <div className="space-y-3 pt-1" data-estado="resultado">
                <p className={`text-xs ${forte}`}>
                  <Trans i18nKey="ext.economia.resultado" components={destaque} values={{
                    tusab: num(teste.total.tokens_tusab),
                    fontes: num(teste.total.economia_vs_fontes_inteiras),
                    projeto: num(teste.total.economia_vs_projeto_inteiro),
                  }} />
                  {teste.total.sem_resposta > 0 && <> {t('ext.economia.sem_resposta', { count: teste.total.sem_resposta })}</>}
                </p>
                <div className="space-y-1.5" role="img" aria-label={t('ext.economia.barras_rotulo', {
                  tusab: num(teste.total.tokens_tusab), fontes: num(teste.total.tokens_fontes_inteiras), projeto: num(teste.total.tokens_projeto_inteiro),
                })}>
                  {barras.map((b) => (
                    <div key={b.chave} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 text-[11px]">
                      <span className={sec}>{b.rotulo}</span>
                      <span className={`h-3 rounded-full ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <span className={`block h-3 rounded-full ${b.cor}`} style={{ width: `${Math.max(1, (b.valor / maior) * 100)}%` }} />
                      </span>
                      <span className={`tabular-nums font-bold ${forte}`}>{num(b.valor)}</span>
                    </div>
                  ))}
                </div>
                <details className={`text-[11px] ${sec}`}>
                  <summary className={`cursor-pointer font-bold ${forte}`}>{t('ext.economia.como_ler')}</summary>
                  <ul className="mt-1.5 space-y-1 list-disc pl-4">
                    <li><strong>{t('ext.economia.col_tusab')}:</strong> {t('ext.economia.ler_tusab')}</li>
                    <li><strong>{t('ext.economia.col_fontes')}:</strong> {t('ext.economia.ler_fontes')}</li>
                    <li><strong>{t('ext.economia.col_projeto')}:</strong> {t('ext.economia.ler_projeto')}</li>
                  </ul>
                </details>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <caption className="sr-only">{t('ext.economia.tabela_legenda')}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className={th}>{t('ext.economia.col_pergunta')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('ext.economia.col_trechos')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('ext.economia.col_tusab')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('ext.economia.col_fontes')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('ext.economia.col_projeto')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teste.perguntas.map((l, i) => (
                        <tr key={i} className={`border-t ${darkMode ? 'border-white/5' : 'border-slate-200'}`}>
                          <th scope="row" className={`${td} font-normal text-left`}>
                            {l.pergunta}
                            {!l.trechos && <span className={`ml-1.5 text-[10px] ${sec}`} data-estado="nada">{t('ext.economia.nada_na_base')}</span>}
                          </th>
                          <td className={`${td} text-right`}>{num(l.trechos)}</td>
                          <td className={`${td} text-right font-bold`}>{num(l.tokens_tusab)}</td>
                          <td className={`${td} text-right`}>{num(l.tokens_fontes_inteiras)}</td>
                          <td className={`${td} text-right`}>{num(l.tokens_projeto_inteiro)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
}

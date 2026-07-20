/**
 * Destaques de release para o modal pós-update ("Tusab atualizado!").
 *
 * Preencher só quando a versão tiver uma novidade que vale a pena comunicar
 * ao usuário no popup automático — não é para toda release/patch. Quando a
 * versão instalada não está aqui, o modal cai no texto genérico padrão
 * (update_success.title/subtitle).
 *
 * Chave: versão exata do package.json (sem "v"). Valor: chave de i18n do
 * resumo (ver update_success.highlight_* em pt/en/es.json).
 */
export const RELEASE_HIGHLIGHTS = {
  '1.0.37': 'update_success.highlight_1_0_37',
};

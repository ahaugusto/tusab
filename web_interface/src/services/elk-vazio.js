// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// No modo extensão, o elkjs (motor de layout "elk" opcional da Mermaid, licença EPL-2.0 ou
// GPL-3.0) é trocado por este módulo: o pacote não leva esse código. Mapas mentais,
// fluxogramas e linhas do tempo usam os layouts padrão da Mermaid. Um diagrama que peça
// "layout: elk" falha e a tela mostra o código dele, como faz com qualquer diagrama inválido.
export default class ELK {
  layout() {
    return Promise.reject(new Error('Layout "elk" indisponível no Tusab.'));
  }
}

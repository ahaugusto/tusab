// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// No modo extensão (vite build --mode extensao) o pacote @microsoft/clarity é trocado por este
// módulo vazio: a telemetria do antigo app desktop não entra no pacote da extensão, nem como
// código parado. analytics.js já não chama nada nesse modo; aqui o código nem existe.
const vazio = () => {};
export default { init: vazio, consentV2: vazio, setTag: vazio, event: vazio, identify: vazio, upgrade: vazio };

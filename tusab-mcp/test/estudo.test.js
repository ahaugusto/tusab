// Fase D — Modo Estudo e Digest: mesmo formato em disco e mesmas respostas do desktop.
// REFERENCIA foi gerada executando as funções REAIS de tusab_engine/api/router_estudo.py
// e tusab_engine/scheduler.py (extraídas por ast e executadas no Windows, por isso os
// arquivos do "projeto do desktop" têm \r\n, como o Python grava em modo texto).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ErroValidacao, LIMITES, aplicarSm2, arquivosNovosDaSemana, excluirArtefato, exportarFlashcardsAnki, filaRevisao,
  idFlashcard, lerArtefato, lerEstudo, listarArtefatos, listarDigests, listarItensEstudo, parsearFlashcardsJson,
  parsearPostitsJson, pedidoGeracaoDigest, pedidoGeracaoEstudo, progressoRevisao, pyRound, renomearArtefato,
  revisarCard, salvarArtefato, salvarDigest, salvarFlashcards, salvarPostits, salvarResumo, ttsIndisponivel,
} from '../src/nucleo/estudo.js';
import { Indice } from '../src/nucleo/indice.js';

const REFERENCIA = {
  "sm2": [
    { "notas": [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], "estados": [[1, 1, 2.5], [2, 6, 2.5], [3, 15, 2.5], [4, 38, 2.5], [5, 95, 2.5], [6, 238, 2.5], [7, 595, 2.5], [8, 1488, 2.5], [9, 3720, 2.5], [10, 9300, 2.5], [11, 23250, 2.5], [12, 58125, 2.5]] },
    { "notas": [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.8], [4, 45, 2.9], [5, 130, 3], [6, 390, 3.1], [7, 1209, 3.2], [8, 3869, 3.3], [9, 12768, 3.4], [10, 43411, 3.5], [11, 151938, 3.6], [12, 546977, 3.7]] },
    { "notas": [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], "estados": [[1, 1, 2.36], [2, 6, 2.22], [3, 13, 2.08], [4, 27, 1.94], [5, 52, 1.8], [6, 94, 1.66], [7, 156, 1.52], [8, 237, 1.38], [9, 327, 1.3], [10, 425, 1.3], [11, 552, 1.3], [12, 718, 1.3]] },
    { "notas": [5, 5, 3, 1, 5, 5, 5, 4, 4, 2, 5, 5], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.56], [0, 1, 2.02], [1, 1, 2.12], [2, 6, 2.22], [3, 13, 2.32], [4, 30, 2.32], [5, 70, 2.32], [0, 1, 2], [1, 1, 2.1], [2, 6, 2.2]] },
    { "notas": [0, 1, 2, 3, 4, 5, 5, 5, 5, 5], "estados": [[0, 1, 1.7], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.5], [5, 16, 1.6], [6, 26, 1.7], [7, 44, 1.8]] },
    { "notas": [1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 1, 1, 5, 3], "estados": [[0, 1, 1.96], [0, 1, 1.42], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3]] },
    { "notas": [3, 3, 3, 5, 1, 5, 5, 3, 3, 1, 1, 3, 5, 5], "estados": [[1, 1, 2.36], [2, 6, 2.22], [3, 13, 2.08], [4, 27, 2.18], [0, 1, 1.64], [1, 1, 1.74], [2, 6, 1.84], [3, 11, 1.7], [4, 19, 1.56], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.5]] },
    { "notas": [5, 5, 5, 1, 5, 1, 5, 1, 5, 5, 5, 5, 5, 1], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.8], [0, 1, 2.26], [1, 1, 2.36], [0, 1, 1.82], [1, 1, 1.92], [0, 1, 1.38], [1, 1, 1.48], [2, 6, 1.58], [3, 9, 1.68], [4, 15, 1.78], [5, 27, 1.88], [0, 1, 1.34]] },
    { "notas": [5, 1, 1, 1, 5, 1, 1, 1, 1, 5, 1, 1, 5, 3], "estados": [[1, 1, 2.6], [0, 1, 2.06], [0, 1, 1.52], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3]] },
    { "notas": [5, 5, 5, 1, 3, 3, 1, 1, 5, 1, 3, 5, 3, 1], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.8], [0, 1, 2.26], [1, 1, 2.12], [2, 6, 1.98], [0, 1, 1.44], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 3, 3, 1, 5, 1, 3, 5, 5, 5, 3, 3, 1, 3], "estados": [[1, 1, 2.36], [2, 6, 2.22], [3, 13, 2.08], [0, 1, 1.54], [1, 1, 1.64], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.5], [4, 12, 1.6], [5, 19, 1.46], [6, 28, 1.32], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [5, 5, 1, 3, 3, 1, 3, 3, 5, 5, 3, 3, 5, 1], "estados": [[1, 1, 2.6], [2, 6, 2.7], [0, 1, 2.16], [1, 1, 2.02], [2, 6, 1.88], [0, 1, 1.34], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.5], [5, 16, 1.36], [6, 22, 1.3], [7, 29, 1.4], [0, 1, 1.3]] },
    { "notas": [1, 3, 3, 5, 1, 5, 5, 5, 1, 5, 1, 5, 3, 1], "estados": [[0, 1, 1.96], [1, 1, 1.82], [2, 6, 1.68], [3, 10, 1.78], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.6], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 1, 3, 5, 5, 1, 1, 3, 3, 3, 3, 5, 1, 3], "estados": [[1, 1, 2.36], [0, 1, 1.82], [1, 1, 1.68], [2, 6, 1.78], [3, 11, 1.88], [0, 1, 1.34], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.3], [5, 13, 1.4], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [3, 1, 5, 5, 1, 3, 5, 3, 1, 3, 5, 1, 1, 1], "estados": [[1, 1, 2.36], [0, 1, 1.82], [1, 1, 1.92], [2, 6, 2.02], [0, 1, 1.48], [1, 1, 1.34], [2, 6, 1.44], [3, 9, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [1, 5, 3, 3, 3, 3, 3, 5, 3, 5, 1, 1, 3, 3], "estados": [[0, 1, 1.96], [1, 1, 2.06], [2, 6, 1.92], [3, 12, 1.78], [4, 21, 1.64], [5, 34, 1.5], [6, 51, 1.36], [7, 69, 1.46], [8, 101, 1.32], [9, 133, 1.42], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3]] },
    { "notas": [5, 5, 5, 1, 5, 1, 1, 1, 1, 1, 3, 3, 3, 1], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.8], [0, 1, 2.26], [1, 1, 2.36], [0, 1, 1.82], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 3, 1, 5, 3, 3, 5, 5, 3, 3, 5, 3, 3, 1], "estados": [[1, 1, 2.36], [2, 6, 2.22], [0, 1, 1.68], [1, 1, 1.78], [2, 6, 1.64], [3, 10, 1.5], [4, 15, 1.6], [5, 24, 1.7], [6, 41, 1.56], [7, 64, 1.42], [8, 91, 1.52], [9, 138, 1.38], [10, 190, 1.3], [0, 1, 1.3]] },
    { "notas": [5, 1, 5, 5, 5, 1, 1, 1, 3, 5, 5, 1, 3, 1], "estados": [[1, 1, 2.6], [0, 1, 2.06], [1, 1, 2.16], [2, 6, 2.26], [3, 14, 2.36], [0, 1, 1.82], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.5], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [5, 3, 5, 5, 1, 3, 5, 1, 1, 3, 5, 5, 3, 3], "estados": [[1, 1, 2.6], [2, 6, 2.46], [3, 15, 2.56], [4, 38, 2.66], [0, 1, 2.12], [1, 1, 1.98], [2, 6, 2.08], [0, 1, 1.54], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.5], [4, 12, 1.36], [5, 16, 1.3]] },
    { "notas": [1, 5, 5, 3, 1, 5, 1, 3, 3, 5, 1, 1, 3, 3], "estados": [[0, 1, 1.96], [1, 1, 2.06], [2, 6, 2.16], [3, 13, 2.02], [0, 1, 1.48], [1, 1, 1.58], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3]] },
    { "notas": [1, 5, 3, 1, 1, 3, 3, 3, 5, 3, 1, 5, 5, 5], "estados": [[0, 1, 1.96], [1, 1, 2.06], [2, 6, 1.92], [0, 1, 1.38], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.4], [5, 14, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.6]] },
    { "notas": [5, 5, 1, 1, 1, 5, 5, 3, 1, 1, 1, 5, 5, 1], "estados": [[1, 1, 2.6], [2, 6, 2.7], [0, 1, 2.16], [0, 1, 1.62], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.36], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [0, 1, 1.3]] },
    { "notas": [3, 5, 1, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3], "estados": [[1, 1, 2.36], [2, 6, 2.46], [0, 1, 1.92], [1, 1, 1.78], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.3], [5, 13, 1.3], [6, 17, 1.3], [7, 22, 1.3], [8, 29, 1.3]] },
    { "notas": [3, 5, 3, 5, 3, 3, 5, 3, 3, 1, 3, 3, 3, 3], "estados": [[1, 1, 2.36], [2, 6, 2.46], [3, 15, 2.32], [4, 35, 2.42], [5, 85, 2.28], [6, 194, 2.14], [7, 415, 2.24], [8, 930, 2.1], [9, 1953, 1.96], [0, 1, 1.42], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.3]] },
    { "notas": [5, 3, 5, 3, 1, 3, 3, 3, 1, 5, 5, 1, 1, 3], "estados": [[1, 1, 2.6], [2, 6, 2.46], [3, 15, 2.56], [4, 38, 2.42], [0, 1, 1.88], [1, 1, 1.74], [2, 6, 1.6], [3, 10, 1.46], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [5, 5, 3, 1, 5, 3, 3, 5, 1, 1, 5, 1, 1, 5], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.56], [0, 1, 2.02], [1, 1, 2.12], [2, 6, 1.98], [3, 12, 1.84], [4, 22, 1.94], [0, 1, 1.4], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4]] },
    { "notas": [3, 5, 3, 1, 5, 1, 1, 5, 3, 1, 3, 5, 3, 5], "estados": [[1, 1, 2.36], [2, 6, 2.46], [3, 15, 2.32], [0, 1, 1.78], [1, 1, 1.88], [0, 1, 1.34], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.3], [4, 10, 1.4]] },
    { "notas": [3, 5, 3, 5, 1, 3, 5, 1, 1, 3, 5, 5, 3, 1], "estados": [[1, 1, 2.36], [2, 6, 2.46], [3, 15, 2.32], [4, 35, 2.42], [0, 1, 1.88], [1, 1, 1.74], [2, 6, 1.84], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.5], [4, 12, 1.36], [0, 1, 1.3]] },
    { "notas": [1, 1, 5, 1, 3, 1, 5, 1, 1, 5, 3, 1, 3, 5], "estados": [[0, 1, 1.96], [0, 1, 1.42], [1, 1, 1.52], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4]] },
    { "notas": [3, 3, 1, 3, 3, 1, 3, 1, 1, 5, 3, 1, 1, 3], "estados": [[1, 1, 2.36], [2, 6, 2.22], [0, 1, 1.68], [1, 1, 1.54], [2, 6, 1.4], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [5, 3, 3, 1, 1, 3, 3, 5, 3, 1, 1, 3, 5, 1], "estados": [[1, 1, 2.6], [2, 6, 2.46], [3, 15, 2.32], [0, 1, 1.78], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [0, 1, 1.3]] },
    { "notas": [5, 1, 5, 5, 5, 5, 5, 1, 3, 3, 3, 5, 1, 5], "estados": [[1, 1, 2.6], [0, 1, 2.06], [1, 1, 2.16], [2, 6, 2.26], [3, 14, 2.36], [4, 33, 2.46], [5, 81, 2.56], [0, 1, 2.02], [1, 1, 1.88], [2, 6, 1.74], [3, 10, 1.6], [4, 16, 1.7], [0, 1, 1.3], [1, 1, 1.4]] },
    { "notas": [1, 3, 5, 1, 3, 5, 3, 3, 5, 1, 1, 1, 3, 3], "estados": [[0, 1, 1.96], [1, 1, 1.82], [2, 6, 1.92], [0, 1, 1.38], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.3], [4, 10, 1.3], [5, 13, 1.4], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3]] },
    { "notas": [3, 3, 5, 5, 1, 3, 5, 3, 1, 3, 3, 1, 1, 3], "estados": [[1, 1, 2.36], [2, 6, 2.22], [3, 13, 2.32], [4, 30, 2.42], [0, 1, 1.88], [1, 1, 1.74], [2, 6, 1.84], [3, 11, 1.7], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [4, 3, 4, 4, 3, 3, 3, 0, 5, 4, 0, 4, 5, 0], "estados": [[1, 1, 2.5], [2, 6, 2.36], [3, 14, 2.36], [4, 33, 2.36], [5, 78, 2.22], [6, 173, 2.08], [7, 360, 1.94], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [0, 1, 1.3]] },
    { "notas": [1, 2, 1, 3, 2, 1, 2, 2, 3, 0, 0, 1, 4, 0], "estados": [[0, 1, 1.96], [0, 1, 1.64], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 5, 1, 0, 0, 5, 5, 5, 5, 4, 4, 5, 5, 1], "estados": [[1, 1, 2.36], [2, 6, 2.46], [0, 1, 1.92], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.6], [4, 14, 1.7], [5, 24, 1.7], [6, 41, 1.7], [7, 70, 1.8], [8, 126, 1.9], [0, 1, 1.36]] },
    { "notas": [3, 3, 5, 1, 0, 2, 5, 5, 4, 2, 5, 2, 4, 0], "estados": [[1, 1, 2.36], [2, 6, 2.22], [3, 13, 2.32], [0, 1, 1.78], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.5], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [1, 4, 0, 3, 2, 4, 2, 4, 0, 0, 0, 5, 1, 0], "estados": [[0, 1, 1.96], [1, 1, 1.96], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [5, 2, 0, 1, 4, 2, 3, 4, 2, 1, 4, 0, 0, 4], "estados": [[1, 1, 2.6], [0, 1, 2.28], [0, 1, 1.48], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [0, 0, 5, 3, 4, 2, 4, 1, 5, 0, 5, 2, 5, 1], "estados": [[0, 1, 1.7], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.3], [3, 8, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3]] },
    { "notas": [4, 3, 0, 5, 5, 2, 1, 2, 1, 4, 3, 3, 5, 2], "estados": [[1, 1, 2.5], [2, 6, 2.36], [0, 1, 1.56], [1, 1, 1.66], [2, 6, 1.76], [0, 1, 1.44], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.4], [0, 1, 1.3]] },
    { "notas": [0, 1, 3, 2, 0, 0, 3, 0, 5, 2, 3, 0, 2, 3], "estados": [[0, 1, 1.7], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [5, 5, 5, 0, 1, 2, 0, 5, 4, 3, 1, 0, 1, 5], "estados": [[1, 1, 2.6], [2, 6, 2.7], [3, 16, 2.8], [0, 1, 2], [0, 1, 1.46], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [3, 8, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4]] },
    { "notas": [2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 3, 5, 4, 2], "estados": [[0, 1, 2.18], [1, 1, 2.04], [2, 6, 2.04], [0, 1, 1.72], [1, 1, 1.58], [2, 6, 1.58], [3, 9, 1.68], [4, 15, 1.54], [5, 23, 1.54], [6, 35, 1.64], [7, 57, 1.5], [8, 86, 1.6], [9, 138, 1.6], [0, 1, 1.3]] },
    { "notas": [2, 3, 1, 4, 2, 4, 0, 2, 4, 2, 4, 3, 0, 3], "estados": [[0, 1, 2.18], [1, 1, 2.04], [0, 1, 1.5], [1, 1, 1.5], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [1, 2, 4, 4, 4, 5, 2, 3, 5, 4, 3, 1, 1, 1], "estados": [[0, 1, 1.96], [0, 1, 1.64], [1, 1, 1.64], [2, 6, 1.64], [3, 10, 1.64], [4, 16, 1.74], [0, 1, 1.42], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.4], [4, 11, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 0, 5, 1, 1, 0, 5, 5, 0, 1, 5, 4, 4, 1], "estados": [[1, 1, 2.36], [0, 1, 1.56], [1, 1, 1.66], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [3, 8, 1.4], [0, 1, 1.3]] },
    { "notas": [0, 2, 2, 5, 4, 2, 0, 4, 3, 5, 3, 2, 3, 2], "estados": [[0, 1, 1.7], [0, 1, 1.38], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [4, 3, 3, 2, 4, 4, 1, 0, 4, 5, 1, 5, 2, 5], "estados": [[1, 1, 2.5], [2, 6, 2.36], [3, 14, 2.22], [0, 1, 1.9], [1, 1, 1.9], [2, 6, 1.9], [0, 1, 1.36], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.4]] },
    { "notas": [1, 4, 2, 5, 0, 0, 3, 2, 2, 4, 1, 1, 2, 0], "estados": [[0, 1, 1.96], [1, 1, 1.96], [0, 1, 1.64], [1, 1, 1.74], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [1, 5, 5, 5, 2, 2, 2, 5, 1, 3, 3, 5, 0, 1], "estados": [[0, 1, 1.96], [1, 1, 2.06], [2, 6, 2.16], [3, 13, 2.26], [0, 1, 1.94], [0, 1, 1.62], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [0, 4, 3, 0, 3, 1, 2, 0, 1, 4, 0, 2, 4, 4], "estados": [[0, 1, 1.7], [1, 1, 1.7], [2, 6, 1.56], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3]] },
    { "notas": [0, 0, 3, 0, 1, 2, 2, 4, 0, 5, 5, 5, 3, 1], "estados": [[0, 1, 1.7], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [3, 9, 1.6], [4, 14, 1.46], [0, 1, 1.3]] },
    { "notas": [1, 3, 4, 2, 5, 5, 4, 3, 5, 1, 5, 2, 1, 4], "estados": [[0, 1, 1.96], [1, 1, 1.82], [2, 6, 1.82], [0, 1, 1.5], [1, 1, 1.6], [2, 6, 1.7], [3, 10, 1.7], [4, 17, 1.56], [5, 27, 1.66], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [4, 5, 3, 5, 0, 0, 5, 2, 2, 0, 3, 5, 1, 1], "estados": [[1, 1, 2.5], [2, 6, 2.6], [3, 16, 2.46], [4, 39, 2.56], [0, 1, 1.76], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.4], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [4, 2, 1, 0, 5, 5, 0, 0, 4, 3, 5, 5, 2, 0], "estados": [[1, 1, 2.5], [0, 1, 2.18], [0, 1, 1.64], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.5], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [3, 3, 0, 5, 0, 5, 4, 1, 3, 0, 4, 4, 5, 3], "estados": [[1, 1, 2.36], [2, 6, 2.22], [0, 1, 1.42], [1, 1, 1.52], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [2, 6, 1.3], [3, 8, 1.4], [4, 11, 1.3]] },
    { "notas": [5, 2, 1, 0, 0, 0, 1, 5, 5, 2, 5, 2, 0, 3], "estados": [[1, 1, 2.6], [0, 1, 2.28], [0, 1, 1.74], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3]] },
    { "notas": [2, 4, 4, 3, 5, 0, 3, 4, 2, 0, 2, 1, 5, 5], "estados": [[0, 1, 2.18], [1, 1, 2.18], [2, 6, 2.18], [3, 13, 2.04], [4, 27, 2.14], [0, 1, 1.34], [1, 1, 1.3], [2, 6, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.5]] },
    { "notas": [1, 4, 1, 3, 5, 3, 2, 1, 4, 2, 2, 2, 3, 0], "estados": [[0, 1, 1.96], [1, 1, 1.96], [0, 1, 1.42], [1, 1, 1.3], [2, 6, 1.4], [3, 8, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [2, 4, 5, 5, 3, 1, 5, 0, 4, 2, 2, 1, 5, 1], "estados": [[0, 1, 2.18], [1, 1, 2.18], [2, 6, 2.28], [3, 14, 2.38], [4, 33, 2.24], [0, 1, 1.7], [1, 1, 1.8], [0, 1, 1.3], [1, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [0, 1, 1.3]] },
    { "notas": [4, 2, 2, 1, 4, 3, 3, 3, 4, 0, 0, 0, 2, 2], "estados": [[1, 1, 2.5], [0, 1, 2.18], [0, 1, 1.86], [0, 1, 1.32], [1, 1, 1.32], [2, 6, 1.3], [3, 8, 1.3], [4, 10, 1.3], [5, 13, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3], [0, 1, 1.3]] },
    { "notas": [2, 5, 5, 3, 2, 5, 4, 3, 0, 0, 5, 4, 2, 3], "estados": [[0, 1, 2.18], [1, 1, 2.28], [2, 6, 2.38], [3, 14, 2.24], [0, 1, 1.92], [1, 1, 2.02], [2, 6, 2.02], [3, 12, 1.88], [0, 1, 1.3], [0, 1, 1.3], [1, 1, 1.4], [2, 6, 1.4], [0, 1, 1.3], [1, 1, 1.3]] }
  ],
  "sm2_empates_para_baixo": 5,
  "ids": [[
      "O que é BM25?",
      "d15d6c0f34e0"
    ], [
      "  Qual a capital do Brasil?  \n",
      "ebff5dd4da00"
    ], [
      "Ação, coração e pão: o que têm em comum?",
      "57408cc05c36"
    ], [
      "Emoji 🚀 conta?",
      "33fcb0056209"
    ]],
  "parsear_flashcards": [
    [
      "[{\"pergunta\": \"P1?\", \"resposta\": \"R1\"}, {\"question\": \"P2?\", \"answer\": \"R2\"}, {\"front\": \"P3\", \"back\": \"R3\"}, {\"pergunta\": \"sem resposta\"}, 7]",
      [
        {
          "id": "c11667d230ca",
          "pergunta": "P1?",
          "resposta": "R1"
        },
        {
          "id": "523f38e0f3b4",
          "pergunta": "P2?",
          "resposta": "R2"
        },
        {
          "id": "30e45f0274ef",
          "pergunta": "P3",
          "resposta": "R3"
        }
      ]
    ],
    [
      "Claro! Aqui estão:\n[{\"pergunta\": \"Dentro?\", \"resposta\": \"Sim\"}]\nEspero ter ajudado.",
      [
        {
          "id": "a86401ced366",
          "pergunta": "Dentro?",
          "resposta": "Sim"
        }
      ]
    ],
    [
      "1. Q: Primeira?\nA: Resposta um\n2. Q: Segunda?\nA: Resposta dois",
      [
        {
          "pergunta": "Primeira?",
          "resposta": "Resposta um"
        },
        {
          "pergunta": "Segunda?",
          "resposta": "Resposta dois"
        }
      ]
    ],
    [
      "nada aproveitável",
      []
    ]
  ],
  "parsear_postits": [
    [
      "[\"Ponto A\", \"  Ponto B \", {\"texto\": \"Ponto C\"}, {\"text\": \"Ponto D\"}, 3, \"\"]",
      [
        "Ponto A",
        "Ponto B",
        "Ponto C",
        "Ponto D"
      ]
    ],
    [
      "Segue:\n[\"X um\", \"X dois\"]\nfim",
      [
        "X um",
        "X dois"
      ]
    ],
    [
      "- primeiro\n• segundo\n* terceiro\n1. quarto\n2) quinto\nlinha solta",
      [
        "primeiro",
        "segundo",
        "terceiro",
        "quarto",
        "quinto"
      ]
    ],
    [
      "",
      []
    ]
  ],
  "desktop": {
    "prefixo": "Projeto_Desktop",
    "projeto_nome": "Projeto Desktop",
    "arquivos": {
      "estudo/estudo_flashcards_20261117_230343.json": "Ww0KICB7DQogICAgImlkIjogImMxMTY2N2QyMzBjYSIsDQogICAgInBlcmd1bnRhIjogIlAxPyIsDQogICAgInJlc3Bvc3RhIjogIlIxIg0KICB9LA0KICB7DQogICAgImlkIjogIjUyM2YzOGUwZjNiNCIsDQogICAgInBlcmd1bnRhIjogIlAyPyIsDQogICAgInJlc3Bvc3RhIjogIlIyIg0KICB9LA0KICB7DQogICAgImlkIjogIjMwZTQ1ZjAyNzRlZiIsDQogICAgInBlcmd1bnRhIjogIlAzIiwNCiAgICAicmVzcG9zdGEiOiAiUjMiDQogIH0NCl0=",
      "estudo/estudo_flashcards_20261117_230343.txt": "VElUVUxPOiBGbGFzaGNhcmRzIOKAlCByZWRlcyBuZXVyYWlzICgxNy8xMS8yMDI2IDIzOjAzKQ0KREFUQTogMTcvMTEvMjAyNiAyMzowMw0KQVZJU086IENvbnRlw7pkbyBnZXJhZG8gcG9yIElBIHZpYSBNb2RvIEVzdHVkbyDigJQgZGVyaXZhZG8gZG8gbWF0ZXJpYWwgb3JpZ2luYWwsIG7Do28gw6kgZm9udGUgcHJpbcOhcmlhLg0KDQpQOiBQMT8NClI6IFIxDQoNClA6IFAyPw0KUjogUjINCg0KUDogUDMNClI6IFIzDQo=",
      "estudo/estudo_postits_20261117_230344.json": "Ww0KICAiUG9udG8gQSIsDQogICJQb250byBCIiwNCiAgIlBvbnRvIEMiLA0KICAiUG9udG8gRCINCl0=",
      "estudo/estudo_postits_20261117_230344.txt": "VElUVUxPOiBQb3N0LWl0cyDigJQgUHJvamV0byBEZXNrdG9wICgxNy8xMS8yMDI2IDIzOjAzKQ0KREFUQTogMTcvMTEvMjAyNiAyMzowMw0KQVZJU086IENvbnRlw7pkbyBnZXJhZG8gcG9yIElBIHZpYSBNb2RvIEVzdHVkbyDigJQgZGVyaXZhZG8gZG8gbWF0ZXJpYWwgb3JpZ2luYWwsIG7Do28gw6kgZm9udGUgcHJpbcOhcmlhLg0KDQotIFBvbnRvIEENCi0gUG9udG8gQg0KLSBQb250byBDDQotIFBvbnRvIEQNCg==",
      "estudo/estudo_resumo_20261117_230346.json": "IiMgVGVtYSBjZW50cmFsXG5cblJlZGVzIG5ldXJhaXMgYXByZW5kZW0gcGVzb3MuXG5cbiMjIENvbmNlaXRvcy1jaGF2ZVxuLSBHcmFkaWVudGVcbi0gUmV0cm9wcm9wYWdhw6fDo28i",
      "estudo/estudo_resumo_20261117_230346.txt": "VElUVUxPOiBSZXN1bW8g4oCUIFByb2pldG8gRGVza3RvcCAoMTcvMTEvMjAyNiAyMzowMykNCkRBVEE6IDE3LzExLzIwMjYgMjM6MDMNCkFWSVNPOiBDb250ZcO6ZG8gZ2VyYWRvIHBvciBJQSB2aWEgTW9kbyBFc3R1ZG8g4oCUIGRlcml2YWRvIGRvIG1hdGVyaWFsIG9yaWdpbmFsLCBuw6NvIMOpIGZvbnRlIHByaW3DoXJpYS4NCg0KIyBUZW1hIGNlbnRyYWwNCg0KUmVkZXMgbmV1cmFpcyBhcHJlbmRlbSBwZXNvcy4NCg0KIyMgQ29uY2VpdG9zLWNoYXZlDQotIEdyYWRpZW50ZQ0KLSBSZXRyb3Byb3BhZ2HDp8Ojbw0K",
      "estudo/_manifest.json": "Ww0KICB7DQogICAgImlkIjogIjIwMjYxMTE3XzIzMDM0Nl9yZXN1bW8iLA0KICAgICJ0aXBvIjogInJlc3VtbyIsDQogICAgInRpdHVsbyI6ICJSZXN1bW8g4oCUIFByb2pldG8gRGVza3RvcCAoMTcvMTEvMjAyNiAyMzowMykiLA0KICAgICJjcmlhZG9fZW0iOiAiMTcvMTEvMjAyNiAyMzowMyIsDQogICAgInByb2pldG8iOiAiUHJvamV0byBEZXNrdG9wIiwNCiAgICAidGVtYSI6ICIiLA0KICAgICJuX2l0ZW5zIjogMCwNCiAgICAiYXJxdWl2b190eHQiOiAiZXN0dWRvX3Jlc3Vtb18yMDI2MTExN18yMzAzNDYudHh0IiwNCiAgICAiYXJxdWl2b19qc29uIjogImVzdHVkb19yZXN1bW9fMjAyNjExMTdfMjMwMzQ2Lmpzb24iDQogIH0sDQogIHsNCiAgICAiaWQiOiAiMjAyNjExMTdfMjMwMzQ0X3Bvc3RpdHMiLA0KICAgICJ0aXBvIjogInBvc3RpdHMiLA0KICAgICJ0aXR1bG8iOiAiUG9zdC1pdHMg4oCUIFByb2pldG8gRGVza3RvcCAoMTcvMTEvMjAyNiAyMzowMykiLA0KICAgICJjcmlhZG9fZW0iOiAiMTcvMTEvMjAyNiAyMzowMyIsDQogICAgInByb2pldG8iOiAiUHJvamV0byBEZXNrdG9wIiwNCiAgICAidGVtYSI6ICIiLA0KICAgICJuX2l0ZW5zIjogMCwNCiAgICAiYXJxdWl2b190eHQiOiAiZXN0dWRvX3Bvc3RpdHNfMjAyNjExMTdfMjMwMzQ0LnR4dCIsDQogICAgImFycXVpdm9fanNvbiI6ICJlc3R1ZG9fcG9zdGl0c18yMDI2MTExN18yMzAzNDQuanNvbiINCiAgfSwNCiAgew0KICAgICJpZCI6ICIyMDI2MTExN18yMzAzNDNfZmxhc2hjYXJkcyIsDQogICAgInRpcG8iOiAiZmxhc2hjYXJkcyIsDQogICAgInRpdHVsbyI6ICJGbGFzaGNhcmRzIOKAlCByZWRlcyBuZXVyYWlzICgxNy8xMS8yMDI2IDIzOjAzKSIsDQogICAgImNyaWFkb19lbSI6ICIxNy8xMS8yMDI2IDIzOjAzIiwNCiAgICAicHJvamV0byI6ICJQcm9qZXRvIERlc2t0b3AiLA0KICAgICJ0ZW1hIjogInJlZGVzIG5ldXJhaXMiLA0KICAgICJuX2l0ZW5zIjogMiwNCiAgICAiYXJxdWl2b190eHQiOiAiZXN0dWRvX2ZsYXNoY2FyZHNfMjAyNjExMTdfMjMwMzQzLnR4dCIsDQogICAgImFycXVpdm9fanNvbiI6ICJlc3R1ZG9fZmxhc2hjYXJkc18yMDI2MTExN18yMzAzNDMuanNvbiINCiAgfQ0KXQ==",
      "management/digest_2026-01-05.md": "IyBEaWdlc3QgZGEgc2VtYW5hIOKAlCAyMDI2LTAxLTA1DQoNCj4gR2VyYWRvIGF1dG9tYXRpY2FtZW50ZSBwZWxvIFR1c2FiIMK3IDMgYXJxdWl2byhzKSBub3ZvKHMpDQoNCuKAoiBUZW1hIHVtDQrigKIgVGVtYSBkb2lzDQo=",
      "management/digest_2026-11-17.md": "IyBEaWdlc3QgZGEgc2VtYW5hIOKAlCAyMDI2LTExLTE3DQoNCjIgYXJxdWl2byhzKSBhZGljaW9uYWRvKHMpIGVzdGEgc2VtYW5hIGFvIHByb2pldG8gQFByb2pldG9fRGVza3RvcC4NCg0KQ29udGXDumRvcyBub3ZvczoNCuKAoiBhLnR4dA0K4oCiIGIudHh0DQo=",
      "management/flashcards.json": "ew0KICAiY2FuYWwiOiAiUHJvamV0byBEZXNrdG9wIiwNCiAgImdlcmFkb19lbSI6ICIyMDI2LTExLTE3VDIzOjAzOjQzIiwNCiAgImZsYXNoY2FyZHMiOiBbDQogICAgew0KICAgICAgImlkIjogImMxMTY2N2QyMzBjYSIsDQogICAgICAicGVyZ3VudGEiOiAiUDE/IiwNCiAgICAgICJyZXNwb3N0YSI6ICJSMSINCiAgICB9LA0KICAgIHsNCiAgICAgICJpZCI6ICI1MjNmMzhlMGYzYjQiLA0KICAgICAgInBlcmd1bnRhIjogIlAyPyIsDQogICAgICAicmVzcG9zdGEiOiAiUjIiDQogICAgfSwNCiAgICB7DQogICAgICAiaWQiOiAiMzBlNDVmMDI3NGVmIiwNCiAgICAgICJwZXJndW50YSI6ICJQMyIsDQogICAgICAicmVzcG9zdGEiOiAiUjMiDQogICAgfQ0KICBdDQp9",
      "management/flashcards_progresso.json": "ew0KICAiYzExNjY3ZDIzMGNhIjogew0KICAgICJyZXBldGljb2VzIjogMiwNCiAgICAiaW50ZXJ2YWxvX2RpYXMiOiA2LA0KICAgICJmYXRvcl9mYWNpbGlkYWRlIjogMi43LA0KICAgICJ1bHRpbWFfcmV2aXNhbyI6ICIyMDI2LTExLTE3IiwNCiAgICAicHJveGltYV9yZXZpc2FvIjogIjIwMjYtMTEtMjMiDQogIH0sDQogICI1MjNmMzhlMGYzYjQiOiB7DQogICAgInJlcGV0aWNvZXMiOiAwLA0KICAgICJpbnRlcnZhbG9fZGlhcyI6IDEsDQogICAgImZhdG9yX2ZhY2lsaWRhZGUiOiAxLjk2LA0KICAgICJ1bHRpbWFfcmV2aXNhbyI6ICIyMDI2LTExLTE3IiwNCiAgICAicHJveGltYV9yZXZpc2FvIjogIjIwMjYtMTEtMTgiDQogIH0NCn0=",
      "management/postits.json": "ew0KICAiY2FuYWwiOiAiUHJvamV0byBEZXNrdG9wIiwNCiAgImdlcmFkb19lbSI6ICIyMDI2LTExLTE3VDIzOjAzOjQ0IiwNCiAgInBvc3RpdHMiOiBbDQogICAgIlBvbnRvIEEiLA0KICAgICJQb250byBCIiwNCiAgICAiUG9udG8gQyIsDQogICAgIlBvbnRvIEQiDQogIF0NCn0=",
      "management/resumo_estudo.md": "IyBUZW1hIGNlbnRyYWwNCg0KUmVkZXMgbmV1cmFpcyBhcHJlbmRlbSBwZXNvcy4NCg0KIyMgQ29uY2VpdG9zLWNoYXZlDQotIEdyYWRpZW50ZQ0KLSBSZXRyb3Byb3BhZ2HDp8Ojbw=="
    },
    "artefatos": [
      {
        "id": "20261117_230346_resumo",
        "tipo": "resumo",
        "titulo": "Resumo — Projeto Desktop (17/11/2026 23:03)",
        "criado_em": "17/11/2026 23:03",
        "projeto": "Projeto Desktop",
        "tema": "",
        "n_itens": 0,
        "arquivo_txt": "estudo_resumo_20261117_230346.txt",
        "arquivo_json": "estudo_resumo_20261117_230346.json"
      },
      {
        "id": "20261117_230344_postits",
        "tipo": "postits",
        "titulo": "Post-its — Projeto Desktop (17/11/2026 23:03)",
        "criado_em": "17/11/2026 23:03",
        "projeto": "Projeto Desktop",
        "tema": "",
        "n_itens": 0,
        "arquivo_txt": "estudo_postits_20261117_230344.txt",
        "arquivo_json": "estudo_postits_20261117_230344.json"
      },
      {
        "id": "20261117_230343_flashcards",
        "tipo": "flashcards",
        "titulo": "Flashcards — redes neurais (17/11/2026 23:03)",
        "criado_em": "17/11/2026 23:03",
        "projeto": "Projeto Desktop",
        "tema": "redes neurais",
        "n_itens": 2,
        "arquivo_txt": "estudo_flashcards_20261117_230343.txt",
        "arquivo_json": "estudo_flashcards_20261117_230343.json"
      }
    ],
    "cards": [
      {
        "id": "c11667d230ca",
        "pergunta": "P1?",
        "resposta": "R1"
      },
      {
        "id": "523f38e0f3b4",
        "pergunta": "P2?",
        "resposta": "R2"
      },
      {
        "id": "30e45f0274ef",
        "pergunta": "P3",
        "resposta": "R3"
      }
    ],
    "postits": [
      "Ponto A",
      "Ponto B",
      "Ponto C",
      "Ponto D"
    ],
    "resumo": "# Tema central\n\nRedes neurais aprendem pesos.\n\n## Conceitos-chave\n- Gradiente\n- Retropropagação",
    "progresso": {
      "c11667d230ca": {
        "repeticoes": 2,
        "intervalo_dias": 6,
        "fator_facilidade": 2.7,
        "ultima_revisao": "2026-11-17",
        "proxima_revisao": "2026-11-23"
      },
      "523f38e0f3b4": {
        "repeticoes": 0,
        "intervalo_dias": 1,
        "fator_facilidade": 1.96,
        "ultima_revisao": "2026-11-17",
        "proxima_revisao": "2026-11-18"
      }
    }
  },
  "anki": "P1?;R1\nP2?;R2\nP3;R3"
};

let raiz;
const neural = () => path.join(raiz, 'data', 'neural');
const projetoDir = (p) => path.join(neural(), p);
const criarProjeto = (p) => fs.mkdirSync(projetoDir(p), { recursive: true });
const lerJsonDisco = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

before(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-estudo-'));
});
after(() => {
  fs.rmSync(raiz, { recursive: true, force: true });
});

// ── Equivalência com o Python ────────────────────────────────────────────────

test('round() do Python: empate para o par sobre o valor binário exato', () => {
  assert.equal(pyRound(12.5), 12);
  assert.equal(pyRound(13.5), 14);
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(37.5), 38);
  assert.equal(pyRound(2.675, 2), 2.67); // 2.67499999… em binário
  assert.equal(pyRound(0.125, 2), 0.12);
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(2.5 - 0.14 - 0.14, 2), 2.22);
  assert.equal(pyRound(1.3, 2), 1.3);
});

test('id do flashcard: sha1 da pergunta igual ao _id_flashcard do desktop', () => {
  for (const [pergunta, id] of REFERENCIA.ids) assert.equal(idFlashcard(pergunta), id, pergunta);
});

test('parsers de flashcards e post-its dão o mesmo resultado do Python', () => {
  for (const [entrada, esperado] of REFERENCIA.parsear_flashcards) {
    // Única diferença deliberada: no fallback "Q:/A:" o desktop não põe id; aqui põe.
    const comId = esperado.map((c) => ({ id: c.id ?? idFlashcard(c.pergunta), pergunta: c.pergunta, resposta: c.resposta }));
    assert.deepEqual(parsearFlashcardsJson(entrada), comId, entrada);
  }
  for (const [entrada, esperado] of REFERENCIA.parsear_postits) assert.deepEqual(parsearPostitsJson(entrada), esperado, entrada);
});

test(`SM-2: ${REFERENCIA.sm2.length} sequências de notas dão os mesmos estados do _aplicar_sm2`, () => {
  assert.ok(REFERENCIA.sm2_empates_para_baixo > 0, 'a referência cobre empates x.5 que o Python arredonda para baixo');
  const hoje = new Date(2026, 1, 27); // 27/02: as datas atravessam o fim do mês
  for (const { notas, estados } of REFERENCIA.sm2) {
    let estado = {};
    notas.forEach((q, i) => {
      estado = aplicarSm2(estado, q, hoje);
      assert.deepEqual([estado.repeticoes, estado.intervalo_dias, estado.fator_facilidade], estados[i], `notas ${notas.join(',')} passo ${i + 1}`);
      const esperada = new Date(2026, 1, 27 + estado.intervalo_dias);
      const iso = `${esperada.getFullYear()}-${String(esperada.getMonth() + 1).padStart(2, '0')}-${String(esperada.getDate()).padStart(2, '0')}`;
      assert.equal(estado.ultima_revisao, '2026-02-27');
      assert.equal(estado.proxima_revisao, iso);
    });
  }
  assert.equal(aplicarSm2({}, 5, new Date(2028, 1, 28)).proxima_revisao, '2028-02-29');
});

// ── Fluxo completo na extensão ───────────────────────────────────────────────

test('flashcards da IA → artefato → itens → fila de revisão → revisar → progresso persistido', async () => {
  criarProjeto('Biologia');
  const cards = [
    { pergunta: 'O que é mitose?', resposta: 'Divisão celular que gera duas células iguais.' },
    { question: '  O que é meiose? ', answer: 'Divisão que gera gametas.' },
    { front: 'DNA significa…', back: 'Ácido desoxirribonucleico; usa ; e\nquebra' },
  ];
  const agora = new Date(2026, 10, 17, 9, 30, 5);
  const r = salvarFlashcards(raiz, 'Biologia', cards, { tema: ' células ', fontes: ['aula1.txt', 'aula2.txt'], agora });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.total, 3);
  assert.deepEqual(r.flashcards.map((c) => c.id), r.flashcards.map((c) => idFlashcard(c.pergunta)));
  assert.equal(r.flashcards[1].pergunta, 'O que é meiose?');
  assert.deepEqual(r.artefatos[0], {
    id: '20261117_093005_flashcards', tipo: 'flashcards', titulo: 'Flashcards — células (17/11/2026 09:30)',
    criado_em: '17/11/2026 09:30', projeto: 'Biologia', tema: 'células', n_itens: 2,
    arquivo_txt: 'estudo_flashcards_20261117_093005.txt', arquivo_json: 'estudo_flashcards_20261117_093005.json',
  });

  // Em disco, como o desktop: management/flashcards.json + estudo/{txt,json,_manifest}
  const fc = lerJsonDisco(path.join(projetoDir('Biologia'), 'management', 'flashcards.json'));
  assert.deepEqual(Object.keys(fc), ['canal', 'gerado_em', 'flashcards']);
  assert.equal(fc.gerado_em, '2026-11-17T09:30:05');
  assert.deepEqual(fc.flashcards, r.flashcards);
  const txt = fs.readFileSync(path.join(projetoDir('Biologia'), 'estudo', 'estudo_flashcards_20261117_093005.txt'), 'utf8');
  assert.match(txt, /^TITULO: Flashcards — células \(17\/11\/2026 09:30\)\nDATA: 17\/11\/2026 09:30\nAVISO: Conteúdo gerado por IA via Modo Estudo — derivado do material original, não é fonte primária\.\n\nP: O que é mitose\?\nR: Divisão/);
  assert.deepEqual(listarArtefatos(raiz, 'Biologia').artefatos, r.artefatos);
  assert.deepEqual(lerEstudo(raiz, 'Biologia'), { flashcards: r.flashcards, resumo: null, total: 3 });

  // Itens do índice (seletor "Itens específicos")
  const textos = path.join(projetoDir('Biologia'), 'texts');
  fs.mkdirSync(textos, { recursive: true });
  fs.writeFileSync(path.join(textos, 'a1b2c3d4_aula1.txt'), `TITULO: Aula 1 — Células\nFONTE: texto\nDATA: 17/11/2026\n${'-'.repeat(70)}\nA célula é a unidade da vida.\n\nMitose e meiose.`);
  const indice = await Indice.abrir(raiz);
  try {
    indice.sincronizar();
    assert.deepEqual(listarItensEstudo(indice, 'Biologia'), {
      ok: true, itens: [{ arquivo: 'a1b2c3d4_aula1.txt', titulo: 'Aula 1 — Células', aba: 'texto', n_chunks: 1 }],
    });
    assert.deepEqual(listarItensEstudo(indice, 'Vazio'), { error: true, message: "Índice não encontrado para 'Vazio'. Indexe a base primeiro." });
    const pedido = pedidoGeracaoEstudo({ projeto_nome: 'Biologia', tipo: 'flashcards', n_cards: 5, tema: 'mitose', arquivos: ['a1b2c3d4_aula1.txt'] }, { indice });
    assert.equal(pedido.pedido, 'crie 5 flashcards sobre mitose do projeto Biologia, usando só: Aula 1 — Células');
  } finally {
    indice.fechar();
  }

  // Fila de hoje: os 3 (nunca revisados). Revisa: Fácil, Fácil, Não lembrei.
  const hoje = new Date(2026, 10, 17);
  assert.equal(filaRevisao(raiz, 'Biologia', { hoje }).total, 3);
  assert.deepEqual(progressoRevisao(raiz, 'Biologia'), { progresso: {} });
  const [c1, c2] = r.flashcards;
  const v1 = revisarCard(raiz, { projeto_nome: 'Biologia', card_id: c1.id, qualidade: 5 }, { hoje });
  assert.deepEqual(v1, { ok: true, card_id: c1.id, repeticoes: 1, intervalo_dias: 1, fator_facilidade: 2.6, ultima_revisao: '2026-11-17', proxima_revisao: '2026-11-18' });
  const v2 = revisarCard(raiz, { projeto_nome: 'Biologia', card_id: c1.id, qualidade: 5 }, { hoje: new Date(2026, 10, 18) });
  assert.deepEqual([v2.repeticoes, v2.intervalo_dias, v2.fator_facilidade, v2.proxima_revisao], [2, 6, 2.7, '2026-11-24']);
  const v3 = revisarCard(raiz, { projeto_nome: 'Biologia', card_id: c2.id, qualidade: 1 }, { hoje });
  assert.deepEqual([v3.repeticoes, v3.intervalo_dias, v3.fator_facilidade], [0, 1, 1.96]);

  // Persistido em management/flashcards_progresso.json, igual ao desktop (que fixou os mesmos números)
  const disco = lerJsonDisco(path.join(projetoDir('Biologia'), 'management', 'flashcards_progresso.json'));
  const { progresso: refProg } = REFERENCIA.desktop;
  const [ref1, ref2] = Object.values(refProg);
  assert.deepEqual([disco[c1.id].repeticoes, disco[c1.id].intervalo_dias, disco[c1.id].fator_facilidade], [ref1.repeticoes, ref1.intervalo_dias, ref1.fator_facilidade]);
  assert.deepEqual([disco[c2.id].repeticoes, disco[c2.id].intervalo_dias, disco[c2.id].fator_facilidade], [ref2.repeticoes, ref2.intervalo_dias, ref2.fator_facilidade]);
  assert.deepEqual(progressoRevisao(raiz, 'Biologia').progresso, disco);
  assert.deepEqual(Object.keys(disco[c1.id]), ['repeticoes', 'intervalo_dias', 'fator_facilidade', 'ultima_revisao', 'proxima_revisao']);

  // Em 19/11: c1 só volta em 24/11; c2 (vence 18/11) e c3 (nunca revisado) estão na fila
  const fila = filaRevisao(raiz, 'Biologia', { hoje: new Date(2026, 10, 19) });
  assert.deepEqual(fila.cards.map((c) => c.id).sort(), [c2.id, r.flashcards[2].id].sort());

  // Anki: CSV "pergunta;resposta", ';' vira ',' e quebra de linha vira espaço
  const anki = exportarFlashcardsAnki(raiz, 'Biologia');
  assert.equal(anki.download.nome, 'tusab_Biologia_flashcards.csv');
  assert.equal(anki.download.tipo, 'text/csv; charset=utf-8');
  assert.equal(anki.download.conteudo.toString('utf8'), [
    'O que é mitose?;Divisão celular que gera duas células iguais.',
    'O que é meiose?;Divisão que gera gametas.',
    'DNA significa…;Ácido desoxirribonucleico, usa , e quebra',
  ].join('\n'));
});

test('artefatos: post-its e resumo, listar (mais recente primeiro), ler, renomear, excluir', () => {
  criarProjeto('Historia');
  const agora = new Date(2026, 10, 17, 10, 0, 0);
  const p = salvarPostits(raiz, 'Historia', ['A Revolução Francesa começou em 1789.', { texto: 'Queda da Bastilha.' }], { agora });
  assert.equal(p.ok, true, p.message);
  assert.deepEqual(p.postits, ['A Revolução Francesa começou em 1789.', 'Queda da Bastilha.']);
  assert.equal(p.artefatos[0].titulo, 'Post-its — Historia (17/11/2026 10:00)');
  const pj = lerJsonDisco(path.join(projetoDir('Historia'), 'management', 'postits.json'));
  assert.deepEqual(pj, { canal: 'Historia', gerado_em: '2026-11-17T10:00:00', postits: p.postits });

  // Mesmo segundo e mesmo tipo: o desktop sobrescreveria; aqui o carimbo avança 1 s.
  const p2 = salvarArtefato(raiz, 'Historia', { tipo: 'postits', conteudo: '- Napoleão\n- Waterloo', agora });
  assert.equal(p2.artefatos[0].id, '20261117_100001_postits');
  assert.deepEqual(p2.postits, ['Napoleão', 'Waterloo']);

  const resumo = '# Tema central\r\n\r\nA Revolução mudou a França.\r\n\r\n## Conceitos-chave\r\n- Liberdade';
  const rs = salvarResumo(raiz, 'Historia', resumo, { tema: 'revolução', titulo: 'Meu resumo', agora });
  assert.equal(rs.ok, true, rs.message);
  assert.equal(rs.artefatos[0].titulo, 'Meu resumo');
  assert.equal(rs.artefatos[0].tema, 'revolução');
  assert.equal(fs.readFileSync(path.join(projetoDir('Historia'), 'management', 'resumo_estudo.md'), 'utf8'), resumo.replace(/\r\n/g, '\n'));
  assert.equal(lerEstudo(raiz, 'Historia').resumo, resumo.replace(/\r\n/g, '\n'));

  const lista = listarArtefatos(raiz, 'Historia').artefatos;
  assert.deepEqual(lista.map((a) => a.id), ['20261117_100000_resumo', '20261117_100001_postits', '20261117_100000_postits']);

  const lido = lerArtefato(raiz, 'Historia', '20261117_100000_resumo');
  assert.equal(lido.ok, true);
  assert.equal(lido.dados, resumo.replace(/\r\n/g, '\n')); // resumo: o .json guarda a string
  assert.deepEqual(lerArtefato(raiz, 'Historia', '20261117_100000_postits').dados, p.postits);
  assert.deepEqual(lerArtefato(raiz, 'Historia', 'nao-existe'), { error: true, message: 'Artefato não encontrado.' });

  const ren = renomearArtefato(raiz, { projeto_nome: 'Historia', artefato_id: '20261117_100000_postits', titulo: '  Revolução  ' });
  assert.equal(ren.artefato.titulo, 'Revolução');
  assert.equal(listarArtefatos(raiz, 'Historia').artefatos[2].titulo, 'Revolução');

  // Excluir: some do manifesto e os arquivos saem da pasta (inclusive o .wav, se houver)
  const estudo = path.join(projetoDir('Historia'), 'estudo');
  fs.writeFileSync(path.join(estudo, 'estudo_postits_20261117_100001.wav'), 'RIFF');
  const manifesto = lerJsonDisco(path.join(estudo, '_manifest.json'));
  manifesto.find((e) => e.id === '20261117_100001_postits').arquivo_audio = 'estudo_postits_20261117_100001.wav';
  fs.writeFileSync(path.join(estudo, '_manifest.json'), JSON.stringify(manifesto));
  assert.deepEqual(excluirArtefato(raiz, 'Historia', '20261117_100001_postits'), { ok: true });
  assert.deepEqual(fs.readdirSync(estudo).filter((n) => n.includes('100001')), []);
  assert.equal(listarArtefatos(raiz, 'Historia').artefatos.length, 2);
  assert.deepEqual(excluirArtefato(raiz, 'Historia', '20261117_100001_postits'), { error: true, message: 'Artefato não encontrado.' });

  // Arquivo apagado por fora do app: a entrada órfã sai e o manifesto é regravado
  fs.rmSync(path.join(estudo, 'estudo_resumo_20261117_100000.json'));
  assert.deepEqual(listarArtefatos(raiz, 'Historia').artefatos.map((a) => a.id), ['20261117_100000_postits']);
  assert.equal(lerJsonDisco(path.join(estudo, '_manifest.json')).length, 1);
});

// ── Projeto criado pelo desktop ──────────────────────────────────────────────

test('projeto estudado no desktop (arquivos gerados pelo Python, com \\r\\n) abre na extensão', () => {
  const { prefixo, projeto_nome: nome, arquivos, artefatos, cards, postits, resumo, progresso } = REFERENCIA.desktop;
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    const destino = path.join(projetoDir(prefixo), ...rel.split('/'));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(conteudo, 'base64'));
  }
  assert.ok(Buffer.from(arquivos['estudo/_manifest.json'], 'base64').includes('\r\n'), 'referência gravada com \\r\\n');

  // O nome com espaço vira o mesmo prefixo do desktop
  assert.deepEqual(listarArtefatos(raiz, nome).artefatos, artefatos);
  assert.deepEqual(lerArtefato(raiz, nome, artefatos[2].id).dados, cards);
  assert.deepEqual(lerArtefato(raiz, nome, artefatos[1].id).dados, postits);
  assert.equal(lerArtefato(raiz, nome, artefatos[0].id).dados, resumo);
  assert.deepEqual(lerEstudo(raiz, nome), { flashcards: cards, resumo, total: cards.length });
  assert.deepEqual(progressoRevisao(raiz, nome), { progresso });
  assert.equal(exportarFlashcardsAnki(raiz, nome).download.conteudo.toString('utf8'), REFERENCIA.anki);

  const { digests } = listarDigests(raiz, nome);
  assert.deepEqual(digests.map((d) => d.data), [...digests.map((d) => d.data)].sort().reverse());
  assert.equal(digests.at(-1).filename, 'digest_2026-01-05.md');
  assert.equal(digests.at(-1).preview, '# Digest da semana — 2026-01-05\n\n> Gerado automaticamente pelo Tusab · 3 arquivo(s) novo(s)\n\n• Tema um\n• Tema dois');

  // Continuar a revisão começada no desktop: parte do estado salvo pelo Python
  const [id1] = Object.keys(progresso);
  const r = revisarCard(raiz, { projeto_nome: nome, card_id: id1, qualidade: 4 }, { hoje: new Date(2026, 10, 20) });
  assert.deepEqual([r.repeticoes, r.intervalo_dias, r.fator_facilidade], [3, 16, 2.7]); // round(6 × 2.7) = 16

  // A extensão grava no mesmo manifesto, sem perder o que o desktop fez
  const novo = salvarFlashcards(raiz, nome, [{ pergunta: 'Nova?', resposta: 'Sim.' }], { agora: new Date(2026, 10, 20, 8, 0, 0) });
  assert.equal(novo.ok, true, novo.message);
  assert.deepEqual(listarArtefatos(raiz, nome).artefatos.map((a) => a.id), [novo.artefatos[0].id, ...artefatos.map((a) => a.id)]);
  // A fila junta o último lote e os cards dos artefatos antigos (sem repetir id)
  const fila = filaRevisao(raiz, nome, { hoje: new Date(2026, 10, 20) });
  assert.ok(fila.cards.some((c) => c.pergunta === 'Nova?'));
  assert.ok(fila.cards.some((c) => c.id === cards[2].id));
});

// ── Entradas inválidas ───────────────────────────────────────────────────────

test('entradas inválidas da IA são recusadas sem gravar nada', () => {
  criarProjeto('Fisica');
  const recusa = (r, trecho) => {
    assert.equal(r.error, true, JSON.stringify(r));
    assert.match(r.message, trecho);
  };
  recusa(salvarFlashcards(raiz, 'NaoExiste', [{ pergunta: 'a', resposta: 'b' }]), /Projeto 'NaoExiste' não encontrado/);
  recusa(salvarFlashcards(raiz, '', [{ pergunta: 'a', resposta: 'b' }]), /Informe o projeto/);
  recusa(salvarFlashcards(raiz, '../..', [{ pergunta: 'a', resposta: 'b' }]), /não encontrado|válido/);
  recusa(salvarFlashcards(raiz, 'Fisica', { pergunta: 'a' }), /array/);
  recusa(salvarFlashcards(raiz, 'Fisica', []), /Nenhum flashcard válido/);
  recusa(salvarFlashcards(raiz, 'Fisica', 'sem formato nenhum'), /Não encontrei flashcards/);
  recusa(salvarFlashcards(raiz, 'Fisica', Array.from({ length: 31 }, (_, i) => ({ pergunta: `P${i}`, resposta: 'R' }))), /máximo por vez é 30/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'Ok?', resposta: 'Sim' }, { pergunta: 'Sem resposta?' }]), /n\.º 2: falta a resposta/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: '   ', resposta: 'x' }]), /n\.º 1, pergunta: está vazio/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'x'.repeat(LIMITES.pergunta + 1), resposta: 'y' }]), /máximo 500/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'Igual?', resposta: 'a' }, { pergunta: ' Igual? ', resposta: 'b' }]), /n\.º 1 e 2 têm a mesma pergunta/);
  recusa(salvarFlashcards(raiz, 'Fisica', ['texto solto']), /n\.º 1: precisa ser um objeto/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'a', resposta: 'b' }], { tema: 't'.repeat(201) }), /tema: .*máximo 200/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'a', resposta: 'b' }], { fontes: 'um.txt' }), /fontes: precisa ser uma lista/);
  recusa(salvarFlashcards(raiz, 'Fisica', [{ pergunta: 'a', resposta: 'b' }], { titulo: 'x'.repeat(151) }), /titulo: .*máximo 150/);
  recusa(salvarPostits(raiz, 'Fisica', [42n]), /precisa ser um texto/);
  recusa(salvarPostits(raiz, 'Fisica', ['ok', 'x'.repeat(401)]), /Post-it n\.º 2: .*máximo 400/);
  recusa(salvarResumo(raiz, 'Fisica', '   '), /resumo está vazio/);
  recusa(salvarResumo(raiz, 'Fisica', ['não é texto']), /como texto/);
  recusa(salvarResumo(raiz, 'Fisica', 'x'.repeat(LIMITES.resumo + 1)), /máximo 30000/);
  recusa(salvarArtefato(raiz, 'Fisica', { tipo: 'mapa', conteudo: 'x' }), /Tipo inválido/);
  assert.equal(fs.existsSync(path.join(projetoDir('Fisica'), 'estudo')), false);
  assert.equal(fs.existsSync(path.join(projetoDir('Fisica'), 'management')), false);

  // Corpo das rotas (o FastAPI responderia 422)
  assert.throws(() => revisarCard(raiz, { projeto_nome: 'Fisica', card_id: 'abc', qualidade: 6 }), ErroValidacao);
  assert.throws(() => revisarCard(raiz, { projeto_nome: 'Fisica', card_id: 'abc', qualidade: 2.5 }), ErroValidacao);
  assert.throws(() => revisarCard(raiz, { projeto_nome: 'Fisica', card_id: 'x'.repeat(33), qualidade: 3 }), ErroValidacao);
  assert.throws(() => revisarCard(raiz, { card_id: 'abc', qualidade: 3 }), ErroValidacao);
  assert.throws(() => renomearArtefato(raiz, { projeto_nome: 'Fisica', artefato_id: 'a', titulo: '' }), ErroValidacao);
  assert.throws(() => renomearArtefato(raiz, { projeto_nome: 'Fisica', artefato_id: 'a', titulo: 'x'.repeat(151) }), ErroValidacao);
  assert.equal(new ErroValidacao('x').status, 422);
  assert.deepEqual(revisarCard(raiz, { projeto_nome: '***', card_id: 'abc', qualidade: '3' }), { error: true, message: 'Projeto não especificado.' });

  // Manifesto adulterado não faz o Tusab ler nem apagar fora da pasta estudo/
  const estudo = path.join(projetoDir('Fisica'), 'estudo');
  fs.mkdirSync(estudo, { recursive: true });
  const fora = path.join(projetoDir('Fisica'), 'segredo.txt');
  fs.writeFileSync(fora, 'não apagar');
  fs.writeFileSync(path.join(estudo, '_manifest.json'), JSON.stringify([{ id: 'x', tipo: 'resumo', arquivo_txt: '../segredo.txt', arquivo_json: '../segredo.txt' }]));
  assert.deepEqual(listarArtefatos(raiz, 'Fisica').artefatos, []);
  assert.ok(fs.existsSync(fora));

  // Projeto vazio/inválido nas leituras: as respostas neutras do desktop
  assert.deepEqual(lerEstudo(raiz, '***'), { flashcards: [], resumo: null, total: 0 });
  assert.deepEqual(listarArtefatos(raiz, ''), { artefatos: [] });
  assert.deepEqual(progressoRevisao(raiz, ''), { progresso: {} });
  assert.deepEqual(listarDigests(raiz, ''), { digests: [] });
  assert.deepEqual(exportarFlashcardsAnki(raiz, 'Fisica'), { error: true, message: "Nenhum flashcard encontrado para 'Fisica'. Gere os flashcards primeiro." });
});

// ── Geração pela IA, TTS e digest ────────────────────────────────────────────

test('geração e TTS respondem no formato que a interface já trata', () => {
  const fc = pedidoGeracaoEstudo({ projeto_nome: 'Biologia', tipo: 'flashcards', n_cards: 10, tema: 'capitalismo' });
  assert.equal(fc.error, true);
  assert.equal(fc.gerar_pela_ia, true);
  assert.equal(fc.message, 'Na extensão, quem gera é a sua IA. Peça à sua IA: ‘crie 10 flashcards sobre capitalismo do projeto Biologia’. O resultado aparece aqui no Estudo.');
  assert.equal(pedidoGeracaoEstudo({ projeto_nome: 'Biologia', tipo: 'resumo' }).pedido, 'crie um resumo de estudo do projeto Biologia');
  assert.equal(pedidoGeracaoEstudo({ projeto_nome: 'Biologia', tipo: 'postits', n_cards: 15 }).pedido, 'crie 15 post-its do projeto Biologia');
  assert.equal(pedidoGeracaoEstudo({ canal_nome: 'Biologia', tipo: 'ambos', n_cards: 5 }).pedido, 'crie 5 flashcards e um resumo de estudo do projeto Biologia');
  assert.deepEqual(pedidoGeracaoEstudo({ projeto_nome: 'Biologia', tipo: 'quiz' }), { error: true, message: 'Tipo inválido. Use: flashcards, resumo, postits ou ambos.' });
  assert.deepEqual(pedidoGeracaoEstudo({ projeto_nome: '' }), { error: true, message: 'Projeto não especificado.' });
  assert.deepEqual(ttsIndisponivel(), { error: true, message: 'TTS não disponível nesta edição do Tusab.' });
});

test('digest: pedido à IA, gravação no formato do desktop e listagem', () => {
  criarProjeto('Semana');
  assert.deepEqual(pedidoGeracaoDigest(raiz, 'Semana'), { ok: false, message: 'Nenhum arquivo novo esta semana.' });
  assert.deepEqual(pedidoGeracaoDigest(raiz, '***'), { ok: false, message: 'Projeto inválido.' });
  const r0 = salvarDigest(raiz, 'Semana', '• algo');
  assert.equal(r0.error, true);
  assert.equal(r0.message, 'Nenhum arquivo novo esta semana.');

  const textos = path.join(projetoDir('Semana'), 'texts');
  fs.mkdirSync(textos, { recursive: true });
  fs.writeFileSync(path.join(textos, 'novo.txt'), 'conteúdo novo');
  fs.writeFileSync(path.join(textos, '_manifest.json'), '[]');
  const antigo = path.join(textos, 'antigo.txt');
  fs.writeFileSync(antigo, 'velho');
  const dezDias = (Date.now() - 10 * 86400_000) / 1000;
  fs.utimesSync(antigo, dezDias, dezDias);
  assert.deepEqual(arquivosNovosDaSemana(raiz, 'Semana'), [{ nome: 'novo.txt', sub: 'texts' }]);

  const pedido = pedidoGeracaoDigest(raiz, 'Semana');
  assert.equal(pedido.ok, false);
  assert.equal(pedido.gerar_pela_ia, true);
  assert.match(pedido.message, /Peça à sua IA: ‘crie o digest da semana do projeto Semana’ \(1 arquivo\(s\) novo\(s\)\)/);

  const r = salvarDigest(raiz, 'Semana', '• Tema A\r\n• Tema B');
  assert.equal(r.ok, true, r.message);
  assert.equal(r.filename, `digest_${r.data}.md`);
  // Mesmo dia: substitui o arquivo, como o desktop
  const r2 = salvarDigest(raiz, 'Semana', '• Tema C');
  assert.equal(r2.filename, r.filename);
  const conteudo = fs.readFileSync(path.join(projetoDir('Semana'), 'management', r.filename), 'utf8');
  assert.equal(conteudo, `# Digest da semana — ${r.data}\n\n> Gerado automaticamente pelo Tusab · 1 arquivo(s) novo(s)\n\n• Tema C\n`);
  assert.equal(salvarDigest(raiz, 'Semana', '').message, 'O digest está vazio.');
  assert.deepEqual(listarDigests(raiz, 'Semana').digests, [{ data: r.data, preview: conteudo.slice(0, 200).trim(), filename: r.filename }]);
});

test('documento: o que a IA gera e não é resumo (quiz, mapa mental, plano de aula...) vira material para abrir na tela', () => {
  criarProjeto('Aulas');
  const agora = new Date(2026, 10, 19, 9, 0, 0);
  const md = '# Quiz — fotossíntese\r\n\r\n1. O que a clorofila absorve?\r\n\r\n```mermaid\r\nmindmap\r\n  root((Fotossíntese))\r\n```';
  const r = salvarArtefato(raiz, 'Aulas', { tipo: 'documento', conteudo: md, titulo: 'Quiz de fotossíntese', tema: 'fotossíntese', agora });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.artefatos[0].id, '20261119_090000_documento');
  assert.equal(r.artefatos[0].tipo, 'documento');
  assert.equal(r.artefatos[0].titulo, 'Quiz de fotossíntese');
  assert.equal(lerArtefato(raiz, 'Aulas', '20261119_090000_documento').dados, md.replace(/\r\n/g, '\n'));
  // Sem título: o automático diz o tipo
  const r2 = salvarArtefato(raiz, 'Aulas', { tipo: 'documento', conteudo: 'Plano de aula', agora });
  assert.equal(r2.artefatos[0].titulo, 'Documento — Aulas (19/11/2026 09:00)');
  // Não mexe nos arquivos de management/ do desktop (resumo_estudo.md continua sendo só do resumo)
  assert.equal(fs.existsSync(path.join(projetoDir('Aulas'), 'management', 'resumo_estudo.md')), false);
  // Recusas
  assert.match(salvarArtefato(raiz, 'Aulas', { tipo: 'documento', conteudo: '   ' }).message, /vazio/);
  assert.match(salvarArtefato(raiz, 'Aulas', { tipo: 'documento', conteudo: ['a'] }).message, /Markdown/);
  assert.match(salvarArtefato(raiz, 'Aulas', { tipo: 'documento', conteudo: 'x'.repeat(60001) }).message, /60000/);
  assert.match(salvarArtefato(raiz, 'Aulas', { tipo: 'video', conteudo: 'x' }).message, /documento/);
});

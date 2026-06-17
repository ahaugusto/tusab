# Empacotamento, Distribuição e Estratégia de Código — Tusab

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Criado em:** 12 de junho de 2026

---

## 1. O que é um smoke test — explicação simples

Um smoke test é o teste mais básico possível: **"isso liga?"**

Não testa funcionalidades. Não testa casos de borda. Só verifica se o produto
arranca sem explodir — como ligar um carro novo e ver se o motor pega antes de
sair rodando.

Se o smoke test falha, nada mais adianta testar. Se passa, você tem a garantia
mínima de que o produto existe como objeto funcional.

---

## 2. Dois modos de funcionar — por que a diferença importa

O Tusab tem dois modos de existência completamente diferentes:

**Modo desenvolvimento**
Você roda direto do código-fonte na sua máquina de trabalho. Ela já tem Python
instalado, Node.js, todas as bibliotecas, o yt-dlp. O produto funciona porque
a máquina já é um ambiente preparado. Nenhum cliente vai ter isso.

**Modo empacotado**
Um único arquivo `.exe` que você manda para o cliente. A máquina dele não tem
nada instalado — nunca teve. O Python, as 76 bibliotecas, o yt-dlp, o frontend
compilado — tudo tem que estar dentro da pasta do app. É o único modo que importa
para distribuição real.

Saber que o app funciona no modo desenvolvimento **não garante nada** sobre o
modo empacotado. São dois cenários completamente diferentes, e muita coisa pode
quebrar na travessia entre eles. O smoke test do app empacotado é a validação
que fecha essa lacuna.

---

## 3. O que foi montado para o build empacotado

### `electron/python_env/` — o Python embutido

O app precisa de um servidor Python rodando por baixo (FastAPI na porta 8001).
Na máquina do cliente esse Python não existe. A solução é incluir uma cópia
portátil do Python dentro do pacote — o "Python embeddable", uma distribuição
sem instalador que roda de qualquer pasta.

O que foi montado:
- Python 3.12.10 Windows embeddable (64-bit)
- pip 26.1.2 instalado sobre ele
- 76 bibliotecas do `requirements-lock.txt` instaladas (FastAPI, uvicorn, BM25, etc.)
- Verificado: `import fastapi, uvicorn, rank_bm25` → OK

É como incluir a cozinha completa na caixa de entrega, em vez de pedir para o
cliente montar a cozinha antes de abrir o produto.

**Por que Python 3.12 e não 3.14:**
A versão 3.14.0 embeddable tem um bug conhecido no Windows — a stdlib não carrega
corretamente, resultando em `No module named 'encodings'` mesmo com configuração
correta. A 3.12.10 é estável e amplamente testada nesse formato.

**Armadilha do encoding no `.pth`:**
O arquivo `python312._pth` configura os caminhos do Python. Ele precisa ser
UTF-8 sem BOM. O comando padrão do PowerShell (`Set-Content -Encoding UTF8`)
escreve UTF-8 COM BOM — três bytes invisíveis no início do arquivo que corrompem
o primeiro caminho (`﻿python312.zip` em vez de `python312.zip`), resultando em
`No module named 'encodings'`. A solução usa a API .NET diretamente:
`[System.IO.File]::WriteAllText(..., [System.Text.UTF8Encoding]::new($false))`.

### `electron/bin/yt-dlp.exe` — o downloader do YouTube

O yt-dlp é a ferramenta que baixa as transcrições dos canais. Também precisa
estar dentro do pacote, pronto para usar sem instalação.

- Versão empacotada: 2026.03.17 (17,6 MB)
- Verificado: `yt-dlp.exe --version` → confirmado

### `build.ps1` — o script de build

O `build.ps1` é o script que monta tudo num único comando: compila o frontend
(Vite/React), empacota o Electron com todas as dependências Python, copia o
yt-dlp. Resultado: a pasta `dist_electron/win-unpacked/` com o app pronto.

**Problema de encoding encontrado e resolvido:**
O script estava quebrando com `TerminatorExpectedAtEndOfString` mesmo sem erros
visíveis. Causa raiz: o arquivo era salvo em UTF-8, mas o PowerShell 5.1 do
Windows lê scripts como ANSI/Windows-1252 por padrão. Os caracteres especiais
do português (acentos, hífens tipográficos) no código-fonte viravam sequências
inválidas dentro de strings, quebrando o parser. A solução definitiva foi
reescrever o arquivo em UTF-16 LE com BOM — o encoding nativo do PowerShell 5.1,
que ele lê sem ambiguidade.

O parser interno (`[System.Management.Automation.Language.Parser]::ParseFile`)
dizia "Parse OK" mesmo com o bug — porque ele usa .NET (UTF-8 correto), enquanto
a execução real do PowerShell 5.1 usava ANSI. Diagnóstico revelado só quando
o comportamento dos dois divergiu explicitamente.

---

## 4. Resultado do smoke test empacotado — 12/06/2026

Comando executado:
```
build.ps1 -Dir
```

Saída resumida:
- Vite: 2.244 módulos compilados em 3,1s ✅
- electron-builder `--dir`: `python_env/` copiado, `yt-dlp.exe` copiado, `app.asar` gerado ✅
- `tusab.exe` lançado: backend FastAPI respondeu `HTTP 200 /status` em **2 segundos** ✅

Estrutura verificada em `dist_electron/win-unpacked/resources/`:
```
resources/
  app/          ← código do app Electron (main.js, preload, etc.)
  bin/          ← yt-dlp.exe
  python_env/   ← Python 3.12 + 76 pacotes
  app.asar      ← frontend compilado
```

**Aviso registrado (não bloqueante):**
`FutureWarning: google.generativeai` — o SDK clássico do Gemini está deprecado.
Não impacta funcionamento. Pendente migração para `google-genai` em versão futura.

---

## 5. Análise de impacto: código aberto vs. fechado

### O ponto central

O yt-dlp precisa de **atualizações frequentes** para continuar funcionando. O
YouTube muda suas APIs regularmente — às vezes semanalmente. Um yt-dlp
desatualizado simplesmente para de baixar transcrições, sem aviso claro.

Isso cria uma dinâmica de valor que vai além do código em si: **a manutenção
contínua é o produto**, não apenas o software inicial.

### Se o código for aberto

- Qualquer usuário técnico vê imediatamente que o yt-dlp é um componente
  separado e como atualizá-lo manualmente (substituir o `.exe`)
- Fóruns e comunidades publicariam tutoriais em dias: "como manter o Tusab
  atualizado sem pagar"
- O argumento de assinatura baseado em atualizações desaparece
- O trabalho de empacotamento — que levou sessões inteiras de resolução de
  problemas não documentados — vira commodity

### Se o código for fechado

- O usuário não sabe que o yt-dlp existe — ele só sabe que "o app baixa YouTube"
- A atualização do yt-dlp vira entrega de valor percebido: "nova versão disponível,
  app está mais rápido com o YouTube"
- O tier gratuito com yt-dlp desatualizado cria fricção natural que incentiva
  upgrade — sem sabotagem intencional, só degradação natural com o tempo
- O trabalho de empacotamento, resolução de bugs de encoding, setup do Python
  embeddable — tudo isso permanece como vantagem de execução não replicável
  facilmente

### O que o código aberto daria

- Contribuições externas (issues, pull requests)
- Credibilidade técnica para desenvolvedores
- Comunidade de evangelistas
- Caminho para grants ou parcerias institucionais open-source

### A tensão real

O modelo de negócio documentado é **freemium + licença perpétua + B2B**. Esse
modelo depende de haver algo que justifique pagar. Com código aberto, o único
diferencial que permanece é suporte e conveniência — não a funcionalidade em si.

Com código fechado, a manutenção do yt-dlp se torna um serviço contínuo e
invisível ao usuário — que não precisa saber o que é, só que o app "continua
funcionando com o YouTube".

### Conclusão

**O modelo de receita escolhido e o código aberto são estruturalmente incompatíveis
no caso específico do Tusab.**

O esforço de empacotamento realizado (Python embeddable, resolução de bugs de
encoding, integração electron-builder, smoke test) representa uma barreira de
execução real. Abrir o código não entrega essa barreira — mas entrega o roteiro
para replicá-la. Para um produto cujo diferencial está na integração, no
empacotamento e na manutenção, o código fechado protege o que foi construído.

A decisão de manter fechado não precisa ser permanente. O caminho natural é:
1. Fechar agora para validar o modelo de receita
2. Abrir partes não estratégicas (como documentação, schemas de API)
3. Avaliar open-core após primeira validação de pagamento (B2B)

---

*Documento criado em 12/06/2026 · Tusab v3.0 · © 2026 CriAugu*

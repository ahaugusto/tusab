# Política de Privacidade — Brain'IAC

**Versão:** 1.0  
**Data de vigência:** 12 de junho de 2026  
**Responsável:** CriAugu — CNPJ 65.131.075/0001-57  
**Contato:** augusto.brasil@saude.gov.br

---

## 1. Apresentação

O Brain'IAC é um sistema de gestão de conhecimento pessoal (PKM) com IA local, desenvolvido e comercializado por CriAugu. Esta Política descreve como coletamos, usamos, armazenamos e protegemos seus dados em conformidade com a **Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)** e com o **GDPR (Regulamento UE 2016/679)**, onde aplicável.

---

## 2. Dados Coletados

### 2.1 Dados processados localmente (sem transferência)

O Brain'IAC opera com princípio **local-first**. Os dados abaixo são processados exclusivamente na máquina do usuário e **nunca são enviados aos nossos servidores**:

| Dado | Finalidade | Local de armazenamento |
|------|------------|------------------------|
| Transcrições de vídeos do YouTube | Base de conhecimento pessoal | `<pasta de dados>/cerebro/` |
| Documentos PDF / DOCX / TXT enviados | Enriquecimento da base | `<pasta de dados>/cerebro/` |
| Textos manuais inseridos | Enriquecimento da base | `<pasta de dados>/cerebro/` |
| Índice BM25 gerado | Busca semântica local | `<pasta de dados>/cerebro/` |
| Configurações do agente (provedor, modelo) | Preferências do usuário | `<pasta de dados>/config/agent_config.json` |
| Histórico de chat (última sessão) | Contexto da conversa | Memória RAM — não persiste entre sessões |

### 2.2 Chaves de API de terceiros

O usuário pode opcionalmente fornecer chaves de API de provedores externos (Groq, OpenAI, Google Gemini, Anthropic). Essas chaves:

- São armazenadas **exclusivamente em `config/agent_config.json`** na máquina local.
- **Nunca são transmitidas a servidores da CriAugu**.
- São usadas diretamente do dispositivo do usuário para chamar os provedores escolhidos.
- **O usuário assume a responsabilidade** pela segurança dessas chaves no próprio dispositivo.

> ⚠️ Recomendamos não incluir a pasta `config/` em backups automáticos em nuvem.

### 2.3 Telemetria de uso (opcional — requer consentimento explícito)

Com o **consentimento expresso** do usuário (opt-in via modal na primeira execução), coletamos eventos anônimos de uso através do PostHog:

| Evento coletado | Dados associados |
|-----------------|-----------------|
| Abertura do aplicativo | Data/hora, versão do app |
| Início de extração | Tipos de conteúdo selecionados |
| Indexação iniciada | Nenhum dado de conteúdo |
| Chat enviado | Modalidade (ampla/restrita), provedor de IA |
| Provedor configurado | Nome do provedor (ex: "gemini") |

**Dados que NÃO são coletados na telemetria:**
- Conteúdo de mensagens ou perguntas do chat
- URLs de canais ou nomes de conteúdo
- Chaves de API
- Qualquer dado pessoal identificável

O usuário pode **revogar o consentimento** a qualquer momento nas configurações do agente (seção "Telemetria e Privacidade").

### 2.4 Integração com Google Drive (opcional)

Se o usuário optar por ativar a sincronização com o Google Drive:

- A autenticação OAuth2 é realizada **diretamente pelo dispositivo do usuário** com os servidores do Google.
- O `token.json` de acesso é armazenado localmente em `config/token.json`.
- A CriAugu **não tem acesso** ao token ou aos arquivos do Drive do usuário.
- O escopo de acesso solicitado ao Google é o mínimo necessário: criação e leitura de arquivos na pasta específica do Brain'IAC.

---

## 3. Base Legal para o Tratamento (LGPD / GDPR)

| Finalidade | Base legal (LGPD) | Base legal (GDPR) |
|------------|-------------------|-------------------|
| Processamento local da base de conhecimento | Art. 7º, I — Consentimento | Art. 6(1)(b) — Execução de contrato |
| Configuração e uso do agente IA | Art. 7º, V — Legítimo interesse | Art. 6(1)(f) — Legítimo interesse |
| Telemetria de uso | Art. 7º, I — Consentimento explícito | Art. 6(1)(a) — Consentimento |
| Armazenamento de chaves de API | Art. 7º, V — Legítimo interesse | Art. 6(1)(b) — Execução de contrato |

---

## 4. Transferência Internacional de Dados

Ao utilizar provedores de IA externos (OpenAI, Google Gemini, Anthropic, Groq), **o conteúdo das consultas (perguntas e contexto de busca)** é transmitido aos servidores desses provedores, que podem estar localizados fora do Brasil.

O Brain'IAC exibe um aviso explícito no painel de configuração ao selecionar um provedor externo. Ao configurar e utilizar tais provedores, o usuário declara ciência e aceita os termos de privacidade do provedor escolhido.

Provedores externos e suas políticas:
- **OpenAI:** https://openai.com/privacy
- **Google (Gemini):** https://policies.google.com/privacy
- **Anthropic:** https://www.anthropic.com/privacy
- **Groq:** https://groq.com/privacy-policy

---

## 5. Direitos do Titular dos Dados

Nos termos do Art. 18 da LGPD e Art. 17 do GDPR, o usuário tem os seguintes direitos:

- **Acesso:** Visualizar todos os dados armazenados (localizados em `<pasta de dados>/`).
- **Correção:** Editar arquivos diretamente na pasta de dados.
- **Exclusão:** Excluir arquivos pela interface do aplicativo (aba Repositório) ou diretamente pelo sistema operacional.
- **Portabilidade:** Os dados estão em formatos abertos (.txt, .json, .csv) — exportáveis a qualquer momento.
- **Revogação do consentimento:** Disponível nas configurações do aplicativo.
- **Eliminação da telemetria:** A revogação do consentimento de telemetria interrompe a coleta imediatamente. Dados históricos anonimizados coletados antes da revogação podem ser mantidos por até 12 meses para fins de melhoria do produto.

Para exercer seus direitos ou em caso de dúvidas, contate: **augusto.brasil@saude.gov.br**

---

## 6. Segurança dos Dados

- O Brain'IAC utiliza **escrita atômica** (write-to-tmp + rename) para garantir integridade dos arquivos locais.
- Chaves de API são armazenadas em JSON local, sem criptografia em repouso. **Recomendamos** que o usuário utilize criptografia de disco (BitLocker no Windows, FileVault no macOS) para maior segurança.
- A comunicação com o backend local (FastAPI) é restrita a `127.0.0.1:8001` — inacessível pela rede.
- O código-fonte é auditável (exceto partes proprietárias — consulte o arquivo de licença).

---

## 7. Retenção dos Dados

| Dado | Período de retenção | Controle |
|------|---------------------|----------|
| Base de conhecimento (cerebro/) | Indefinido — controle total do usuário | Usuário pode excluir a qualquer momento |
| Configurações (config/) | Indefinido | Usuário pode excluir a qualquer momento |
| Histórico de chat (RAM) | Duração da sessão ativa | Limpado ao fechar o app ou pelo botão "Limpar" |
| Telemetria anônima (PostHog) | 12 meses | Revogação encerra novas coletas |
| Tokens OAuth (token.json) | Até revogação manual | Usuário pode excluir token.json diretamente |

---

## 8. Cookies e Tecnologias de Rastreamento

O Brain'IAC **não utiliza cookies**. É uma aplicação desktop local (Electron) sem acesso a cookies do navegador.

A telemetria de uso (quando consentida) utiliza a biblioteca PostHog SDK, que armazena um identificador anônimo em `localStorage` do frontend Electron. Este identificador não é vinculado a nenhum dado pessoal.

---

## 9. Menores de Idade

O Brain'IAC não é destinado a menores de 16 anos. Não coletamos intencionalmente dados de menores. Se você acredita que dados de um menor foram coletados, entre em contato para exclusão imediata.

---

## 10. Alterações nesta Política

Esta política pode ser atualizada. Em caso de alterações materiais, o usuário será notificado na próxima abertura do aplicativo. A versão mais recente estará sempre disponível no repositório do projeto.

---

## 11. Contato e Encarregado de Proteção de Dados (DPO)

**CriAugu — CNPJ 65.131.075/0001-57**  
**Encarregado:** Augusto Brasil  
**E-mail:** augusto.brasil@saude.gov.br  
**LinkedIn:** https://linkedin.com/in/augustoalvesbrasil

---

*Este documento foi elaborado em conformidade com a LGPD (Lei nº 13.709/2018), a Lei do Software (Lei nº 9.609/1998), e o GDPR (Regulamento UE 2016/679).*

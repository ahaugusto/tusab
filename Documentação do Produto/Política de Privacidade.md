# Política de Privacidade — Tusab

**Versão:** 1.2  
**Data de vigência:** 24 de junho de 2026  
**Responsável:** CriAugu — CNPJ 65.131.075/0001-57  
**Site:** https://tusab.solutions  
**Contato:** criaugu.tec.design@gmail.com

---

## 1. Apresentação

O Tusab é um sistema de gestão de conhecimento pessoal (PKM) com IA local, desenvolvido e comercializado pela CriAugu. Esta Política descreve como coletamos, usamos, armazenamos e protegemos seus dados, em conformidade com a **Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)** e com o **GDPR (Regulamento UE 2016/679)**, onde aplicável.

O princípio central do Tusab é **local-first**: seus dados ficam na sua máquina. A CriAugu não tem servidores que armazenam seu conteúdo, suas conversas ou suas bases de conhecimento.

---

## 2. Dados Coletados

### 2.1 Dados processados localmente (sem transferência para a CriAugu)

Os dados abaixo são processados exclusivamente na máquina do usuário e **nunca são enviados a servidores da CriAugu**:

| Dado | Finalidade | Local de armazenamento |
|------|------------|------------------------|
| Transcrições de vídeos do YouTube | Base de conhecimento pessoal | `<dados>/neural/<projeto>/youtube/` |
| Documentos PDF / DOCX / XLSX / CSV / TXT enviados | Enriquecimento da base | `<dados>/neural/<projeto>/documents/` |
| Textos manuais inseridos | Enriquecimento da base | `<dados>/neural/<projeto>/texts/` |
| Conversas exportadas do WhatsApp | Enriquecimento da base | `<dados>/neural/<projeto>/texts/` |
| Transcrições de reuniões (Otter, Zoom, Teams etc.) | Enriquecimento da base | `<dados>/neural/<projeto>/texts/` |
| Índice BM25 gerado | Busca local | `<dados>/indexes/<projeto>_index.json` |
| Configurações do agente (provedor, modelo, tom) | Preferências do usuário | `<dados>/config/agent_config.json` |
| Histórico de chat da sessão | Contexto da conversa | Memória RAM — não persiste entre sessões |

### 2.2 Chaves de API de terceiros

O usuário pode opcionalmente fornecer chaves de API de provedores externos (Groq, OpenAI, Google Gemini, Anthropic). Essas chaves:

- São armazenadas **localmente**, preferencialmente via `safeStorage` do Electron (Windows DPAPI / macOS Keychain), ou em `config/agent_config.json` como alternativa.
- **Nunca são transmitidas a servidores da CriAugu**.
- São usadas diretamente do dispositivo do usuário para chamar os provedores escolhidos.
- **O usuário assume a responsabilidade** pela segurança dessas chaves no próprio dispositivo.

> ⚠️ Recomendamos não incluir a pasta `config/` em backups automáticos em nuvem sem criptografia adicional.

### 2.3 Telemetria de uso (opcional — requer consentimento explícito)

Com o **consentimento expresso** do usuário (opt-in via modal na primeira execução), coletamos eventos anônimos de uso via PostHog:

| Evento coletado | Dados associados |
|-----------------|-----------------|
| Abertura do aplicativo | Data/hora, versão do app |
| Início de extração | Tipos de conteúdo selecionados |
| Indexação iniciada | Nenhum dado de conteúdo |
| Chat enviado | Modalidade (ampla/restrita), provedor de IA |
| Provedor configurado | Nome do provedor (ex: "gemini") |

**Dados que NÃO são coletados na telemetria:**
- Conteúdo de mensagens, perguntas ou respostas do chat
- URLs de canais ou títulos de vídeos
- Nomes de arquivos ou documentos
- Chaves de API
- Qualquer dado pessoal identificável

O usuário pode **revogar o consentimento** a qualquer momento nas configurações do agente.

### 2.4 Integração com Google Drive (opcional)

Se o usuário optar por ativar a sincronização com o Google Drive:

- A autenticação OAuth2 é realizada **diretamente pelo dispositivo** com os servidores do Google.
- O token de acesso é armazenado localmente em `config/token.json`.
- A CriAugu **não tem acesso** ao token ou aos arquivos do Drive do usuário.
- O escopo solicitado ao Google é o mínimo necessário: criação e leitura de arquivos na pasta específica do Tusab.

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

Ao utilizar provedores de IA externos (OpenAI, Google Gemini, Anthropic, Groq), **o conteúdo das consultas — perguntas e trechos de contexto recuperados pela busca BM25 — é transmitido aos servidores desses provedores**, que podem estar localizados fora do Brasil.

O Tusab exibe um aviso explícito ao selecionar um provedor externo. Ao configurá-lo, o usuário declara ciência e aceita os termos de privacidade do provedor:

- **OpenAI:** https://openai.com/privacy
- **Google (Gemini):** https://policies.google.com/privacy
- **Anthropic:** https://www.anthropic.com/privacy
- **Groq:** https://groq.com/privacy-policy

O uso do **Ollama (provedor local padrão)** não gera qualquer transferência de dados — todo o processamento ocorre na máquina do usuário, sem conexão com servidores externos.

---

## 5. Direitos do Titular dos Dados

Nos termos do Art. 18 da LGPD e Art. 17 do GDPR:

- **Acesso:** Todos os dados estão na pasta de dados do Tusab, acessível diretamente pelo sistema operacional.
- **Correção:** Arquivos podem ser editados diretamente ou pela interface do aplicativo.
- **Exclusão:** Disponível pela aba Repositório do aplicativo ou diretamente no sistema de arquivos.
- **Portabilidade:** Dados estão em formatos abertos (.txt, .json, .csv) — exportáveis a qualquer momento sem dependência do Tusab.
- **Revogação do consentimento:** Disponível nas configurações do aplicativo. Dados de telemetria históricos anonimizados podem ser mantidos por até 12 meses para fins de melhoria do produto.
- **Oposição ao tratamento:** Como o processamento é local, o usuário pode interromper qualquer tratamento simplesmente desinstalando o aplicativo.

Para exercer direitos ou em caso de dúvidas: **criaugu.tec.design@gmail.com**

---

## 6. Segurança dos Dados

- **Escrita atômica:** Todos os arquivos são escritos via operação `write-to-tmp` + `rename` — sem corrupção em caso de falha.
- **Token de sessão:** A API local (`127.0.0.1:8001`) é protegida por token gerado a cada boot — impede que processos locais não autorizados acessem a API.
- **Rate limiting:** Todas as rotas da API têm limite de requisições por minuto — dificulta abuso programático.
- **CORS restrito:** A API só aceita requisições de `localhost:8001` — inacessível a páginas web externas.
- **Electron sandbox:** O processo de renderização roda com `sandbox: true` e `contextIsolation: true` — código web não tem acesso ao sistema operacional.
- **Chaves de API:** Armazenadas via `safeStorage` do Electron quando disponível (Windows DPAPI / macOS Keychain). Recomendamos criptografia de disco completo (BitLocker / FileVault) para proteção adicional.

---

## 7. Retenção dos Dados

| Dado | Período de retenção | Controle |
|------|---------------------|----------|
| Base de conhecimento (`neural/`) | Indefinido | Usuário controla totalmente |
| Configurações (`config/`) | Indefinido | Usuário pode excluir a qualquer momento |
| Histórico de chat (RAM) | Duração da sessão | Limpado ao fechar o app |
| Telemetria anônima (PostHog) | 12 meses | Revogação do consentimento encerra novas coletas |
| Token OAuth do Drive (`token.json`) | Até revogação manual | Usuário pode desconectar pelo app ou excluir o arquivo |

---

## 8. Cookies e Rastreamento

O Tusab **não utiliza cookies**. É uma aplicação desktop (Electron) sem acesso a cookies do navegador.

A telemetria (quando consentida) usa o PostHog SDK, que mantém um identificador anônimo em `localStorage` do frontend Electron. Este identificador é gerado aleatoriamente e não é vinculado a nenhum dado pessoal.

---

## 9. Menores de Idade

O Tusab não é destinado a menores de 16 anos. Não coletamos intencionalmente dados de menores. Se você acredita que dados de um menor foram processados pelo aplicativo, entre em contato para orientação sobre exclusão.

---

## 10. Alterações nesta Política

Esta política pode ser atualizada. Em caso de alterações materiais, o usuário será notificado na próxima abertura do aplicativo. A versão vigente estará sempre disponível em **https://tusab.solutions**.

---

## 11. Contato e Encarregado de Proteção de Dados (DPO)

**CriAugu — CNPJ 65.131.075/0001-57**  
**Encarregado:** Augusto Brasil  
**E-mail:** criaugu.tec.design@gmail.com  
**Site:** https://tusab.solutions  
**LinkedIn:** https://linkedin.com/in/augustoalvesbrasil

---

*Elaborado em conformidade com a LGPD (Lei nº 13.709/2018), a Lei do Software (Lei nº 9.609/1998) e o GDPR (Regulamento UE 2016/679).*

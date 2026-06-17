# Changelog Técnico — Tusab v1.0
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

Documento de referência das modificações implementadas na sprint de lançamento da v1.0.
Organizado por commit, do mais antigo ao mais recente.

---

## Commit `572fd5f` — Pro groundwork v1.0

**Data:** 16/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Implementação do fundamento técnico para o modelo freemium Free vs. Pro.
A estratégia é "free generoso": o loop completo funciona no free; a parede existe onde o usuário já depende do produto.
Nenhuma feature é bloqueada na v1.0 — o ProSnackbar é informativo ("fique de olho no lançamento").

---

### Backend

#### `tusab_engine/api/router_exports.py` (novo)

Dois endpoints de export, exclusivos do plano Pro:

**`POST /export/base`**
Gera um arquivo `.zip` contendo:
- Toda a pasta `cerebro/` (transcrições YouTube, documentos, textos colados)
- CSVs e JSONs de gestão (`gestao/`)

Retorna `StreamingResponse` com `Content-Disposition: attachment` para download direto pelo browser.
Nome do arquivo: `tusab_base_YYYYMMDD_HHMM.zip`.

**`POST /export/historico`**
Recebe `{ canal_nome: string }` no body.
Lê o histórico server-side (`state.chat_histories[canal]`) e gera um arquivo `.md` estruturado:
```
# Histórico de Chat — @canal
_Exportado em DD/MM/YYYY HH:MM_

**Você:** pergunta do usuário

**Tusab:** resposta do agente

_Fontes:_
- [Título do vídeo](link)
```
Retorna `StreamingResponse` com `media_type: text/markdown`.
Nome do arquivo: `tusab_historico_{canal}_{ts}.md`.
Retorna JSON de erro claro se não há histórico disponível.

#### `tusab_engine/agent/index.py`

Adicionado limite freemium no `indexar()`:

```python
FREE_MAX_CANAIS = 2

def _contar_canais_indexados() -> list:
    # Conta arquivos _index.json em INDEX_DIR
    ...

# Em indexar():
if not config.get('pro', False):
    existentes = _contar_canais_indexados()
    if canal_nome not in existentes and len(existentes) >= FREE_MAX_CANAIS:
        raise ValueError("PRO_LIMIT:Você já tem N canais indexados...")
```

O prefixo `PRO_LIMIT:` é a convenção de contrato com o frontend:
quando o erro começa com esse prefixo, o frontend exibe o ProSnackbar em vez de um erro genérico.

#### `api_tusab.py`

`router_exports` incluído no app FastAPI junto aos demais routers.

---

### Frontend

#### `ProSnackbar.jsx` (novo)
**Path:** `web_interface/src/components/shared/ProSnackbar.jsx`

Componente de notificação informativo para features Pro. Aparece quando o usuário toca uma funcionalidade exclusiva do plano Pro.

Comportamento:
- Posição fixa no canto inferior direito (`bottom-24 right-5`)
- Animação de entrada/saída via framer-motion (slide + fade)
- Auto-fecha em 6 segundos (configurável via prop `autoClose`)
- CTA "Quero ser avisado →" com link `mailto:` para registrar interesse
- Fechar manual pelo botão ✕

Props:
| Prop | Tipo | Descrição |
|------|------|-----------|
| `visible` | boolean | Controla exibição |
| `onClose` | function | Callback ao fechar |
| `feature` | string | Nome da feature (ex: "Fila de Extração") |
| `darkMode` | boolean | Tema dark/light |
| `autoClose` | number | Ms para fechar automaticamente (padrão: 6000) |

Acessibilidade: `role="status"` + `aria-live="polite"`.

#### `App.jsx`

Estado e helper adicionados:
```jsx
const [proSnackbar, setProSnackbar] = useState({ visible: false, feature: '' });
const showProSnackbar = (feature) => setProSnackbar({ visible: true, feature });
```

Touchpoints onde o ProSnackbar é acionado:
| Ação do usuário | Feature exibida |
|-----------------|-----------------|
| Indexar canal além do limite free | "Canais ilimitados" |
| Adicionar canal à fila durante extração | "Fila de Extração" |
| Ativar busca em canal extra (multi-canal) | "Busca Multi-canal" |
| Clicar em "Exportar base (ZIP)" | "Export da Base" |
| Clicar em "Exportar histórico de chat (MD)" | "Export do Histórico" |

Nova seção **"Export da Base (Pro)"** adicionada no painel de Configurar Agente (entre Telemetria e Indexação):
- Botão "Exportar base (ZIP)": chama `POST /export/base`, aciona download via URL objeto temporário e exibe ProSnackbar
- Botão "Exportar histórico de chat (MD)": chama `POST /export/historico`, aciona download e exibe ProSnackbar

#### `services/api.js`

```js
export const exportBase = () =>
  fetch(`${API_BASE}/export/base`, { method: 'POST' });

export const exportHistorico = (canal_nome = '') =>
  fetch(`${API_BASE}/export/historico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome }),
  });
```

Usam `fetch` nativo (não axios) para capturar o stream de download como `Blob`.

---

## Commit `6811cd3` — Upload de imagens + drag and drop + alert

**Data:** 16/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Três problemas identificados no repositório de conhecimento:
1. **Bug:** imagens enviadas pelo usuário não apareciam na lista — eram silenciosamente descartadas
2. **UX:** ausência de drag and drop tornava o upload mais trabalhoso
3. **Informação:** o alert do repositório não mencionava imagens e áudios como tipos suportados

---

### Backend

#### `tusab_engine/api/router_repositorio.py`

**Raiz do bug de imagens:**
O endpoint `POST /cerebro/upload` chamava `_extrair_imagem()`, que lança `RuntimeError` quando nem Ollama multimodal nem Tesseract OCR estão disponíveis. Esse `RuntimeError` era capturado pelo `except` externo e retornava `{"error": true}`. O arquivo nunca entrava no manifesto.

**Fix aplicado:**
O branch `eh_imagem` agora tem seu próprio `try/except RuntimeError`:

```python
elif eh_imagem:
    try:
        texto = _extrair_imagem(conteudo_bytes, arquivo.filename)
    except RuntimeError as e:
        aviso_extracao = str(e)
        texto = (
            "[Imagem registrada sem extração de texto]\n"
            f"Arquivo: {arquivo.filename}\n"
            "Para extrair o conteúdo, instale Ollama com modelo multimodal "
            "(llava ou gemma3) ou Tesseract OCR e reindexe a base."
        )
```

Resultado: a imagem sempre entra no manifesto. O campo `"aviso"` na resposta informa o frontend que a extração foi parcial.

Resposta de sucesso com aviso:
```json
{
  "ok": true,
  "id": "f5048ad8",
  "nome": "foto.png",
  "chars": 216,
  "aviso": "Nenhum extrator de imagem disponível..."
}
```

---

### Frontend

#### `RepositorioTab.jsx`

**Drag and drop — implementação completa:**

- O componente raiz (`<div className="space-y-4">`) captura eventos `onDragOver` / `onDrop`
- Arrastar qualquer arquivo sobre o repositório (mesmo sem o painel aberto) abre automaticamente o painel em modo "Upload de arquivo"
- A drop zone interna (`dropRef`) tem feedback visual independente: borda colorida + scale leve quando o arquivo está sendo arrastado sobre ela
- Arquivos de tipo não aceito soltos na zona exibem mensagem de erro inline (não fecha o painel)
- Upload automático ao soltar um arquivo válido diretamente na drop zone

**Drop zone melhorada:**
- Quando nenhum arquivo selecionado: instrução "Arraste e solte ou clique para selecionar" + lista de tipos suportados com emojis (📄 🖼️ 🎵)
- Quando arquivo selecionado: exibe nome, tamanho em KB, emoji do tipo e "Clique para trocar"
- Estado `dragging` controla a aparência visual da zona (borda primária + escala)

**Tratamento de resposta de upload:**
```jsx
if (data?.error) {
  setUploadAviso(data.message); // vermelho — falha real
} else {
  if (data?.aviso) {
    setUploadAviso('⚠️ Imagem registrada...'); // amarelo — aviso informativo
  }
  reload();
  setFile(null);
  setShowAdd(false);
}
```

#### `App.jsx`

Alert do repositório atualizado (linha 1303):

> _"Use **+ Adicionar** ou **arraste e solte** para incluir PDFs, Word, Markdown, imagens (PNG, JPG, WEBP) ou áudios (MP3, WAV)."_

---

## Estado atual dos testes

| Suite | Resultado |
|-------|-----------|
| `pytest tests/ -v` (23 testes) | ✅ 23/23 verde |
| Smoke test pre-commit (15 checks) | ✅ 15/15 verde |

**Smoke test — checks cobertos:**
- yt-dlp funcionando (3 vídeos reais mapeados)
- `/status`, `/history`, `/repositorio` respondendo com schema correto
- `/queue`, `/queue/add` (URL válida e inválida), `/queue/clear`
- `/agent/status`, Ollama rodando
- `/agent/test-key` rejeita chave inválida
- `/agent/config` não expõe chave em claro
- `/agent/chat` retorna erro orientado para canal sem índice
- `/` serve `index.html`
- Path traversal bloqueado (fallback seguro)

---

## Arquitetura de features Pro — diagrama de decisão

```
Usuário toca feature Pro
        │
        ▼
Feature funciona? ──── SIM ──► Executa normalmente
        │                      + ProSnackbar informativo
        │                        ("Feature Pro — fique de olho")
       NÃO
        │
        ▼
   Retorna erro
  com prefixo         Frontend detecta "PRO_LIMIT:"
  "PRO_LIMIT:"  ────► ProSnackbar em vez de erro genérico
```

A checagem de licença real (Lemon Squeezy) ainda não está implementada — isso é M2 no backlog.
Na v1.0, o `config.get('pro', False)` sempre retorna `False` (nenhum usuário tem Pro ativo).
O limite de 2 canais está ativo; os exports e demais features simplesmente funcionam para todos
enquanto o sistema de licença não é lançado.

---

*Para o histórico de decisões de produto, ver `Gaps e To-Dos — v1.0.md` e `Modelo de negócio.txt`.*
*Para a arquitetura modular completa, ver `Blueprint de Modularização.md`.*

# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Dados consolidados da auditoria de segurança do Tusab (28-29/ago/2026).
Gerados por workflow de 5 auditores especializados (1 por categoria) + verificação
adversarial de cada achado (32 agentes no total). Fonte bruta: journal do workflow
wf_27ebb85c-600, sintetizado manualmente por Claude após revisão linha a linha.

Modelo de ameaça considerado: Tusab é um app desktop local-first (Electron +
FastAPI), single-user, sem login/sessão/multi-tenant. O backend fica em
127.0.0.1:8001, sem autenticação entre processos do mesmo host — isso é ACEITO
POR DESIGN e não é, sozinho, um achado. Os achados reais abaixo são especificamente
sobre falta de SANITIZAÇÃO DE PATH (que permite escapar do diretório de dados
pretendido, mesmo dentro do modelo de ameaça aceito) e sobre operações destrutivas
sem qualquer confirmação server-side.
"""

METODOLOGIA = {
    "banco_sem_tranca": (
        "Não há RLS nem multi-tenant no Tusab (é single-user local). Adaptação: "
        "verificar se toda rota que recebe um identificador de projeto/canal/prefixo "
        "controlado pelo cliente sanitiza esse valor ANTES de compor um caminho de "
        "disco — o equivalente local a 'isolamento de dono' é 'não escapar do "
        "diretório de dados pretendido (data/neural/)'."
    ),
    "permissao_navegador": (
        "Não há RBAC/roles/admin no produto. Adaptação: mapear operações destrutivas "
        "ou privilegiadas (reset total, limpeza em massa, abrir pasta arbitrária no "
        "SO) e verificar se o backend aceita a chamada incondicionalmente, confiando "
        "que só a UI oferece confirmação — o que no modelo local-first é aceitável "
        "para 'falta de auth', mas não para ausência total de qualquer barreira em "
        "operações irreversíveis."
    ),
    "idor": (
        "Sem contas de usuário, então não há 'objeto de outro usuário'. Adaptação: "
        "path traversal sistemático — toda rota que recebe id/fid/tipo/prefixo via "
        "path, query ou body foi verificada handler por handler quanto a escapar do "
        "diretório de dados esperado via '..' ou padrões de path malformado."
    ),
    "chaves_expostas": (
        "Aplicado sem adaptação — hardcode de segredos, defaults inseguros e "
        "histórico git são universais independente da stack."
    ),
    "xss": (
        "Aplicado ao React/Vite do Tusab — uso de ReactMarkdown sobre conteúdo "
        "dinâmico (respostas de LLM), presença/ausência de rehype-raw, uso de "
        "dangerouslySetInnerHTML e validação de protocolo em hrefs controlados por "
        "conteúdo indexado ou gerado por LLM."
    ),
}

STACK = {
    "Backend": "FastAPI 0.136+ / Python 3.12 (dev) — bind 127.0.0.1:8001, CORS restrito a localhost:8001/127.0.0.1:8001",
    "Persistência": "Sem ORM/SQL — arquivos JSON com escrita atômica (.tmp + os.replace), LanceDB (columnar, beta), SQLite FTS5",
    "Autenticação": "Nenhuma entre processos locais (single-user, sem sessão) — único OAuth real é Google Drive (motor/drive.py)",
    "Frontend": "React 19 + Vite 8 — react-markdown 10.1, sem rehype-raw, sem DOMPurify instalado",
    "Empacotamento": "Electron 34 (contextIsolation=true, nodeIntegration=false, sandbox=false documentado), PyInstaller para o backend",
    "Segredos": "Chaves de LLM via Electron safeStorage (DPAPI/Keychain); agent_config.json em texto plano como fallback (avisado ao usuário)",
    "CI/CD": "GitHub Actions — segredos via ${{ secrets.* }}, sem hardcode; sem Docker no projeto",
}

RESUMO_HANDLERS = {
    "banco_sem_tranca": 67,
    "permissao_navegador": 62,
    "idor": 97,
    "chaves_expostas": None,  # varredura de arquivos, não de handlers
    "xss": 4,
}

# ── Achados confirmados, deduplicados por endpoint ───────────────────────────
# Quando o mesmo endpoint foi reportado por mais de uma categoria (ex: open-folder
# em banco_sem_tranca E permissao_navegador E idor), consolidado numa entrada só
# com a união das categorias e a explicação mais completa.

ACHADOS = [
    {
        "id": "A1",
        "severidade": "critica",
        "categorias": ["IDOR / Path Traversal", "Banco sem tranca"],
        "arquivo": "tusab_engine/api/router_exports.py",
        "linhas": "397-458",
        "titulo": "Path traversal em GET /export/base-compartilhavel/{projeto} — sem realpath/startswith",
        "descricao": (
            "O path param `projeto` é usado diretamente em os.path.join(NEURAL_DIR, projeto) "
            "para localizar o diretório a ser compactado em ZIP, sem nenhuma sanitização (só "
            ".strip()) nem checagem de os.path.realpath+startswith contra NEURAL_DIR. A rota "
            "IRMÃ (import_base_compartilhavel, linhas 493-496, mesmo arquivo) TEM essa proteção "
            "— a ausência no export é uma omissão isolada, não uma decisão deliberada."
        ),
        "trecho": (
            "projeto = projeto.strip()\n"
            "neural_path = os.path.join(NEURAL_DIR, projeto)\n"
            "...\n"
            "for subdir in ('youtube', 'documents', 'texts', 'management'):\n"
            "    subpath = os.path.join(neural_path, subdir)\n"
            "    for root, _, files in os.walk(subpath):\n"
            "        for fname in files:\n"
            "            fpath = os.path.join(root, fname)\n"
            "            zf.write(fpath, arcname)"
        ),
        "explicacao": (
            "Um GET com projeto contendo '..' pode fazer o backend compactar e servir para "
            "download conteúdo de fora de data/neural/{projeto} — leitura + exfiltração via "
            "resposta HTTP direta, sem exigir JS/CORS (o download é o próprio efeito do GET). "
            "É uma rota GET, disparável até por <img>/<a> em página web aberta no mesmo host. "
            "Verificação adversarial testou o roteador FastAPI real: como a rota usa um único "
            "segmento de path (não :path), múltiplos '../../.. ' codificados são bloqueados pelo "
            "roteador (404). O único traversal executável é projeto='..', subindo 1 nível para "
            "data/ — testado contra o layout real do repo: nenhuma das 4 subpastas hardcoded "
            "(youtube/documents/texts/management) existe diretamente em data/, então a "
            "exploração PRÁTICA hoje resulta em ZIP vazio. Ainda assim, é path traversal real e "
            "comprovável, que se torna perigoso se a estrutura de data/ mudar no futuro."
        ),
        "severidade_original": "critica",
        "severidade_ajustada": "media",
        "nota_verificacao": (
            "Verificação adversarial rebaixou de crítica para média: o vetor de exploração "
            "descrito originalmente (acesso amplo via múltiplos segmentos codificados) não se "
            "sustenta contra o roteador real do FastAPI/Starlette, e o layout atual de disco não "
            "expõe nada sensível com o único traversal viável (projeto='..'). Mantido como achado "
            "prioritário porque é uma falha de sanitização real e o padrão correto já existe na "
            "rota irmã do mesmo arquivo."
        ),
        "condicao": "Nenhuma pré-condição especial — GET simples. Exploração prática hoje é nula dado o layout de disco atual; risco é estrutural/latente.",
        "recomendacao": "Aplicar a mesma checagem de import_base_compartilhavel: `neural_path = os.path.realpath(os.path.join(NEURAL_DIR, projeto)); if not neural_path.startswith(os.path.realpath(NEURAL_DIR) + os.sep): reject`.",
    },
    {
        "id": "A2",
        "severidade": "alta",
        "categorias": ["Banco sem tranca", "IDOR / Path Traversal"],
        "arquivo": "tusab_engine/api/router_extraction.py",
        "linhas": "453-487 (POST) / 490-532 (GET)",
        "titulo": "Escrita e leitura arbitrária de arquivo via /auto-update/config — sem sanitização",
        "descricao": (
            "POST /auto-update/config recebe canal_prefixo e projeto_prefixo no BODY e os usa "
            "em os.path.join(NEURAL_DIR, projeto_prefixo, 'management', f'{canal_prefixo}_summary.json') "
            "com apenas .strip() — nenhum re.sub de sanitização, diferente de ~50 outros pontos "
            "do mesmo projeto que aplicam esse padrão. O endpoint GET irmão tem o mesmo problema "
            "para leitura."
        ),
        "trecho": (
            "canal_prefixo   = req.canal_prefixo.strip()\n"
            "projeto_prefixo = req.projeto_prefixo.strip()\n"
            "summary_path = os.path.join(\n"
            "    NEURAL_DIR, projeto_prefixo, \"management\", f\"{canal_prefixo}_summary.json\"\n"
            ")\n"
            "os.makedirs(os.path.dirname(summary_path), exist_ok=True)\n"
            "salvar_json_atomico(summary, summary_path, indent=2)"
        ),
        "explicacao": (
            "Write primitivo: projeto_prefixo='..\\\\..\\\\AppData\\\\pasta' cria diretórios (via "
            "os.makedirs) e escreve/sobrescreve um .json arbitrário fora de data/neural. O GET "
            "companheiro (linha 490-532) tem o mesmo padrão para leitura, mitigado parcialmente "
            "porque só retorna a chave 'auto_update' de um JSON válido."
        ),
        "severidade_original": "alta",
        "severidade_ajustada": "alta",
        "nota_verificacao": "Confirmado sem ajuste — é write primitivo real, não falta de auth genérica; o próprio arquivo sanitiza em outros dois pontos (linhas 114, 174) e pulou este.",
        "condicao": "Nenhuma — POST/GET simples sem payload especial além do campo malicioso.",
        "recomendacao": "Aplicar re.sub(r'[<>:\"/\\\\|?*\\s]', '_', valor).strip('_') em canal_prefixo e projeto_prefixo antes de qualquer os.path.join, nos dois endpoints.",
    },
    {
        "id": "A3",
        "severidade": "alta",
        "categorias": ["Banco sem tranca", "Permissão no navegador", "IDOR / Path Traversal"],
        "arquivo": "tusab_engine/api/router_status.py",
        "linhas": "151-177",
        "titulo": "GET /open-folder sem sanitização — CSRF-like com mkdir + abertura de Explorer fora do escopo",
        "descricao": (
            "prefixo (query string) entra em os.path.join(NEURAL_DIR, prefixo, ...) e "
            "gestao_canal_dir(prefixo) sem NENHUMA sanitização — o único arquivo do projeto "
            "inteiro sem esse tratamento. O resultado é usado em os.makedirs(exist_ok=True) e "
            "depois subprocess.Popen(['explorer'/'open', target])."
        ),
        "trecho": (
            "\"projeto\": os.path.join(NEURAL_DIR, prefixo) if prefixo else NEURAL_DIR,\n"
            "\"canal_youtube\": os.path.join(NEURAL_DIR, prefixo, \"youtube\") if prefixo else NEURAL_DIR,\n"
            "target = folders.get(name)\n"
            "os.makedirs(target, exist_ok=True)\n"
            "subprocess.Popen([\"explorer\", target])  # ou \"open\" no macOS"
        ),
        "explicacao": (
            "É um GET com side-effect (cria diretório + abre janela do Explorer/Finder fora do "
            "escopo pretendido), sem exigir header customizado nem token — CORS restringe leitura "
            "de resposta via fetch, mas NÃO bloqueia o envio de um GET simples disparado por "
            "<img src=...> ou navegação a partir de qualquer página web aberta no navegador do "
            "usuário enquanto o backend roda em background. Não é RCE (Popen usa lista de "
            "argumentos, sem shell=True) nem leitura de conteúdo de arquivo — o dano é criação de "
            "diretório arbitrário + abertura de janela do SO."
        ),
        "severidade_original": "critica",
        "severidade_ajustada": "alta",
        "nota_verificacao": "Rebaixado de crítica para alta: não há RCE nem exfiltração de conteúdo, só mkdir + abertura de janela do Explorer/Finder — grave o suficiente por ser CSRF real contra endpoint local, mas sem o impacto de um crítico clássico.",
        "condicao": "Nenhuma — GET simples cabe numa URL, disparável por página web de terceiro sem qualquer interação do usuário com o Tusab.",
        "recomendacao": "Aplicar o mesmo re.sub(...) usado em todo o resto do projeto ao parâmetro `prefixo` antes de compor qualquer path, neste arquivo inteiro.",
    },
    {
        "id": "A4",
        "severidade": "media",
        "categorias": ["Banco sem tranca", "IDOR / Path Traversal"],
        "arquivo": "tusab_engine/api/router_exports.py",
        "linhas": "220-238",
        "titulo": "POST /export/tabela-videos sem sanitização de projeto_nome",
        "descricao": (
            "canal = req.projeto_nome é usado sem re.sub antes de gestao_canal_dir(canal) — que "
            "por sua vez (storage.py:62-66) também não sanitiza e chama os.makedirs(exist_ok=True) "
            "incondicionalmente."
        ),
        "trecho": (
            "canal = req.projeto_nome or state.stats.get(\"projeto_nome\", \"\") or \"\"\n"
            "csv_path = os.path.join(gestao_canal_dir(canal), f\"{canal}_base.csv\")"
        ),
        "explicacao": (
            "Cria diretório 'management/' fora de neural/{projeto} via traversal antes de checar "
            "se o CSV existe (side-effect ocorre incondicionalmente). Leitura de CSV arbitrário "
            "só é possível se o atacante já tiver colocado um arquivo com nome exato no destino."
        ),
        "severidade_original": "media",
        "severidade_ajustada": "media",
        "nota_verificacao": "Confirmado — mesmo arquivo tem export_flashcards_anki (linha 531) sanitizando corretamente, provando que é omissão pontual, não padrão aceito.",
        "condicao": "POST simples com projeto_nome contendo '..'. Leitura de CSV exige que o arquivo já exista no path exato do traversal.",
        "recomendacao": "Sanitizar `canal` com o mesmo padrão re.sub já usado 3 linhas abaixo (export_flashcards_anki) no mesmo arquivo.",
    },
    {
        "id": "A5",
        "severidade": "media",
        "categorias": ["Permissão no navegador"],
        "arquivo": "tusab_engine/api/router_repositorio.py",
        "linhas": "1064-1143",
        "titulo": "DELETE /reset-total sem qualquer confirmação server-side",
        "descricao": (
            "reset_total() não declara nenhum parâmetro — qualquer DELETE nesta rota apaga "
            "incondicionalmente neural/, gestao/, índices BM25/LanceDB e histórico em memória. "
            "É a única rota destrutiva do produto sem seletor algum (tudo-ou-nada)."
        ),
        "trecho": (
            "@router.delete(\"/reset-total\")\n"
            "def reset_total():\n"
            "    for data_dir in [neural_dir, motor_tusab.CEREBRO_DIR, gestao_dir]:\n"
            "        for entry in os.scandir(data_dir):\n"
            "            if entry.is_dir():\n"
            "                shutil.rmtree(entry.path)"
        ),
        "explicacao": (
            "A única barreira é a confirmação visual no frontend (modal 'tem certeza?'). No "
            "modelo de ameaça aceito (single-user local, sem sessão), isso é coerente com o "
            "resto do produto — mas é irreversível (sem lixeira/soft-delete/backup) e é a "
            "operação de maior raio de destruição do app."
        ),
        "severidade_original": "media",
        "severidade_ajustada": "media",
        "nota_verificacao": "Confirmado sem ajuste — irreversibilidade total + zero barreira server-side eleva acima de 'falta de auth genérica aceita por design'.",
        "condicao": "Nenhuma pré-condição além de acesso à porta 8001 no host.",
        "recomendacao": "Exigir um campo de confirmação simples no body (ex: {\"confirmar\": \"RESET\"}) — barato de implementar, elimina disparo acidental por chamada automatizada malformada.",
    },
    {
        "id": "A6",
        "severidade": "media",
        "categorias": ["Banco sem tranca", "IDOR / Path Traversal"],
        "arquivo": "tusab_engine/api/router_extraction.py",
        "linhas": "490-532",
        "titulo": "GET /auto-update/config/{canal_prefixo} — leitura fora de escopo",
        "descricao": "Mesma causa raiz do achado A2 (auto-update/config), lado de leitura.",
        "trecho": (
            "if projeto_prefixo:\n"
            "    summary_path = os.path.join(NEURAL_DIR, projeto_prefixo, \"management\", f\"{canal_prefixo}_summary.json\")\n"
            "    cfg = _ler_auto_update(summary_path)"
        ),
        "explicacao": "Leitura de arquivo JSON fora de data/neural via query param sem sanitização. Impacto limitado porque só retorna a chave 'auto_update' de um JSON válido.",
        "severidade_original": "media",
        "severidade_ajustada": "media",
        "nota_verificacao": "Confirmado — path traversal real, mitigado só pelo formato de retorno restrito.",
        "condicao": "GET simples; só retorna algo se o arquivo alvo existir, for JSON válido e tiver a chave 'auto_update'.",
        "recomendacao": "Mesma correção do A2 — sanitizar ambos os parâmetros.",
    },
    {
        "id": "A7",
        "severidade": "media",
        "categorias": ["IDOR / Path Traversal"],
        "arquivo": "tusab_engine/api/router_repositorio.py",
        "linhas": "1312-1331",
        "titulo": "cerebro_ler_arquivo — checagem de prefixo sem separador de diretório",
        "descricao": (
            "A checagem `caminho_abs.startswith(os.path.normpath(neural_dir))` não usa "
            "`+ os.sep` ao final — bypass teórico via diretório irmão cujo nome comece com "
            "'neural' (ex: 'neural_evil')."
        ),
        "trecho": (
            "caminho_abs = os.path.normpath(os.path.join(neural_dir, caminho_limpo))\n"
            "if not caminho_abs.startswith(os.path.normpath(neural_dir)):\n"
            "    return {\"error\": True, \"message\": \"Acesso negado\"}"
        ),
        "explicacao": (
            "Duas rotas do MESMO arquivo (cerebro_delete, cerebro_criar_projeto) implementam a "
            "checagem correta com `+ os.sep` — a omissão aqui é inconsistência, não decisão "
            "deliberada. Verificado contra o layout real de disco: não existe hoje nenhum "
            "diretório irmão de data/neural cujo nome comece com 'neural', então não há "
            "exploração prática disponível agora."
        ),
        "severidade_original": "media",
        "severidade_ajustada": "media",
        "nota_verificacao": "Confirmado como bug de padrão real, mas sem vetor de exploração hoje — mantido em média por ser corrigível trivialmente e proteger contra mudanças futuras de layout.",
        "condicao": "Exige existência de um diretório irmão com prefixo textual coincidente — não existe hoje na instalação padrão.",
        "recomendacao": "Trocar para `caminho_abs.startswith(os.path.normpath(neural_dir) + os.sep)`, replicando o padrão já usado em cerebro_delete/cerebro_criar_projeto no mesmo arquivo.",
    },
    {
        "id": "A8",
        "severidade": "baixa",
        "categorias": ["Permissão no navegador"],
        "arquivo": "tusab_engine/api/router_repositorio.py",
        "linhas": "975-1061 / 951-972",
        "titulo": "DELETE /neural/limpar e /historico/limpar — campo vazio amplia escopo para 'todos os projetos'",
        "descricao": (
            "Quando `canal`/`prefixos` vem vazio/omitido, o comportamento é limpar TODOS os "
            "projetos em vez de nenhum — contrato de API onde omitir um campo array escolhe o "
            "pior caso, não o mais seguro."
        ),
        "trecho": (
            "if req.canal:\n"
            "    candidatos = [req.canal]\n"
            "else:\n"
            "    for entry in os.scandir(neural_dir):\n"
            "        canal_paths.append(entry.path)"
        ),
        "explicacao": (
            "O próprio comentário do código já reconhece o risco ('comportamento legado — use "
            "com cuidado'). O frontend sempre popula o campo, então a via de exploração é "
            "exclusivamente cliente externo ao app oficial chamando a API diretamente."
        ),
        "severidade_original": "baixa",
        "severidade_ajustada": "baixa",
        "nota_verificacao": "Confirmado — footgun de contrato de API real, efeito recuperável via reindexação (não afeta youtube/documents/texts, só CSVs de gestão no caso de /historico/limpar).",
        "condicao": "Requer chamada direta à API omitindo o campo — não acontece via UI oficial.",
        "recomendacao": "Trocar o default de 'lista vazia = todos' para exigir um valor explícito tipo {\"escopo\": \"tudo\"} quando a intenção for realmente global.",
    },
    {
        "id": "A9",
        "severidade": "baixa",
        "categorias": ["XSS"],
        "arquivo": "web_interface/src/components/chat/ChatDrawer.jsx",
        "linhas": "1094-1118, 1259-1264",
        "titulo": "href sem allowlist de protocolo em links de fonte e em markdown do LLM",
        "descricao": (
            "O link de fonte do chat (f.link, extraído do cabeçalho de arquivos .txt indexados) "
            "e o componente `a` customizado do ReactMarkdown (que renderiza links da resposta do "
            "LLM) não validam o esquema da URL antes de usá-la em href — um valor "
            "'javascript:...' seria aceito."
        ),
        "trecho": (
            "f.link ? <a href={f.link} target=\"_blank\" rel=\"noreferrer\">...\n"
            "a: ({href, children}) => <a href={href} target=\"_blank\" rel=\"noreferrer\">{children}</a>"
        ),
        "explicacao": (
            "rehype-raw está AUSENTE do projeto (confirmado via grep + package.json) — isso "
            "elimina o vetor clássico de HTML/script bruto embutido em markdown sendo renderizado "
            "como DOM. O que sobra é estritamente o href de um link markdown/fonte não validado "
            "quanto a protocolo. Exploração exige que o próprio LLM do usuário produza um link "
            "malicioso (self-XSS, sem multi-tenant) E que o usuário clique explicitamente no link "
            "(target=_blank)."
        ),
        "severidade_original": "baixa",
        "severidade_ajustada": "baixa",
        "nota_verificacao": "Confirmado como lacuna real de defesa em profundidade, mas de exploração prática muito limitada nesse modelo de ameaça (essencialmente self-XSS).",
        "condicao": "Requer LLM produzir link com esquema javascript: (não trivial sem prompt injection) e clique explícito do usuário.",
        "recomendacao": "Adicionar allowlist de protocolo (permitir apenas http/https/mailto) no componente `a` customizado do ReactMarkdown e no href de fontes do chat.",
    },
]

# ── Pontos fortes (evidência de cobertura) ───────────────────────────────────

PONTOS_FORTES = [
    {
        "categoria": "Chaves expostas",
        "resumo": "Zero achados reais na categoria inteira",
        "evidencia": (
            "Nenhuma API key, token ou secret hardcoded encontrado em tusab_engine/, electron/, "
            "CI ou histórico git completo (git log --all -p). Chaves de LLM passam por "
            "Electron safeStorage (DPAPI/Keychain); GET /agent/config mascara a chave antes de "
            "devolver ao frontend; CI usa exclusivamente ${{ secrets.* }}; .gitignore cobre "
            "corretamente credentials.json, token.json, data/config/, .env. Único 'default' "
            "identificado (api_key or 'local' para provider custom) é inofensivo — placeholder "
            "para endpoints locais sem auth."
        ),
    },
    {
        "categoria": "XSS",
        "resumo": "rehype-raw ausente do projeto — mitigação estrutural contra HTML bruto do LLM",
        "evidencia": (
            "Todos os 3 arquivos que usam ReactMarkdown sobre conteúdo de LLM (ChatDrawer.jsx, "
            "EstudoTab.jsx, EstudoArtefatoModal.jsx) usam só remarkGfm/remarkBreaks, nunca "
            "rehypeRaw — confirmado via grep em toda a árvore + leitura de package.json. Isso "
            "significa que tags HTML embutidas em respostas do LLM (mesmo via prompt injection) "
            "são renderizadas como texto escapado, não como DOM executável. As 7 ocorrências de "
            "dangerouslySetInnerHTML no projeto usam exclusivamente strings estáticas de i18n, "
            "nunca conteúdo dinâmico do LLM/usuário."
        ),
    },
    {
        "categoria": "IDOR / Path Traversal",
        "resumo": "Padrão de sanitização (re.sub) aplicado consistentemente em ~50 pontos do código",
        "evidencia": (
            "router_agent.py, router_estudo.py, router_digest.py, router_fontes.py e a maior "
            "parte de router_repositorio.py sanitizam projeto_nome/canal_nome/prefixo via "
            "re.sub(r'[<>:\"/\\\\|?*\\s]', '_', nome).strip('_') ANTES de qualquer os.path.join — "
            "confirmado handler por handler em 97 rotas verificadas. import_base_compartilhavel "
            "implementa defesa contra zip-slip com os.path.realpath+startswith. "
            "cerebro_delete e cerebro_criar_projeto usam a forma correta com '+ os.sep'. "
            "Rotas de estudo (router_estudo.py) resolvem nomes de arquivo sempre a partir do "
            "manifest server-side, nunca do input do cliente — path traversal via artefato_id "
            "estruturalmente impossível."
        ),
    },
    {
        "categoria": "Banco sem tranca",
        "resumo": "lance_store.py e fts.py replicam sanitização como defesa em profundidade",
        "evidencia": (
            "_sanitizar_prefixo() em lance_store.py e fts.py usa regex mais restritiva "
            "(re.sub(r'[^\\w\\-]', '_', prefixo)) e é aplicada em todo ponto de acesso a disco "
            "desses módulos — protege mesmo se o chamador esquecer de sanitizar antes. Comentário "
            "explícito no código reconhece a duplicação como decisão deliberada."
        ),
    },
    {
        "categoria": "Permissão no navegador",
        "resumo": "Validação real de SSRF em endpoint customizado de LLM",
        "evidencia": (
            "_validar_custom_base_url() bloqueia explicitamente o range de metadata cloud "
            "169.254.0.0/16 (alvo clássico de SSRF para roubo de credenciais IAM) e exige "
            "esquema http/https antes de persistir uma URL customizada de provider LLM — não é "
            "'confia cegamente no frontend', é validação real de backend."
        ),
    },
]

TOTAIS_SEVERIDADE = {
    "critica": 0,
    "alta": 2,
    "media": 5,
    "baixa": 2,
    "informativa": 11,
}

TOTAIS_CATEGORIA = {
    "Banco sem tranca": 4,
    "Permissão no navegador": 2,
    "IDOR / Path Traversal": 3,
    "Chaves expostas": 0,
    "XSS": 1,
}

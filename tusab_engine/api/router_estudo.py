# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de Modo Estudo: geração de flashcards e resumo estruturado via LLM.
"""

import os
import re
import json
import time
import random
import hashlib
import datetime

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field, model_validator

import agent_tusab
from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico, salvar_texto_atomico
from tusab_engine.agent.llm_providers import _get_llm_client

router = APIRouter()


class StudyRequest(BaseModel):
    projeto_nome: str = Field(default="", max_length=120)
    tipo:         str = Field(default="flashcards", max_length=20)  # flashcards | resumo | ambos | postits
    n_cards:      int = Field(default=10, ge=1, le=30)
    tema:         str = Field(default="", max_length=200)  # opcional — escopa a geração a um tema/tópico
    # opcional — restringe o corpus de origem a itens específicos já
    # armazenados no projeto (por 'arquivo', o mesmo identificador já presente
    # em cada chunk do índice) antes de aplicar o filtro de tema. Vazio =
    # comportamento antigo, projeto inteiro. Combinável com `tema`: os itens
    # definem o universo, o tema rankeia dentro dele.
    arquivos:     list[str] = Field(default_factory=list, max_length=50)

    # campo legado — normalizado via model_validator:
    canal_nome: str = Field(default="", max_length=120)

    @model_validator(mode='after')
    def _normalizar(self):
        if not self.projeto_nome and self.canal_nome:
            self.projeto_nome = self.canal_nome
        return self


class TTSRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=10000)


class RenomearArtefatoRequest(BaseModel):
    projeto_nome: str = Field(max_length=120)
    artefato_id:  str = Field(max_length=60)
    titulo:       str = Field(min_length=1, max_length=150)


class RevisarCardRequest(BaseModel):
    projeto_nome: str = Field(max_length=120)
    card_id:      str = Field(max_length=32)
    qualidade:    int = Field(ge=0, le=5)  # 0-5 escala SM-2; UI mapeia 3 botões (1/3/5)


def _chamar_llm_estudo(prompt: str) -> str:
    """Chama o LLM configurado com o prompt e retorna a resposta como string."""
    config = agent_tusab.carregar_config()
    provider = config.get("provider", "gemini")
    api_key  = config.get("api_key", "")

    if provider == "ollama":
        import requests as _req
        model = config.get("ollama_model", "llama3.2:1b")
        resp = _req.post(
            "http://localhost:11434/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "think": False},
            timeout=300,
        )
        return resp.json().get("response", "")

    if provider in ("gemini", "google"):
        client, model = _get_llm_client(provider, api_key, config)
        if not model:
            return ""
        return client.GenerativeModel(model).generate_content(prompt).text

    if provider in ("openai", "groq"):
        client, llm_model = _get_llm_client(provider, api_key, config)
        resp = client.chat.completions.create(
            model=llm_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
        )
        return resp.choices[0].message.content or ""

    if provider == "anthropic":
        client, model = _get_llm_client(provider, api_key, config)
        msg = client.messages.create(
            model=model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text if msg.content else ""

    raise ValueError(f"Provider não configurado: {provider}")


def _parsear_flashcards_json(texto: str, n_esperado: int) -> list:
    """Extrai flashcards de uma resposta LLM que deveria conter um array JSON.

    Tenta três estratégias em cascata:
    1. json.loads direto (resposta limpa)
    2. Extrai primeiro bloco [...] da resposta (LLM adicionou texto antes/depois)
    3. Fallback para regex Q:/A: (LLM ignorou a instrução de JSON)
    """
    texto = texto.strip()

    # Estratégia 1: JSON direto
    try:
        data = json.loads(texto)
        if isinstance(data, list):
            return _validar_cards(data)
    except (json.JSONDecodeError, ValueError):
        pass

    # Estratégia 2: extrai bloco JSON [...] do meio do texto
    match = re.search(r'\[\s*\{.*?\}\s*\]', texto, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return _validar_cards(data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Estratégia 3: fallback Q:/A: linha a linha (LLM ignorou JSON)
    pares = re.findall(r'Q:\s*(.+?)\nA:\s*(.+?)(?=\n(?:\d+\.|Q:)|\Z)', texto + '\n', re.DOTALL)
    if pares:
        return [{"pergunta": q.strip(), "resposta": a.strip()} for q, a in pares]

    return []


def _id_flashcard(pergunta: str) -> str:
    """Id estável (hash da pergunta) — sobrevive a regeneração; base da repetição espaçada.

    Se a mesma pergunta reaparecer numa geração futura, o progresso de revisão
    já registrado continua valendo (não reseta pra zero por ela ter vindo de
    um novo lote gerado pelo LLM).
    """
    return hashlib.sha1(pergunta.strip().encode("utf-8")).hexdigest()[:12]


def _validar_cards(data: list) -> list:
    """Filtra e normaliza itens do array JSON — descarta entradas sem pergunta/resposta."""
    resultado = []
    for item in data:
        if not isinstance(item, dict):
            continue
        pergunta = str(item.get("pergunta") or item.get("question") or item.get("front") or "").strip()
        resposta  = str(item.get("resposta")  or item.get("answer")   or item.get("back")  or "").strip()
        if pergunta and resposta:
            resultado.append({"id": _id_flashcard(pergunta), "pergunta": pergunta, "resposta": resposta})
    return resultado


def _parsear_postits_json(texto: str) -> list:
    """Extrai pontos-chave curtos (post-its) de uma resposta LLM.

    Três estratégias em cascata, igual a _parsear_flashcards_json: JSON direto
    → bloco [...] no meio do texto → fallback textual (linhas com marcador
    -/•/número, já que post-it é texto livre curto e tem formato natural
    pra isso, ao contrário de múltipla escolha).
    """
    texto = texto.strip()

    def _normalizar(data) -> list:
        itens = []
        for x in data:
            if isinstance(x, str):
                s = x.strip()
            elif isinstance(x, dict):
                s = str(x.get("texto") or x.get("text") or "").strip()
            else:
                continue
            if s:
                itens.append(s)
        return itens

    try:
        data = json.loads(texto)
        if isinstance(data, list):
            itens = _normalizar(data)
            if itens:
                return itens
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r'\[\s*(?:"|\{).*?\]', texto, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                itens = _normalizar(data)
                if itens:
                    return itens
        except (json.JSONDecodeError, ValueError):
            pass

    linhas = re.findall(r'^\s*(?:[-•*]|\d+[.)])\s*(.+)$', texto, re.MULTILINE)
    return [l.strip() for l in linhas if l.strip()]


def _filtrar_chunks_por_tema(chunks: list, tema: str, n: int) -> list:
    """Seleciona os n chunks mais relevantes pro tema (BM25); sem tema, amostra aleatória.

    Sem isso, gerar flashcards/resumo/postits de um projeto inteiro dá material
    genérico demais quando o usuário quer estudar um recorte específico (ex:
    "capitalismo" dentro de um projeto bem mais amplo). Fallback pra amostra
    aleatória se o tema não bater com nada — nunca retorna vazio se há chunks.
    """
    if not tema or not tema.strip():
        return random.sample(chunks, min(n, len(chunks)))
    try:
        from rank_bm25 import BM25Okapi
        corpus = [str(c.get('texto_original') or c.get('texto') or '').lower().split() for c in chunks]
        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(tema.lower().split())
        ranqueados = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)
        top = [i for i in ranqueados if scores[i] > 0][:n]
        if not top:
            return random.sample(chunks, min(n, len(chunks)))
        return [chunks[i] for i in top]
    except Exception:
        return random.sample(chunks, min(n, len(chunks)))


def _progresso_flashcards_path(canal_prefixo: str) -> str:
    return os.path.join(NEURAL_DIR, canal_prefixo, "management", "flashcards_progresso.json")


def _ler_progresso_flashcards(canal_prefixo: str) -> dict:
    path = _progresso_flashcards_path(canal_prefixo)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _aplicar_sm2(estado: dict, qualidade: int) -> dict:
    """Algoritmo SM-2 (SuperMemo 2) simplificado — repetição espaçada dos flashcards.

    `qualidade` (0-5): a UI mapeia 3 botões pra 3 pontos da escala (Não
    lembrei=1, Difícil=3, Fácil=5) em vez dos 6 níveis originais do SM-2 —
    granularidade fina demais seria fricção sem benefício real pro usuário.
    `estado` é o registro anterior do card (vazio = nunca revisado, usa os
    defaults de um card novo: 0 repetições, EF 2.5).
    """
    repeticoes = estado.get("repeticoes", 0)
    intervalo  = estado.get("intervalo_dias", 0)
    ef         = estado.get("fator_facilidade", 2.5)

    if qualidade < 3:
        repeticoes = 0
        intervalo = 1
    else:
        if repeticoes == 0:
            intervalo = 1
        elif repeticoes == 1:
            intervalo = 6
        else:
            intervalo = round(intervalo * ef)
        repeticoes += 1

    ef = max(1.3, ef + (0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02)))

    hoje = datetime.date.today()
    proxima = hoje + datetime.timedelta(days=intervalo)

    return {
        "repeticoes":        repeticoes,
        "intervalo_dias":    intervalo,
        "fator_facilidade":  round(ef, 2),
        "ultima_revisao":    hoje.isoformat(),
        "proxima_revisao":   proxima.isoformat(),
    }


def _manifest_estudo_path(canal_prefixo: str) -> str:
    return os.path.join(NEURAL_DIR, canal_prefixo, "estudo", "_manifest.json")


def _ler_manifest_estudo(canal_prefixo: str) -> list:
    """Lê o manifest de artefatos e descarta entradas cujos arquivos não
    existem mais em neural/{prefixo}/estudo/ — a pasta em disco é a fonte de
    verdade, não o manifest. Um artefato só é "trazido" pra interface
    enquanto os dois arquivos dele (.txt indexável + .json estruturado)
    realmente existirem lá; cobre o caso de alguém apagar/mover arquivos por
    fora do app (Explorer, sync externo, etc.), sem deixar card fantasma no
    kanban. Reescreve o manifest podado de volta no disco quando encontra
    órfãs, pra não repetir a checagem de arquivo a cada listagem.
    """
    path = _manifest_estudo_path(canal_prefixo)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        manifest = data if isinstance(data, list) else []
    except Exception:
        return []

    estudo_dir = os.path.join(NEURAL_DIR, canal_prefixo, "estudo")
    validos = []
    encontrou_orfa = False
    for entrada in manifest:
        txt = entrada.get("arquivo_txt", "")
        jsn = entrada.get("arquivo_json", "")
        existe = bool(txt) and bool(jsn) \
            and os.path.exists(os.path.join(estudo_dir, txt)) \
            and os.path.exists(os.path.join(estudo_dir, jsn))
        if existe:
            validos.append(entrada)
        else:
            encontrou_orfa = True

    if encontrou_orfa:
        salvar_json_atomico(validos, path, indent=2)

    return validos


def _audio_artefato_path(canal_prefixo: str, entrada: dict) -> str | None:
    """Deriva o caminho do .wav a partir do arquivo_txt já registrado no manifest
    (nunca do cliente) — mesmo nome-base, extensão .wav. Sem risco de path
    traversal via artefato_id."""
    nome_base, _ = os.path.splitext(entrada.get("arquivo_txt", ""))
    if not nome_base:
        return None
    return os.path.join(NEURAL_DIR, canal_prefixo, "estudo", f"{nome_base}.wav")


def _texto_para_audio(tipo: str, dados) -> str:
    """Extrai o texto a ser lido em voz alta a partir dos dados estruturados do artefato."""
    if tipo == "resumo":
        return str(dados or "")
    if tipo == "postits":
        return ". ".join(str(p) for p in (dados or []))
    if tipo == "flashcards":
        return ". ".join(f"{c.get('pergunta', '')}. {c.get('resposta', '')}" for c in (dados or []))
    return ""


def _formatar_texto_indexavel(tipo: str, dados) -> str:
    """Achata o conteúdo estruturado (flashcards/postits/resumo) num texto corrido pro BM25."""
    if tipo == "flashcards":
        return "\n\n".join(f"P: {c['pergunta']}\nR: {c['resposta']}" for c in dados)
    if tipo == "postits":
        return "\n".join(f"- {p}" for p in dados)
    return str(dados)  # resumo já é texto


def _salvar_estudo_indexavel(canal_prefixo: str, projeto_nome: str, tipo: str, tema: str, dados, n_itens: int = 0) -> dict | None:
    """Salva um artefato do Modo Estudo em neural/{prefixo}/estudo/ e registra no manifest.

    Grava DOIS arquivos por artefato:
    - `.txt` achatado (TITULO:/DATA: no cabeçalho, igual ao parser de indexação
      já espera) — é o que vira pesquisável via BM25/MCP no próximo reindex.
    - `.json` com os dados estruturados originais (array de flashcards/postits, ou
      string do resumo) — é o que a UI usa pra reconstruir o mesmo componente
      rico (flip de carta, múltipla escolha) ao reabrir um card antigo do
      kanban, em vez de re-parsear o `.txt` de volta pra estrutura.

    AVISO no cabeçalho do `.txt` deixa explícito que é conteúdo derivado por
    IA, não fonte primária — mitiga o risco de uma imprecisão do resumo ser
    citada pelo chat como se fosse fato do material original.

    Falha ao persistir nunca deve quebrar a geração em si — o usuário já viu
    o resultado na tela mesmo que o arquivo não grave (retorna None nesse caso,
    card simplesmente não aparece no kanban).
    """
    if not dados:
        return None
    try:
        estudo_dir = os.path.join(NEURAL_DIR, canal_prefixo, "estudo")
        os.makedirs(estudo_dir, exist_ok=True)

        agora = time.strftime("%d/%m/%Y %H:%M")
        ts = time.strftime("%Y%m%d_%H%M%S")
        artefato_id = f"{ts}_{tipo}"

        rotulos = {"resumo": "Resumo", "flashcards": "Flashcards", "postits": "Post-its"}
        rotulo = rotulos.get(tipo, tipo.title())
        titulo = f"{rotulo} — {tema.strip() or projeto_nome} ({agora})"

        texto_achatado = _formatar_texto_indexavel(tipo, dados).strip()
        if not texto_achatado:
            return None

        nome_base = f"estudo_{tipo}_{ts}"
        arquivo_txt = f"{nome_base}.txt"
        arquivo_json = f"{nome_base}.json"

        conteudo_txt = (
            f"TITULO: {titulo}\n"
            f"DATA: {agora}\n"
            "AVISO: Conteúdo gerado por IA via Modo Estudo — derivado do material "
            "original, não é fonte primária.\n\n"
            f"{texto_achatado}\n"
        )
        salvar_texto_atomico(conteudo_txt, os.path.join(estudo_dir, arquivo_txt))

        salvar_json_atomico(dados, os.path.join(estudo_dir, arquivo_json), indent=2)

        entrada = {
            "id": artefato_id,
            "tipo": tipo,
            "titulo": titulo,
            "criado_em": agora,
            "projeto": projeto_nome,
            "tema": tema.strip(),
            "n_itens": n_itens,  # 0 = gerado do projeto inteiro; N = restrito a N itens específicos
            "arquivo_txt": arquivo_txt,
            "arquivo_json": arquivo_json,
        }
        manifest = _ler_manifest_estudo(canal_prefixo)
        manifest.insert(0, entrada)  # mais recente primeiro
        salvar_json_atomico(manifest, _manifest_estudo_path(canal_prefixo), indent=2)
        return entrada
    except Exception:
        return None


@router.post("/agent/study")
def agent_study(req: StudyRequest):
    """Gera flashcards e/ou resumo estruturado a partir do índice BM25 do projeto."""
    if req.tipo not in ("flashcards", "resumo", "ambos", "postits"):
        return {"error": True, "message": "Tipo inválido. Use: flashcards, resumo, postits ou ambos."}

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}

    from tusab_engine.agent import lance_store
    chunks = lance_store.carregar_chunks(canal_prefixo)
    if not chunks:
        return {"error": True, "message": f"Índice não encontrado para '{req.projeto_nome}'. Indexe a base primeiro."}

    # Restringe o universo a itens específicos escolhidos pelo usuário (ex.:
    # 2 vídeos e 1 documento, não o projeto inteiro) — o tema (se também
    # informado) rankeia dentro desse subconjunto, não do projeto inteiro.
    if req.arquivos:
        arquivos_set = set(req.arquivos)
        chunks_selecionados = [c for c in chunks if c.get("arquivo") in arquivos_set]
        if not chunks_selecionados:
            return {"error": True, "message": "Nenhum conteúdo encontrado nos itens selecionados."}
        chunks = chunks_selecionados

    # Amostra distribuída: por tema via BM25 se informado, senão aleatória de
    # todo o índice (ou do subconjunto de itens, se restringido acima).
    # Flashcards precisam de mais diversidade; resumo precisa de menos
    # tokens no prompt.
    n_amostras = min(req.n_cards * 3, 60, len(chunks))
    amostra = _filtrar_chunks_por_tema(chunks, req.tema, n_amostras)
    # Amostra menor dedicada ao resumo — reduz contexto enviado ao LLM (~18k→4k chars)
    n_resumo = min(15, len(chunks))
    amostra_resumo = _filtrar_chunks_por_tema(chunks, req.tema, n_resumo)

    mgmt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "management")
    os.makedirs(mgmt_dir, exist_ok=True)

    flashcards_resultado = []
    resumo_resultado = ""
    postits_resultado = []
    artefatos_criados = []

    if req.tipo == "postits":
        trechos_pi = "\n\n".join(
            f"[{c.get('titulo', '')}]: {str(c.get('texto', ''))[:300]}"
            for c in amostra
        )
        prompt_pi = (
            f"Você é um tutor especializado. Com base nos trechos abaixo de \"{req.projeto_nome}\", "
            f"extraia exatamente {req.n_cards} pontos-chave curtos, no estilo de notas adesivas (post-its) de estudo.\n\n"
            "RESPONDA APENAS com um array JSON de strings. Nenhum texto antes ou depois.\n"
            'Formato: ["ponto-chave 1", "ponto-chave 2", ...]\n\n'
            "Regras:\n"
            f"- Exatamente {req.n_cards} strings no array\n"
            "- Cada string é 1 frase curta e direta (máximo ~20 palavras), sem numeração\n"
            "- Cubra conceitos variados e específicos dos trechos, sem repetir ideias\n\n"
            f"TRECHOS:\n{trechos_pi}"
        )
        try:
            resposta_pi = _chamar_llm_estudo(prompt_pi)
            postits_resultado = _parsear_postits_json(resposta_pi)
            if not postits_resultado:
                return {"error": True, "message": "O modelo não retornou os post-its no formato esperado. Tente novamente."}
            pi_path = os.path.join(mgmt_dir, "postits.json")
            salvar_json_atomico({
                "canal": req.projeto_nome,
                "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "postits": postits_resultado,
            }, pi_path, indent=2)
            artefato = _salvar_estudo_indexavel(canal_prefixo, req.projeto_nome, "postits", req.tema, postits_resultado, n_itens=len(req.arquivos))
            if artefato:
                artefatos_criados.append(artefato)
        except Exception as e:
            return {"error": True, "message": f"Erro ao gerar post-its: {e}"}

    if req.tipo in ("flashcards", "ambos"):
        trechos = "\n\n".join(
            f"[{c.get('titulo', '')}]: {str(c.get('texto', ''))[:300]}"
            for c in amostra
        )
        prompt_fc = (
            f"Você é um tutor especializado. Com base nos trechos abaixo de \"{req.projeto_nome}\", "
            f"gere exatamente {req.n_cards} flashcards de estudo.\n\n"
            "RESPONDA APENAS com um array JSON válido. Nenhum texto antes ou depois.\n"
            "Formato:\n"
            '[\n'
            '  {"pergunta": "texto da pergunta", "resposta": "texto da resposta"},\n'
            '  ...\n'
            ']\n\n'
            "Regras:\n"
            f"- Exatamente {req.n_cards} objetos no array\n"
            "- Cada pergunta deve ser específica e clara\n"
            "- Cada resposta deve ser direta e concisa (1-3 frases)\n"
            "- Cubra conceitos variados dos trechos fornecidos\n\n"
            f"TRECHOS:\n{trechos}"
        )
        try:
            resposta_fc = _chamar_llm_estudo(prompt_fc)
            # Parser robusto: extrai o primeiro array JSON da resposta
            flashcards_resultado = _parsear_flashcards_json(resposta_fc, req.n_cards)
            if not flashcards_resultado:
                return {"error": True, "message": "O modelo não retornou flashcards no formato esperado. Tente novamente."}
            fc_path = os.path.join(mgmt_dir, "flashcards.json")
            salvar_json_atomico({
                "canal": req.projeto_nome,
                "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "flashcards": flashcards_resultado,
            }, fc_path, indent=2)
            artefato = _salvar_estudo_indexavel(canal_prefixo, req.projeto_nome, "flashcards", req.tema, flashcards_resultado, n_itens=len(req.arquivos))
            if artefato:
                artefatos_criados.append(artefato)
        except Exception as e:
            return {"error": True, "message": f"Erro ao gerar flashcards: {e}"}

    if req.tipo in ("resumo", "ambos"):
        # Usa amostra_resumo (15 chunks × 250 chars = ~3.750 chars) — viável para Ollama local
        trechos_resumo = "\n\n".join(
            f"[{c.get('titulo', '')}]: {str(c.get('texto', ''))[:250]}"
            for c in amostra_resumo
        )
        prompt_rs = (
            f"Com base nos trechos abaixo de {req.projeto_nome}, crie um resumo estruturado de estudo.\n\n"
            "Inclua:\n"
            "1. Tema central (1 frase)\n"
            "2. Conceitos-chave (3-5 bullet points)\n"
            "3. Insights principais (2-3 parágrafos)\n"
            "4. Lacunas identificadas (o que o conteúdo não cobre)\n\n"
            f"TRECHOS:\n{trechos_resumo}"
        )
        try:
            resumo_resultado = _chamar_llm_estudo(prompt_rs)
            rs_path = os.path.join(mgmt_dir, "resumo_estudo.md")
            with open(rs_path, "w", encoding="utf-8") as f:
                f.write(resumo_resultado)
            artefato = _salvar_estudo_indexavel(canal_prefixo, req.projeto_nome, "resumo", req.tema, resumo_resultado, n_itens=len(req.arquivos))
            if artefato:
                artefatos_criados.append(artefato)
        except Exception as e:
            return {"error": True, "message": f"Erro ao gerar resumo: {e}"}

    return {
        "ok": True,
        "flashcards": flashcards_resultado,
        "resumo": resumo_resultado,
        "postits": postits_resultado,
        "total": len(flashcards_resultado) or len(postits_resultado),
        "artefatos": artefatos_criados,
    }


@router.get("/agent/study/itens/{projeto_nome}")
def agent_study_itens(projeto_nome: str):
    """Lista os itens (vídeos/documentos/textos) já indexados do projeto, agregados
    por 'arquivo' — alimenta o seletor "Itens específicos" no Modo Estudo, que
    restringe flashcards/resumo/post-its a um recorte escolhido do
    projeto em vez do conteúdo inteiro. Reaproveita o índice já carregado em
    disco (mesmo arquivo que agent_study() lê); não faz nenhum scan novo.
    """
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}

    from tusab_engine.agent import lance_store

    chunks = lance_store.carregar_chunks(canal_prefixo)
    if not chunks:
        return {"error": True, "message": f"Índice não encontrado para '{projeto_nome}'. Indexe a base primeiro."}

    agregados = {}
    for c in chunks:
        arquivo = c.get("arquivo") or ""
        if not arquivo:
            continue
        item = agregados.setdefault(arquivo, {
            "arquivo": arquivo,
            "titulo": c.get("titulo") or arquivo,
            "aba": c.get("aba", "documento"),
            "n_chunks": 0,
        })
        item["n_chunks"] += 1

    itens = sorted(agregados.values(), key=lambda x: x["titulo"].lower())
    return {"ok": True, "itens": itens}


@router.get("/agent/study/{projeto_nome}")
def agent_study_get(projeto_nome: str):
    """Retorna flashcards e resumo salvos para o projeto."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"flashcards": [], "resumo": None, "total": 0}

    mgmt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "management")
    fc_path = os.path.join(mgmt_dir, "flashcards.json")
    rs_path = os.path.join(mgmt_dir, "resumo_estudo.md")

    flashcards = []
    if os.path.exists(fc_path):
        try:
            with open(fc_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            flashcards = data.get("flashcards", [])
        except Exception:
            pass

    resumo = None
    if os.path.exists(rs_path):
        try:
            with open(rs_path, 'r', encoding='utf-8') as f:
                resumo = f.read()
        except Exception:
            pass

    return {"flashcards": flashcards, "resumo": resumo, "total": len(flashcards)}


@router.post("/agent/study/revisar")
def agent_study_revisar(req: RevisarCardRequest):
    """Aplica SM-2 à revisão de um flashcard e persiste o novo estado — repetição espaçada."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}
    progresso = _ler_progresso_flashcards(canal_prefixo)
    novo_estado = _aplicar_sm2(progresso.get(req.card_id, {}), req.qualidade)
    progresso[req.card_id] = novo_estado
    mgmt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "management")
    os.makedirs(mgmt_dir, exist_ok=True)
    salvar_json_atomico(progresso, _progresso_flashcards_path(canal_prefixo), indent=2)
    return {"ok": True, "card_id": req.card_id, **novo_estado}


@router.get("/agent/study/revisao/{projeto_nome}")
def agent_study_revisao(projeto_nome: str):
    """Progresso de repetição espaçada (SM-2) de todos os flashcards já revisados do projeto."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"progresso": {}}
    return {"progresso": _ler_progresso_flashcards(canal_prefixo)}


@router.get("/agent/study/artefatos/{projeto_nome}")
def agent_study_artefatos(projeto_nome: str):
    """Lista os artefatos de estudo persistidos (resumo/flashcards/postits) — alimenta o kanban."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"artefatos": []}
    return {"artefatos": _ler_manifest_estudo(canal_prefixo)}


@router.get("/agent/study/artefato/{projeto_nome}/{artefato_id}")
def agent_study_artefato_conteudo(projeto_nome: str, artefato_id: str):
    """Retorna o conteúdo estruturado de um artefato — usado pra abrir o card no modal ampla.

    Lê do `.json` estruturado (não do `.txt` achatado indexável) pra
    reconstruir o mesmo componente rico (flip de flashcard, grade de
    post-its) que a tela de geração já mostra.
    """
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}
    manifest = _ler_manifest_estudo(canal_prefixo)
    entrada = next((e for e in manifest if e.get("id") == artefato_id), None)
    if not entrada:
        return {"error": True, "message": "Artefato não encontrado."}
    caminho_json = os.path.join(NEURAL_DIR, canal_prefixo, "estudo", entrada["arquivo_json"])
    try:
        with open(caminho_json, "r", encoding="utf-8") as f:
            dados = json.load(f)
    except Exception as e:
        return {"error": True, "message": f"Erro ao carregar artefato: {e}"}
    return {"ok": True, "artefato": entrada, "dados": dados}


@router.post("/agent/study/artefato/renomear")
def agent_study_artefato_renomear(req: RenomearArtefatoRequest):
    """Renomeia o título editável de um card do kanban de estudo."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}
    manifest = _ler_manifest_estudo(canal_prefixo)
    entrada = next((e for e in manifest if e.get("id") == req.artefato_id), None)
    if not entrada:
        return {"error": True, "message": "Artefato não encontrado."}
    entrada["titulo"] = req.titulo.strip()
    salvar_json_atomico(manifest, _manifest_estudo_path(canal_prefixo), indent=2)
    return {"ok": True, "artefato": entrada}


@router.delete("/agent/study/artefato/{projeto_nome}/{artefato_id}")
def agent_study_artefato_deletar(projeto_nome: str, artefato_id: str):
    """Remove um card do kanban de estudo — arquivos em disco + entrada no manifest.

    Nomes de arquivo vêm sempre do próprio manifest (gerados server-side em
    `_salvar_estudo_indexavel`, nunca do cliente) — sem risco de path
    traversal via artefato_id ou projeto_nome.
    """
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}
    manifest = _ler_manifest_estudo(canal_prefixo)
    entrada = next((e for e in manifest if e.get("id") == artefato_id), None)
    if not entrada:
        return {"error": True, "message": "Artefato não encontrado."}
    estudo_dir = os.path.join(NEURAL_DIR, canal_prefixo, "estudo")
    for chave in ("arquivo_txt", "arquivo_json", "arquivo_audio"):
        nome = entrada.get(chave, "")
        caminho = os.path.join(estudo_dir, nome) if nome else ""
        if caminho and os.path.exists(caminho):
            try:
                os.remove(caminho)
            except Exception:
                pass
    manifest = [e for e in manifest if e.get("id") != artefato_id]
    salvar_json_atomico(manifest, _manifest_estudo_path(canal_prefixo), indent=2)
    return {"ok": True}


@router.post("/agent/study/artefato/{projeto_nome}/{artefato_id}/audio")
def agent_study_artefato_audio(projeto_nome: str, artefato_id: str):
    """Gera (ou serve do cache) o áudio TTS de um artefato de estudo — build Beta/Enterprise.

    Sintetizar tem custo real de CPU (medido: ~79s pra um resumo de 3.2k chars) —
    por isso é sob demanda (não em toda geração) e persistido em disco na primeira
    vez; chamadas seguintes servem o .wav já salvo sem chamar o modelo de novo.
    Path do áudio deriva do arquivo_txt já registrado no manifest, nunca do
    cliente — sem risco de path traversal via artefato_id.
    """
    from tusab_engine.agent.tts import sintetizar_audio, tts_disponivel
    if not tts_disponivel():
        return {"error": True, "message": "TTS não disponível nesta edição do Tusab."}

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Projeto não especificado."}
    manifest = _ler_manifest_estudo(canal_prefixo)
    entrada = next((e for e in manifest if e.get("id") == artefato_id), None)
    if not entrada:
        return {"error": True, "message": "Artefato não encontrado."}

    audio_path = _audio_artefato_path(canal_prefixo, entrada)
    if not audio_path:
        return {"error": True, "message": "Artefato inválido."}

    if os.path.exists(audio_path):
        with open(audio_path, "rb") as f:
            return Response(content=f.read(), media_type="audio/wav")

    caminho_json = os.path.join(NEURAL_DIR, canal_prefixo, "estudo", entrada["arquivo_json"])
    try:
        with open(caminho_json, "r", encoding="utf-8") as f:
            dados = json.load(f)
    except Exception as e:
        return {"error": True, "message": f"Erro ao carregar artefato: {e}"}

    texto = _texto_para_audio(entrada.get("tipo", ""), dados)
    if not texto.strip():
        return {"error": True, "message": "Nada para sintetizar neste artefato."}

    try:
        audio_bytes = sintetizar_audio(texto)
    except Exception as e:
        return {"error": True, "message": f"Erro ao gerar áudio: {e}"}

    try:
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
        entrada["arquivo_audio"] = os.path.basename(audio_path)
        salvar_json_atomico(manifest, _manifest_estudo_path(canal_prefixo), indent=2)
    except Exception:
        pass  # falha ao persistir não deve impedir o usuário de ouvir agora

    return Response(content=audio_bytes, media_type="audio/wav")


@router.get("/agent/tts/status")
def agent_tts_status():
    """Verifica se o TTS local está disponível nesta instalação (build Beta/Enterprise).

    Build B2C padrão não tem torch/pocket-tts — retorna disponivel=False,
    frontend deve ocultar o botão "Ouvir resumo" nesse caso.
    """
    from tusab_engine.agent.tts import tts_disponivel
    return {"disponivel": tts_disponivel()}


@router.post("/agent/tts")
def agent_tts(req: TTSRequest):
    """Sintetiza texto em áudio via Pocket TTS (kyutai-labs) — build Beta/Enterprise.

    Reservado: torch+pocket-tts não fazem parte do requirements.txt do B2C
    (medição real: ~530MB em disco, ver `tusab_engine/agent/tts.py`). Retorna
    erro claro em vez de 500 quando a stack não está instalada.
    """
    from tusab_engine.agent.tts import sintetizar_audio

    try:
        audio_bytes = sintetizar_audio(req.texto)
    except RuntimeError as e:
        return {"error": True, "message": str(e)}
    except Exception as e:
        return {"error": True, "message": f"Erro ao gerar áudio: {e}"}

    return Response(content=audio_bytes, media_type="audio/wav")

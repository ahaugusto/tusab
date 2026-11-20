import { MODO_EXTENSAO } from '../constants';

// Extensão: o chat (e o histórico dele) é a IA do próprio usuário; Estudo chega na fase D.
const ABAS_FORA_DA_EXTENSAO = new Set(['agente', 'historico']);
// Recursos do desktop ainda não portados para a extensão (fases B e C) ou que não se aplicam.
const REGRAS_EXTENSAO = {
  config_api: false, drive: false,
};
import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Configuração completa de regras por perfil
// ---------------------------------------------------------------------------
export const PERFIS_CONFIG = {
  estudante: {
    abas: ['repositorio', 'historico', 'relatorio', 'estudo', 'agente', 'admin'],
    persona_padrao: 'didatico',
    busca_ampla: true,
    config_api: true,
    fila: true,
    drive: true,
    reset_total: true,
    export_tusab: true,
    import_tusab: true,
    visao_geral: true,
    monitor: false,
    admin: true,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
  },
  professor: {
    abas: ['extracao', 'repositorio', 'historico', 'relatorio', 'visao-geral', 'estudo', 'agente', 'admin'],
    persona_padrao: 'didatico',
    busca_ampla: true,
    config_api: true,
    fila: true,
    drive: true,
    reset_total: true,
    export_tusab: true,
    import_tusab: true,
    visao_geral: true,
    monitor: false,
    admin: true,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
    // Fontes públicas liberadas para o Professor em out/2026, junto com a área
    // "Educação" (BDTD, OasisBR, CAPES, EduCAPES, ERIC, Wikilivros...): era o
    // perfil que mais precisava delas e só o Pesquisador as via.
    fontes_publicas: true,
  },
  pesquisador: {
    abas: ['extracao', 'repositorio', 'historico', 'relatorio', 'visao-geral', 'estudo', 'agente', 'admin'],
    persona_padrao: 'tecnico',
    busca_ampla: true,
    config_api: true,
    fila: true,
    drive: true,
    reset_total: true,
    export_tusab: true,
    import_tusab: true,
    visao_geral: true,
    monitor: false,
    admin: true,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
    // Busca em fontes públicas por área de conhecimento — registro genérico
    // em tusab_engine/motor/fontes/ (9 áreas de domínio + "Buscadores gerais"
    // pros multidisciplinares: arXiv, OpenAlex, DataCite, DOAJ, Zenodo).
    // Compartilhado com o futuro vertical Tusab Saúde, não exclusivo dele.
    // Ver histórico interno do projeto.
    fontes_publicas: true,
  },
  profissional: {
    abas: ['extracao', 'repositorio', 'historico', 'relatorio', 'visao-geral', 'monitor', 'estudo', 'agente', 'admin'],
    persona_padrao: 'objetivo',
    busca_ampla: true,
    config_api: true,
    fila: true,
    drive: true,
    reset_total: true,
    export_tusab: true,
    import_tusab: true,
    visao_geral: true,
    monitor: true,
    admin: true,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
    // Especialista é o perfil de acesso completo (docs: "diferenciais em
    // relação ao Pesquisador"), mas estava sem as fontes públicas — corrigido
    // em out/2026.
    fontes_publicas: true,
  },
};

// ---------------------------------------------------------------------------
// Metadados de exibição na UI (valores são chaves i18n)
// ---------------------------------------------------------------------------
export const PERFIS_META = {
  estudante: {
    label: 'perfil.estudante',
    icon: '🎓',
    desc: 'perfil.estudante_desc',
  },
  professor: {
    label: 'perfil.professor',
    icon: '📚',
    desc: 'perfil.professor_desc',
  },
  pesquisador: {
    label: 'perfil.pesquisador',
    icon: '🔬',
    desc: 'perfil.pesquisador_desc',
  },
  // ATENÇÃO MANUTENÇÃO: o slug interno é 'profissional' (não 'especialista').
  // O nome exibido na UI foi renomeado para "Especialista" em jun/2026, mas o slug
  // NÃO foi alterado para preservar compatibilidade com localStorage já gravado,
  // fallbacks em App.jsx/Onboarding.jsx e filtros de feature flag em HomeScreen.jsx.
  // Nunca renomeie o slug sem uma migração explícita de localStorage.
  profissional: {
    label: 'perfil.especialista',
    icon: '🧑‍💻',
    desc: 'perfil.especialista_desc',
  },
};

// ---------------------------------------------------------------------------
// Perfil válido a partir do localStorage (ou null)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'tusab_perfil';
const SLUGS_VALIDOS = Object.keys(PERFIS_CONFIG);

function lerPerfilStorage() {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);
    return SLUGS_VALIDOS.includes(valor) ? valor : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePerfil() {
  const [perfil, setPerfilState] = useState(() => lerPerfilStorage());

  const setPerfil = useCallback((slug) => {
    const slugValido = SLUGS_VALIDOS.includes(slug) ? slug : null;
    try {
      if (slugValido) {
        localStorage.setItem(STORAGE_KEY, slugValido);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage pode estar indisponível (modo privado bloqueado)
    }
    setPerfilState(slugValido);
  }, []);

  // Se perfil não definido, fallback = profissional (não bloqueia nada antes do onboarding)
  // Extensão (19/11/2026): perfil único, o de acesso completo. A separação por público virou
  // filtro na Biblioteca de Prompts ("Para quê"); a tela é a mesma para todos.
  const perfilEfetivo = MODO_EXTENSAO ? 'profissional' : perfil;
  const regrasBase = PERFIS_CONFIG[perfilEfetivo] ?? PERFIS_CONFIG.profissional;
  const regras = { ...regrasBase, _perfil: perfilEfetivo ?? 'profissional' };
  if (MODO_EXTENSAO) {
    Object.assign(regras, REGRAS_EXTENSAO);
    regras.abas = regras.abas.filter((a) => !ABAS_FORA_DA_EXTENSAO.has(a));
    // Materiais (o que a IA guardou) acompanha a Biblioteca de Prompts.
    if (regras.abas.includes('estudo')) regras.abas.push('materiais');
  }

  const perfilDefinido = MODO_EXTENSAO || perfil !== null;

  return {
    perfil: perfilEfetivo,
    regras,
    setPerfil,
    perfilDefinido,
    PERFIS_CONFIG,
    PERFIS_META,
  };
}

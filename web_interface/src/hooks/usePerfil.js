import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Configuração completa de regras por perfil
// ---------------------------------------------------------------------------
export const PERFIS_CONFIG = {
  estudante: {
    abas: ['repositorio'],
    persona_padrao: 'didatico',
    busca_ampla: false,
    config_api: false,
    fila: false,
    drive: false,
    reset_total: false,
    export_tusab: false,
    import_tusab: true,
    visao_geral: false,
    monitor: false,
    admin: false,
    relatorio: false,
    deletar_arquivos: false,
    limpar_canal: false,
  },
  professor: {
    abas: ['extracao', 'repositorio', 'relatorio', 'agente'],
    persona_padrao: 'didatico',
    busca_ampla: false,
    config_api: false,
    fila: true,
    drive: true,
    reset_total: false,
    export_tusab: true,
    import_tusab: true,
    visao_geral: false,
    monitor: false,
    admin: false,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
  },
  pesquisador: {
    abas: ['extracao', 'repositorio', 'relatorio', 'visao-geral', 'agente'],
    persona_padrao: 'tecnico',
    busca_ampla: true,
    config_api: true,
    fila: true,
    drive: true,
    reset_total: false,
    export_tusab: true,
    import_tusab: true,
    visao_geral: true,
    monitor: false,
    admin: false,
    relatorio: true,
    deletar_arquivos: true,
    limpar_canal: true,
  },
  profissional: {
    abas: ['extracao', 'repositorio', 'relatorio', 'visao-geral', 'monitor', 'agente', 'admin'],
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
  profissional: {
    label: 'perfil.profissional',
    icon: '💼',
    desc: 'perfil.profissional_desc',
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
  const regrasBase = PERFIS_CONFIG[perfil] ?? PERFIS_CONFIG.profissional;
  const regras = { ...regrasBase, _perfil: perfil ?? 'profissional' };

  const perfilDefinido = perfil !== null;

  return {
    perfil,
    regras,
    setPerfil,
    perfilDefinido,
    PERFIS_CONFIG,
    PERFIS_META,
  };
}

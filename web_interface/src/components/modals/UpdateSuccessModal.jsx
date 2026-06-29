import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';

export default function UpdateSuccessModal({ version, darkMode, onClose }) {
  const { t } = useTranslation();

  const releaseUrl = `https://github.com/ahaugusto/tusab-public/releases/tag/v${version}`;

  return (
    <ModalWrapper
      open={!!version}
      onClose={onClose}
      darkMode={darkMode}
      label="Tusab atualizado com sucesso"
    >
      <div className={`rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6 flex flex-col gap-5
        ${darkMode ? 'bg-surface text-text-primary' : 'bg-white text-gray-900'}`}>

        {/* Ícone + título */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {t('update_success.title', 'Tusab atualizado!')}
            </h2>
            <p className={`text-sm mt-1 ${darkMode ? 'text-text-secondary' : 'text-gray-500'}`}>
              {t('update_success.subtitle', 'Você está usando a versão mais recente.')}
            </p>
          </div>
        </div>

        {/* Versão destacada */}
        <div className={`rounded-xl px-4 py-3 flex items-center justify-between
          ${darkMode ? 'bg-primary/10 border border-primary/20' : 'bg-primary/5 border border-primary/15'}`}>
          <span className={`text-sm font-medium ${darkMode ? 'text-text-secondary' : 'text-gray-600'}`}>
            {t('update_success.version', 'Versão instalada')}
          </span>
          <span className="text-sm font-bold text-primary">v{version}</span>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <a
            href={releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-center transition-colors border
              ${darkMode
                ? 'border-border text-text-secondary hover:text-text-primary hover:border-primary/40'
                : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:border-primary/40'}`}>
            {t('update_success.changelog', 'Ver novidades')}
          </a>
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors ${BTN_FOCUS}`}>
            {t('update_success.confirm', 'Continuar')}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

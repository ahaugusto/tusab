import { Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';

export default function ProHintModal({ onClose }) {
  const { t } = useTranslation();

  return (
    <ModalWrapper onClose={onClose} zIndex="z-[9000]" backdrop="bg-black/50 backdrop-blur-sm" label={t('proHint.title', 'Tusab Pro')}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">
              {t('proHint.title', 'Você está indo longe!')}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {t('proHint.subtitle', 'Tusab Pro está chegando')}
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
          {t('proHint.body', 'Você já tem 3 ou mais bases indexadas. Em breve, o Tusab Pro vai permitir bases ilimitadas, busca avançada com reranking semântico e muito mais.')}
        </p>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
            {t('proHint.comingSoon', 'Em desenvolvimento')}
          </p>
          <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc list-inside">
            <li>{t('proHint.feature1', 'Bases ilimitadas')}</li>
            <li>{t('proHint.feature2', 'Busca avançada com reranking semântico')}</li>
            <li>{t('proHint.feature3', 'Sincronização com Google Drive')}</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('proHint.cta', 'Entendido, continuar usando')}
        </button>
      </div>
    </ModalWrapper>
  );
}

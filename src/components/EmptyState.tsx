import { ImagePlus, Lock } from 'lucide-react'
import type { RefObject } from 'react'
import { Feedback } from './Feedback'
import type { Status } from './Feedback'

type EmptyStateProps = {
  isDragging: boolean
  status: Status
  modifierKey: string
  onChooseFile: () => void
  chooseButtonRef: RefObject<HTMLButtonElement | null>
}

export function EmptyState({ isDragging, status, modifierKey, onChooseFile, chooseButtonRef }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__inner">
        <h1 className="empty__title">Proteja seu screenshot antes de compartilhar</h1>
        <p className="empty__subtitle">
          Cubra dados pessoais com tarjas sólidas e copie ou baixe a imagem protegida.
        </p>

        <section
          className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
          aria-label="Área para colar ou arrastar uma imagem"
        >
          <span className="dropzone__icon" aria-hidden="true">
            <ImagePlus size={26} strokeWidth={1.6} />
          </span>
          {isDragging ? (
            <p className="dropzone__title">Solte a imagem para começar</p>
          ) : (
            <>
              <p className="dropzone__title">
                Cole um screenshot com <span className="dropzone__shortcut"><kbd>{modifierKey}</kbd> <kbd>V</kbd></span>
              </p>
              <p className="dropzone__hint">ou arraste uma imagem para esta área</p>
            </>
          )}
          <button
            ref={chooseButtonRef}
            type="button"
            className="btn btn--secondary dropzone__choose"
            onClick={onChooseFile}
          >
            Escolher arquivo
          </button>
          <Feedback status={status} className="dropzone__feedback" />
        </section>

        <p className="privacy-note">
          <Lock size={14} strokeWidth={2} aria-hidden="true" />
          Processado localmente. Nenhum screenshot é enviado para a aplicação.
        </p>
      </div>
    </div>
  )
}

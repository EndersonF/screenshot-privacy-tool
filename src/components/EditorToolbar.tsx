import { Copy, Download, EyeOff, Redo2, Trash2, Undo2 } from 'lucide-react'
import type { RefObject } from 'react'
import { Brand } from './Brand'
import { Feedback } from './Feedback'
import type { Status } from './Feedback'

type EditorToolbarProps = {
  canHide: boolean
  canRemove: boolean
  canUndo: boolean
  canRedo: boolean
  hasRedactions: boolean
  moving: boolean
  onHide: () => void
  onRemove: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onDownload: () => void
  onNewImage: () => void
  newImageButtonRef: RefObject<HTMLButtonElement | null>
  /** Retorno da última cópia ou download; `null` quando outra mensagem o substituiu. */
  exportStatus: Status | null
}

export function EditorToolbar({
  canHide,
  canRemove,
  canUndo,
  canRedo,
  hasRedactions,
  moving,
  onHide,
  onRemove,
  onUndo,
  onRedo,
  onCopy,
  onDownload,
  onNewImage,
  newImageButtonRef,
  exportStatus,
}: EditorToolbarProps) {
  const showReview = hasRedactions && !exportStatus
  return (
    <header className="topbar">
      <div className="topbar__side">
        <Brand compact />
        <button
          ref={newImageButtonRef}
          type="button"
          className="btn btn--ghost topbar__new"
          onClick={onNewImage}
        >
          Nova imagem
        </button>
      </div>

      <div className="editor-tools">
        <p id="selection-hint" className={`selection-hint${canHide ? ' selection-hint--pending' : ''}`}>
          {canHide ? 'Confirme em “Ocultar região”.' : moving ? 'Desative “Mover imagem” para selecionar.' : 'Arraste na imagem para selecionar.'}
        </p>
        <div className="tool-group tool-group--edit" role="group" aria-label="Edição">
          <button
            type="button"
            className={`btn ${canHide ? 'btn--confirm' : 'btn--tinted'}`}
            onClick={onHide}
            disabled={!canHide}
            aria-describedby="selection-hint"
          >
            <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
            Ocultar região
          </button>
          {canRemove && (
            <button type="button" className="btn btn--ghost" onClick={onRemove}>
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
              Remover ocultação
            </button>
          )}
          <span className="tool-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Desfazer"
            title="Desfazer"
          >
            <Undo2 size={17} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Refazer"
            title="Refazer"
          >
            <Redo2 size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="topbar__side topbar__side--end">
        <div className="export-actions">
          <div className="tool-group tool-group--export" role="group" aria-label="Exportação" aria-describedby={showReview ? 'export-hint' : undefined}>
            <button type="button" className="btn btn--secondary" onClick={onDownload}>
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              Baixar PNG
            </button>
            <button type="button" className="btn btn--primary" onClick={onCopy}>
              <Copy size={16} strokeWidth={2} aria-hidden="true" />
              Copiar imagem protegida
            </button>
          </div>
          {exportStatus ? (
            // Usa o espaço já reservado para a revisão. O anúncio continua
            // somente na região role="status" do App; este texto é visual.
            <div className="export-feedback">
              <Feedback status={exportStatus} />
              {exportStatus.downloadRequested && (
                <details className="download-help">
                  <summary>Não encontrou o arquivo?</summary>
                  <p>Confira a pasta de downloads definida pelo navegador. No iPhone, procure na lista de downloads do Safari ou no app Arquivos. O PNG não aparece automaticamente no Fotos.</p>
                </details>
              )}
            </div>
          ) : showReview && (
            <p id="export-hint" className="export-hint">Antes de compartilhar, confira se ocultou todas as informações necessárias.</p>
          )}
        </div>
      </div>
    </header>
  )
}

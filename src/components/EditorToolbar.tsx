import { Copy, Download, EyeOff, Redo2, Trash2, Undo2 } from 'lucide-react'
import type { RefObject } from 'react'
import { Brand } from './Brand'

type EditorToolbarProps = {
  canHide: boolean
  canRemove: boolean
  canUndo: boolean
  canRedo: boolean
  onHide: () => void
  onRemove: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onDownload: () => void
  onNewImage: () => void
  newImageButtonRef: RefObject<HTMLButtonElement | null>
}

export function EditorToolbar({
  canHide,
  canRemove,
  canUndo,
  canRedo,
  onHide,
  onRemove,
  onUndo,
  onRedo,
  onCopy,
  onDownload,
  onNewImage,
  newImageButtonRef,
}: EditorToolbarProps) {
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

      <div className="tool-group tool-group--edit" role="group" aria-label="Edição">
        <button type="button" className="btn btn--tinted" onClick={onHide} disabled={!canHide}>
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

      <div className="topbar__side topbar__side--end">
        <div className="tool-group tool-group--export" role="group" aria-label="Exportação">
          <button type="button" className="btn btn--secondary" onClick={onDownload}>
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            Baixar PNG
          </button>
          <button type="button" className="btn btn--primary" onClick={onCopy}>
            <Copy size={16} strokeWidth={2} aria-hidden="true" />
            Copiar imagem protegida
          </button>
        </div>
      </div>
    </header>
  )
}

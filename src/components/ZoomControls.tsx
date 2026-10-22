import { Hand, Minus, Plus } from 'lucide-react'

type ZoomControlsProps = {
  scale: number
  moving: boolean
  busy: boolean
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onToggleMoving: () => void
}

export function ZoomControls({ scale, moving, busy, canZoomIn, canZoomOut, onZoomIn, onZoomOut, onFit, onToggleMoving }: ZoomControlsProps) {
  return (
    <div className="zoom-controls" role="group" aria-label="Visualização">
      <div className="zoom-controls__scale">
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Reduzir" title="Reduzir" disabled={busy || !canZoomOut} onClick={onZoomOut}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="zoom-level" aria-label={`Escala: ${Math.round(scale * 100)}%`}>{Math.round(scale * 100)}%</span>
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Ampliar" title="Ampliar" disabled={busy || !canZoomIn} onClick={onZoomIn}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="btn btn--ghost" disabled={busy} onClick={onFit}>Imagem inteira</button>
      <button type="button" className={`btn ${moving ? 'btn--tinted' : 'btn--ghost'} zoom-controls__move`} aria-pressed={moving} aria-describedby="view-mode-hint" disabled={busy} onClick={onToggleMoving}>
        <Hand size={15} aria-hidden="true" />
        Mover imagem
      </button>
      <span id="view-mode-hint" className="sr-only">{moving ? 'Modo mover ativo. Desative Mover imagem para voltar a selecionar.' : 'Modo selecionar ativo. Ative Mover imagem para navegar na imagem ampliada.'}</span>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, PointerEvent } from 'react'
import { ImageUp, Lock } from 'lucide-react'
import {
  applyRedaction,
  emptyHistory,
  exportPng,
  redactionAtPoint,
  rectFromPoints,
  redo,
  removeRedaction,
  renderImage,
  undo,
} from './redaction'
import type { History, Point, Rect } from './redaction'
import { PublicHeader, PublicFooter } from './components/PublicLayout'
import { PublicInformation } from './components/PublicInformation'
import { EditorToolbar } from './components/EditorToolbar'
import { EmptyState } from './components/EmptyState'
import { Feedback } from './components/Feedback'
import type { Status, StatusTone } from './components/Feedback'

const MODIFIER_KEY = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
type PendingAction =
  | { kind: 'new' }
  | { kind: 'replace'; bitmap: ImageBitmap }
  | { kind: 'export'; format: 'copy' | 'download' }

type SelectionDrag = { pointerId: number; pointerType: string; start: Point; clientStart: Point }

function pointOnCanvas(event: PointerEvent<HTMLCanvasElement>): Point {
  const canvas = event.currentTarget
  const bounds = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
  }
}

function isSupportedImage(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml'
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chooseButtonRef = useRef<HTMLButtonElement>(null)
  const newImageButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const selectionDrag = useRef<SelectionDrag | null>(null)
  const activeTouches = useRef(new Set<number>())
  const touchGestureBlocked = useRef(false)
  const loadSequence = useRef(0)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [history, setHistory] = useState(emptyHistory)
  const historyRef = useRef(history)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [selectedRedaction, setSelectedRedaction] = useState<number | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [status, setStatus] = useState<Status>({ text: '', tone: 'info' })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const pendingActionRef = useRef<PendingAction | null>(null)

  const setMessage = useCallback((text: string, tone: StatusTone = 'info', downloadRequested = false) => {
    setStatus({ text, tone, downloadRequested })
  }, [])

  const cancelSelection = useCallback(() => {
    selectionDrag.current = null
    setSelection(null)
    setSelectedRedaction(null)
    setMessage('Seleção cancelada.')
  }, [setMessage])

  useEffect(() => {
    const onTouchDown = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      activeTouches.current.add(event.pointerId)
      if (activeTouches.current.size > 1) {
        touchGestureBlocked.current = true
        if (selectionDrag.current?.pointerType === 'touch') cancelSelection()
      }
    }
    const onTouchEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      activeTouches.current.delete(event.pointerId)
      if (activeTouches.current.size === 0) touchGestureBlocked.current = false
    }
    // Observa também contatos fora do canvas, inclusive após perda de captura.
    // O bloqueio só termina quando todos os contatos de toque saem.
    window.addEventListener('pointerdown', onTouchDown, true)
    window.addEventListener('pointerup', onTouchEnd, true)
    window.addEventListener('pointercancel', onTouchEnd, true)
    return () => {
      window.removeEventListener('pointerdown', onTouchDown, true)
      window.removeEventListener('pointerup', onTouchEnd, true)
      window.removeEventListener('pointercancel', onTouchEnd, true)
    }
  }, [cancelSelection])

  const updateHistory = useCallback((update: (current: History) => History) => {
    const next = update(historyRef.current)
    historyRef.current = next
    setHistory(next)
  }, [])

  const showPendingAction = useCallback((action: PendingAction) => {
    loadSequence.current += 1
    pendingActionRef.current = action
    setPendingAction(action)
  }, [])

  const commitImage = useCallback((bitmap: ImageBitmap) => {
    setImage(bitmap)
    updateHistory(emptyHistory)
    setSelection(null)
    setSelectedRedaction(null)
    selectionDrag.current = null
    setMessage('Arraste sobre a imagem para marcar o que deseja ocultar.')
  }, [setMessage, updateHistory])

  const clearEditor = useCallback(() => {
    loadSequence.current += 1
    setImage(null)
    updateHistory(emptyHistory)
    setSelection(null)
    setSelectedRedaction(null)
    selectionDrag.current = null
    setDraggingFile(false)
    setStatus({ text: '', tone: 'info' })
  }, [updateHistory])

  const requestImage = useCallback(async (file: File) => {
    if (pendingActionRef.current) return
    if (!isSupportedImage(file)) {
      setMessage('Este arquivo não é uma imagem compatível. Arquivos SVG não são aceitos.', 'error')
      return
    }
    const request = ++loadSequence.current
    setMessage('Abrindo imagem…')
    try {
      const bitmap = await createImageBitmap(file)
      if (request !== loadSequence.current || pendingActionRef.current) {
        bitmap.close()
        return
      }
      if (historyRef.current.applied.length > 0) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        showPendingAction({ kind: 'replace', bitmap })
      } else {
        commitImage(bitmap)
      }
    } catch {
      if (request === loadSequence.current) setMessage('Não foi possível abrir esta imagem.', 'error')
    }
  }, [commitImage, setMessage, showPendingAction])

  useEffect(() => {
    if (!pendingAction || !dialogRef.current) return
    if (!dialogRef.current.open) dialogRef.current.showModal()
    cancelButtonRef.current?.focus()
  }, [pendingAction])

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dialogRef.current?.open) return
      if (!selectionDrag.current && !selection && selectedRedaction === null) return
      cancelSelection()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [selection, selectedRedaction, cancelSelection])

  const cancelPendingAction = () => {
    dialogRef.current?.close()
    const action = pendingActionRef.current
    if (action?.kind === 'replace') action.bitmap.close()
    pendingActionRef.current = null
    setPendingAction(null)
    window.requestAnimationFrame(() => {
      const previous = returnFocusRef.current
      if (previous?.isConnected && previous !== document.body) previous.focus()
      else newImageButtonRef.current?.focus()
    })
  }

  const confirmPendingAction = () => {
    const action = pendingActionRef.current
    if (!action) return
    dialogRef.current?.close()
    pendingActionRef.current = null
    setPendingAction(null)
    if (action.kind === 'new') {
      clearEditor()
      window.requestAnimationFrame(() => chooseButtonRef.current?.focus())
    } else if (action.kind === 'replace') {
      commitImage(action.bitmap)
      window.requestAnimationFrame(() => newImageButtonRef.current?.focus())
    } else {
      if (action.format === 'copy') void performCopy()
      else void performDownload()
      window.requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }

  const onNewImage = () => {
    if (historyRef.current.applied.length === 0) {
      clearEditor()
      window.requestAnimationFrame(() => chooseButtonRef.current?.focus())
      return
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    showPendingAction({ kind: 'new' })
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void requestImage(file)
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find(
        (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/'),
      )
      const file = item?.getAsFile()
      if (!file) return
      event.preventDefault()
      void requestImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [requestImage])

  useEffect(() => () => {
    loadSequence.current += 1
    const action = pendingActionRef.current
    if (action?.kind === 'replace') action.bitmap.close()
  }, [])
  useEffect(() => () => { image?.close() }, [image])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    try {
      renderImage(canvas, image, history.applied)
      if (selectedRedaction !== null) {
        const rect = history.applied[selectedRedaction]
        const context = canvas.getContext('2d')
        if (rect && context) {
          const displayWidth = canvas.getBoundingClientRect().width
          const scale = displayWidth > 0 ? canvas.width / displayWidth : 1
          context.save()
          context.strokeStyle = '#ffffff'
          context.lineWidth = 3 * scale
          context.strokeRect(rect.x, rect.y, rect.width, rect.height)
          context.strokeStyle = '#0071e3'
          context.lineWidth = 1.5 * scale
          context.strokeRect(rect.x, rect.y, rect.width, rect.height)
          context.restore()
        }
      }
      if (selection) {
        const context = canvas.getContext('2d')
        if (!context) return
        // Indicação visual da seleção pendente: existe só no canvas da tela,
        // nunca na exportação, que usa um canvas separado em exportPng.
        const displayWidth = canvas.getBoundingClientRect().width
        const scale = displayWidth > 0 ? canvas.width / displayWidth : 1
        const { x, y, width, height } = selection
        context.save()
        context.fillStyle = 'rgba(0, 113, 227, 0.14)'
        context.fillRect(x, y, width, height)
        context.strokeStyle = 'rgba(255, 255, 255, 0.95)'
        context.lineWidth = 3 * scale
        context.strokeRect(x, y, width, height)
        context.strokeStyle = '#0071e3'
        context.lineWidth = 1.5 * scale
        context.setLineDash([6 * scale, 4 * scale])
        context.strokeRect(x, y, width, height)
        context.restore()
      }
    } catch {
      setMessage('Não foi possível exibir a imagem neste navegador.', 'error')
    }
  }, [image, history.applied, selection, selectedRedaction, setMessage])

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDraggingFile(true)
  }

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFile(false)
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDraggingFile(false)
    const file = Array.from(event.dataTransfer.files).find(isSupportedImage)
    if (file) void requestImage(file)
    else setMessage('Solte um arquivo de imagem compatível. Arquivos SVG não são aceitos.', 'error')
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || event.button !== 0 || selectionDrag.current || touchGestureBlocked.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    selectionDrag.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start: pointOnCanvas(event),
      clientStart: { x: event.clientX, y: event.clientY },
    }
    setSelection(null)
    setSelectedRedaction(null)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = selectionDrag.current
    if (!image || !drag || drag.pointerId !== event.pointerId) return
    setSelection(rectFromPoints(drag.start, pointOnCanvas(event), image.width, image.height))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = selectionDrag.current
    if (!image || !drag || drag.pointerId !== event.pointerId) return
    selectionDrag.current = null
    const isClick = Math.hypot(event.clientX - drag.clientStart.x, event.clientY - drag.clientStart.y) < 4
    if (isClick) {
      const index = redactionAtPoint(history.applied, pointOnCanvas(event))
      setSelection(null)
      setSelectedRedaction(index)
      if (index !== null) setMessage('Ocultação selecionada. Use “Remover ocultação” para removê-la.')
      return
    }
    const rect = rectFromPoints(drag.start, pointOnCanvas(event), image.width, image.height)
    setSelection(rect)
    if (rect) setMessage('Região marcada.')
  }

  const onPointerCancel = (event: PointerEvent<HTMLCanvasElement>) => {
    // pointerup já encerrou o arraste antes da perda normal de captura.
    if (selectionDrag.current?.pointerId !== event.pointerId) return
    cancelSelection()
  }

  const onHide = () => {
    if (!selection) return
    updateHistory((current) => applyRedaction(current, selection))
    setSelection(null)
    setSelectedRedaction(null)
    setMessage('Região ocultada.')
  }

  const onRemove = () => {
    if (selectedRedaction === null) return
    updateHistory((current) => removeRedaction(current, selectedRedaction))
    setSelectedRedaction(null)
    setMessage('Ocultação removida. Você pode desfazer esta ação.')
  }

  const onUndo = () => {
    updateHistory(undo)
    setSelectedRedaction(null)
    setMessage('Última edição desfeita.')
  }

  const onRedo = () => {
    updateHistory(redo)
    setSelectedRedaction(null)
    setMessage('Edição refeita.')
  }

  const performCopy = async () => {
    if (!image) return
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setMessage('Este navegador não permite copiar imagens aqui. Use “Baixar PNG”.', 'error')
      return
    }
    try {
      const png = exportPng(image, history.applied)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setMessage(history.applied.length > 0 ? 'Imagem com ocultações copiada.' : 'Imagem copiada sem ocultações.', 'success')
    } catch {
      setMessage('Não foi possível copiar. Verifique a permissão da área de transferência ou use “Baixar PNG”.', 'error')
    }
  }

  const performDownload = async () => {
    if (!image) return
    let png: Blob
    try {
      png = await exportPng(image, history.applied)
    } catch {
      setMessage('Não foi possível gerar o PNG desta imagem.', 'error')
      return
    }

    let url: string | null = null
    let link: HTMLAnchorElement | null = null
    try {
      url = URL.createObjectURL(png)
      link = document.createElement('a')
      link.href = url
      link.download = 'screenshot-protegido.png'
      document.body.append(link)
      link.click()
      setMessage(history.applied.length > 0 ? 'Download do PNG com ocultações solicitado ao navegador.' : 'Download do PNG sem ocultações solicitado ao navegador.', 'success', true)
    } catch {
      setMessage('Não foi possível solicitar o download. Tente novamente.', 'error')
    } finally {
      link?.remove()
      if (url) {
        const completedUrl = url
        window.setTimeout(() => URL.revokeObjectURL(completedUrl), 1000)
      }
    }
  }

  const onCopy = () => {
    if (!image) return
    if (history.applied.length === 0) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      showPendingAction({ kind: 'export', format: 'copy' })
    } else {
      void performCopy()
    }
  }

  const onDownload = () => {
    if (!image) return
    if (history.applied.length === 0) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      showPendingAction({ kind: 'export', format: 'download' })
    } else {
      void performDownload()
    }
  }

  return (
    <div className="app" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChange} />
      {/* Região de anúncio permanente: não é desmontada ao trocar de estado. */}
      <p className="sr-only" role="status" aria-live="polite">{status.text}</p>

      {image ? (
        <>
          <EditorToolbar
            canHide={selection !== null}
            canRemove={selectedRedaction !== null}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            hasRedactions={history.applied.length > 0}
            onHide={onHide}
            onRemove={onRemove}
            onUndo={onUndo}
            onRedo={onRedo}
            onCopy={onCopy}
            onDownload={onDownload}
            onNewImage={onNewImage}
            newImageButtonRef={newImageButtonRef}
          />

          <main className="workspace">
            <h1 className="sr-only">Editar screenshot</h1>
            <div className="stage">
              <canvas
                ref={canvasRef}
                className="editor-canvas"
                width={image.width}
                height={image.height}
                aria-label="Screenshot; arraste o mouse para selecionar a região a ocultar"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={onPointerCancel}
              />
            </div>
            {draggingFile && (
              <div className="drop-overlay" aria-hidden="true">
                <span className="drop-overlay__content">
                  <ImageUp size={20} strokeWidth={2} />
                  Solte para substituir a imagem atual
                </span>
              </div>
            )}
          </main>

          <footer className="statusbar">
            <div className="statusbar__feedback">
              <Feedback status={status} />
              {status.downloadRequested && (
                <details className="download-help">
                  <summary>Não encontrou o arquivo?</summary>
                  <p>Confira a pasta de downloads definida pelo navegador. No iPhone, procure na lista de downloads do Safari ou no app Arquivos. O PNG não aparece automaticamente no Fotos.</p>
                </details>
              )}
            </div>
            <span className="statusbar__meta">
              <span>Cole ou arraste outra imagem para trocar</span>
              <span className="statusbar__item">
                <Lock size={13} strokeWidth={2} aria-hidden="true" />
                Processado localmente
              </span>
            </span>
          </footer>
        </>
      ) : (
        <>
          <PublicHeader />
          <main className="empty-main">
            <EmptyState
              isDragging={draggingFile}
              status={status}
              modifierKey={MODIFIER_KEY}
              onChooseFile={() => fileInputRef.current?.click()}
              chooseButtonRef={chooseButtonRef}
            />
            <PublicInformation />
          </main>
          <PublicFooter />
        </>
      )}

      <dialog
        ref={dialogRef}
        className="confirmation-dialog"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        onCancel={(event) => { event.preventDefault(); cancelPendingAction() }}
      >
        <h2 id="confirmation-title">
          {pendingAction?.kind === 'export' ? 'Revisar imagem antes de compartilhar' : 'Descartar edição?'}
        </h2>
        <p id="confirmation-description">
          {pendingAction?.kind === 'export'
            ? 'Esta imagem ainda não possui informações ocultadas. Deseja continuar mesmo assim?'
            : pendingAction?.kind === 'new'
              ? 'As tarjas aplicadas serão descartadas ao voltar para o início.'
              : 'As tarjas aplicadas serão descartadas ao substituir esta imagem.'}
        </p>
        <div className="confirmation-dialog__actions">
          <button ref={cancelButtonRef} type="button" className="btn btn--secondary" onClick={cancelPendingAction}>
            {pendingAction?.kind === 'export' ? 'Voltar à edição' : 'Cancelar'}
          </button>
          <button type="button" className="btn btn--primary" onClick={confirmPendingAction}>
            {pendingAction?.kind === 'export'
              ? 'Continuar mesmo assim'
              : pendingAction?.kind === 'new' ? 'Descartar e voltar' : 'Descartar e substituir'}
          </button>
        </div>
      </dialog>
    </div>
  )
}

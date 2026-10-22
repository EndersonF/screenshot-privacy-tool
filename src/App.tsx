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
import { ZoomControls } from './components/ZoomControls'
import { useImageView } from './useImageView'
import type { Status, StatusTone } from './components/Feedback'

const MODIFIER_KEY = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
type PendingAction =
  | { kind: 'new' }
  | { kind: 'replace'; bitmap: ImageBitmap }
  | { kind: 'export'; format: 'copy' | 'download' }

type SelectionDrag = { pointerId: number; pointerType: string; start: Point; clientStart: Point }
type PanDrag = { pointerId: number; start: Point; scroll: Point }

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chooseButtonRef = useRef<HTMLButtonElement>(null)
  const newImageButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const selectionDrag = useRef<SelectionDrag | null>(null)
  const panDrag = useRef<PanDrag | null>(null)
  const captureTarget = useRef<HTMLElement | null>(null)
  const navigationTouches = useRef(new Set<number>())
  const activeTouches = useRef(new Set<number>())
  const touchGestureBlocked = useRef(false)
  const loadSequence = useRef(0)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [moving, setMoving] = useState(false)
  const [gestureActive, setGestureActive] = useState(false)
  const [history, setHistory] = useState(emptyHistory)
  const historyRef = useRef(history)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [selectedRedaction, setSelectedRedaction] = useState<number | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [status, setStatus] = useState<Status>({ text: '', tone: 'info' })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const pendingActionRef = useRef<PendingAction | null>(null)

  const setMessage = useCallback((text: string, tone: StatusTone = 'info') => {
    setStatus({ text, tone })
  }, [])

  // Retorno de copiar/baixar: aparece junto aos botões que o originaram.
  // Qualquer mensagem posterior do editor o substitui, como antes.
  const setExportMessage = useCallback((text: string, tone: StatusTone, downloadRequested = false) => {
    setStatus({ text, tone, downloadRequested, scope: 'export' })
  }, [])

  const cancelSelection = useCallback(() => {
    const drag = selectionDrag.current
    selectionDrag.current = null
    if (drag) {
      if (captureTarget.current?.hasPointerCapture(drag.pointerId)) captureTarget.current.releasePointerCapture(drag.pointerId)
      captureTarget.current = null
    }
    setGestureActive(panDrag.current !== null || navigationTouches.current.size > 0)
    setSelection(null)
    setSelectedRedaction(null)
    setMessage('Seleção cancelada.')
  }, [setMessage])

  const cancelActiveGesture = useCallback(() => {
    if (selectionDrag.current) cancelSelection()
    const pan = panDrag.current
    panDrag.current = null
    if (pan && captureTarget.current?.hasPointerCapture(pan.pointerId)) captureTarget.current.releasePointerCapture(pan.pointerId)
    captureTarget.current = null
    setGestureActive(navigationTouches.current.size > 0)
  }, [cancelSelection])

  const { canvasRef, viewportRef, scale, canZoomIn, canZoomOut, zoom, fit } = useImageView(image, cancelActiveGesture)

  useEffect(() => {
    // Rolar a página ou a área da imagem durante uma seleção muda sua geometria.
    // A navegação normal não redesenha o bitmap nem modifica uma seleção concluída.
    const onScroll = () => {
      if (selectionDrag.current) cancelSelection()
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [cancelSelection])

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
      // Em rolagem nativa, pointercancel acontece antes de levantar o dedo.
      if (event.type !== 'pointercancel') navigationTouches.current.delete(event.pointerId)
      if (!selectionDrag.current && !panDrag.current && navigationTouches.current.size === 0) setGestureActive(false)
    }
    const onNativeTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) return
      navigationTouches.current.clear()
      if (!selectionDrag.current && !panDrag.current) setGestureActive(false)
    }
    // Observa também contatos fora do canvas, inclusive após perda de captura.
    // O bloqueio só termina quando todos os contatos de toque saem.
    window.addEventListener('pointerdown', onTouchDown, true)
    window.addEventListener('pointerup', onTouchEnd, true)
    window.addEventListener('pointercancel', onTouchEnd, true)
    window.addEventListener('touchend', onNativeTouchEnd, { capture: true, passive: true })
    window.addEventListener('touchcancel', onNativeTouchEnd, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onTouchDown, true)
      window.removeEventListener('pointerup', onTouchEnd, true)
      window.removeEventListener('pointercancel', onTouchEnd, true)
      window.removeEventListener('touchend', onNativeTouchEnd, true)
      window.removeEventListener('touchcancel', onNativeTouchEnd, true)
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
    cancelActiveGesture()
    navigationTouches.current.clear()
    setGestureActive(false)
    setImage(bitmap)
    setMoving(false)
    updateHistory(emptyHistory)
    setSelection(null)
    setSelectedRedaction(null)
    selectionDrag.current = null
    setMessage('Arraste sobre a imagem para marcar o que deseja ocultar.')
  }, [cancelActiveGesture, setMessage, updateHistory])

  const clearEditor = useCallback(() => {
    cancelActiveGesture()
    navigationTouches.current.clear()
    setGestureActive(false)
    loadSequence.current += 1
    setImage(null)
    setMoving(false)
    updateHistory(emptyHistory)
    setSelection(null)
    setSelectedRedaction(null)
    selectionDrag.current = null
    setDraggingFile(false)
    setStatus({ text: '', tone: 'info' })
  }, [cancelActiveGesture, updateHistory])

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
    const drag = selectionDrag.current ?? panDrag.current
    if (drag && captureTarget.current?.hasPointerCapture(drag.pointerId)) captureTarget.current.releasePointerCapture(drag.pointerId)
    captureTarget.current = null
    selectionDrag.current = null
    panDrag.current = null
    navigationTouches.current.clear()
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
  }, [image, history.applied, selection, selectedRedaction, scale, canvasRef, setMessage])

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
    if (!image || moving || event.button !== 0 || selectionDrag.current || touchGestureBlocked.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    captureTarget.current = event.currentTarget
    setGestureActive(true)
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    captureTarget.current = null
    setGestureActive(false)
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

  const onPanDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!moving || event.button !== 0 || panDrag.current) return
    const viewport = event.currentTarget
    const bounds = viewport.getBoundingClientRect()
    // Deixa as barras de rolagem nativas disponíveis também para o mouse.
    if (event.clientX >= bounds.left + viewport.clientLeft + viewport.clientWidth
      || event.clientY >= bounds.top + viewport.clientTop + viewport.clientHeight) return
    if (event.pointerType === 'touch') {
      // No modo mover, o navegador controla a rolagem com um dedo.
      // Não capturamos nem bloqueamos esse gesto nativo.
      navigationTouches.current.add(event.pointerId)
      setGestureActive(true)
      return
    }
    event.preventDefault()
    viewport.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    captureTarget.current = event.currentTarget
    panDrag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      scroll: { x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop },
    }
    setGestureActive(true)
  }

  const onPanMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.currentTarget.scrollLeft = drag.scroll.x + drag.start.x - event.clientX
    event.currentTarget.scrollTop = drag.scroll.y + drag.start.y - event.clientY
  }

  const onPanEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || event.type === 'pointerup') navigationTouches.current.delete(event.pointerId)
    if (panDrag.current?.pointerId === event.pointerId) {
      panDrag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      captureTarget.current = null
    }
    if (!selectionDrag.current && !panDrag.current && navigationTouches.current.size === 0) setGestureActive(false)
  }

  const viewAction = (action: () => void) => {
    if (!selectionDrag.current && !panDrag.current && navigationTouches.current.size === 0) action()
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
      setExportMessage('Este navegador não permite copiar imagens aqui. Use “Baixar PNG”.', 'error')
      return
    }
    try {
      const png = exportPng(image, history.applied)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setExportMessage(history.applied.length > 0 ? 'Imagem com ocultações copiada.' : 'Imagem copiada sem ocultações.', 'success')
    } catch {
      setExportMessage('Não foi possível copiar. Verifique a permissão da área de transferência ou use “Baixar PNG”.', 'error')
    }
  }

  const performDownload = async () => {
    if (!image) return
    let png: Blob
    try {
      png = await exportPng(image, history.applied)
    } catch {
      setExportMessage('Não foi possível gerar o PNG desta imagem.', 'error')
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
      setExportMessage(history.applied.length > 0 ? 'Download do PNG com ocultações solicitado ao navegador.' : 'Download do PNG sem ocultações solicitado ao navegador.', 'success', true)
    } catch {
      setExportMessage('Não foi possível solicitar o download. Tente novamente.', 'error')
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
            moving={moving}
            onHide={onHide}
            onRemove={onRemove}
            onUndo={onUndo}
            onRedo={onRedo}
            onCopy={onCopy}
            onDownload={onDownload}
            onNewImage={onNewImage}
            newImageButtonRef={newImageButtonRef}
            exportStatus={status.scope === 'export' ? status : null}
          />

          <main className="workspace">
            <h1 className="sr-only">Editar screenshot</h1>
            <ZoomControls
              scale={scale}
              moving={moving}
              busy={gestureActive}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
              onZoomIn={() => viewAction(() => zoom(1))}
              onZoomOut={() => viewAction(() => zoom(-1))}
              onFit={() => viewAction(fit)}
              onToggleMoving={() => viewAction(() => setMoving((current) => !current))}
            />
            <div className="stage">
              <div
                ref={viewportRef}
                className={`image-viewport${moving ? ' image-viewport--moving' : ''}${gestureActive && moving ? ' image-viewport--dragging' : ''}`}
                role="region"
                aria-label="Visualização da imagem"
                aria-describedby="view-mode-hint"
                tabIndex={0}
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={onPanEnd}
                onPointerCancel={onPanEnd}
                onLostPointerCapture={onPanEnd}
              >
                <div className="image-content">
                  <canvas
                    ref={canvasRef}
                    className="editor-canvas"
                    width={image.width}
                    height={image.height}
                    aria-label={moving ? 'Screenshot; modo mover imagem' : 'Screenshot; arraste para selecionar a região a ocultar'}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onLostPointerCapture={onPointerCancel}
                  />
                </div>
              </div>
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
              {/* O retorno da exportação é exibido somente na toolbar, sem duplicação. */}
              {status.scope !== 'export' && <Feedback status={status} />}
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

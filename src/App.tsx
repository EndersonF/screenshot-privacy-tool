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
import type { Point, Rect } from './redaction'
import { Brand } from './components/Brand'
import { EditorToolbar } from './components/EditorToolbar'
import { EmptyState } from './components/EmptyState'
import { Feedback } from './components/Feedback'
import type { Status, StatusTone } from './components/Feedback'

const MODIFIER_KEY = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
type PendingAction =
  | { kind: 'new' }
  | { kind: 'replace'; file: File }
  | { kind: 'export'; format: 'copy' | 'download' }

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
  const startPoint = useRef<Point | null>(null)
  const startClientPoint = useRef<Point | null>(null)
  const loadSequence = useRef(0)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [history, setHistory] = useState(emptyHistory)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [selectedRedaction, setSelectedRedaction] = useState<number | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [status, setStatus] = useState<Status>({ text: '', tone: 'info' })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const setMessage = useCallback((text: string, tone: StatusTone = 'info') => {
    setStatus({ text, tone })
  }, [])

  const loadImage = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) {
      setMessage('Este arquivo não é uma imagem compatível. Arquivos SVG não são aceitos.', 'error')
      return
    }

    const request = ++loadSequence.current
    setMessage('Abrindo imagem…')
    try {
      const bitmap = await createImageBitmap(file)
      if (request !== loadSequence.current) {
        bitmap.close()
        return
      }
      setImage(bitmap)
      setHistory(emptyHistory())
      setSelection(null)
      setSelectedRedaction(null)
      startPoint.current = null
      startClientPoint.current = null
      setMessage('Arraste sobre a imagem para marcar o que deseja ocultar.')
    } catch {
      if (request === loadSequence.current) {
        setMessage('Não foi possível abrir esta imagem.', 'error')
      }
    }
  }, [setMessage])

  const clearEditor = useCallback(() => {
    loadSequence.current += 1
    setImage(null)
    setHistory(emptyHistory())
    setSelection(null)
    setSelectedRedaction(null)
    startPoint.current = null
    startClientPoint.current = null
    setDraggingFile(false)
    setStatus({ text: '', tone: 'info' })
  }, [])

  const requestImage = useCallback((file: File) => {
    if (!isSupportedImage(file)) {
      setMessage('Este arquivo não é uma imagem compatível. Arquivos SVG não são aceitos.', 'error')
      return
    }
    if (history.applied.length > 0) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPendingAction({ kind: 'replace', file })
    } else {
      void loadImage(file)
    }
  }, [history.applied.length, loadImage, setMessage])

  useEffect(() => {
    if (!pendingAction || !dialogRef.current) return
    if (!dialogRef.current.open) dialogRef.current.showModal()
    cancelButtonRef.current?.focus()
  }, [pendingAction])

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dialogRef.current?.open) return
      if (!startPoint.current && !selection && selectedRedaction === null) return
      startPoint.current = null
      startClientPoint.current = null
      setSelection(null)
      setSelectedRedaction(null)
      setMessage('Seleção cancelada.')
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [selection, selectedRedaction, setMessage])

  const cancelPendingAction = () => {
    dialogRef.current?.close()
    setPendingAction(null)
    window.requestAnimationFrame(() => {
      const previous = returnFocusRef.current
      if (previous?.isConnected && previous !== document.body) previous.focus()
      else newImageButtonRef.current?.focus()
    })
  }

  const confirmPendingAction = () => {
    const action = pendingAction
    if (!action) return
    dialogRef.current?.close()
    setPendingAction(null)
    if (action.kind === 'new') {
      clearEditor()
      window.requestAnimationFrame(() => chooseButtonRef.current?.focus())
    } else if (action.kind === 'replace') {
      void loadImage(action.file)
      window.requestAnimationFrame(() => newImageButtonRef.current?.focus())
    } else {
      if (action.format === 'copy') void performCopy()
      else void performDownload()
      window.requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }

  const onNewImage = () => {
    if (history.applied.length === 0) {
      clearEditor()
      window.requestAnimationFrame(() => chooseButtonRef.current?.focus())
      return
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPendingAction({ kind: 'new' })
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) requestImage(file)
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find(
        (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/'),
      )
      const file = item?.getAsFile()
      if (!file) return
      event.preventDefault()
      requestImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [requestImage])

  useEffect(() => () => { loadSequence.current += 1 }, [])
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
    if (file) requestImage(file)
    else setMessage('Solte um arquivo de imagem compatível. Arquivos SVG não são aceitos.', 'error')
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startPoint.current = pointOnCanvas(event)
    startClientPoint.current = { x: event.clientX, y: event.clientY }
    setSelection(null)
    setSelectedRedaction(null)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || !startPoint.current) return
    setSelection(rectFromPoints(startPoint.current, pointOnCanvas(event), image.width, image.height))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || !startPoint.current) return
    const clientStart = startClientPoint.current
    const isClick = clientStart && Math.hypot(event.clientX - clientStart.x, event.clientY - clientStart.y) < 4
    startClientPoint.current = null
    if (isClick) {
      const index = redactionAtPoint(history.applied, pointOnCanvas(event))
      startPoint.current = null
      setSelection(null)
      setSelectedRedaction(index)
      if (index !== null) setMessage('Ocultação selecionada. Use “Remover ocultação” para removê-la.')
      return
    }
    const rect = rectFromPoints(startPoint.current, pointOnCanvas(event), image.width, image.height)
    startPoint.current = null
    setSelection(rect)
    if (rect) setMessage('Região marcada. Clique em “Ocultar região” para cobri-la.')
  }

  const onPointerCancel = () => {
    startPoint.current = null
    startClientPoint.current = null
    setSelection(null)
  }

  const onHide = () => {
    if (!selection) return
    setHistory((current) => applyRedaction(current, selection))
    setSelection(null)
    setSelectedRedaction(null)
    setMessage('Região ocultada. Revise a imagem antes de compartilhar.')
  }

  const onRemove = () => {
    if (selectedRedaction === null) return
    setHistory((current) => removeRedaction(current, selectedRedaction))
    setSelectedRedaction(null)
    setMessage('Ocultação removida. Você pode desfazer esta ação.')
  }

  const onUndo = () => {
    setHistory(undo)
    setSelectedRedaction(null)
    setMessage('Última edição desfeita.')
  }

  const onRedo = () => {
    setHistory(redo)
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
      setMessage('Imagem protegida copiada.', 'success')
    } catch {
      setMessage('Não foi possível copiar. Verifique a permissão da área de transferência ou use “Baixar PNG”.', 'error')
    }
  }

  const performDownload = async () => {
    if (!image) return
    try {
      const png = await exportPng(image, history.applied)
      const url = URL.createObjectURL(png)
      const link = document.createElement('a')
      link.href = url
      link.download = 'screenshot-protegido.png'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('PNG protegido salvo.', 'success')
    } catch {
      setMessage('Não foi possível gerar o PNG desta imagem.', 'error')
    }
  }

  const onCopy = () => {
    if (!image) return
    if (history.applied.length === 0) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPendingAction({ kind: 'export', format: 'copy' })
    } else {
      void performCopy()
    }
  }

  const onDownload = () => {
    if (!image) return
    if (history.applied.length === 0) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPendingAction({ kind: 'export', format: 'download' })
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
            <Feedback status={status} />
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
          <header className="empty-header">
            <Brand />
          </header>
          <main className="empty-main">
            <EmptyState
              isDragging={draggingFile}
              status={status}
              modifierKey={MODIFIER_KEY}
              onChooseFile={() => fileInputRef.current?.click()}
              chooseButtonRef={chooseButtonRef}
            />
          </main>
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

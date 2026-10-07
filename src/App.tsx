import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, PointerEvent } from 'react'
import {
  applyRedaction,
  emptyHistory,
  exportPng,
  rectFromPoints,
  redo,
  renderImage,
  undo,
} from './redaction'
import type { Point, Rect } from './redaction'

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
  const startPoint = useRef<Point | null>(null)
  const loadSequence = useRef(0)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [history, setHistory] = useState(emptyHistory)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [message, setMessage] = useState('Cole uma imagem com Ctrl+V ou arraste um arquivo para começar.')

  const loadImage = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) {
      setMessage('Escolha uma imagem compatível. Arquivos SVG não são aceitos.')
      return
    }

    const request = ++loadSequence.current
    setMessage('Abrindo imagem...')
    try {
      const bitmap = await createImageBitmap(file)
      if (request !== loadSequence.current) {
        bitmap.close()
        return
      }
      setImage(bitmap)
      setHistory(emptyHistory())
      setSelection(null)
      startPoint.current = null
      setMessage('Imagem pronta. Arraste no canvas para selecionar uma região.')
    } catch {
      if (request === loadSequence.current) {
        setMessage('Não foi possível abrir esta imagem.')
      }
    }
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find(
        (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/'),
      )
      const file = item?.getAsFile()
      if (!file) return
      event.preventDefault()
      void loadImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadImage])

  useEffect(() => () => { loadSequence.current += 1 }, [])
  useEffect(() => () => { image?.close() }, [image])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    try {
      renderImage(canvas, image, history.applied)
      if (selection) {
        const context = canvas.getContext('2d')
        if (!context) return
        context.save()
        context.fillStyle = 'rgba(39, 111, 235, 0.16)'
        context.strokeStyle = '#276feb'
        context.lineWidth = Math.max(1, image.width / canvas.getBoundingClientRect().width)
        context.setLineDash([8, 5])
        context.fillRect(selection.x, selection.y, selection.width, selection.height)
        context.strokeRect(selection.x, selection.y, selection.width, selection.height)
        context.restore()
      }
    } catch {
      setMessage('Não foi possível renderizar a imagem neste navegador.')
    }
  }, [image, history.applied, selection])

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDraggingFile(false)
    const file = Array.from(event.dataTransfer.files).find(isSupportedImage)
    if (file) void loadImage(file)
    else setMessage('Solte um arquivo de imagem compatível. Arquivos SVG não são aceitos.')
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startPoint.current = pointOnCanvas(event)
    setSelection(null)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || !startPoint.current) return
    setSelection(rectFromPoints(startPoint.current, pointOnCanvas(event), image.width, image.height))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!image || !startPoint.current) return
    const rect = rectFromPoints(startPoint.current, pointOnCanvas(event), image.width, image.height)
    startPoint.current = null
    setSelection(rect)
    if (rect) setMessage('Região selecionada. Clique em “Aplicar redaction”.')
  }

  const onPointerCancel = () => {
    startPoint.current = null
    setSelection(null)
  }

  const onApply = () => {
    if (!selection) return
    setHistory((current) => applyRedaction(current, selection))
    setSelection(null)
    setMessage('Redaction aplicada. Revise a imagem antes de compartilhar.')
  }

  const onCopy = async () => {
    if (!image || history.applied.length === 0) return
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setMessage('Cópia de imagem indisponível. Use Chrome ou Edge em localhost ou HTTPS.')
      return
    }
    try {
      const png = exportPng(image, history.applied)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setMessage('Imagem protegida copiada para a área de transferência.')
    } catch {
      setMessage('Não foi possível copiar a imagem. Verifique a permissão da área de transferência.')
    }
  }

  const onDownload = async () => {
    if (!image || history.applied.length === 0) return
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
      setMessage('PNG protegido gerado para download.')
    } catch {
      setMessage('Não foi possível gerar o PNG desta imagem.')
    }
  }

  return (
    <main className="app">
      <header>
        <h1>Proteção de screenshots</h1>
        <p>Oculte uma região antes de compartilhar a imagem.</p>
      </header>

      <section
        className={`drop-zone${draggingFile ? ' drop-zone--active' : ''}`}
        aria-label="Área para colar ou arrastar uma imagem"
        onDragOver={(event) => { event.preventDefault(); setDraggingFile(true) }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFile(false)
        }}
        onDrop={onDrop}
      >
        <p className="drop-hint">Cole uma imagem com <kbd>Ctrl</kbd> + <kbd>V</kbd> ou arraste um arquivo até aqui.</p>
        {image ? (
          <canvas
            ref={canvasRef}
            width={image.width}
            height={image.height}
            aria-label="Screenshot; arraste o mouse para selecionar a região a ocultar"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        ) : (
          <div className="empty-state">A imagem aparecerá aqui.</div>
        )}
      </section>

      <div className="actions">
        <button type="button" onClick={onApply} disabled={!selection}>Aplicar redaction</button>
        <button type="button" onClick={() => { setHistory(undo); setMessage('Última redaction desfeita.') }} disabled={history.applied.length === 0}>Desfazer</button>
        <button type="button" onClick={() => { setHistory(redo); setMessage('Redaction refeita.') }} disabled={history.undone.length === 0}>Refazer</button>
        <button type="button" onClick={() => { void onCopy() }} disabled={history.applied.length === 0}>Copiar imagem protegida</button>
        <button type="button" onClick={() => { void onDownload() }} disabled={history.applied.length === 0}>Baixar PNG</button>
      </div>

      <p className="message" role="status" aria-live="polite">{message}</p>
      <p className="privacy-note">Processado localmente. Nenhuma imagem é enviada para servidores.</p>
    </main>
  )
}

import { useLayoutEffect, useRef, useState } from 'react'
import type { Point } from './redaction'

const MAX_SCALE = 4
const SCALE_STEP = 1.5

type ViewGeometry = { scale: number; minimum: number; fitting: boolean; width: number; height: number }
type View = ViewGeometry & { scrollLeft: number; scrollTop: number }

/** Estado de visualização: nunca altera o bitmap, as regiões ou o histórico. */
export function useImageView(image: ImageBitmap | null, onGeometryChange: () => void) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View | null>(null)
  const [scale, setScale] = useState(1)
  const [minimum, setMinimum] = useState(1)

  const centerPoint = (resizing = false): Point | null => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    const view = viewRef.current
    if (!viewport || !canvas || !image || !view) return null
    if (!resizing) {
      const bounds = viewport.getBoundingClientRect()
      const displayed = canvas.getBoundingClientRect()
      return {
        x: (bounds.left + viewport.clientLeft + viewport.clientWidth / 2 - displayed.left) * image.width / displayed.width,
        y: (bounds.top + viewport.clientTop + viewport.clientHeight / 2 - displayed.top) * image.height / displayed.height,
      }
    }
    // No resize, o DOM já tem o novo tamanho. Derivamos a margem do
    // enquadramento anterior para preservar seu centro ao surgir rolagem.
    const left = Math.max(0, (view.width - image.width * view.scale) / 2)
    const top = Math.max(0, (view.height - image.height * view.scale) / 2)
    return {
      x: (view.scrollLeft + view.width / 2 - left) / view.scale,
      y: (view.scrollTop + view.height / 2 - top) / view.scale,
    }
  }

  const display = (next: ViewGeometry, center: Point | null) => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas || !image) return
    canvas.style.width = `${image.width * next.scale}px`
    canvas.style.height = `${image.height * next.scale}px`
    // O conteúdo só é centralizado nos eixos em que cabe. A rolagem nativa
    // limita os deslocamentos, mantendo todos os cantos alcançáveis.
    viewport.scrollLeft = center ? center.x * next.scale + canvas.offsetLeft - next.width / 2 : 0
    viewport.scrollTop = center ? center.y * next.scale + canvas.offsetTop - next.height / 2 : 0
    viewRef.current = { ...next, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop }
    setScale(next.scale)
    setMinimum(next.minimum)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas || !image) {
      viewRef.current = null
      return
    }

    viewRef.current = null
    const resize = () => {
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      if (width === 0 || height === 0) return
      const current = viewRef.current
      if (current?.width === width && current.height === height) return
      const center = centerPoint(true)
      const minimum = Math.min(1, width / image.width, height / image.height)
      if (current) onGeometryChange()
      display({
        width,
        height,
        minimum,
        fitting: current?.fitting ?? true,
        scale: !current || current.fitting ? minimum : Math.max(minimum, current.scale),
      }, current?.fitting ? null : center)
    }
    resize()
    const rememberScroll = () => {
      const current = viewRef.current
      // O navegador pode limitar a rolagem antes de entregar um resize.
      // Nesse caso, o centro deve usar a posição do enquadramento anterior.
      if (current && current.width === viewport.clientWidth && current.height === viewport.clientHeight) {
        current.scrollLeft = viewport.scrollLeft
        current.scrollTop = viewport.scrollTop
      }
    }
    viewport.addEventListener('scroll', rememberScroll, { passive: true })
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', rememberScroll)
      viewRef.current = null
    }
    // Os callbacks só leem refs; uma nova imagem inicia outro enquadramento.
  }, [image, onGeometryChange])

  const zoom = (direction: 1 | -1) => {
    const current = viewRef.current
    if (!current) return
    const nextScale = Math.max(current.minimum, Math.min(MAX_SCALE, current.scale * SCALE_STEP ** direction))
    if (nextScale === current.scale) return
    display({ ...current, scale: nextScale, fitting: nextScale === current.minimum }, centerPoint())
  }

  const fit = () => {
    const current = viewRef.current
    if (current) display({ ...current, scale: current.minimum, fitting: true }, null)
  }

  return {
    viewportRef,
    canvasRef,
    scale,
    canZoomIn: scale < MAX_SCALE - 0.000001,
    canZoomOut: scale > minimum + 0.000001,
    zoom,
    fit,
  }
}

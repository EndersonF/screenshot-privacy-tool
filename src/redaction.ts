export type Point = { x: number; y: number }

export type Rect = { x: number; y: number; width: number; height: number }

export type History = { applied: Rect[]; past: Rect[][]; future: Rect[][] }

export const emptyHistory = (): History => ({ applied: [], past: [], future: [] })

export function rectFromPoints(start: Point, end: Point, width: number, height: number): Rect | null {
  const left = Math.max(0, Math.floor(Math.min(start.x, end.x)))
  const top = Math.max(0, Math.floor(Math.min(start.y, end.y)))
  const right = Math.min(width, Math.ceil(Math.max(start.x, end.x)))
  const bottom = Math.min(height, Math.ceil(Math.max(start.y, end.y)))

  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function applyRedaction(history: History, rect: Rect): History {
  return { applied: [...history.applied, rect], past: [...history.past, history.applied], future: [] }
}

export function removeRedaction(history: History, index: number): History {
  if (index < 0 || index >= history.applied.length) return history
  return {
    applied: history.applied.filter((_, currentIndex) => currentIndex !== index),
    past: [...history.past, history.applied],
    future: [],
  }
}

export function redactionAtPoint(redactions: Rect[], point: Point): number | null {
  for (let index = redactions.length - 1; index >= 0; index -= 1) {
    const rect = redactions[index]
    if (point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height) {
      return index
    }
  }
  return null
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  return {
    applied: history.past[history.past.length - 1],
    past: history.past.slice(0, -1),
    future: [history.applied, ...history.future],
  }
}

export function redo(history: History): History {
  if (history.future.length === 0) return history
  return {
    applied: history.future[0],
    past: [...history.past, history.applied],
    future: history.future.slice(1),
  }
}

export function renderImage(canvas: HTMLCanvasElement, image: ImageBitmap, redactions: Rect[]): void {
  if (canvas.width !== image.width) canvas.width = image.width
  if (canvas.height !== image.height) canvas.height = image.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível iniciar o canvas.')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  context.fillStyle = '#000000'
  for (const rect of redactions) {
    context.fillRect(rect.x, rect.y, rect.width, rect.height)
  }
}

export function exportPng(image: ImageBitmap, redactions: Rect[]): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderImage(canvas, image, redactions)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível gerar o PNG.'))
    }, 'image/png')
  })
}

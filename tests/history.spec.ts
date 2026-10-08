import { expect, test } from '@playwright/test'
import { applyRedaction, emptyHistory, redactionAtPoint, redo, removeRedaction, undo } from '../src/redaction'
import type { Rect } from '../src/redaction'

const first: Rect = { x: 10, y: 10, width: 40, height: 40 }
const second: Rect = { x: 30, y: 30, width: 40, height: 40 }

test('remove uma tarja do meio e preserva as demais ao desfazer e refazer', () => {
  let history = applyRedaction(applyRedaction(emptyHistory(), first), second)
  history = removeRedaction(history, 0)
  expect(history.applied).toEqual([second])

  history = undo(history)
  expect(history.applied).toEqual([first, second])

  history = redo(history)
  expect(history.applied).toEqual([second])

  history = undo(history)
  history = applyRedaction(history, first)
  expect(history.future).toEqual([])
})

test('a última tarja aplicada vence nas regiões sobrepostas', () => {
  expect(redactionAtPoint([first, second], { x: 35, y: 35 })).toBe(1)
  expect(redactionAtPoint([first, second], { x: 15, y: 15 })).toBe(0)
  expect(redactionAtPoint([first, second], { x: 90, y: 90 })).toBeNull()
})

test('índice inválido e histórico vazio não alteram o estado', () => {
  const empty = emptyHistory()
  expect(undo(empty)).toBe(empty)
  expect(redo(empty)).toBe(empty)
  expect(removeRedaction(empty, 0)).toBe(empty)
})

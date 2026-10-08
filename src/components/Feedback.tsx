import { CircleAlert, CircleCheck } from 'lucide-react'

export type StatusTone = 'info' | 'success' | 'error'

export type Status = { text: string; tone: StatusTone }

type FeedbackProps = { status: Status; className?: string }

/**
 * Exibição visual da mensagem de status. O anúncio para leitores de tela é
 * feito por uma região `role="status"` permanente no App, por isso este
 * elemento fica oculto da árvore de acessibilidade.
 */
export function Feedback({ status, className = '' }: FeedbackProps) {
  if (!status.text) return null

  const Icon = status.tone === 'success' ? CircleCheck : status.tone === 'error' ? CircleAlert : null

  return (
    <span className={`feedback feedback--${status.tone} ${className}`.trim()} aria-hidden="true">
      {Icon && <Icon size={15} strokeWidth={2} />}
      <span key={status.text} className="feedback__text">{status.text}</span>
    </span>
  )
}

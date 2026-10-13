type BrandProps = { compact?: boolean }

/** O header e o favicon compartilham o mesmo SVG aprovado. */
export function Brand({ compact = false }: BrandProps) {
  return (
    <span className={`brand${compact ? ' brand--compact' : ''}`}>
      <img className="brand__mark" src="/app-icon.svg" width={26} height={26} alt="" aria-hidden="true" />
      <span className="brand__name">Tampei</span>
    </span>
  )
}

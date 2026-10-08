type BrandProps = { compact?: boolean }

/** Marca simples: um retângulo com uma tarja sólida, a ação central do produto. */
export function Brand({ compact = false }: BrandProps) {
  return (
    <span className={`brand${compact ? ' brand--compact' : ''}`}>
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="#1d1d1f" />
        <rect x="7" y="9" width="12" height="2.5" rx="1.25" fill="#ffffff" opacity="0.55" />
        <rect x="7" y="14.75" width="18" height="5" rx="1.5" fill="#ffffff" />
        <rect x="7" y="23" width="9" height="2.5" rx="1.25" fill="#ffffff" opacity="0.55" />
      </svg>
      <span className="brand__name">Proteção de screenshots</span>
    </span>
  )
}

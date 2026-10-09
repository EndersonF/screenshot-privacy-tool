import { Brand } from './Brand'

const REPOSITORY_URL = 'https://github.com/EndersonF/screenshot-privacy-tool'

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.6-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.31c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  )
}

export function PublicHeader() {
  return (
    <header className="empty-header">
      <Brand />
      <nav className="public-nav" aria-label="Navegação principal">
        <a href="#como-funciona">Como funciona</a>
        <a href="#privacidade">Privacidade</a>
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub (abre em nova aba)">
          <GitHubIcon /> GitHub
        </a>
      </nav>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <p><span className="public-footer__name">Proteção de screenshots</span><br />Projeto gratuito e open source.</p>
      <nav aria-label="Links do projeto">
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub (abre em nova aba)">GitHub</a>
        <a href={`${REPOSITORY_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" aria-label="Licença MIT (abre em nova aba)">Licença MIT</a>
      </nav>
    </footer>
  )
}

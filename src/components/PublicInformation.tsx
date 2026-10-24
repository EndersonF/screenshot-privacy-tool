import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const questions = [
  {
    question: 'Minhas imagens são enviadas para algum servidor?',
    answer: 'Não. No Tampei, a edição acontece diretamente no seu navegador, sem enviar sua imagem para um servidor. A hospedagem entrega os arquivos da ferramenta, mas não recebe o screenshot que você está editando.',
  },
  {
    question: 'A ferramenta identifica informações sensíveis automaticamente?',
    answer: 'Ainda não. Você escolhe manualmente quais partes da imagem deseja ocultar. Antes de compartilhar, revise o resultado para conferir se nenhuma informação ficou exposta.',
  },
  {
    question: 'Como faço para ocultar uma informação?',
    answer: "Cole, arraste ou escolha uma imagem. Em seguida, arraste o mouse ou deslize o dedo sobre a região que deseja esconder e clique em 'Ocultar região'. Repita o processo nas outras áreas e, ao terminar, copie ou baixe a imagem.",
  },
  {
    question: 'Como ampliar uma imagem para ocultar informações pequenas?',
    answer: "Use os botões de zoom (+ e -) para aproximar ou afastar a visualização. Para navegar pela imagem ampliada, ative o modo 'Mover imagem' e arraste com o mouse ou com um dedo. Para voltar a selecionar regiões e aplicar tarjas, basta desativar 'Mover imagem'. A qualquer momento, use a ação 'Imagem inteira' para recuperar o enquadramento completo. O zoom altera apenas a visualização em tela e não modifica a resolução original do arquivo.",
  },
  {
    question: 'Posso desfazer ou remover uma ocultação?',
    answer: "Sim. Você pode usar as ações de desfazer e refazer a qualquer momento. Para remover uma tarja específica, selecione-a com um clique ou toque e depois pressione 'Remover ocultação'.",
  },
  {
    question: 'Onde encontro a imagem depois de baixar?',
    answer: 'O destino do arquivo é definido pelas configurações do seu navegador e pelo dispositivo. No computador ou no Android, o PNG é salvo na pasta de downloads configurada no navegador. No Safari do iPhone, o arquivo pode ser encontrado na lista de downloads do navegador ou no app Arquivos (na pasta Downloads), conforme a sua configuração. Ele não é adicionado automaticamente ao aplicativo Fotos.',
  },
  {
    question: 'O que acontece com a imagem depois que termino?',
    answer: 'O Tampei não salva seus screenshots em uma conta ou banco de dados. Durante a edição, a imagem permanece temporariamente na memória do navegador. Ao copiar ou baixar, as tarjas são incorporadas aos pixels da imagem gerada. Depois disso, os arquivos baixados e o conteúdo copiado passam a ser gerenciados pelo seu dispositivo e navegador.',
  },
]

export function PublicInformation() {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0)

  return (
    <div className="public-information">
      <section id="como-funciona" className="public-section public-section--how" aria-labelledby="how-title">
        <div className="how-layout">
          <div className="how-copy">
            <div className="how-header">
              <h2 id="how-title">Como funciona</h2>
              <span className="how-arrow" aria-hidden="true">
                <span className="how-arrow__line" />
                <span className="how-arrow__badge">
                  <svg className="how-arrow__icon how-arrow__icon--desktop" width="22" height="16" viewBox="0 0 22 16" fill="none" focusable="false">
                    <path
                      d="M2 8H19M19 8L13 2M19 8L13 14"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <svg className="how-arrow__icon how-arrow__icon--mobile" width="20" height="18" viewBox="0 0 20 18" fill="none" focusable="false">
                    <path
                      d="M3 4H10C12.2091 4 14 5.79086 14 8V15M14 15L9.5 10.5M14 15L18.5 10.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </span>
            </div>

            <h3 className="how-lead">Você escolhe o que fica visível.</h3>
            <p className="how-description">
              Adicione a imagem, selecione o que deseja ocultar e confirme. Revise o resultado antes de compartilhar.
            </p>
            <p className="how-flow">
              <span className="how-flow__step">Adicione.</span>{' '}
              <span className="how-flow__step">Oculte.</span>{' '}
              <span className="how-flow__step">Compartilhe.</span>
            </p>
          </div>

          <figure className="how-demo">
            <div className="how-comparison">
              <div className="how-example">
                <p className="how-example__label">
                  <span>Antes</span>
                  <small>Imagem original</small>
                </p>
                <img
                  className="how-example__capture"
                  src="/demo-original.png"
                  alt="Conversa fictícia de atendimento com e-mail e telefone visíveis."
                  width={400}
                  height={440}
                  loading="lazy"
                />
              </div>
              <div className="how-example">
                <p className="how-example__label">
                  <span>Depois</span>
                  <small>No Tampei</small>
                </p>
                <img
                  className="how-example__capture"
                  src="/demo-protected.png"
                  alt="A mesma conversa, com tarjas pretas sobre o e-mail e o telefone."
                  width={400}
                  height={440}
                  loading="lazy"
                />
              </div>
            </div>
            <figcaption className="how-demo__caption">
              Conversa fictícia. Ocultações manuais no Tampei.
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="privacidade" className="public-section public-section--privacy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacidade no navegador</h2>
        <div className="public-prose">
          <p>A edição acontece localmente no seu navegador, sem upload do screenshot para a aplicação. Você seleciona manualmente o que deseja ocultar e revisa o resultado antes de compartilhar.</p>
          <p>A imagem fica temporariamente na memória durante a edição e não é salva em conta ou banco de dados. Downloads e conteúdo copiado são gerenciados pelo seu navegador e dispositivo. A hospedagem entrega os arquivos da aplicação e pode registrar dados técnicos de navegação, sem receber o screenshot editado.</p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="faq-title">
        <h2 id="faq-title">Perguntas frequentes</h2>
        <div className="faq">
          {questions.map(({ question, answer }, index) => {
            const isOpen = openQuestion === index
            return (
              <div className="faq__item" key={question}>
                <h3>
                  <button
                    type="button"
                    id={`faq-question-${index}`}
                    className="faq__question"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setOpenQuestion(isOpen ? null : index)}
                  >
                    {question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </h3>
                <div id={`faq-answer-${index}`} className="faq__answer" hidden={!isOpen}>
                  <p>{answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

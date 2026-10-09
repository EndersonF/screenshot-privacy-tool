import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const questions = [
  {
    question: 'Minhas imagens são enviadas para algum servidor?',
    answer: 'Não. A edição acontece no seu navegador, sem enviar o screenshot aos nossos servidores. A hospedagem entrega os arquivos da ferramenta, mas não recebe a imagem que você está editando.',
  },
  {
    question: 'A ferramenta identifica informações sensíveis automaticamente?',
    answer: 'Ainda não. Você escolhe manualmente quais partes da imagem deseja ocultar. Antes de compartilhar, revise o resultado para conferir se não deixou nenhuma informação exposta.',
  },
  {
    question: 'Como faço para ocultar uma informação?',
    answer: "Cole, arraste ou escolha uma imagem. Depois, arraste o mouse sobre a área que deseja esconder e clique em 'Ocultar região'. Repita nas outras áreas e copie ou baixe o resultado.",
  },
  {
    question: 'Posso desfazer ou remover uma ocultação?',
    answer: 'Sim. Enquanto estiver no editor, você pode desfazer, refazer ou clicar em uma tarja para removê-la individualmente.',
  },
  {
    question: 'O que acontece com a imagem depois que termino?',
    answer: 'A ferramenta não salva seus screenshots em uma conta ou banco de dados. A imagem permanece temporariamente na memória durante a edição. Ao copiar ou baixar, o arquivo gerado contém as tarjas incorporadas aos pixels. Os arquivos baixados e o conteúdo copiado passam a ser gerenciados pelo seu dispositivo e navegador.',
  },
]

export function PublicInformation() {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0)

  return (
    <div className="public-information">
      <section id="como-funciona" className="public-section" aria-labelledby="how-title">
        <h2 id="how-title">Como funciona</h2>
        <ol className="how-steps">
          <li><h3>Adicione</h3><p>Cole, arraste ou escolha uma imagem.</p></li>
          <li><h3>Oculte</h3><p>Selecione as regiões e confirme a ocultação.</p></li>
          <li><h3>Compartilhe</h3><p>Revise, copie ou baixe o PNG.</p></li>
        </ol>
      </section>

      <section id="privacidade" className="public-section public-section--privacy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacidade no navegador</h2>
        <div className="public-prose">
          <p>A edição acontece localmente no seu navegador, sem upload do screenshot para a aplicação. Você escolhe manualmente o que ocultar e precisa revisar o resultado antes de compartilhar.</p>
          <p>A imagem fica temporariamente na memória durante a edição. A ferramenta não salva screenshots; downloads e conteúdo copiado são gerenciados pelo seu dispositivo e navegador. A hospedagem entrega os arquivos da aplicação e pode registrar dados técnicos de navegação, sem receber o screenshot editado.</p>
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

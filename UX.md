# UX do MVP 0.1

Este documento consolida as decisões de experiência aprovadas para a aplicação web desktop-first e local-first. **Estado atual** descreve o spike técnico existente; **a implementar** descreve mudanças de UX aprovadas que ainda não estão no código. As decisões de produto e privacidade de [PRODUCT.md](PRODUCT.md) continuam válidas.

## 1. Objetivo da experiência

Permitir que uma pessoa revise um screenshot, oculte manualmente as regiões que escolher e copie ou baixe a imagem resultante com poucos passos. A experiência deve funcionar no navegador, com processamento local, sem backend, cadastro, configuração inicial ou tutorial obrigatório.

## 2. Princípios de UX

- O screenshot é o elemento central da interface; controles e mensagens devem apoiar a revisão sem competir com a imagem.
- A pessoa decide o que ocultar. Selecionar uma região e aplicar a tarja são ações distintas.
- A ocultação padrão é sólida e opaca. A imagem exportada incorpora a ocultação aos pixels, sem depender de camadas da interface.
- Copiar é a ação principal; baixar PNG é uma alternativa secundária.
- Avisos devem permitir uma escolha consciente antes de exportar sem tarjas ou descartar edições.
- O processamento local deve ser comunicado de forma permanente e discreta. A presença de tarjas não é uma garantia de que todo dado sensível foi ocultado.
- O visual deve ser minimalista e funcional, inspirado em ferramentas nativas, sem sidebar ou dashboard.

## 3. Fluxo principal

1. Colar um screenshot ou arrastar uma imagem para a área de entrada.
2. Revisar a imagem exibida e arrastar o mouse para marcar uma região.
3. Conferir a seleção visível e clicar em **Ocultar região**, ou usar Escape para cancelá-la.
4. Repetir a seleção quando necessário. É possível selecionar uma tarja aplicada e removê-la individualmente; aplicar e remover tarjas integram desfazer/refazer.
5. Revisar a imagem resultante e escolher **Copiar imagem** ou **Baixar PNG**. Se não houver tarjas, mostrar antes um aviso de revisão com as opções **Voltar** e **Continuar**.

Ao carregar outra imagem, o fluxo anterior é encerrado. Se houver uma imagem editada, a troca requer confirmação antes de descartar as alterações.

## 4. Estados da interface

### Estado atual do spike

| Estado ou comportamento | Implementação atual |
| --- | --- |
| Vazio | Área para colar com Ctrl+V ou arrastar uma imagem. |
| Carregamento e falha de entrada | Mensagem simples de abertura ou erro; a imagem anterior permanece se a nova falhar. |
| Imagem pronta | Canvas com a imagem e controles de edição. |
| Seleção pendente | Área marcada visualmente; a ocultação só é aplicada pelo botão **Aplicar redaction**. |
| Tarjas aplicadas | Tarjas pretas visíveis; desfazer/refazer disponível para aplicações. |
| Saída | Cópia e download em PNG disponíveis somente quando há ao menos uma tarja. |
| Troca de imagem | Nova imagem limpa seleção e histórico, sem confirmação de descarte. |
| Feedback e privacidade | Mensagem de status e aviso permanente de processamento local. |

### Estados aprovados a implementar

- Seleção pendente com cancelamento por Escape e botão **Ocultar região**.
- Tarja aplicada selecionada, com possibilidade de removê-la individualmente.
- Confirmação de revisão antes de copiar ou baixar uma imagem sem tarjas.
- Confirmação antes de substituir uma imagem editada.
- Feedback de sucesso discreto e erro objetivo com caminho alternativo quando uma saída falhar.
- Hierarquia visual que torne copiar a ação principal e baixar a secundária.

## 5. Seleção e confirmação

**Estado atual:** o arraste no canvas cria uma seleção visível, sem ocultar os pixels imediatamente. O botão **Aplicar redaction** confirma a ação. Iniciar outro arraste substitui a seleção pendente.

**A implementar:** o botão deve se chamar **Ocultar região**. Escape cancela a seleção ativa sem criar ou remover tarjas. A seleção pendente deve permanecer distinguível de uma tarja já aplicada. Somente a confirmação explícita transforma a região selecionada em uma tarja sólida.

## 6. Gerenciamento de tarjas

**Estado atual:** é possível aplicar várias tarjas, mas não selecionar nem remover uma tarja específica por clique.

**A implementar:** clicar em uma tarja aplicada permite selecioná-la; a seleção deve ser perceptível na interface e oferecer um controle claro para removê-la individualmente. A remoção altera somente a tarja escolhida. Escape cancela a seleção ativa. Qualquer indicação visual de seleção serve à edição e não integra a imagem exportada.

## 7. Desfazer e refazer

**Estado atual:** desfazer remove a última tarja aplicada; refazer a restaura. Aplicar uma nova tarja após desfazer limpa o histórico de refazer. Trocar de imagem reinicia o histórico.

**A implementar:** a remoção individual de uma tarja também deve entrar no histórico. Desfazer reverte a última aplicação ou remoção; refazer reaplica essa mesma ação. Uma nova edição após desfazer substitui o caminho de refazer. Ao substituir a imagem, o histórico anterior deve ser limpo.

## 8. Copiar, baixar e avisos

**Estado atual:** copiar e baixar PNG usam uma composição em canvas separada da imagem original; as tarjas são incorporadas aos pixels exportados. Ambas as ações ficam indisponíveis sem tarjas. Há mensagens simples de sucesso ou erro.

**A implementar:** **Copiar imagem** é a ação principal e **Baixar PNG** é secundária. As duas ações ficam disponíveis mesmo sem tarjas, mas nesse caso devem abrir um aviso de revisão antes da saída, com **Voltar** e **Continuar**. O aviso informa que nenhuma região foi ocultada, sem afirmar que uma imagem com tarjas esteja completamente segura. Sucesso deve ter feedback discreto; em falha de cópia, oferecer baixar PNG como caminho alternativo e, em falha de download, oferecer a cópia quando disponível.

## 9. Troca de imagem

**Estado atual:** colar ou soltar outra imagem substitui a atual e limpa seleção e histórico. Não há aviso quando a imagem anterior foi editada.

**A implementar:** uma imagem é considerada editada somente quando há uma ou mais tarjas efetivamente aplicadas no estado atual. Nesse caso, antes de substituí-la, pedir confirmação para descartar as alterações ou voltar à imagem atual. Sem tarjas aplicadas, a troca não exige confirmação, inclusive quando todas foram removidas ou desfeitas e restam alterações apenas no histórico de refazer. Uma seleção de região ainda não confirmada é descartada ao trocar de imagem e não a torna editada. A troca limpa seleção, tarjas e histórico anteriores. Se a nova imagem não puder ser aberta, manter a imagem atual e apresentar um erro objetivo.

## 10. Hierarquia e direção visual

**Estado atual:** interface clara e simples, com área de entrada, canvas, botões e mensagens. Os botões de saída têm tratamento visual semelhante.

**A implementar:** manter tema claro inicial, cores neutras e aparência funcional inspirada em ferramentas nativas. O screenshot deve ocupar a maior área útil. Organizar os controles próximos da imagem, com **Copiar imagem** visualmente prioritário e **Baixar PNG** secundário. Não usar sidebar ou dashboard. Avisos e confirmações devem ser claros, sem linguagem que prometa segurança completa.

## 11. Acessibilidade e responsividade

**Estado atual:** botões nativos, foco visível, rótulo para o canvas e mensagem de status anunciada pela interface. A seleção de regiões é feita por arraste do mouse.

**A implementar:** garantir navegação por teclado nos controles, inclusive no controle de remoção de tarja e nas opções dos avisos; manter foco visível, contraste suficiente e rótulos claros. A interface é desktop-first, mas deve preservar legibilidade e acesso aos controles quando a janela for reduzida. A seleção no canvas continua manual por arraste no MVP 0.1; o método de seleção de regiões por teclado não está definido neste documento.

## 12. Critérios de aceitação

- A área vazia explica como colar ou arrastar uma imagem; a imagem carregada se torna o foco da interface.
- Arrastar cria uma seleção visível sem ocultação imediata; **Ocultar região** aplica a tarja e Escape cancela a seleção.
- Uma tarja aplicada pode ser selecionada por clique e removida individualmente, sem alterar as demais.
- Desfazer/refazer reverte e reaplica tanto a aplicação quanto a remoção de tarjas; uma nova edição após desfazer limpa o refazer.
- Copiar é a ação principal e baixar PNG é secundária. Ambas podem exportar uma imagem sem tarjas somente após o aviso de revisão com **Voltar** ou **Continuar**.
- Trocar uma imagem editada exige confirmação; a troca confirmada limpa seleção e histórico. Uma falha ao abrir a nova imagem preserva a anterior.
- O PNG copiado ou baixado contém as tarjas nos pixels. Nenhuma imagem é enviada a servidores ou armazenada pela aplicação.
- Os controles têm rótulos claros, foco visível e acesso por teclado; mensagens de erro indicam uma alternativa quando houver uma.
- O aviso discreto de processamento local permanece visível; a interface não afirma que as tarjas eliminam todos os riscos de exposição.

## 13. Decisões futuras e fora do escopo

**Fora do escopo do MVP 0.1:** OCR, detecção automática, backend, login, banco de dados, PWA, extensão e aplicativo desktop. As evoluções 0.2 e 0.3 permanecem conforme [PRODUCT.md](PRODUCT.md).

**Questões em aberto para implementação e validação:**

- Validar comportamento e desempenho com screenshots de grande resolução, sem fixar um limite arbitrário agora.
- Definir os requisitos de compatibilidade de navegador além da prioridade inicial para desktop moderno, Chrome e Edge.
- Avaliar futuramente se a seleção de regiões também precisará ser operável por teclado; a exigência atual cobre a navegação por teclado nos controles.

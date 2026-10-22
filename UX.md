# Tampei: UX do MVP 0.1

Este documento consolida as decisões de experiência aprovadas para a aplicação web desktop-first e local-first. **Estado atual** descreve a implementação existente; **a implementar** descreve mudanças de UX aprovadas que ainda não estão no código. As decisões de produto e privacidade de [PRODUCT.md](PRODUCT.md) continuam válidas.

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

1. Colar um screenshot, arrastar uma imagem ou escolher um arquivo na área de entrada.
2. Revisar a imagem exibida e arrastar para marcar uma região. Se necessário, ampliar a visualização e usar **Mover imagem** para navegar até o detalhe; desativar esse modo para voltar a selecionar.
3. Conferir a seleção visível e clicar em **Ocultar região**, ou usar Escape para cancelá-la.
4. Repetir a seleção quando necessário. É possível selecionar uma tarja aplicada e removê-la individualmente; aplicar e remover tarjas integram desfazer/refazer.
5. Revisar a imagem resultante e escolher **Copiar imagem protegida** ou **Baixar PNG**. Se não houver tarjas, mostrar antes um aviso de revisão com as opções **Voltar à edição** e **Continuar mesmo assim**.

No editor, **Nova imagem** encerra a edição e retorna ao estado vazio. Ao carregar outra imagem, o fluxo anterior é encerrado. Se houver uma imagem editada, ambas as ações requerem confirmação antes de descartar as alterações.

## 4. Estados da interface

### Estado atual da implementação

| Estado ou comportamento | Implementação atual |
| --- | --- |
| Vazio | Área para colar com Ctrl+V, arrastar uma imagem ou escolher um arquivo. |
| Carregamento e falha de entrada | Mensagem simples de abertura ou erro; a imagem anterior permanece se a nova falhar. |
| Imagem pronta | Canvas com a imagem inteira ajustada à área disponível, sem ampliar automaticamente imagens pequenas; controles de edição e visualização. |
| Seleção pendente | Área marcada visualmente; orientação junto ao botão **Ocultar região**, que ganha destaque para confirmar a aplicação. |
| Tarjas aplicadas | Tarjas pretas visíveis; clique seleciona a tarja superior em áreas sobrepostas e permite removê-la. Aplicação e remoção integram desfazer/refazer. |
| Saída | Cópia e download em PNG disponíveis; com tarjas, orientação discreta de revisão junto às ações; sem tarjas, um aviso de revisão precede a exportação. |
| Troca ou encerramento | **Nova imagem** volta ao estado vazio; colar ou arrastar substitui a imagem. Havendo tarjas aplicadas, ambas as ações pedem confirmação antes de descartar a edição. |
| Feedback e privacidade | Mensagem de status e aviso permanente de processamento local. |

### Estados aprovados a implementar

- Em falha de download, oferecer a cópia como caminho alternativo quando disponível.

## 5. Seleção e confirmação

**Estado atual:** o arraste no canvas cria uma seleção visível, sem ocultar os pixels imediatamente. O botão **Ocultar região** confirma a ação. Iniciar outro arraste substitui a seleção pendente. Escape cancela a seleção ativa sem alterar as tarjas ou o histórico; se houver um diálogo aberto, ele recebe o Escape primeiro. A seleção pendente tem indicação visual distinta da tarja aplicada selecionada.

A orientação acima do grupo de edição muda de **Arraste na imagem para selecionar.** para **Confirme em “Ocultar região”.** enquanto há uma seleção. O mesmo botão ganha destaque azul; não há uma segunda ação de confirmação. A linha de orientação mantém sua altura para não deslocar a imagem durante o arraste e permanece próxima ao botão na barra superior fixa durante a rolagem.

### Zoom e navegação

Uma faixa compacta fora do canvas oferece **Ampliar**, **Reduzir**, o percentual informativo, **Imagem inteira** e **Mover imagem**. O zoom altera somente as dimensões CSS da visualização; imagem, regiões e coordenadas originais permanecem intactas. A escala inicial e mínima mostra a imagem inteira e não ultrapassa 100%; os passos usam fator 1,5, até 400%. Ampliar ou reduzir preserva o ponto central da visualização quando as bordas permitem. **Imagem inteira** recupera o enquadramento completo e recentraliza.

**Selecionar** é o modo inicial. Ativar **Mover imagem** muda o arraste de mouse ou caneta para navegação e permite rolagem nativa com um dedo. Não cria seleções nem altera tarjas. O botão indica o modo ativo e a orientação informa como voltar a selecionar; o modo permanece até ser desativado. A rolagem nativa por roda, trackpad e teclado também está disponível. Todos os cantos podem ser alcançados, sem rolagem horizontal da página.

Uma seleção pendente concluída permanece nas mesmas coordenadas ao ampliar, reduzir, mover ou ajustar. Controles de escala e modo ficam indisponíveis durante um gesto ativo. Uma mudança inesperada de geometria cancela somente o gesto em andamento, sem apagar tarjas ou histórico. No modo selecionar, o bloqueio de multitoque continua cancelando a seleção em andamento e aguardando a retirada dos contatos. O cancelamento nativo da navegação no modo mover preserva uma seleção anterior.

O enquadramento ajustado acompanha mudanças de tamanho da área disponível. Em escala manual, a escala e o centro são preservados quando possível, respeitando a nova escala mínima. A primeira implementação não tem zoom por pinça, rolagem automática durante a seleção ou alças de ajuste.

## 6. Gerenciamento de tarjas

**Estado atual:** é possível aplicar várias tarjas. Clicar em uma tarja permite selecioná-la com contorno discreto e usar **Remover ocultação**; a remoção altera somente a tarja escolhida. Em regiões sobrepostas, o clique seleciona a última tarja aplicada naquela posição. Escape cancela a seleção ativa. A indicação visual de seleção serve à edição e não integra a imagem exportada.

## 7. Desfazer e refazer

**Estado atual:** desfazer reverte a última aplicação ou remoção de tarja; refazer reaplica essa mesma edição. Uma nova edição após desfazer limpa o histórico de refazer. Trocar de imagem reinicia o histórico.

Zoom, enquadramento e navegação não integram o histórico de edição.

## 8. Copiar, baixar e avisos

**Estado atual:** copiar e baixar PNG usam uma composição em canvas separada da imagem original; as tarjas são incorporadas aos pixels exportados. Copiar é a ação visual principal e baixar PNG é secundária. As duas ações ficam disponíveis sem tarjas, mas nesse caso abrem um aviso de revisão com **Voltar à edição** e **Continuar mesmo assim**. O aviso informa que nenhuma região foi ocultada, sem afirmar que uma imagem com tarjas esteja completamente segura. Há feedback discreto de sucesso e mensagens de erro; em falha de cópia, a mensagem oferece baixar PNG como alternativa.

Com uma ou mais tarjas aplicadas, as ações de exportação têm a orientação discreta **Antes de compartilhar, confira se ocultou todas as informações necessárias.** Ela não exige confirmação e não é repetida na mensagem de status após aplicar uma tarja. Desfazer ou remover a última tarja retira essa orientação e mantém o aviso existente para exportar sem ocultações.

A exportação sempre inclui a imagem inteira na resolução original, independentemente da escala e da parte visível no editor. O zoom não altera os pixels exportados; contornos de seleção continuam exclusivos da visualização.

**A implementar:** em falha de download, oferecer a cópia como caminho alternativo quando disponível.

## 9. Troca de imagem

**Estado atual:** a ação discreta **Nova imagem**, na barra superior, encerra a edição e retorna ao estado vazio. Com uma ou mais tarjas aplicadas, mostra uma confirmação para descartar ou cancelar; cancelar mantém imagem, tarjas, seleção e histórico. A mesma confirmação protege a substituição por colagem ou drag and drop. Sem tarjas aplicadas, inclusive com seleção pendente ou alterações apenas no histórico de refazer, não há confirmação. Ao voltar ao estado vazio, seleção, imagem, tarjas, histórico e mensagens da edição anterior são limpos. A confirmação tem foco inicial no cancelamento e pode ser fechada com Escape.

**Regra:** uma imagem é considerada editada somente quando há uma ou mais tarjas efetivamente aplicadas no estado atual. Uma seleção de região ainda não confirmada é descartada ao trocar de imagem e não a torna editada. Uma troca confirmada limpa seleção, tarjas e histórico anteriores. Se a nova imagem não puder ser aberta, a imagem atual permanece e um erro objetivo é apresentado.

Uma nova imagem também reinicia o enquadramento e o modo selecionar. Cancelar a substituição preserva escala, posição, modo e seleção da imagem atual.

## 10. Hierarquia e direção visual

**Estado atual:** interface clara e simples, com área de entrada, canvas, botões e mensagens. Copiar tem prioridade visual sobre baixar PNG.

**Direção aprovada:** manter tema claro inicial, cores neutras e aparência funcional inspirada em ferramentas nativas. O screenshot deve ocupar a maior área útil. Organizar os controles próximos da imagem, com **Copiar imagem** visualmente prioritário e **Baixar PNG** secundário. Não usar sidebar ou dashboard. Avisos e confirmações devem ser claros, sem linguagem que prometa segurança completa.

## 11. Acessibilidade e responsividade

**Estado atual:** botões nativos, foco visível, rótulo para o canvas e uma única região de anúncio de status. A seleção de regiões é feita por arraste de mouse, toque ou caneta. A área rolável é identificada e recebe foco para navegação por teclado. Os controles de zoom têm rótulos, limites desabilitados e indicação acessível do modo mover, sem anúncios contínuos de posição. O zoom global do navegador não é desativado.

**A implementar:** garantir navegação por teclado nos controles, inclusive no controle de remoção de tarja e nas opções dos avisos; manter foco visível, contraste suficiente e rótulos claros. A interface é desktop-first, mas deve preservar legibilidade e acesso aos controles quando a janela for reduzida. A seleção no canvas continua manual por arraste no MVP 0.1; o método de seleção de regiões por teclado não está definido neste documento.

## 12. Critérios de aceitação

- A área vazia explica como colar, arrastar ou escolher um arquivo de imagem; a imagem carregada se torna o foco da interface.
- Arrastar cria uma seleção visível sem ocultação imediata; **Ocultar região** aplica a tarja e Escape cancela a seleção.
- A seleção pendente destaca o único botão **Ocultar região** e mostra a instrução de confirmação junto a ele, sem deslocar o canvas durante o gesto. Instrução e botão permanecem visíveis em telas pequenas.
- Uma tarja aplicada pode ser selecionada por clique e removida individualmente, sem alterar as demais.
- Ampliar, reduzir e ajustar alteram apenas a visualização, respeitam os limites de escala e preservam seleção, tarjas e histórico; todos os cantos permanecem acessíveis.
- **Mover imagem** tem estado explícito, não seleciona nem edita tarjas e pode ser desativado para voltar a selecionar. Mudanças de escala e modo são bloqueadas durante o gesto.
- Desfazer/refazer reverte e reaplica tanto a aplicação quanto a remoção de tarjas; uma nova edição após desfazer limpa o refazer.
- Copiar é a ação principal e baixar PNG é secundária. Ambas podem exportar uma imagem sem tarjas somente após o aviso de revisão com **Voltar** ou **Continuar**.
- Com tarjas, a orientação de revisão permanece junto às ações de exportação, sem confirmação adicional nem promessa de proteção completa.
- **Nova imagem** retorna ao estado vazio. Com tarjas aplicadas, voltar ao estado vazio ou substituir a imagem exige confirmação; cancelar preserva a edição, e confirmar limpa seleção, tarjas, histórico e mensagens anteriores. Sem tarjas aplicadas, não há confirmação. Uma falha ao abrir a nova imagem preserva a anterior.
- O PNG copiado ou baixado contém as tarjas nos pixels. Nenhuma imagem é enviada a servidores ou armazenada pela aplicação.
- A resolução e os pixels do PNG permanecem idênticos após mudanças exclusivamente de zoom ou navegação.
- Os controles têm rótulos claros, foco visível e acesso por teclado; mensagens de erro indicam uma alternativa quando houver uma.
- O aviso discreto de processamento local permanece visível; a interface não afirma que as tarjas eliminam todos os riscos de exposição.

## 13. Decisões futuras e fora do escopo

**Fora do escopo do MVP 0.1:** OCR, detecção automática, backend, login, banco de dados, PWA, extensão e aplicativo desktop. As evoluções 0.2 e 0.3 permanecem conforme [PRODUCT.md](PRODUCT.md).

**Questões em aberto para implementação e validação:**

- Validar comportamento e desempenho com screenshots de grande resolução, sem fixar um limite arbitrário agora.
- Definir os requisitos de compatibilidade de navegador além da prioridade inicial para desktop moderno, Chrome e Edge.
- Avaliar futuramente se a seleção de regiões também precisará ser operável por teclado; a exigência atual cobre a navegação por teclado nos controles.

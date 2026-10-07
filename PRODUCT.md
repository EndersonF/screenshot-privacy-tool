# Produto: privacidade para screenshots

## 1. Visão do produto

Ferramenta open source, simples e local-first para proteger informações sensíveis de um screenshot antes de compartilhá-lo. O usuário escolhe o que ocultar e obtém uma imagem protegida para copiar ou baixar.

## 2. Problema

Screenshots compartilhados em chats, ferramentas de IA, suporte técnico, fóruns, redes sociais e ambientes de trabalho podem revelar informações pessoais ou sensíveis sem que a pessoa perceba. O produto deve oferecer uma etapa rápida de revisão e ocultação antes do compartilhamento.

## 3. Usuário inicial

Pessoa comum ou profissional que precisa compartilhar um screenshot e quer evitar a exposição de informações pessoais.

## 4. Proposta de valor

> Proteja informações sensíveis de um screenshot antes de compartilhá-lo, sem enviar a imagem para nenhum servidor.

O usuário mantém o controle da seleção das regiões e do resultado final. No MVP 0.1, a identificação das informações é inteiramente manual.

## 5. Princípios do produto

- **Privacy-first e local-first:** a imagem é processada no dispositivo do usuário.
- **Nenhum envio de imagem a servidores:** a ferramenta não depende de backend no escopo inicial.
- **Controle do usuário:** somente regiões escolhidas pelo usuário são ocultadas no MVP 0.1; futuras sugestões exigirão aceitação individual.
- **Redaction sólida como padrão:** as regiões selecionadas são cobertas por uma área opaca, em vez de blur.
- **Simplicidade:** arquitetura justificável, código aberto e nenhuma complexidade prematura.
- **Sem conta, banco de dados ou armazenamento de screenshots:** o MVP não exige login e não persiste imagens.

## 6. Fluxo principal

1. O usuário cola um screenshot da área de transferência ou arrasta e solta uma imagem.
2. A ferramenta exibe a imagem localmente.
3. O usuário seleciona manualmente as regiões que deseja ocultar.
4. A ferramenta aplica redaction sólida às regiões selecionadas.
5. O usuário pode desfazer ou refazer as alterações, revisar o resultado e copiar a imagem protegida ou baixar um PNG.

## 7. Escopo do MVP 0.1

- Colar screenshot via clipboard.
- Receber imagem por drag and drop.
- Exibir a imagem.
- Selecionar regiões manualmente.
- Aplicar redaction sólida.
- Desfazer e refazer.
- Copiar a imagem protegida.
- Baixar a imagem protegida em PNG.

## 8. Fora do escopo

- OCR, detecção automática e sugestões de informações sensíveis no MVP 0.1.
- Backend, contas e login, banco de dados e armazenamento de screenshots.
- Funcionalidades não descritas no escopo das versões 0.1, 0.2 e 0.3.

## 9. Evolução 0.2 e 0.3

**MVP 0.2:** introduzir OCR local e detecção automática inicial de CPF, e-mail e telefone. A ferramenta mostrará sugestões; o usuário aceitará ou rejeitará cada uma.

**MVP 0.3:** ampliar os tipos detectados e melhorar heurísticas e confiança. Explorar Pix, cartão, localizador de reserva e outras categorias. Os tipos e critérios exatos dessa expansão permanecem em aberto.

## 10. Arquitetura inicial

A implementação planejada usa Vite, React, TypeScript e Canvas API. O core de domínio deve ser independente de React para permitir possível reutilização em web app, PWA, browser extension ou aplicativo desktop com Tauri.

Web Workers, Tesseract.js, Vitest e Playwright fazem parte da arquitetura planejada. Tesseract.js será considerado quando o OCR local entrar na versão 0.2. O uso concreto de Web Workers deve ser definido conforme a necessidade da implementação, sem antecipar complexidade no MVP 0.1. Não haverá backend inicialmente.

## 11. Privacidade e segurança

- A imagem deve permanecer no dispositivo e ser processada localmente; nenhuma imagem deve ser enviada a servidores.
- Screenshots não devem ser armazenados pela ferramenta. O estado necessário para edição existe apenas durante o uso.
- A exportação deve incorporar a ocultação sólida aos pixels da imagem resultante, de modo que o conteúdo coberto não permaneça recuperável no PNG ou na imagem copiada. A proteção da imagem final não deve depender de overlays, camadas visuais ou elementos da interface.
- O usuário deve revisar o resultado antes de compartilhá-lo; a seleção manual pode deixar informações sensíveis visíveis.
- Futuras detecções automáticas serão sugestões locais e não substituirão a decisão do usuário.

## 12. Modelo de domínio inicial

- **Imagem de trabalho:** screenshot carregado localmente para edição durante a sessão.
- **Região selecionada:** área da imagem indicada pelo usuário para ocultação.
- **Redaction:** cobertura sólida aplicada a uma região selecionada e presente na imagem exportada.
- **Histórico de edição:** alterações necessárias para desfazer e refazer durante a sessão.
- **Imagem protegida:** resultado final copiado ou baixado após a aplicação das redactions.

As sugestões de detecção pertencem à evolução 0.2 e não precisam integrar o modelo do MVP 0.1.

## 13. Estratégia de testes

- Usar Vitest para validar o core independente de React, especialmente seleção de regiões, redaction e desfazer/refazer.
- Usar Playwright para verificar o fluxo principal no navegador: entrada da imagem, edição e saída protegida.
- Verificar que pixels das regiões ocultadas não aparecem na imagem exportada e que o fluxo não envia a imagem a servidores.

## 14. Critérios de sucesso

- Uma pessoa consegue colar ou arrastar uma imagem, ocultar regiões manualmente, revisar e copiar ou baixar o resultado.
- O resultado exportado contém redaction sólida nas regiões escolhidas e não permite recuperar visualmente o conteúdo coberto.
- O fluxo funciona localmente, sem conta, backend ou armazenamento de screenshots.
- O fluxo principal pode ser concluído sem cadastro, configuração inicial ou tutorial obrigatório.
- O usuário consegue desfazer e refazer as alterações antes da saída.

Métricas quantitativas de adoção, tempo de uso e qualidade ainda não foram definidas.

## 15. Riscos e hipóteses

- **Hipótese:** seleção manual e fluxo curto são suficientes para oferecer valor na versão 0.1; isso precisa ser validado com usuários.
- **Risco:** o usuário pode deixar dados sensíveis fora das regiões selecionadas. A revisão visual do resultado é parte essencial do fluxo.
- **Risco técnico:** disponibilidade e comportamento da área de transferência podem variar entre navegadores; a compatibilidade necessária ainda precisa ser definida.
- **Risco técnico:** screenshots de grande resolução podem elevar o consumo de memória e prejudicar o desempenho no navegador; isso deve ser validado em um spike técnico, sem definir limites arbitrários antecipadamente.
- **Questão em aberto:** limites de tamanho de imagem e navegadores suportados ainda não foram definidos.
- **Questão em aberto:** critérios de confiança e cobertura das sugestões futuras serão definidos nas versões 0.2 e 0.3.

## 16. Próximos passos

1. Validar o fluxo manual do MVP 0.1 com o usuário inicial.
2. Definir os requisitos de compatibilidade de navegador e tamanho de imagem necessários para implementar esse fluxo.
3. Implementar e testar o MVP 0.1 mantendo o core independente de React e o processamento local.
4. Avaliar a evolução 0.2 somente após validar o fluxo básico.

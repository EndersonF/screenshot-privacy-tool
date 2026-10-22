# <img src="public/app-icon.svg" alt="" width="32" height="32" align="center" /> Tampei

> Adicione. Oculte. Compartilhe.

É fácil compartilhar um print ou screenshot sem perceber que ele contém um e-mail, telefone, documento ou outra informação pessoal. O Tampei oferece uma etapa rápida de revisão e proteção antes do compartilhamento: você escolhe as regiões, aplica tarjas sólidas e opacas e copia ou baixa o resultado com segurança.

A edição acontece inteiramente no seu navegador, sem envio da imagem para nenhum servidor. O projeto é gratuito, de código aberto e não exige cadastro nem instalação.

[Abrir a aplicação](https://screenshot-privacy-tool.pages.dev)

## Por que criei o Tampei?

O Tampei nasceu de uma necessidade simples: eu queria esconder uma informação em uma imagem antes de compartilhá-la, sem precisar abrir um editor cheio de ferramentas para fazer isso.

Comecei pensando em uma solução rápida para o meu próprio uso. Depois, a ideia evoluiu para uma ferramenta gratuita e open source, em que você escolhe o que ocultar e edita a imagem diretamente no navegador.

## Desenvolvimento com inteligência artificial

A inteligência artificial teve uma participação importante no desenvolvimento do Tampei, desde o planejamento e as decisões técnicas até a implementação, revisão de código, testes e documentação.

O projeto foi construído com essa colaboração. Como mantenedor, continuo responsável pelas decisões sobre o produto, pela validação das funcionalidades e pela evolução do código.

## Como usar

1. **Adicione a imagem:** cole um screenshot com `Ctrl+V` (ou `⌘+V`), arraste uma imagem para a tela ou clique em **Escolher arquivo**.
2. **Selecione a região:** arraste o mouse ou use o dedo na tela para marcar a área que deseja esconder. Para detalhes pequenos ou textos compactos, use os controles de zoom (+ e -) e ative o modo **Mover imagem** para navegar por arraste com o mouse ou um dedo. Desative o modo para voltar a selecionar.
3. **Confirme a ocultação:** confira o retângulo marcado e clique em **Ocultar região** (a tecla `Escape` cancela uma seleção pendente).
4. **Revise o print completo:** repita o processo nas demais áreas sensíveis. Use a ação **Imagem inteira** para recuperar o enquadramento completo. Caso queira excluir uma tarja, clique ou toque sobre ela para selecioná-la e pressione **Remover ocultação**.
5. **Compartilhe com segurança:** use **Copiar imagem protegida** para colar diretamente no seu app de destino ou **Baixar PNG** para salvar o arquivo final.

## O que o Tampei v0.1 oferece

- **Múltiplas formas de entrada:** cole pela área de transferência, arraste e solte (drag and drop) ou selecione arquivos do dispositivo.
- **Ocultação manual precisa:** tarjas pretas sólidas e 100% opacas, com confirmação manual antes de aplicar.
- **Zoom de visualização e navegação:** controles de zoom (+ e -) para focar em detalhes pequenos sem alterar a resolução original do arquivo.
- **Modo Mover imagem e Imagem inteira:** navegação panorâmica por arraste com mouse ou um dedo pelo screenshot ampliado e recuperação rápida do enquadramento completo.
- **Interação por mouse e toque:** suporte a ponteiros de mouse, caneta digital e telas sensíveis ao toque (incluindo navegação nativa e proteção contra conflitos de multitoque).
- **Gestão de tarjas e histórico:** seleção de tarja por clique ou toque para removê-la com o botão **Remover ocultação**, com histórico completo de desfazer (`Ctrl+Z`) e refazer (`Ctrl+Y` / `Ctrl+Shift+Z`).
- **Exportação com tarjas nos pixels:** cópia direta para a área de transferência e download em PNG com as tarjas fundidas à matriz de pixels da imagem gerada.
- **Avisos de revisão e segurança:** alerta preventivo ao tentar exportar uma imagem sem nenhuma tarja aplicada e confirmação ao descartar edições.
- **Ajuda contextual para downloads:** orientações na interface para encontrar arquivos baixados (incluindo especificidades do Safari no iPhone).
- **Ação Nova imagem:** fluxo rápido para limpar o editor e iniciar outra proteção.

## Privacidade e limitações técnicas

- **Processamento 100% local:** o screenshot é decodificado e manipulado localmente no navegador via Canvas API. O estado de edição reside temporariamente na memória RAM da aba e é descartado ao fechar ou trocar de imagem.
- **Sem backend ou armazenamento:** a aplicação não envia imagens para servidores externos nem armazena screenshots em bancos de dados, cookies ou armazenamento local (`localStorage`). A hospedagem entrega apenas os arquivos estáticos da interface e pode registrar dados técnicos de requisição HTTP, sem acesso às imagens manipuladas.
- **Exportação permanente:** o arquivo PNG gerado contém as tarjas aplicadas diretamente sobre os pixels da imagem. Após o download ou cópia, o gerenciamento do arquivo fica sob responsabilidade do seu sistema operacional e navegador.
- **Revisão exclusivamente humana:** a ferramenta não possui OCR ou detecção automática de dados no escopo atual. A identificação das áreas sensíveis é manual e cabe ao usuário revisar o print antes de compartilhá-lo.
- **Zoom e memória:** o zoom atua estritamente na renderização em tela para facilitar a seleção; ele não redimensiona nem altera a resolução da imagem original exportada. Imagens em resoluções muito altas podem demandar maior consumo de memória do dispositivo.
- **Formatos e permissões:** imagens SVG não são aceitas; outros formatos dependem dos decodificadores suportados pelo navegador. A cópia para a área de transferência exige contexto seguro (HTTPS ou localhost) e permissão de clipboard; o botão de download em PNG está sempre disponível como alternativa.
- **Dispositivos e validações:** o editor foi desenhado para funcionar em desktops e dispositivos móveis modernos com suporte a Pointer Events. A validação física do comportamento do zoom no Safari do iPhone ainda está pendente.
- **Conectividade:** o projeto não promete funcionamento offline nem compatibilidade universal com navegadores legados. Detalhes de UX e arquitetura podem ser consultados em [PRODUCT.md](PRODUCT.md) e [UX.md](UX.md).

## Tecnologias

- **Vite**, **React 19** e **TypeScript** estruturam a aplicação.
- **Canvas API nativa** gerencia o desenho das tarjas e a exportação em PNG.
- O núcleo de redaction é modular e independente de UI (`src/redaction.ts`).
- **Lucide Icons** para os ícones da interface.
- **CSS Vanilla** com tipografia System UI nativa (sem fontes externas e sem bibliotecas de estilização pesadas).
- **Playwright** para suíte de testes de integração e ponta a ponta cobrindo interações, gestos de ponteiro, zoom e acessibilidade.

## Executar e testar localmente

Requisitos: Node.js 22.12+ (ou versão compatível com Vite) e Google Chrome para os testes Playwright.

```sh
npm ci
npm run dev
```

Para validar a qualidade e integridade do projeto:

```sh
npm run build
npm run lint
npm test
```

Para visualizar a build de produção localmente, execute `npx vite preview` após o build. O arquivo `public/_headers` contém as regras de segurança e CSP aplicadas no deploy pelo Cloudflare Pages.

## Contribuir

Sugestões e relatos de problemas são bem-vindos por meio de issues no [repositório oficial](https://github.com/EndersonF/screenshot-privacy-tool). Ao submeter um pull request, garanta que seu código mantenha o processamento 100% local, passe em todos os testes (`npm test`, `npm run lint`, `npm run build`) e utilize apenas imagens sintéticas nos testes.

## Licença

Distribuído sob a [Licença MIT](LICENSE).

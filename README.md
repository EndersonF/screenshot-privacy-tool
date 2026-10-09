# Proteção de screenshots

É fácil compartilhar um screenshot sem perceber que ele contém um e-mail, telefone ou outra informação pessoal. Este projeto oferece uma etapa de revisão antes do compartilhamento: você escolhe as regiões, aplica tarjas sólidas e copia ou baixa o resultado.

A edição acontece no navegador, sem upload do screenshot para a aplicação. O projeto é gratuito, open source e não exige conta.

[Abrir a aplicação](https://screenshot-privacy-tool.pages.dev)

## Como usar

1. Cole um screenshot com Ctrl+V (ou ⌘+V), arraste uma imagem ou clique em **Escolher arquivo**.
2. Arraste o mouse para selecionar uma região. Confira a seleção e clique em **Ocultar região**. Escape cancela uma seleção pendente.
3. Repita nas outras regiões e revise a imagem inteira.
4. Use **Copiar imagem protegida** ou **Baixar PNG** para compartilhar o resultado.

## O que o MVP 0.1 oferece

- Entrada por colagem, drag and drop ou seleção de arquivo.
- Ocultação manual com tarjas sólidas e opacas.
- Seleção de uma tarja aplicada para removê-la individualmente.
- Desfazer e refazer aplicações e remoções.
- Cópia da imagem e download em PNG com as tarjas incorporadas aos pixels.
- Aviso antes de exportar sem tarjas e confirmação antes de descartar uma imagem com ocultações.
- Ação **Nova imagem** para encerrar a edição.

## Privacidade e limitações

O screenshot é decodificado e editado localmente, com estado temporário na memória durante o uso. A aplicação não envia a imagem a um backend nem persiste screenshots em uma conta, banco de dados ou armazenamento do navegador. A hospedagem entrega os arquivos da ferramenta e pode registrar dados técnicos de navegação; isso é distinto do conteúdo da imagem editada.

O arquivo exportado contém as tarjas nos pixels. Arquivos baixados e conteúdo copiado passam a ser gerenciados pelo dispositivo e navegador. A ferramenta não controla o que acontece quando você os compartilha em outro serviço.

A identificação de informações é manual. Não há OCR ou detecção automática, e a presença de tarjas não garante que todo dado sensível foi ocultado. Revise o resultado antes de compartilhar.

A prioridade é desktop com Chrome ou Edge modernos. A seleção de regiões usa arraste do mouse; os controles podem ser usados pelo teclado. SVG não é aceito, e outros formatos dependem da decodificação disponível no navegador. Imagens de grande resolução podem consumir bastante memória. A cópia de PNG exige HTTPS ou localhost e pode depender da permissão do clipboard; o download é a alternativa disponível.

O projeto não promete funcionamento offline. As decisões de produto e experiência estão em [PRODUCT.md](PRODUCT.md) e [UX.md](UX.md).

## Tecnologias

Vite, React e TypeScript compõem a interface. A Canvas API renderiza a imagem e gera o PNG; o núcleo de redaction fica independente de React em `src/redaction.ts`. Playwright cobre o editor e o histórico, e ESLint e TypeScript verificam o código. Os ícones usam Lucide; a tipografia inicial é System UI, com fontes nativas do dispositivo e sem fontes externas.

## Executar e testar localmente

Use Node.js 22.12+ ou uma versão mais recente compatível com Vite, além de Chrome instalado para os testes de navegador.

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Para verificar o projeto:

```sh
npm run build
npm run lint
npm test
```

Para abrir a build de produção localmente, execute `npx vite preview` após o build. O arquivo `public/_headers` contém as políticas do Cloudflare Pages e é copiado para `dist/_headers`; o servidor de preview do Vite não aplica essas políticas automaticamente.

## Contribuir

Abra uma issue no [repositório](https://github.com/EndersonF/screenshot-privacy-tool) para relatar um problema ou discutir uma mudança. Para contribuir com código, crie uma branch, mantenha a alteração focada e execute build, lint e testes antes de abrir um pull request. Inclua os passos para reproduzir o problema e validar a correção, usando imagens sintéticas em vez de dados pessoais.

Mudanças devem preservar o processamento local, a revisão manual e a exportação com tarjas nos pixels. Consulte os documentos de produto e UX antes de ampliar o escopo.

## Licença

Distribuído sob a [licença MIT](LICENSE).

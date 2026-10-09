# screenshot-privacy-tool

Projeto open source em fase inicial para proteger informações sensíveis em screenshots antes do compartilhamento, com processamento local e sem envio da imagem a servidores.

As decisões de produto e o escopo inicial estão em [PRODUCT.md](PRODUCT.md). O MVP 0.1 permite colar, arrastar ou escolher uma imagem, ocultar regiões manualmente, desfazer/refazer e copiar ou baixar um PNG.

## Executar localmente

Requer Node.js compatível com Vite. Execute `npm ci` e depois `npm run dev`. Abra o endereço local mostrado pelo Vite em Chrome ou Edge. Para verificar o projeto, execute `npm run build`, `npm run lint` e `npm test` (testes de navegador com Chrome instalado). Para conferir a build localmente, execute `npx vite preview` após o build.

A imagem é processada no navegador e não é enviada para servidores. A cópia de PNG para o clipboard requer uma página em contexto seguro, como `localhost` ou HTTPS.

## Preparar deploy de testes no Cloudflare Pages

Conecte o repositório GitHub a um projeto **Pages** e configure a branch de produção como `main`, o comando de build como `npm run build` e o diretório de saída como `dist`. A raiz do projeto é a raiz do repositório. O MVP não precisa de variáveis de ambiente, Pages Functions, Workers nem serviços de terceiros. A publicação ainda não foi realizada.

O arquivo [`public/_headers`](public/_headers) é copiado para `dist/_headers` no build. O Cloudflare Pages aplica essas políticas às respostas estáticas; o servidor `vite preview` não simula os headers do Pages. A CSP permite somente scripts e estilos da própria origem, imagens locais e URLs `blob:`; bloqueia conexões iniciadas pelo JavaScript. A geração do PNG e o Clipboard API continuam no navegador.

Depois do primeiro deploy, confira no endereço real:

1. No painel **Network**, confirme os headers de `index.html` e dos assets e verifique que não há requisições a terceiros nem envio da imagem.
2. No console, confira que não há violações de CSP ao colar, arrastar ou escolher uma imagem, aplicar tarjas, desfazer/refazer, copiar e baixar PNG.
3. Abra o PNG fora da aplicação e confirme que as tarjas estão incorporadas aos pixels. Verifique também o aviso ao exportar sem tarjas.
4. Confira que a cópia funciona em HTTPS e que a página não pode ser incorporada em um iframe.

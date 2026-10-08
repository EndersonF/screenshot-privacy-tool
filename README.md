# screenshot-privacy-tool

Projeto open source em fase inicial para proteger informações sensíveis em screenshots antes do compartilhamento, com processamento local e sem envio da imagem a servidores.

As decisões de produto e o escopo inicial estão em [PRODUCT.md](PRODUCT.md). O primeiro spike técnico cobre colar ou arrastar uma imagem, selecionar regiões manualmente, aplicar redaction sólida, desfazer/refazer e copiar ou baixar um PNG protegido.

## Executar localmente

Requer Node.js compatível com Vite. Execute `npm install` e depois `npm run dev`. Abra o endereço local mostrado pelo Vite em Chrome ou Edge. Para verificar o projeto, execute `npm run build`, `npm run lint` e `npm test` (testes de navegador com Chrome instalado).

A imagem é processada no navegador e não é enviada para servidores. A cópia de PNG para o clipboard requer uma página em contexto seguro, como `localhost` ou HTTPS.

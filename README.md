# BSH Flats · Orçamentos e recibos

Interface em português para preparar documentos de hospedagem, com prévia em tempo real e impressão em A4. Feita em HTML, CSS e JavaScript, sem dependências de instalação.

## Executar

Requer Node.js 20 ou superior.

```sh
npm run dev
```

Abra **http://localhost:5173**. Para usar outra porta: `PORT=3000 npm run dev`.

## Usar

1. Selecione **Orçamento** ou **Recibo**.
2. Informe o responsável, os hóspedes e o período. O campo **Quantidade de diárias** ajusta a data de saída automaticamente; ao editar as datas, as diárias também são recalculadas.
3. Escolha a **quantidade de quartos** de cada categoria.
4. Marque ou desmarque **Aplicar desconto**. Para um caso especial, preencha **Desconto especial (%)** com um percentual maior que o progressivo e de até 100%. Deixe vazio para usar o progressivo.
5. No recibo, informe a data e a forma de pagamento.
6. Clique em **Imprimir / salvar PDF** e escolha **Salvar como PDF** no navegador.

O nome sugerido para o PDF usa tipo, nome do responsável e data de emissão: `RECIBO_VICTOR_30082026.pdf` ou `ORCAMENTO_VICTOR_30082026.pdf`. Espaços e acentos do nome são normalizados. O navegador pode permitir alterar o nome na janela de salvamento.

Para um documento sem endereço do site e data do navegador nas margens, desmarque **Cabeçalhos e rodapés** na janela de impressão.

O recibo registra o pagamento integral do total calculado. Os campos do documento são mantidos ao alternar entre orçamento e recibo. **Novo documento** reinicia o formulário, preservando os dados do hotel.

O orçamento inclui um **QR Code Pix** na prévia, na impressão e no PDF, com a chave cadastrada em **Dados do hotel** e o valor final, já considerando o desconto. O código é atualizado quando o total ou os dados do favorecido mudam. Recibos, orçamentos com cálculo inválido e cortesias de valor zero não exibem QR Code de cobrança.

A geração é local, sem chamadas a serviços de QR Code. Aceita CPF/CNPJ com ou sem pontuação, e-mail, chave aleatória e telefone no formato internacional (`+55` e DDD). A validação confere o formato; o cadastro da chave e os dados do destinatário são confirmados pelo aplicativo bancário ao escanear. O QR usa o [padrão Pix do Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf) e a biblioteca [QR Code generator, de Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library), incluída em `vendor/qrcodegen.js` com licença MIT e uma exportação ES module local.

## Tarifas e descontos

| Acomodação | Diária por quarto | Capacidade |
| --- | --- | --- |
| Single | R$ 99,90 | 1 pessoa |
| Duplo | R$ 120,00 | 2 pessoas |
| Triplo | R$ 150,00 | 3 pessoas |

| Diárias | Desconto |
| --- | --- |
| 1 | 0% |
| 2 | 5% |
| 3 | 10% |
| 4 | 15% |
| 5 ou mais | 20% |

Subtotal = soma de quantidade de quartos × tarifa × diárias. O desconto é aplicado uma vez sobre esse subtotal, com arredondamento em centavos. A média por pessoa divide o total final pelo número de diárias e de hóspedes. As tarifas estão em `pricing.js`, em centavos.

O desconto vem ativado por padrão. O percentual especial substitui o progressivo: 15% informados significam 15% no total, sem somar as faixas. Aceita vírgula ou ponto e até duas casas decimais. Desmarcar o checkbox remove todo desconto, mantendo o percentual digitado para reutilização. A escolha fica salva no rascunho e vale para orçamento e recibo.

Por exemplo: 1 quarto single por 2 diárias custa R$ 199,80 antes do desconto e R$ 189,81 com 5%. Já 2 quartos single por 1 diária custam R$ 199,80 e não entram na faixa de 2 diárias.

## Dados do hotel

**Dados do hotel** permite editar nome, contato, endereço, CNPJ, Pix, banco e logo. Os dados iniciais foram transcritos da imagem de referência. O CEP ficou vazio porque não estava completo na imagem.

O logo oficial fornecido está em `assets/logo-oficial.jpg` e é usado no cabeçalho, no ícone da aba e nos documentos. O arquivo original disponível tem 150 × 150 pixels. É possível enviar uma versão em maior resolução pelo painel (PNG, JPG ou WebP de até 2 MB).

O rascunho e as configurações ficam no armazenamento local do navegador. Não há servidor de dados, autenticação ou sincronização entre computadores. O servidor incluído apenas entrega os arquivos da interface e escuta em localhost. As fontes usam Google Fonts, com fontes locais alternativas quando não há conexão.

## Verificar

```sh
npm test
```

Os testes cobrem tarifas, todas as faixas de desconto, desconto desativado e especial, limites e arredondamento, múltiplos quartos, valor por extenso, capacidade, datas inválidas, viradas de mês e ano e ano bissexto.

## Publicar

Pode ser hospedado como site estático. Publique `index.html`, `styles.css`, `app.js`, `pricing.js`, `pix.js` e as pastas `assets/` e `vendor/` em um serviço de hospedagem estática. Não há etapa de build.

# Análise de UI e UX do aplicativo mobile

Análise estática do código, realizada em 3 de novembro de 2026. As observações sobre telas pequenas, teclado e leitores de tela precisam ser confirmadas em dispositivos reais. Este documento registra recomendações; nenhuma mudança de interface foi implementada nesta etapa.

## Cadastro e entrada

Código analisado: `mobile/app/auth.tsx`, `mobile/src/api.ts`, `mobile/src/context/SessionContext.tsx` e `backend/app/Http/Controllers/AuthController.php`.

### O que funciona

- O cadastro pede somente nome, e-mail e senha.
- Criar conta é opcional para usar as funções públicas do aplicativo.
- O botão informa a ação atual e mostra um indicador durante o envio.

### Melhorias, em ordem de prioridade

1. **Rótulos persistentes e acessíveis.** Os três campos são identificados somente por placeholders, que desaparecem após a digitação. Mostrar rótulos visíveis e nomes acessíveis para cada entrada.
2. **Layout adaptável ao teclado.** A tela usa um `View` fixo, sem rolagem ou ajuste ao teclado. Usar área segura e rolagem, e validar o botão em telas pequenas e com fonte ampliada.
3. **Regras e erros junto aos campos.** A API exige nome, e-mail válido e senha de 8 a 72 caracteres, mas a tela não mostra essas regras antes do envio. A mensagem de erro é global, e `mobile/src/api.ts` não preserva o mapa de erros por campo recebido em respostas de validação. Mostrar orientação antecipada e erros específicos sem apagar o que já foi digitado.
4. **Preenchimento automático e fluxo do teclado.** Informar ao sistema os tipos de conteúdo de nome, e-mail, senha atual e nova senha; configurar a passagem entre campos e a ação final do teclado.
5. **Valor da conta e escolha de modo.** Explicar brevemente o benefício real de criar conta e tornar clara a escolha entre entrar e cadastrar, mantendo o uso sem conta.
6. **Conferência da senha.** Considerar um controle acessível para mostrar ou ocultar a senha, com área de toque confortável.

Preservar o formulário curto; não há evidência de que mais campos ou etapas sejam necessários.

## Criação de uma nova mensagem

Código analisado: `mobile/app/create.tsx`, `mobile/src/api.ts`, `backend/app/Http/Requests/StoreDeliveryRequest.php`, `backend/app/Http/Controllers/DeliveryController.php` e a tela de sucesso do frontend web como referência de comportamento existente.

### O que funciona

- O fluxo permite criar sem conta e solicita poucos dados obrigatórios: nome do destinatário e mensagem, além das escolhas da viagem.
- Há rótulos visíveis para os campos, teclado de e-mail, teclado numérico, contador de caracteres, rolagem e tratamento inicial do teclado.
- A rota e a duração selecionadas aparecem em um resumo antes do envio.
- O botão evita uma segunda submissão enquanto a requisição está em andamento.

### Melhorias, em ordem de prioridade

1. **Conclusão e compartilhamento — crítica.** Após criar, `create.tsx` substitui a tela pela rota de acompanhamento usando `recipient_access_token`. O app não apresenta uma confirmação clara, não oferece compartilhar o link do destinatário e descarta o `sender_access_token` da resposta. Para uma entrega anônima, isso pode deixar o remetente sem um caminho para recuperar o link que deve enviar e sem seu próprio acesso de acompanhamento. Planejar uma tela de sucesso com ações distintas: compartilhar o link do destinatário, guardar/copiar o link do remetente e acompanhar como remetente. Não tratar o e-mail opcional como envio automático; o código atual não envia mensagem ou convite por e-mail.
2. **Etapas que correspondam ao fluxo real — alta.** O indicador anuncia “Mensagem”, “Rota” e “Revisão”, mas todas as seções estão abertas na mesma página e não existe etapa de revisão. Escolher um modelo coerente: etapas reais com navegação e revisão antes de criar, ou página única sem indicador de etapas. Para este formulário, a página única com seções claras pode ser suficiente; testar a preferência com usuários antes de acrescentar navegação.
3. **Perda do texto em andamento — alta.** O estado do formulário fica apenas na memória da tela. Sair da tela ou perder o estado pode descartar uma carta longa. Considerar rascunho local ou, ao menos, aviso ao sair com texto não enviado; definir retenção e proteção adequadas por se tratar de conteúdo privado.
4. **Erros localizados — alta.** As validações locais cobrem destinatário, mensagem, origem/destino e duração, mas mostram um erro geral somente depois do resumo. A API também valida limites de nomes e e-mail; `mobile/src/api.ts` descarta os erros por campo. Mostrar limites relevantes e erros junto ao campo, levar o usuário ao primeiro erro e manter os valores preenchidos.
5. **Expectativa sobre o destinatário — alta.** O campo “E-mail (opcional)” não explica sua função. A criação não envia um e-mail ao destinatário; o link ainda precisa ser compartilhado. Explicar isso antes da criação para evitar a expectativa de entrega automática.
6. **Escolhas e duração mais compreensíveis — média.** As opções de entregador, origem e destino usam chips sem semântica explícita de seleção para tecnologias assistivas. A duração aceita texto numérico livre de 1 a 1440 minutos sem explicar o efeito da escolha na chegada. Mostrar estado selecionado acessível, explicar a duração e considerar opções rápidas com ajuste manual.
7. **Resumo útil — média.** O resumo atual mostra rota, entregador e duração. Antes da confirmação, também permitir conferir o destinatário e a mensagem ou uma prévia dela, especialmente se houver uma etapa chamada “Revisão”. Evitar expor conteúdo privado em uma tela de compartilhamento que possa ser vista por terceiros.
8. **Escopo do produto — decisão posterior.** A versão web já oferece aventura com paradas, enquanto a criação mobile envia apenas a rota direta. Decidir se a experiência mobile inicial deve explicitar essa limitação ou incluir paradas em uma fase futura; não acrescentar essa complexidade antes de resolver conclusão, compartilhamento e erros.

### Evolução aplicada à escolha de lugares

O backend aceita `origin_location` e `destination_location` com rótulo, latitude e longitude, e o frontend web possui um seletor de lugares. A criação mobile agora pede somente lugares reais para origem e destino, com busca opcional e seleção por toque no mapa. Esse fluxo ainda precisa de validação visual e funcional em um dispositivo real.

### Sequência sugerida para implementação posterior

1. Resolver a tela de sucesso e os dois links de acesso.
2. Tornar o fluxo visualmente coerente e revisar o texto sobre e-mail e duração.
3. Melhorar erros, acessibilidade das escolhas e preservação do rascunho.
4. Validar em Android e iOS reais, com teclado aberto, fontes ampliadas e leitor de tela.

## Referências

- Apple, [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts): conta opcional e explicação dos benefícios.
- Apple, [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields): rótulos e entradas adequadas.
- Apple, [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data): reduzir digitação, oferecer escolhas e validar dados.
- Apple, [Layout](https://developer.apple.com/design/human-interface-guidelines/layout): áreas seguras e adaptação a tamanhos de tela e texto.
- Apple, [Writing](https://developer.apple.com/design/human-interface-guidelines/writing): erros próximos dos campos e linguagem orientadora.
- Apple, [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback): confirmação de ações significativas.
- Apple, [Activity views](https://developer.apple.com/design/human-interface-guidelines/activity-views): compartilhamento pela interface do sistema.
- React Native, [TextInput](https://reactnative.dev/docs/textinput.html) e [KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview): propriedades e comportamento nativos.
- Android, [Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views): controles descritivos e alvos de toque.
- W3C, [Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) e [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): princípios de acessibilidade para formulários, usados aqui como referência complementar para o app nativo.

# Planejamento do aplicativo mobile do Cartopia

## Objetivo

Transformar o Cartopia em um aplicativo mobile próprio para criar, receber e acompanhar entregas virtuais, mantendo o uso anônimo como parte essencial do produto.

O aplicativo deve tornar as entregas mais presentes no dia a dia do usuário, especialmente por meio de notificações, deep links, histórico e associações entre remetentes e destinatários.

## Direção técnica

- Aplicativo: React Native com Expo e TypeScript.
- Navegação: Expo Router.
- Armazenamento seguro: `expo-secure-store`.
- Notificações: Expo Notifications, com FCM no Android e APNs no iOS.
- Backend: API REST Laravel existente, evoluída para uma versão mobile (`/api/v1`).
- Banco: PostgreSQL.
- Mapas: avaliar MapLibre ou outra solução compatível com Expo após validar custos e permissões.
- Reutilização: compartilhar tipos, contratos e regras puras com o frontend web; componentes visuais serão próprios para mobile.

## Princípios do produto

- Criar uma entrega não exige autenticação.
- Autenticação desbloqueia histórico, entregas recebidas, contatos e locais salvos.
- O destinatário precisa conseguir acompanhar uma entrega sem criar conta.
- O app deve complementar a experiência web, não exigir migração imediata do usuário.
- Links compartilhados devem continuar funcionando fora do aplicativo.

## Escopo do MVP mobile

### Conta e sessão

- Cadastro, login e logout.
- Sessão armazenada com segurança no dispositivo.
- Expiração e renovação de tokens.
- Logout por dispositivo.
- Tela de conta e preferências básicas.

### Criação de entregas

- Criar entrega anônima ou autenticada.
- Selecionar remetente, destinatário, locais e entregador.
- Usar contatos e locais salvos.
- Escolher entrega direta ou aventura com paradas.
- Compartilhar link do remetente e do destinatário.

### Acompanhamento

- Abrir links do Cartopia diretamente no app.
- Acompanhar status, progresso, rota e paradas.
- Exibir a mensagem quando a entrega chegar.
- Continuar funcionando no navegador quando o app não estiver instalado.

### Dashboard

- Histórico de envios.
- Entregas recebidas.
- Entregas acompanhadas por link.
- Locais salvos.
- Destinatários salvos.
- Associação de destinatários por e-mail.

### Notificações

- Nova entrega recebida.
- Entrega iniciada.
- Entrega chegada ao destino.
- Mensagem disponível para abertura.

## Evolução necessária no backend

### API

1. Introduzir `/api/v1` sem remover imediatamente as rotas atuais.
2. Padronizar payloads de sucesso, validação e erro.
3. Adicionar paginação para históricos e listas.
4. Adicionar identificadores estáveis para entregas, contatos e locais.
5. Implementar idempotência na criação de entregas para evitar duplicações por repetição de requisição.

### Autenticação mobile

O token atual deve evoluir para um modelo com sessões por dispositivo:

- access token de curta duração;
- refresh token armazenado com hash;
- revogação individual;
- identificação opcional do dispositivo;
- limite de sessões ativas;
- nenhum token sensível em AsyncStorage ou logs.

### Entregas recebidas

- Manter o e-mail do destinatário na entrega.
- Permitir que uma conta encontre entregas destinadas ao seu e-mail.
- Liberar o token de acompanhamento somente para o destinatário autenticado.
- Definir comportamento quando o e-mail ainda não possui conta.
- Criar notificações somente depois de confirmar a associação.

### Dispositivos e notificações

Criar uma tabela de dispositivos contendo:

- usuário;
- token de push;
- plataforma;
- nome opcional do dispositivo;
- último uso;
- data de revogação.

As notificações devem ser processadas de forma assíncrona e possuir registro para auditoria, retry e deduplicação.

## Estrutura sugerida do repositório

```text
backend/
frontend/
mobile/
docs/
```

O projeto mobile terá sua própria camada de telas e componentes. Tipos compartilhados podem ser extraídos posteriormente para uma pasta ou pacote comum, quando houver repetição real entre web e mobile.

## Fases de implementação

### Fase 0 — Preparação e decisões

- Confirmar identidade visual e nome do aplicativo.
- Escolher o identificador de pacote Android e bundle ID iOS.
- Definir ambientes local, staging e produção.
- Definir política de retenção de tokens e dados de notificação.
- Confirmar se o mapa será usado no primeiro release ou em uma atualização próxima.

Critério de conclusão: decisões registradas e ambiente de desenvolvimento reproduzível.

### Fase 1 — API preparada para mobile

- Criar `/api/v1`.
- Evoluir autenticação para sessões por dispositivo.
- Padronizar contratos e erros.
- Implementar endpoints de conta, entregas recebidas e dispositivos.
- Adicionar testes de autorização e isolamento entre usuários.

Critério de conclusão: todos os fluxos essenciais podem ser executados sem depender do frontend web.

### Fase 2 — Fundação do aplicativo

- Criar projeto Expo.
- Configurar navegação, tema, fontes e ícones.
- Implementar cliente HTTP.
- Implementar armazenamento seguro da sessão.
- Criar estados de loading, erro, vazio e offline.
- Configurar deep links básicos.

Critério de conclusão: o app abre, navega entre telas e autentica em Android e iOS.

### Fase 3 — Criação e acompanhamento

- Implementar tela de criação.
- Reutilizar contatos e locais salvos.
- Implementar prévia da entrega.
- Abrir e acompanhar links recebidos.
- Compartilhar links usando APIs nativas do sistema.

Critério de conclusão: um usuário consegue criar uma entrega e outro consegue acompanhá-la pelo app ou navegador.

### Fase 4 — Conta e rede de pessoas

- Implementar dashboard mobile.
- Implementar contatos, locais e entregas acompanhadas.
- Implementar caixa de entregas recebidas.
- Associar novas entregas por e-mail.
- Permitir remover associações.

Critério de conclusão: um destinatário autenticado encontra e acompanha automaticamente uma entrega enviada para seu e-mail.

### Fase 5 — Notificações

- Registrar dispositivos.
- Solicitar permissão de notificações no momento adequado.
- Criar eventos de entrega.
- Enviar notificações deduplicadas.
- Permitir abrir diretamente a entrega correspondente.

Critério de conclusão: uma entrega recebida gera uma notificação funcional em Android e iOS.

### Fase 6 — Qualidade e publicação

- Testar em dispositivos físicos.
- Validar links com e sem o app instalado.
- Validar permissões, notificações e login expirado.
- Adicionar monitoramento de erros.
- Criar builds de teste.
- Publicar beta fechado na Google Play e TestFlight.
- Revisar política de privacidade e textos das lojas.

Critério de conclusão: beta instalável, atualizável e utilizável por pessoas externas ao time.

## Estratégia de testes

- Testes unitários para parsing de links, sessão e regras de navegação.
- Testes de integração para autenticação, entregas recebidas e notificações.
- Testes de API para autorização e isolamento de dados.
- Testes manuais em Android e iOS reais.
- Testes de rede lenta, offline e token expirado.
- Testes de deep link com app instalado e não instalado.
- Testes de acessibilidade e tamanhos de fonte.

## Riscos e decisões importantes

- Notificações exigem configuração de contas Apple e Google e ambiente de produção.
- Mapas podem introduzir custos, limites de uso e complexidade de publicação.
- Tokens de acesso em links precisam continuar compatíveis com o fluxo web atual.
- A associação por e-mail deve tratar e-mails incorretos sem revelar dados de terceiros.
- O app não deve exigir login para abrir uma entrega recebida por link.
- O backend deve evitar que um usuário descubra entregas apenas por conhecer um e-mail.

## Primeira entrega recomendada

O primeiro ciclo de desenvolvimento deve entregar:

1. API `/api/v1` com autenticação por dispositivo.
2. Projeto Expo funcional.
3. Login opcional.
4. Abertura de links de entrega.
5. Tela de acompanhamento.
6. Dashboard básico com envios e entregas recebidas.

Notificações push, mapa nativo e publicação nas lojas podem entrar no segundo ciclo, depois que a experiência central estiver validada em dispositivos reais.

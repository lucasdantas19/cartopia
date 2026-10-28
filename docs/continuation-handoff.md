# Handoff para a próxima janela

## Estado atual

O Cartopia possui autenticação opcional e dashboard de usuário. Usuários anônimos continuam podendo criar e acompanhar entregas por link.

Commits recentes:

- `608f90d feat: add optional user authentication`
- `d6dd21d feat: use saved items in delivery form`
- `c96dd4d feat: add tracked deliveries to user account`
- `af68fd9 feat: offer saving new recipients and locations`

## Funcionalidades já implementadas

- Cadastro, login, logout e token Bearer.
- Histórico de envios do usuário.
- Locais e destinatários salvos.
- Seleção de itens salvos no formulário de criação.
- Mapa para escolher novos locais.
- Prompts opcionais para salvar novos locais e pessoas durante a criação.
- Entregas acompanhadas por link.
- Entregas recebidas associadas ao e-mail do destinatário.
- Dashboard visual com indicadores, histórico, entregas recebidas e acompanhadas.
- Token de destinatário armazenado criptografado para permitir o acesso pela conta.

## Alterações ainda não commitadas

Estas alterações foram iniciadas para preparar o app mobile:

- `backend/routes/api.php`: registra o grupo `/api/v1`.
- `backend/routes/api_v1.php`: rotas versionadas de health, autenticação, entregas e conta.
- `backend/tests/Feature/MobileApiTest.php`: teste do health endpoint versionado.
- `docs/mobile-api.md`: contrato inicial da API mobile.
- `docs/mobile-app-plan.md`: planejamento completo do aplicativo mobile.
- Este arquivo de continuidade.

Além disso, o primeiro esqueleto do aplicativo mobile foi criado em `mobile/`:

- projeto Expo Router com TypeScript e configuração de deep link `cartopia://`;
- cliente HTTP para autenticação, acompanhamento e abertura de mensagem;
- cliente HTTP também integrado aos envios e entregas recebidas da conta;
- cliente HTTP integrado à criação de entregas anônimas ou autenticadas;
- cliente HTTP integrado à abertura da mensagem quando a entrega chega;
- acompanhamento informa quando a mensagem ainda está bloqueada e atualiza o status automaticamente a cada 30 segundos;
- cliente HTTP diferencia falha de conexão da API e orienta a configuração para celular;
- sessão persistida com `expo-secure-store`;
- telas iniciais de entrada, cadastro/login, criação, conta com dashboard, acompanhamento e revelação da mensagem;
- tela de criação reorganizada em etapas visuais, com resumo da rota, contador de mensagem e suporte melhorado ao teclado;
- parser de links de entrega com testes automatizados.
- dependências instaladas e `mobile/package-lock.json` gerado.
- projeto atualizado para Expo SDK 58, React Native 0.88 e React 19.3.
- `.nvmrc` adicionado com Node.js 24.21.0, compatível com o SDK 58 e validado também no frontend.

Antes de iniciar uma nova frente, revisar e commitar esse conjunto como, por exemplo:

```bash
git add backend/routes/api.php backend/routes/api_v1.php \
  backend/tests/Feature/MobileApiTest.php docs
git commit -m "docs: prepare versioned api for mobile app"
```

## Próximo passo recomendado

Validar o app em Android/iOS. Depois conectar primeiro:

1. configuração de ambiente da API;
2. cliente HTTP;
3. armazenamento seguro de sessão;
4. login opcional;
5. deep link de entrega;
6. tela de acompanhamento.

O acompanhamento atual já consulta `GET /api/v1/deliveries/{publicId}` e abre links colados ou recebidos pelo sistema operacional. A conta já consulta `GET /api/v1/account/deliveries` e `GET /api/v1/account/incoming-deliveries`, além de obter o token de destinatário para abrir uma entrega recebida. A tela de criação envia entregas diretas com mensagem, destinatário, origem, destino, duração e entregador. Quando a entrega chega, o destinatário pode abrir a mensagem por `GET /api/v1/deliveries/{publicId}/message`. Ainda faltam aventura com paradas e histórico de links acompanhados na camada mobile.

Não reutilizar componentes visuais React do `frontend/`. Compartilhar apenas tipos, contratos e regras puras quando houver benefício claro.

## Decisões técnicas atuais

- O backend continua sendo Laravel 12 + PostgreSQL.
- A API mobile deverá usar `/api/v1`; as rotas atuais permanecem por compatibilidade.
- O app não deve exigir login para abrir um link de entrega.
- A associação de destinatários usa e-mail.
- O token de conta atual é simples e deve evoluir para access token curto + refresh token por dispositivo antes de uma publicação em lojas.
- Notificações push ainda não foram implementadas.
- O projeto `mobile/` ainda não existe.

## Validações já executadas

- Frontend: `npm run build` passou.
- Frontend: `npm test` passou com 12 testes.
- Mobile: `npm test` passou com 3 testes de parsing de deep links.
- Mobile: `npx tsc --noEmit` e `npx expo config --type public` passaram.
- Mobile: `npx expo export --platform android --output-dir /tmp/cartopia-mobile-export` passou e gerou o bundle Android.
- Mobile: export Android repetido após a migração para SDK 58 passou.
- Mobile: export Android passou após conectar o dashboard de conta.
- Mobile: export Android passou após integrar a criação de entregas.
- Mobile: export Android passou após a melhoria visual da tela de criação.
- Mobile: export Android passou após integrar a revelação da mensagem.
- Mobile: export Android passou após adicionar atualização automática até a chegada.
- Mobile: TypeScript e testes passaram após adicionar a configuração de rede local e o tratamento de erro de conexão.
- Frontend: `npm test` passou com 12 testes usando Node.js 24.21.0.
- Frontend: `npm run build` passou usando Node.js 24.21.0.
- PHP lint passou nos arquivos alterados.
- Rotas `/api/v1` verificadas com `php artisan route:list`.
- `git diff --check` passou.

## Limitações conhecidas

- A suíte Laravel completa não pôde ser executada neste ambiente porque os testes tentam conectar ao PostgreSQL em `127.0.0.1:5432`, bloqueado pelo sandbox.
- O ambiente do agente não conseguiu escrever em `.git/index.lock`; os commits recentes foram realizados posteriormente pelo usuário.
- Depois de aplicar as migrations no banco, validar especialmente:
  - associação por e-mail;
  - entrega recebida por usuário cadastrado;
  - acesso ao token de destinatário;
  - isolamento entre contas;
  - rotas `/api/v1`.
- A validação visual em simulador/dispositivo ainda não foi possível: há um binário `emulator`, mas o `adb` não está disponível no ambiente e o `expo start --android` não conseguiu abrir um destino Android.
- O Expo SDK 58 exige Node.js 22.13 ou superior; este ambiente usa Node.js 22.12 e emite aviso de engine durante os comandos.
- O Node.js 24.21.0 está instalado via nvm e foi usado nas validações. O alias global `default` não pôde ser persistido pelo ambiente; em um novo terminal, executar `nvm use` dentro do repositório se necessário.
- Para testar em celular, configurar `mobile/.env.local` com o IP da máquina e iniciar o Laravel com `php artisan serve --host=0.0.0.0 --port=8000`; instruções completas estão em `mobile/README.md`.

## Comandos úteis

```bash
cd backend
php artisan migrate
php artisan route:list | rg 'api/v1'
php artisan test

cd ../frontend
npm run build
npm test
```

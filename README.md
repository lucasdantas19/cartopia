# Cartopia

> Cada mensagem, uma aventura.

Cartopia é uma plataforma para transformar mensagens, cartas e presentes digitais em pequenas experiências de entrega. Quem envia escolhe a rota, o entregador e a forma de revelação; quem recebe acompanha a jornada e descobre a mensagem quando ela chega.

O projeto está em fase de MVP/Beta e foi construído como um monorepo com API Laravel, frontend web React e aplicativo mobile Expo.

## O que o Cartopia oferece

- Criação de entregas com ou sem conta.
- Entregadores virtuais: Andorinha de Papel, Gatinho Carteiro e Dragão Mensageiro.
- Rotas diretas ou aventuras com várias etapas, títulos, descrições e duração por trecho.
- Acompanhamento por link público, sem expor a mensagem antes da chegada.
- Visualização da viagem em porcentagem ou mapa.
- Mensagens protegidas por senha ou desafio de palavras.
- Contas para reunir envios, entregas recebidas e acompanhamentos salvos.
- Agenda de locais e destinatários para reutilização em novas entregas.
- Painel administrativo para consultar usuários e entregas, incluindo filtros por tipo, status e período.
- Atualização em tempo real no frontend por Laravel Reverb, com fallback para consulta HTTP.
- PWA web e aplicativo mobile com navegação própria, deep links e suporte a mapas.

Uma entrega pode ser criada anonimamente. Quando o remetente está autenticado, ela também fica disponível na conta para consulta posterior.

## Como funciona

1. O remetente escreve a mensagem e informa quem receberá.
2. Escolhe uma origem, um destino, um entregador e a duração da viagem.
3. Opcionalmente, adiciona etapas, localização real, senha ou desafio.
4. O Cartopia gera um link seguro de acompanhamento.
5. O destinatário acompanha a viagem e abre a mensagem somente após a chegada.

O token de acesso da entrega é independente do token da conta. A API armazena apenas o hash dos tokens e o frontend mantém o token de acompanhamento no fragmento do link, evitando que ele seja enviado ao servidor como parte da URL.

## Arquitetura

| Camada | Tecnologia | Diretório |
| --- | --- | --- |
| API e domínio | PHP 8.3+, Laravel 12 | [backend/](backend/) |
| Banco de dados | PostgreSQL | — |
| Frontend web | React 19, TypeScript, Vite | [frontend/](frontend/) |
| Aplicativo mobile | Expo SDK 58, React Native, Expo Router | [mobile/](mobile/) |
| Tempo real | Laravel Reverb, Laravel Echo e Pusher JS | backend/ + frontend/ |
| Mapas | MapLibre GL, OpenFreeMap e busca opcional via Mapbox | frontend/ + mobile/ |

O frontend web consome a API REST em /api. O aplicativo mobile utiliza a versão compatível /api/v1, documentada em [docs/mobile-api.md](docs/mobile-api.md).

## Pré-requisitos

- PHP 8.3 ou superior.
- Composer.
- Node.js 22.13 ou superior.
- npm.
- PostgreSQL 14 ou superior.
- Para desenvolvimento mobile: Expo Go compatível com o SDK 58 ou um emulador Android/iOS.

## Configuração local

### 1. API

~~~bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
~~~

Configure no backend/.env pelo menos:

~~~dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=cartopia
DB_USERNAME=postgres
DB_PASSWORD=sua-senha
~~~

Para o desenvolvimento local com atualizações em tempo real, mantenha o Reverb habilitado conforme os valores de backend/.env.example.

### 2. Frontend web

Em outro terminal:

~~~bash
cd frontend
npm install
cp .env.example .env
npm run dev
~~~

O frontend ficará disponível em http://localhost:5173 e a API em http://localhost:8000.

As variáveis mais importantes do frontend são:

~~~dotenv
VITE_API_URL=http://localhost:8000/api
VITE_REVERB_ENABLED=true
VITE_REVERB_APP_KEY=cartopia-local-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
~~~

O token público do Mapbox é opcional. Sem ele, ainda é possível escolher um ponto diretamente no mapa:

~~~dotenv
VITE_MAPBOX_ACCESS_TOKEN=pk.seu_token_publico
~~~

### 3. Aplicativo mobile

Em outro terminal:

~~~bash
cd mobile
npm install
cp .env.example .env.local
npm start
~~~

Para testar em um celular físico, substitua localhost pelo IP do computador na rede local:

~~~dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1
EXPO_PUBLIC_WEB_URL=http://192.168.1.42:5173
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.seu_token_publico
~~~

Inicie a API aceitando conexões da rede:

~~~bash
cd backend
php artisan serve --host=0.0.0.0 --port=8000
~~~

Consulte [mobile/README.md](mobile/README.md) para deep links, mapas, rascunhos locais, Expo Go, emuladores e configuração de builds.

## Comandos úteis

### Backend

~~~bash
cd backend
php artisan serve
php artisan test
php artisan migrate
~~~

### Frontend web

~~~bash
cd frontend
npm run dev
npm run build
npm run lint
npm test
~~~

### Mobile

~~~bash
cd mobile
npx tsc --noEmit
npm test
npm start
~~~

### Verificação de saúde

~~~bash
curl http://localhost:8000/api/health
~~~

Resposta esperada:

~~~json
{"status":"ok"}
~~~

## API e segurança

Os principais grupos de endpoint são:

- POST /api/auth/register e POST /api/auth/login.
- POST /api/deliveries para criar uma entrega.
- GET /api/deliveries/{public_id} para acompanhar uma viagem.
- GET /api/deliveries/{public_id}/message para abrir a mensagem após a chegada.
- /api/account/* para dados da conta, agenda e entregas acompanhadas.
- /api/admin/* para as operações do painel administrativo.

O cadastro exige senha com pelo menos 8 caracteres, letra maiúscula, letra minúscula e número. Essa regra vale somente para novas contas; contas legadas continuam podendo fazer login com suas senhas existentes.

Boas práticas importantes do projeto:

- Nunca commite arquivos .env ou credenciais.
- Não coloque APP_KEY, senha do banco, segredo do Reverb ou tokens privados em variáveis VITE_* ou EXPO_PUBLIC_*.
- Use HTTPS/WSS em produção.
- Restrinja CORS, origens do Reverb e tokens públicos de mapas aos domínios necessários.
- Faça backup do PostgreSQL antes de migrations e operações de retenção.

Detalhes do contrato de entregas estão em [docs/deliveries-api.md](docs/deliveries-api.md).

## Deploy

O guia de produção descreve uma implantação mínima com Nginx ou Caddy, PHP-FPM, PostgreSQL, frontend estático e Laravel Reverb:

[docs/production.md](docs/production.md)

Antes de publicar:

- configurar domínio e HTTPS;
- revisar todas as variáveis de ambiente;
- executar php artisan migrate --force no banco correto;
- gerar o frontend com as variáveis públicas de produção;
- configurar o proxy para API e WebSocket;
- verificar CORS, WSS, logs, backups e rate limiting;
- substituir os identificadores dos arquivos de Universal Links/App Links.

O projeto não inclui credenciais, infraestrutura pronta ou um pipeline de deploy automático.

## Estrutura do repositório

~~~text
cartopia/
├── backend/                 # API Laravel, domínio, migrations e testes
├── frontend/                # Aplicação web React/TypeScript
├── mobile/                  # Aplicativo Expo/React Native
├── docs/                    # Produto, APIs, mobile e produção
├── deploy/                  # Templates de serviços systemd
├── AGENTS.md                # Convenções de desenvolvimento do projeto
└── LICENSE                  # Licença MIT
~~~

## Documentação complementar

- [Visão do produto](docs/product.md)
- [API de entregas](docs/deliveries-api.md)
- [API mobile v1](docs/mobile-api.md)
- [Plano de produção](docs/production.md)
- [Plano de deployment](docs/deployment-plan.md)
- [Análise de UI/UX mobile](docs/mobile-ui-ux-analysis.md)
- [Configuração do Reverb](docs/reverb.md)
- [README do frontend](frontend/README.md)
- [README do mobile](mobile/README.md)

## Contribuição

1. Crie uma branch para a alteração.
2. Mantenha a solução incremental e alinhada às convenções do framework.
3. Adicione ou atualize testes para regras de negócio.
4. Execute as validações relevantes antes de abrir o pull request.
5. Não inclua credenciais, dados reais ou arquivos de ambiente.

## Licença

Distribuído sob a [licença MIT](LICENSE).

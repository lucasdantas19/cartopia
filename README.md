# Cartopia

Plataforma de entregas virtuais e lúdicas de mensagens, cartas e presentes digitais. Cada mensagem é planejada como uma pequena aventura.

## Visão geral

O remetente escolhe um entregador virtual, define um destino e compartilha um link para que o destinatário acompanhe a viagem e descubra a surpresa quando ela chegar. O slogan provisório é: **Cada mensagem, uma aventura.**

## Pré-requisitos

- PHP 8.3 ou superior, Composer e extensões usuais do Laravel.
- Node.js 22 ou superior e npm.
- PostgreSQL 14 ou superior em execução para uso do banco local.

## Instalação

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

cd ../frontend
npm install
cp .env.example .env
```

Configure as credenciais do PostgreSQL em `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` e `DB_PASSWORD`). O frontend usa `VITE_API_URL`, com padrão `http://localhost:8000/api`.

## Inicialização

Em terminais separados:

```bash
cd backend && php artisan serve
cd frontend && npm run dev
```

A API ficará disponível em `http://localhost:8000` e o frontend em `http://localhost:5173`.

## Testes e validações

```bash
cd backend && php artisan test
cd frontend && npm run build
```

O endpoint inicial é `GET /api/health`, que retorna `{"status":"ok"}`. Para validar manualmente: `curl http://localhost:8000/api/health`.

## Estrutura

- `backend/`: aplicação Laravel e API REST.
- `frontend/`: aplicação React + TypeScript + Vite.
- `docs/`: documentação de produto e escopo.
- `AGENTS.md`: diretrizes para agentes de IA.

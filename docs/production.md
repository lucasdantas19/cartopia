# Cartopia em produção

Este documento prepara uma implantação pequena do Cartopia. Ele não executa deploy,
cria servidores ou contém credenciais.

## Arquitetura mínima

Para um Beta de baixo volume, uma única VPS pode executar:

- Nginx ou Caddy, terminando HTTPS e encaminhando WebSocket com WSS;
- PHP-FPM e a API Laravel;
- PostgreSQL;
- Laravel Reverb como processo supervisionado;
- os arquivos estáticos gerados pelo build do frontend.

O Reverb deve escutar em um endereço interno, por exemplo `127.0.0.1:8080`, e o
proxy deve expor somente HTTPS/WSS. A porta do PostgreSQL não deve ser pública.
O evento atual usa `ShouldBroadcastNow`; não é necessário um worker de fila para
esse fluxo específico.

Uma VPS única é um ponto único de falha. Backups do PostgreSQL devem ser enviados
para armazenamento externo e a restauração deve ser testada antes da publicação.

## Variáveis do backend

Use `.env` no servidor, nunca o Git. Os valores abaixo são exemplos de formato:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app.example.com
APP_KEY=<gerado-e-armazenado-no-servidor>

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=cartopia
DB_USERNAME=<usuario-do-banco>
DB_PASSWORD=<senha-fora-do-git>

CACHE_STORE=database
LOG_CHANNEL=stack
LOG_STACK=stderr
LOG_LEVEL=info

BROADCAST_CONNECTION=reverb
REVERB_APP_ID=<id-da-aplicacao>
REVERB_APP_KEY=<chave-publica>
REVERB_APP_SECRET=<segredo-fora-do-git>

# Endereço interno onde o processo Reverb escuta.
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8080

# Endereço público usado pelo frontend e pelo cliente WebSocket.
REVERB_HOST=ws.example.com
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_ALLOWED_ORIGINS=https://app.example.com

CORS_ALLOWED_ORIGINS=https://app.example.com
TRUSTED_PROXIES=10.0.0.10
REVERB_APP_ACCEPT_CLIENT_EVENTS_FROM=none
```

`REVERB_SERVER_*` é interno. `REVERB_HOST`, `REVERB_PORT` e
`REVERB_SCHEME` descrevem o endpoint público após o proxy. O segredo Reverb e a
senha do banco nunca devem ser prefixados com `VITE_`.

O `TRUSTED_PROXIES` deve conter somente o endereço ou CIDR da rede do proxy
reverso. Não use `*` nem confie em `X-Forwarded-For` diretamente de clientes.
Se a topologia da VPS ainda não estiver definida, deixe o valor vazio até
conhecer o endereço real do proxy.

O cache `database` exige que as migrations padrão de cache estejam aplicadas.
Os limites de rate limiting continuam configuráveis por:

```dotenv
DELIVERY_CREATION_RATE_LIMIT=5
DELIVERY_TRACKING_RATE_LIMIT=60
MESSAGE_OPENING_RATE_LIMIT=20
BROADCASTING_AUTH_RATE_LIMIT=30
DELIVERY_RETENTION_DAYS=90
DELIVERY_RETENTION_BATCH_SIZE=100
```

## Retenção de entregas

O comando `cartopia:prune-deliveries` considera elegíveis as entregas cujo
`arrives_at` ocorreu há pelo menos `DELIVERY_RETENTION_DAYS` dias. O padrão é
90 dias, calculado em UTC. Ele exclui em lotes e nunca seleciona entregas ainda
em trânsito ou futuras.

O agendamento não está ativado nesta etapa. Antes da implantação, validar a
prévia no banco de produção:

```bash
/usr/bin/php8.4 artisan cartopia:prune-deliveries --dry-run
```

Para conferir o valor efetivo carregado pelo ambiente, sem criar endpoint
público nem executar exclusões:

```bash
/usr/bin/php8.4 artisan config:show deliveries
```

Verifique `retention_days` na saída. O valor vem de
`DELIVERY_RETENTION_DAYS`, com padrão 90 quando a variável não está definida.

Para a VPS atual, a opção mais simples é o timer systemd diário em
[`deploy/systemd`](../deploy/systemd), executando como o usuário `cartopia` e
usando PHP 8.4. Os templates usam
`ExecStart=/usr/bin/php8.4 artisan cartopia:prune-deliveries`, o diretório do
backend e o `.env` compartilhado, com `OnCalendar=*-*-* 03:30:00` e
`Persistent=true`. Os arquivos não estão instalados nem habilitados nesta
etapa.

Para ativar futuramente, depois de revisar a prévia, o banco-alvo e o backup,
copiar os dois templates para `/etc/systemd/system/`, executar
`systemctl daemon-reload` e então `systemctl enable --now
cartopia-prune-deliveries.timer`. A ativação deve ocorrer somente em janela
autorizada e após confirmar que o `.env` aponta para o banco de produção do
Cartopia.

Após a ativação, verificar falhas com:

```bash
systemctl status cartopia-prune-deliveries.timer
systemctl status cartopia-prune-deliveries.service
journalctl -u cartopia-prune-deliveries.service --since today
```

Não executar `--dry-run` ou a limpeza apontando para o banco de desenvolvimento
ou para o banco do OurHistory. A execução real não deve ser feita durante esta
tarefa.

## Variáveis do frontend

O Vite incorpora essas variáveis durante o build:

```dotenv
VITE_API_URL=https://api.example.com/api
VITE_REVERB_ENABLED=true
VITE_REVERB_APP_KEY=<mesma-chave-publica-do-Reverb>
VITE_REVERB_HOST=ws.example.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
VITE_BROADCAST_AUTH_URL=https://api.example.com/api/broadcasting/auth
# Opcional até o contato oficial ser confirmado.
VITE_PRIVACY_CONTACT_EMAIL=<email-real-configurado-antes-da-publicacao>
```

Somente a chave pública do Reverb pode aparecer no frontend. Não inclua
`REVERB_APP_SECRET`, senha do banco ou `APP_KEY` em variáveis `VITE_*`.
Não preencha `VITE_PRIVACY_CONTACT_EMAIL` com um endereço fictício.

## Diferenças do ambiente local

- Local usa HTTP, localhost e Reverb na porta 8080.
- Produção usa HTTPS/WSS terminados no proxy.
- Local permite as origens de desenvolvimento configuradas nos exemplos.
- Produção exige `CORS_ALLOWED_ORIGINS` e `REVERB_ALLOWED_ORIGINS` explícitos.
- Local pode usar logs em arquivo e nível `debug`; produção deve usar `info` ou
  mais restritivo, preferencialmente `stderr` com rotação pelo systemd/journald.
- Produção deve usar `APP_DEBUG=false`.
- O banco de produção nunca deve ser usado pela suíte automatizada.

O código não registra tokens, headers `Authorization` ou payloads. O proxy e as
ferramentas de observabilidade também devem ser configurados para não registrar
corpos de resposta, URLs com fragmentos ou headers sensíveis. O canal `stderr`
deve ter rotação e retenção definidas pelo sistema operacional.

## Etapas futuras de deploy

1. Provisionar a VPS, DNS, firewall e certificados TLS.
2. Criar o banco e um usuário PostgreSQL com permissões mínimas.
3. Configurar `.env` e os segredos fora do repositório.
4. Configurar o proxy para API, arquivos estáticos e WebSocket.
5. Gerar o frontend com `npm run build` usando as variáveis de produção.
6. Executar `php artisan config:cache` e `php artisan migrate --force` somente
   após confirmar o banco e realizar backup.
7. Iniciar PHP-FPM, Reverb e, se futuramente necessário, workers sob supervisão.
8. Verificar HTTPS, CORS, WSS, rate limiting, abertura da carta e fallback sem
   WebSocket.

Não execute `migrate:fresh` em produção.

## Checklist

- [ ] Domínio e HTTPS configurados.
- [ ] Proxy encaminha `Upgrade`/`Connection` para WebSocket.
- [ ] `APP_DEBUG=false`.
- [ ] `APP_KEY`, senha do banco e segredo Reverb fora do Git.
- [ ] CORS e origens Reverb restritos ao frontend real.
- [ ] `TRUSTED_PROXIES` contém somente o proxy conhecido.
- [ ] Migrations aplicadas no banco correto após backup.
- [ ] Tabela `cache` disponível para rate limiting.
- [ ] Reverb supervisionado e reiniciado automaticamente.
- [ ] Logs com rotação e sem tokens, payloads ou credenciais.
- [ ] Backup externo e restauração testada.
- [ ] Build frontend não contém localhost.
- [ ] Fluxos de criação, acompanhamento, abertura e evento WebSocket validados.

Ainda dependem da implantação: endereços reais, CIDR do proxy, domínio,
certificados, política de backup, limites de recursos da VPS e estratégia de
monitoramento.

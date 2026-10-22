# Plano de implantação do Cartopia na VPS do OurHistory

Este documento é um roteiro de planejamento. Nenhum comando deve ser executado
na VPS como parte desta tarefa. O objetivo é adicionar o Cartopia sem alterar o
site, o PHP-FPM, o Nginx ou o MySQL utilizados pelo OurHistory sem validação e
janela controlada.

## Capacidade e compatibilidade

A VPS tem 1 vCPU, aproximadamente 3,8 GiB de RAM e 44 GB livres. É suficiente
para um Beta de baixo volume, mas há pouca margem para processos concorrentes.
Não devem ser executados workers de fila adicionais neste estágio; o evento
atual usa `ShouldBroadcastNow`.

O [backend/composer.json](../backend/composer.json) declara PHP `^8.2`,
Laravel `^12.0` e Reverb `^1.6`, mas essa faixa não descreve sozinha o
requisito efetivo do lock. O `composer.lock` atual fixa pacotes Symfony 8.1.9
que exigem PHP `>=8.4.1`. Portanto, o PHP 8.3.35 da VPS não é suficiente para
instalar/validar o conjunto bloqueado. Não usar `--ignore-platform-reqs` e não
regenerar o lock como atalho.

A estratégia preferencial é instalar PHP 8.4.1 ou posterior em paralelo ao
PHP 8.3 do OurHistory. O PHP 8.3-FPM, seu pool, socket, CLI e configuração do
OurHistory permanecem inalterados. O Cartopia usará exclusivamente os
executáveis e serviços PHP 8.4. O Composer deve ser executado com o binário
8.4 e `--no-dev` na implantação.

### Compatibilidade adicional encontrada no `composer.lock`

Além de `symfony/clock v8.1.9`, que motivou esta revisão, o lock contém outras
dependências Symfony na série 8.1.9 com o mesmo requisito `php >=8.4.1`:

- `symfony/css-selector`;
- `symfony/event-dispatcher`;
- `symfony/string`;
- `symfony/translation`;
- `symfony/yaml`.

O requisito declarado pelo framework continua sendo PHP `^8.2`, mas o lock é a
fonte que determina a instalação reproduzível. Com PHP 8.3, o Composer deve
recusar esses pacotes por requisito de plataforma. A validação obrigatória no
servidor será feita com o PHP 8.4, por exemplo:

```bash
/usr/bin/php8.4 /usr/local/bin/composer check-platform-reqs --no-dev
```

O caminho real do Composer deve ser confirmado antes da execução.

O Vite instalado exige Node `^20.19.0 || >=22.12.0`. Como Node não está
instalado na VPS e o frontend é estático, o build será feito fora dela e apenas
os artefatos `frontend/dist` serão enviados.

### Extensões PHP 8.4

O conjunto do Cartopia deve ser instalado e verificado na variante 8.4; não se
deve misturar extensões 8.3 no pool da aplicação:

- `php8.4-cli`, para Artisan, Composer e o processo Reverb;
- `php8.4-fpm`, com um pool exclusivo do Cartopia;
- `php8.4-pgsql`, incluindo PDO PostgreSQL;
- `php8.4-mbstring`, `php8.4-xml`, `php8.4-curl` e `php8.4-zip`;
- `php8.4-opcache` para o FPM em produção;
- extensões base como `ctype`, `fileinfo`, `openssl`, `tokenizer`, `json` e
  `session`, fornecidas pelo runtime PHP.

Para o Reverb e comandos de longa duração, confirmar no CLI 8.4 também
`pcntl`, `posix` e `sockets`. `intl` e `bcmath` são recomendáveis para
compatibilidade com dependências e parsing, embora não sejam requisitos
diretos do fluxo atual. A lista final deve ser conferida com
`check-platform-reqs`, usando exatamente `/usr/bin/php8.4`.

### Disponibilidade e origem do PHP 8.4 no Ubuntu 22.04

Não presumir que os repositórios nativos do Ubuntu 22.04 forneçam `php8.4-*`:
Jammy tem PHP 8.1 como versão padrão. Antes de qualquer mudança, verificar sem
instalar:

```bash
apt-cache policy php8.4-cli php8.4-fpm php8.4-pgsql
apt-cache madison php8.4-cli php8.4-fpm
```

Se os pacotes não estiverem disponíveis em uma fonte oficial habilitada, a
alternativa usual para Jammy é o PPA `ondrej/php`, publicado no Launchpad e com
builds `php8.4` para `ubuntu jammy` ([build de referência no Launchpad](https://launchpad.net/~ondrej/+archive/ubuntu/php/+build/30919803)).
As instruções oficiais do PHP também apontam essa fonte para instalações Linux
quando necessário ([PHP downloads](https://www.php.net/downloads.php?os=linux&osvariant=linux-ubuntu&usage=web&version=8.4)).
Ele é uma fonte externa ao Ubuntu, portanto
não deve ser adicionado automaticamente: a aprovação deve registrar a origem,
a assinatura/chave do repositório, a suíte `jammy`, a política de prioridade do
APT e o mantenedor responsável. Não usar `.deb` baixado de site aleatório.

O PPA deve ser tratado como risco de cadeia de fornecimento e de manutenção.
Se a origem aprovada não estiver disponível ou não passar na validação, parar
o planejamento de instalação e não rebaixar o lock para PHP 8.3. Também não
alterar o `php` padrão do sistema nem remover os pacotes 8.3 do OurHistory.

Não é necessário instalar MySQL para o Cartopia. O MySQL existente deve
continuar exclusivo do OurHistory.

## PostgreSQL 14

O Ubuntu 22.04 (Jammy) disponibiliza `postgresql-14` nos repositórios oficiais
de atualizações. A instalação prevista é:

```bash
sudo apt update
sudo apt install postgresql-14 postgresql-client-14
```

Antes de instalar, confirmar arquitetura, espaço em disco e a versão disponível
com `apt-cache policy postgresql-14`. A página oficial do PostgreSQL também
descreve o repositório PGDG para casos em que a versão desejada não esteja
disponível no Ubuntu: [instruções oficiais para Ubuntu](https://www.postgresql.org/download/linux/ubuntu/)
e [pacote PostgreSQL 14 para Jammy](https://packages.ubuntu.com/jammy-updates/postgresql-14).

Após a instalação, criar somente um banco e usuário próprios do Cartopia, com
acesso local e permissões mínimas. Não usar o usuário `postgres` na aplicação e
não alterar qualquer banco MySQL do OurHistory.

Configuração prevista:

```text
/var/lib/postgresql/14/main       dados do PostgreSQL
127.0.0.1:5432                    acesso local da aplicação
cartopia                          banco de produção
cartopia_app                      usuário da aplicação
```

O nome real do usuário e a senha devem ser definidos fora do Git. Antes de
`migrate --force`, confirmar inequivocamente `current_database()` e realizar
backup. Nunca usar `migrate:fresh`.

## Estrutura de diretórios

Manter as aplicações separadas, sem assumir o caminho atualmente usado pelo
OurHistory:

```text
/srv/cartopia/
├── current/                 release atualmente ativo
│   ├── backend/              código Laravel
│   └── frontend/             build estático, se mantido junto do release
├── releases/                releases anteriores para rollback
└── shared/
    ├── .env                  configuração e segredos do Cartopia
    ├── storage/              storage persistente do Laravel
    └── backups/              somente se houver política segura e externa
```

O usuário de serviço `cartopia` deve possuir somente os diretórios necessários.
O `storage` e o `.env` não devem ser servidos pelo Nginx. O caminho real do
OurHistory deve ser descoberto antes e não deve ser reutilizado.

## Componentes reutilizados e novos

Reutilizar:

- Nginx existente, adicionando um novo server block independente;
- systemd existente para supervisionar Reverb;
- TLS, firewall, DNS e ferramentas de log já operadas na VPS, após confirmar a
  configuração atual do OurHistory.

Manter separado:

- PHP 8.3-FPM, CLI e pools do OurHistory, sem troca do socket ou do `php`
  padrão;
- PHP 8.4-FPM, CLI e extensões 8.4, exclusivos do Cartopia;

Instalar ou preparar para o Cartopia:

- PostgreSQL 14 e cliente PostgreSQL;
- PHP 8.4 CLI/FPM e as extensões 8.4 ausentes, especialmente `pdo_pgsql`;
- Composer, se ainda não estiver disponível para o usuário de deploy;
- um usuário Unix e diretórios próprios;
- um serviço systemd para Reverb;
- certificado e hostname próprios, caso o proxy atual não possa compartilhar o
  certificado de forma segura.

Não instalar Docker, Redis, Kubernetes ou uma segunda aplicação Nginx.

## Pool PHP-FPM dedicado

Um pool PHP-FPM 8.4 separado melhora isolamento de usuário, limites e logs,
sem tocar no pool PHP 8.3 do OurHistory, mas consome processos adicionais. Com
1 vCPU, começar conservadoramente:

```ini
[cartopia]
user = cartopia
group = www-data
listen = /run/php/php8.4-fpm-cartopia.sock
pm = ondemand
pm.max_children = 2
pm.process_idle_timeout = 10s
pm.max_requests = 300
```

O valor de `pm.max_children` deve ser ajustado após medir o OurHistory e o
Cartopia. Ativar/recarregar somente o serviço `php8.4-fpm`; não reutilizar nem
reconfigurar o pool do OurHistory. Confirmar que o socket 8.4 pertence ao
usuário/grupo corretos e que o socket 8.3 do OurHistory não mudou.

## Nginx sem alteração do OurHistory

Criar um arquivo de site separado, por exemplo `cartopia.conf`, com hostname
próprio. O server block deve:

- servir o `frontend/dist` como raiz;
- usar `try_files` para o fallback SPA;
- encaminhar `/api` ao `index.php` do backend Laravel via socket do pool Cartopia;
- usar explicitamente `fastcgi_pass unix:/run/php/php8.4-fpm-cartopia.sock;`,
  nunca o socket genérico ou o socket PHP 8.3 do OurHistory;
- encaminhar o caminho WebSocket do Reverb ao `127.0.0.1:8080` com os headers
  `Upgrade` e `Connection`;
- não expor `.env`, `storage`, `vendor` ou o código fonte;
- manter limites de corpo e timeouts compatíveis com a API.

Antes e depois de ativar o novo arquivo, executar `nginx -t` e verificar o
hostname do OurHistory com `curl`. Aplicar apenas `systemctl reload nginx`, sem
desabilitar ou editar `sites-enabled/ourhistory`.

O domínio público deve ser separado, por exemplo:

```text
app.cartopia.example       frontend e API
ws.cartopia.example        WebSocket, se separado for necessário
```

Também é possível usar um único hostname e encaminhar WebSocket por caminho,
desde que isso não conflite com as rotas do OurHistory.

## Serviço Reverb

Criar um serviço systemd separado, executando como `cartopia`:

```ini
[Unit]
Description=Cartopia Laravel Reverb
After=network.target postgresql.service

[Service]
User=cartopia
Group=www-data
WorkingDirectory=/srv/cartopia/current/backend
EnvironmentFile=/srv/cartopia/shared/.env
ExecStart=/usr/bin/php8.4 artisan reverb:start --host=127.0.0.1 --port=8080
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

O processo não deve escutar em `0.0.0.0` na VPS compartilhada. O Nginx será o
único componente público para WSS. Validar limites de memória e incluir logs do
serviço no journald com retenção definida.

## Consumo de recursos, logs e backups

- Manter apenas um processo Reverb.
- Não iniciar `queue:work` enquanto não houver jobs que dependam dele.
- Adicionar swap controlada, preferencialmente 1–2 GiB, antes de serviços de
  longa duração, após avaliar a política do host.
- Monitorar RAM, load average, espaço em disco, conexões PostgreSQL e processos
  FPM/Reverb.
- Usar `LOG_STACK=stderr` com journald ou `daily` com `LOG_DAILY_DAYS` definido.
- Não registrar tokens, headers `Authorization`, mensagens ou corpos de
  requisição.
- Rotacionar logs do Nginx, Laravel, PostgreSQL e Reverb sem ocupar o disco.
- Fazer `pg_dump` criptografado ou protegido para destino externo; não deixar o
  único backup na mesma VPS.
- Testar restauração em ambiente separado antes de considerar o backup válido.

O MySQL do OurHistory deve ter seu próprio backup e métricas preservados.

## Sequência segura de implantação

1. Registrar o estado atual do OurHistory: URL pública, páginas críticas,
   `nginx -t`, status do Nginx/PHP-FPM/MySQL, espaço, RAM e carga.
2. Fazer backup e confirmar como restaurar o OurHistory. Guardar uma cópia da
   configuração Nginx existente, sem publicar segredos.
3. Verificar espaço, swap, arquitetura, versões PHP/Composer e extensões. Confirmar
   `php8.3 -v`/pool do OurHistory e executar `apt-cache policy` para todos os
   pacotes PHP 8.4. Usar `apt-get -s` antes de qualquer instalação para
   identificar possíveis reinícios de serviços.
4. Aprovar e instalar PHP 8.4 e extensões 8.4 em paralelo, em janela
   controlada. Não trocar o `php` padrão, parar o PHP 8.3-FPM ou alterar arquivos
   do OurHistory. Instalar PostgreSQL 14 separadamente, sem tocar no MySQL.
5. Confirmar que o PostgreSQL iniciou, está limitado a acesso local e criar o
   banco/usuário Cartopia.
6. Criar usuário e diretórios Cartopia, publicar o backend e configurar o
   `.env` fora do Git.
7. Compilar o frontend fora da VPS e copiar somente `dist` para o diretório do
   release.
8. Executar o Composer com o binário 8.4, por exemplo
   `/usr/bin/php8.4 /usr/local/bin/composer install --no-dev
   --optimize-autoloader`, e validar com o mesmo binário:
   `/usr/bin/php8.4 artisan about` e
   `/usr/bin/php8.4 artisan config:cache`.
9. Confirmar o banco por consulta somente leitura, realizar backup e executar
   `/usr/bin/php8.4 artisan migrate --force`.
10. Instalar o pool PHP 8.4 dedicado e validar
    `/run/php/php8.4-fpm-cartopia.sock`. Recarregar somente o PHP 8.4-FPM,
    conferindo o OurHistory imediatamente antes e depois.
11. Instalar o server block Cartopia, executar `nginx -t` e recarregar o Nginx.
12. Iniciar Reverb sob systemd e testar WSS, autorização privada e fallback sem
    WebSocket.
13. Executar smoke tests de criação, acompanhamento, abertura, rate limiting e
    links; observar logs e recursos.
14. Manter o release anterior disponível até concluir a validação.

Se qualquer validação do OurHistory falhar, interromper a ativação do Cartopia,
restaurar somente o novo arquivo de configuração e investigar antes de tocar no
site existente.

## Checklist do OurHistory

### Antes

- [ ] URL pública e páginas críticas respondem corretamente.
- [ ] `nginx -t` aprovado.
- [ ] Nginx, PHP-FPM e MySQL ativos.
- [ ] `php8.3 -v` e o socket/pool do OurHistory registrados sem alterações.
- [ ] `php8.4 -v` disponível, com origem aprovada e extensões 8.4 verificadas.
- [ ] Backup recente do MySQL verificado.
- [ ] Espaço, RAM, swap e carga registrados.
- [ ] Configuração de `sites-enabled/ourhistory` copiada para recuperação.
- [ ] Nenhuma porta ou socket do OurHistory será reutilizada sem confirmação.

### Depois

- [ ] URL, assets, login e endpoints críticos do OurHistory continuam respondendo.
- [ ] Não há erros novos nos logs do Nginx, PHP-FPM ou MySQL.
- [ ] O número de workers e a RAM do OurHistory permanecem dentro do baseline.
- [ ] Reload do Nginx não alterou o server block existente.
- [ ] O Cartopia responde sem bloquear o MySQL do OurHistory.
- [ ] O Nginx do Cartopia aponta para
      `/run/php/php8.4-fpm-cartopia.sock` e o OurHistory mantém seu socket.
- [ ] Artisan, Composer e Reverb foram executados explicitamente com PHP 8.4.
- [ ] Reverb e PostgreSQL estão limitados aos endereços esperados.

## Riscos do compartilhamento

- 1 vCPU pode causar contenção entre PHP-FPM, PostgreSQL, Reverb e OurHistory.
- Sem swap, picos de memória podem provocar OOM e derrubar processos.
- Instalação de PHP/extensões pode reiniciar ou recarregar serviços se o APT
  resolver pacotes compartilhados; usar simulação e confirmar o impacto antes.
- O PPA de PHP 8.4, se necessário, adiciona risco de cadeia de fornecimento e
  exige controle de origem, pinning e atualizações de segurança.
- Um erro no Nginx pode afetar os dois sites; sempre testar com `nginx -t`.
- O disco é compartilhado entre bancos, logs e releases.
- PostgreSQL e MySQL competirão por memória e I/O.
- A VPS é ponto único de falha; backups externos e rollback são obrigatórios.

## Informações ainda necessárias

- Domínio e DNS do Cartopia.
- Caminho real e usuário do OurHistory.
- Saída de `php8.3 -v`, status do `php8.3-fpm`, socket/pool e módulos instalados.
- Disponibilidade, origem aprovada e fingerprint da chave do repositório PHP 8.4
  para Jammy; sem isso a instalação deve permanecer bloqueada.
- Saída de `php8.4 -v` e lista final de módulos após a instalação paralela.
- Arquitetura da VPS e versão disponível de `postgresql-14`.
- Endereço/CIDR do proxy confiável e estratégia TLS.
- Usuário Unix e política de permissões desejados.
- Política de swap, backups e retenção de logs.
- Forma de entrega dos releases e janela autorizada para reload do PHP-FPM/Nginx.
- Capacidade de monitoramento e alertas do host.

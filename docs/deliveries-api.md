# API de entregas

As entregas usam um `public_id` UUID e um token secreto independente. O token é retornado somente na criação, armazenado apenas como hash SHA-256 e enviado nos endpoints de leitura pelo header `Authorization: Bearer <token>`.

O frontend pode guardar o token no fragmento do link de acompanhamento, por exemplo `/deliveries/{public_id}#token={token}`. Fragmentos não são enviados ao servidor como URL nem aparecem nos logs de requisição.

## Opções disponíveis

Origens e destinos aceitos inicialmente:

- `port-of-dreams`
- `garden-of-ideas`
- `library-of-memories`

O entregador inicial é `paper-swallow`. A duração deve estar entre 1 e 1440 minutos. Os horários são definidos pelo backend no momento da criação; a viagem começa imediatamente.

## Criar entrega

`POST /api/deliveries`

```json
{
  "message": "Uma surpresa chegou até você.",
  "sender_name": "Aventureiro",
  "recipient_name": "Pessoa querida",
  "origin": "port-of-dreams",
  "destination": "garden-of-ideas",
  "duration_minutes": 60
}
```

Resposta `201 Created`:

```json
{
  "data": {
    "public_id": "01234567-89ab-cdef-0123-456789abcdef",
    "sender_name": "Aventureiro",
    "recipient_name": "Pessoa querida",
    "origin": "port-of-dreams",
    "destination": "garden-of-ideas",
    "courier": "paper-swallow",
    "starts_at": "2026-10-21T12:00:00.000000Z",
    "arrives_at": "2026-10-21T13:00:00.000000Z",
    "status": "IN_TRANSIT",
    "progress": 0
  },
  "access_token": "token-retornado-apenas-na-criacao",
  "tracking_path": "/deliveries/01234567-89ab-cdef-0123-456789abcdef#token=token-retornado-apenas-na-criacao"
}
```

## Consultar acompanhamento

`GET /api/deliveries/{public_id}`

```bash
curl \
  -H "Authorization: Bearer $CARTOPIA_ACCESS_TOKEN" \
  http://localhost:8000/api/deliveries/{public_id}
```

O retorno contém `status` (`SCHEDULED`, `IN_TRANSIT` ou `DELIVERED`) e `progress` entre `0` e `100`, mas nunca contém a mensagem.

## Abrir mensagem

`GET /api/deliveries/{public_id}/message`

```bash
curl \
  -H "Authorization: Bearer $CARTOPIA_ACCESS_TOKEN" \
  http://localhost:8000/api/deliveries/{public_id}/message
```

Antes da chegada, a API retorna `403 Forbidden` com `error.code` igual a `DELIVERY_NOT_ARRIVED`. Após a chegada, retorna `200 OK` com a mensagem. Token ausente, inválido ou usado com outro UUID retorna `404 Not Found` sem revelar dados privados.

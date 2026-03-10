# uazapi-mcp v2.0.0

MCP Server completo para integração com a [API uazapi](https://uazapi.com) — WhatsApp.

> **Endpoints 100% reais** — extraídos diretamente do código-fonte do pacote oficial `n8n-nodes-uazapi v1.0.4` (npm).

## 45 ferramentas disponíveis

| Categoria | Tools | Endpoints reais |
|---|---|---|
| **Instâncias** | 8 | /instance/init, /instance/connect, /instance/status, /instance/disconnect, DELETE /instance, /instance/all, /instance/updateInstanceName, /instance/updatechatbotsettings |
| **Mensagens** | 4 | /send/text, /send/media, /send/contact, /send/location |
| **Ações em msg** | 5 | /message/react, /message/delete, /message/edit, /message/download, /message/markread |
| **Grupos** | 8 | /group/create, /group/info, /group/list, /group/updateParticipants, /group/updateName, /group/updateDescription, /group/leave, /group/invitelink/:jid |
| **Chats** | 8 | /chat/find, /chat/check, /chat/details, /chat/archive, /chat/delete, /chat/read, /chat/pin, /chat/mute |
| **Contatos** | 3 | GET /contacts, /contact/add, /contact/remove |
| **Etiquetas** | 1 | GET /labels |
| **Campanhas** | 5 | /sender/simple, /sender/listfolders, /sender/listmessages, /sender/edit, /sender/cleardone |
| **Agentes IA** | 3 | GET /agent/list, /agent/edit, GET /knowledge/list |

## Autenticação

A uazapi usa **query string** (não header):
```
?admintoken=SEU_ADMIN_TOKEN&token=SEU_INSTANCE_TOKEN
```

## Instalação

```bash
npm install
npm run build
```

## Configuração no Claude Code

Crie `.mcp.json` na raiz do projeto:

```json
{
  "mcpServers": {
    "uazapi": {
      "command": "node",
      "args": ["/caminho/para/uazapi-mcp/dist/index.js"],
      "env": {
        "UAZAPI_BASE_URL": "https://focus.uazapi.com",
        "UAZAPI_INSTANCE_TOKEN": "seu_instance_token",
        "UAZAPI_ADMIN_TOKEN": "seu_admin_token"
      }
    }
  }
}
```

## Observações

- Números sempre com DDI, sem `+` ou espaços: `5511999999999`
- Group JID formato: `120363308883996631@g.us`
- Message ID: obtido no webhook ao receber mensagens
- `chat_mark_read` e `chat_mute` convertem número para JID automaticamente
- `campaign_create_simple` converte números para JID automaticamente

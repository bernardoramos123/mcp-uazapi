#!/usr/bin/env node

/**
 * uazapi-mcp v2.0.0 — MCP Server para a API uazapi (WhatsApp)
 *
 * Endpoints extraídos diretamente do código-fonte oficial do node n8n da uazapi
 * (pacote npm n8n-nodes-uazapi v1.0.4, 44 endpoints reais).
 *
 * Auth: query string ?admintoken=xxx&token=xxx
 * Base URL padrão: https://focus.uazapi.com
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.UAZAPI_BASE_URL || "https://focus.uazapi.com").replace(/\/$/, "");
const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN || "";
const ADMIN_TOKEN    = process.env.UAZAPI_ADMIN_TOKEN    || "";

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function req(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<unknown> {
  const params = new URLSearchParams();
  if (ADMIN_TOKEN)    params.set("admintoken", ADMIN_TOKEN);
  if (INSTANCE_TOKEN) params.set("token", INSTANCE_TOKEN);

  const url = `${BASE_URL}${endpoint}?${params.toString()}`;

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  };
  if (body && method !== "GET") options.body = JSON.stringify(body);

  const res  = await fetch(url, options);
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`Erro ${res.status} em ${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

const ok = (d: unknown) => JSON.stringify(d, null, 2);

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "uazapi-mcp",
  version: "2.0.0",
  description: "MCP Server completo para a API uazapi — WhatsApp (44 endpoints reais)",
});

// ════════════════════════════════════════════════════════════════════════════
// INSTÂNCIAS
// ════════════════════════════════════════════════════════════════════════════

server.tool("instance_create",
  "Cria uma nova instância WhatsApp. [POST /instance/init]",
  { name: z.string().describe("Nome único da instância. Ex: minha-empresa") },
  async ({ name }) => ({ content: [{ type: "text", text: ok(await req("/instance/init", "POST", { name })) }] })
);

server.tool("instance_connect",
  "Conecta a instância ao WhatsApp, gerando QR Code ou código de pareamento. [POST /instance/connect]",
  { phone: z.string().optional().describe("Número com DDI para código de pareamento (ex: 5511999999999). Omitir para QR Code") },
  async ({ phone }) => {
    const body: Record<string, unknown> = {};
    if (phone) body.phone = phone;
    return { content: [{ type: "text", text: ok(await req("/instance/connect", "POST", body)) }] };
  }
);

server.tool("instance_status",
  "Verifica o status de conexão da instância atual. [GET /instance/status]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/instance/status", "GET")) }] })
);

server.tool("instance_disconnect",
  "Desconecta a instância do WhatsApp. [POST /instance/disconnect]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/instance/disconnect", "POST")) }] })
);

server.tool("instance_delete",
  "Deleta permanentemente a instância. [DELETE /instance]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/instance", "DELETE")) }] })
);

server.tool("instance_list_all",
  "Lista todas as instâncias da conta (requer ADMIN_TOKEN). [GET /instance/all]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/instance/all", "GET")) }] })
);

server.tool("instance_update_name",
  "Renomeia a instância atual. [POST /instance/updateInstanceName]",
  { name: z.string().describe("Novo nome para a instância") },
  async ({ name }) => ({ content: [{ type: "text", text: ok(await req("/instance/updateInstanceName", "POST", { name })) }] })
);

server.tool("instance_update_chatbot_settings",
  "Configura as definições do chatbot IA da instância. [POST /instance/updatechatbotsettings]",
  {
    chatbot_enabled: z.boolean().describe("Ativa (true) ou desativa (false) o chatbot"),
    openai_apikey:   z.string().optional().describe("Chave de API OpenAI (opcional)"),
  },
  async ({ chatbot_enabled, openai_apikey }) => {
    const body: Record<string, unknown> = { chatbot_enabled };
    if (openai_apikey) body.openai_apikey = openai_apikey;
    return { content: [{ type: "text", text: ok(await req("/instance/updatechatbotsettings", "POST", body)) }] };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// ENVIO DE MENSAGENS
// ════════════════════════════════════════════════════════════════════════════

server.tool("send_text",
  "Envia mensagem de texto. Suporta formatação WhatsApp: *negrito*, _itálico_, ~tachado~, `monoespaçado`. [POST /send/text]",
  {
    number: z.string().describe("Número do destinatário com DDI, sem + ou espaços. Ex: 5511999999999"),
    text:   z.string().describe("Conteúdo da mensagem (até 4096 caracteres)"),
  },
  async ({ number, text }) => ({ content: [{ type: "text", text: ok(await req("/send/text", "POST", { number, text })) }] })
);

server.tool("send_media",
  "Envia mídia para um número. Suporta: image, video, audio, document, ptt (áudio de voz), sticker. [POST /send/media]",
  {
    number:  z.string().describe("Número do destinatário. Ex: 5511999999999"),
    type:    z.enum(["image", "video", "audio", "document", "ptt", "sticker"]).describe("Tipo da mídia"),
    file:    z.string().describe("URL pública HTTPS do arquivo OU string base64 (data:image/png;base64,...)"),
    caption: z.string().optional().describe("Legenda (opcional, para image, video e document)"),
  },
  async ({ number, type, file, caption }) => {
    const body: Record<string, unknown> = { number, type, file };
    if (caption) body.caption = caption;
    return { content: [{ type: "text", text: ok(await req("/send/media", "POST", body)) }] };
  }
);

server.tool("send_contact",
  "Envia um cartão de contato (vCard). [POST /send/contact]",
  {
    number:      z.string().describe("Número do destinatário. Ex: 5511999999999"),
    fullName:    z.string().describe("Nome completo do contato a ser enviado"),
    phoneNumber: z.string().describe("Número(s) de telefone do contato. Para múltiplos, separe por vírgula"),
  },
  async ({ number, fullName, phoneNumber }) => ({ content: [{ type: "text", text: ok(await req("/send/contact", "POST", { number, fullName, phoneNumber })) }] })
);

server.tool("send_location",
  "Envia uma localização geográfica. [POST /send/location]",
  {
    number:    z.string().describe("Número do destinatário. Ex: 5511999999999"),
    name:      z.string().describe("Nome do local exibido no pin do mapa. Ex: Escritório Central"),
    address:   z.string().describe("Endereço completo do local"),
    latitude:  z.number().describe("Latitude. Ex: -23.5505"),
    longitude: z.number().describe("Longitude. Ex: -46.6333"),
  },
  async ({ number, name, address, latitude, longitude }) => ({ content: [{ type: "text", text: ok(await req("/send/location", "POST", { number, name, address, latitude, longitude })) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// AÇÕES EM MENSAGENS
// ════════════════════════════════════════════════════════════════════════════

server.tool("message_react",
  "Envia uma reação (emoji) a uma mensagem. [POST /message/react]",
  {
    number: z.string().describe("Número do chat. Ex: 5511999999999"),
    id:     z.string().describe("ID da mensagem (obtido no payload do webhook)"),
    text:   z.string().describe("Emoji da reação. Ex: 👍 ❤️ 😂 😮 😢 🙏"),
  },
  async ({ number, id, text }) => ({ content: [{ type: "text", text: ok(await req("/message/react", "POST", { number, id, text })) }] })
);

server.tool("message_delete",
  "Deleta uma mensagem para todos os participantes. [POST /message/delete]",
  { id: z.string().describe("ID da mensagem a ser deletada") },
  async ({ id }) => ({ content: [{ type: "text", text: ok(await req("/message/delete", "POST", { id })) }] })
);

server.tool("message_edit",
  "Edita o texto de uma mensagem já enviada. [POST /message/edit]",
  {
    id:   z.string().describe("ID da mensagem a ser editada"),
    text: z.string().describe("Novo conteúdo da mensagem"),
  },
  async ({ id, text }) => ({ content: [{ type: "text", text: ok(await req("/message/edit", "POST", { id, text })) }] })
);

server.tool("message_download",
  "Baixa o arquivo de mídia de uma mensagem recebida. [POST /message/download]",
  { id: z.string().describe("ID da mensagem contendo a mídia") },
  async ({ id }) => ({ content: [{ type: "text", text: ok(await req("/message/download", "POST", { id })) }] })
);

server.tool("message_mark_read",
  "Marca uma ou mais mensagens como lidas (dois tiques azuis). [POST /message/markread]",
  { ids: z.array(z.string()).describe("Array com ID(s) da(s) mensagem(ns). Ex: ['MSG_ID_1', 'MSG_ID_2']") },
  async ({ ids }) => ({ content: [{ type: "text", text: ok(await req("/message/markread", "POST", { id: ids })) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// GRUPOS
// ════════════════════════════════════════════════════════════════════════════

server.tool("group_create",
  "Cria um novo grupo WhatsApp. [POST /group/create]",
  {
    name:         z.string().describe("Nome do grupo"),
    participants: z.array(z.string()).min(1).describe("Números dos participantes com DDI. Ex: ['5511999999999']"),
  },
  async ({ name, participants }) => ({ content: [{ type: "text", text: ok(await req("/group/create", "POST", { name, participants })) }] })
);

server.tool("group_info",
  "Obtém informações detalhadas de um grupo (nome, descrição, participantes, admins). [POST /group/info]",
  { groupjid: z.string().describe("JID do grupo. Ex: 120363308883996631@g.us") },
  async ({ groupjid }) => ({ content: [{ type: "text", text: ok(await req("/group/info", "POST", { groupjid })) }] })
);

server.tool("group_list",
  "Lista todos os grupos da instância. [GET /group/list]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/group/list", "GET")) }] })
);

server.tool("group_update_participants",
  "Adiciona, remove, promove ou rebaixa participantes. [POST /group/updateParticipants]",
  {
    groupjid:     z.string().describe("JID do grupo. Ex: 120363308883996631@g.us"),
    action:       z.enum(["add", "remove", "promote", "demote"]).describe("add | remove | promote | demote"),
    participants: z.array(z.string()).describe("Números dos participantes com DDI. Ex: ['5511999999999']"),
  },
  async ({ groupjid, action, participants }) => ({ content: [{ type: "text", text: ok(await req("/group/updateParticipants", "POST", { groupjid, action, participants })) }] })
);

server.tool("group_update_name",
  "Atualiza o nome de um grupo. [POST /group/updateName]",
  {
    groupjid: z.string().describe("JID do grupo. Ex: 120363308883996631@g.us"),
    name:     z.string().describe("Novo nome do grupo"),
  },
  async ({ groupjid, name }) => ({ content: [{ type: "text", text: ok(await req("/group/updateName", "POST", { groupjid, name })) }] })
);

server.tool("group_update_description",
  "Atualiza a descrição de um grupo. [POST /group/updateDescription]",
  {
    groupjid:    z.string().describe("JID do grupo. Ex: 120363308883996631@g.us"),
    description: z.string().describe("Nova descrição do grupo"),
  },
  async ({ groupjid, description }) => ({ content: [{ type: "text", text: ok(await req("/group/updateDescription", "POST", { groupjid, description })) }] })
);

server.tool("group_leave",
  "Faz a instância sair de um grupo. [POST /group/leave]",
  { groupjid: z.string().describe("JID do grupo. Ex: 120363308883996631@g.us") },
  async ({ groupjid }) => ({ content: [{ type: "text", text: ok(await req("/group/leave", "POST", { groupjid })) }] })
);

server.tool("group_invite_link",
  "Obtém o link de convite de um grupo. [GET /group/invitelink/:groupJid]",
  { groupjid: z.string().describe("JID do grupo. Ex: 120363308883996631@g.us") },
  async ({ groupjid }) => ({ content: [{ type: "text", text: ok(await req(`/group/invitelink/${groupjid}`, "GET")) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// CHATS
// ════════════════════════════════════════════════════════════════════════════

server.tool("chat_find",
  "Busca e lista conversas com paginação. [POST /chat/find]",
  {
    limit:  z.number().int().min(1).max(100).optional().default(50).describe("Máx. de chats (padrão: 50)"),
    offset: z.number().int().min(0).optional().default(0).describe("Offset para paginação (padrão: 0)"),
    sort:   z.string().optional().default("-wa_lastMsgTimestamp").describe("Campo de ordenação (padrão: mais recentes primeiro)"),
  },
  async ({ limit, offset, sort }) => ({ content: [{ type: "text", text: ok(await req("/chat/find", "POST", { operator: "AND", sort, limit, offset })) }] })
);

server.tool("chat_check_number",
  "Verifica se um ou mais números possuem WhatsApp ativo. [POST /chat/check]",
  { numbers: z.array(z.string()).describe("Números com DDI. Ex: ['5511999999999', '5511888888888']") },
  async ({ numbers }) => ({ content: [{ type: "text", text: ok(await req("/chat/check", "POST", { numbers })) }] })
);

server.tool("chat_details",
  "Obtém detalhes de um contato/chat (foto de perfil, nome, bio). [POST /chat/details]",
  {
    number:  z.string().describe("Número com DDI. Ex: 5511999999999"),
    preview: z.boolean().optional().default(false).describe("true para versão resumida (padrão: false)"),
  },
  async ({ number, preview }) => ({ content: [{ type: "text", text: ok(await req("/chat/details", "POST", { number, preview })) }] })
);

server.tool("chat_archive",
  "Arquiva ou desarquiva uma conversa. [POST /chat/archive]",
  {
    number:  z.string().describe("Número do chat. Ex: 5511999999999"),
    archive: z.boolean().describe("true para arquivar, false para desarquivar"),
  },
  async ({ number, archive }) => ({ content: [{ type: "text", text: ok(await req("/chat/archive", "POST", { number, archive })) }] })
);

server.tool("chat_delete",
  "Deleta uma conversa da instância. [POST /chat/delete]",
  {
    number:              z.string().describe("Número do chat. Ex: 5511999999999"),
    deleteChatDB:        z.boolean().optional().default(true).describe("Deletar do banco local"),
    deleteMessagesDB:    z.boolean().optional().default(true).describe("Deletar mensagens do banco local"),
    deleteChatWhatsApp:  z.boolean().optional().default(true).describe("Deletar do WhatsApp"),
  },
  async ({ number, deleteChatDB, deleteMessagesDB, deleteChatWhatsApp }) => ({ content: [{ type: "text", text: ok(await req("/chat/delete", "POST", { number, deleteChatDB, deleteMessagesDB, deleteChatWhatsApp })) }] })
);

server.tool("chat_mark_read",
  "Marca todas as mensagens de um chat como lidas. [POST /chat/read]",
  { number: z.string().describe("Número do chat com DDI. Ex: 5511999999999") },
  async ({ number }) => {
    const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
    return { content: [{ type: "text", text: ok(await req("/chat/read", "POST", { number: jid, read: true })) }] };
  }
);

server.tool("chat_pin",
  "Fixa ou desfixa uma conversa. [POST /chat/pin]",
  {
    number: z.string().describe("Número do chat. Ex: 5511999999999"),
    pin:    z.boolean().describe("true para fixar, false para desfixar"),
  },
  async ({ number, pin }) => ({ content: [{ type: "text", text: ok(await req("/chat/pin", "POST", { number, pin })) }] })
);

server.tool("chat_mute",
  "Silencia ou ativa notificações de um chat. [POST /chat/mute]",
  {
    number:      z.string().describe("Número do chat com DDI. Ex: 5511999999999"),
    muteEndTime: z.number().describe("Duração: 0 = dessilenciar, 8 = 8h, 168 = 1 semana, -1 = permanente"),
  },
  async ({ number, muteEndTime }) => {
    const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
    return { content: [{ type: "text", text: ok(await req("/chat/mute", "POST", { number: jid, muteEndTime })) }] };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// CONTATOS
// ════════════════════════════════════════════════════════════════════════════

server.tool("contacts_list",
  "Lista todos os contatos da agenda do número conectado. [GET /contacts]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/contacts", "GET")) }] })
);

server.tool("contact_add",
  "Adiciona um novo contato à agenda. [POST /contact/add]",
  {
    phone: z.string().describe("Número do contato com DDI. Ex: 5511999999999"),
    name:  z.string().describe("Nome do contato"),
  },
  async ({ phone, name }) => ({ content: [{ type: "text", text: ok(await req("/contact/add", "POST", { phone, name })) }] })
);

server.tool("contact_remove",
  "Remove um contato da agenda. [POST /contact/remove]",
  { phone: z.string().describe("Número do contato a remover. Ex: 5511999999999") },
  async ({ phone }) => ({ content: [{ type: "text", text: ok(await req("/contact/remove", "POST", { phone })) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// ETIQUETAS
// ════════════════════════════════════════════════════════════════════════════

server.tool("labels_list",
  "Lista todas as etiquetas/tags da instância. [GET /labels]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/labels", "GET")) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// CAMPANHAS (SENDER)
// ════════════════════════════════════════════════════════════════════════════

server.tool("campaign_create_simple",
  "Cria uma campanha de disparo em massa simples. Números são convertidos para JID automaticamente. [POST /sender/simple]",
  {
    numbers:  z.array(z.string()).min(1).describe("Números destinatários com DDI. Ex: ['5511999999999']"),
    type:     z.enum(["text", "image", "video", "document"]).describe("Tipo da mensagem"),
    text:     z.string().describe("Texto da mensagem. Use {{variável}} para personalização"),
    delayMin: z.number().int().min(1).optional().default(10).describe("Delay mínimo em segundos entre envios (padrão: 10)"),
    delayMax: z.number().int().min(1).optional().default(30).describe("Delay máximo em segundos entre envios (padrão: 30)"),
  },
  async ({ numbers, type, text, delayMin, delayMax }) => {
    const numbersJid = numbers.map(n => n.includes("@") ? n : `${n}@s.whatsapp.net`);
    return { content: [{ type: "text", text: ok(await req("/sender/simple", "POST", { numbers: numbersJid, type, text, delayMin, delayMax })) }] };
  }
);

server.tool("campaign_list",
  "Lista todas as campanhas (pastas de envio) da instância. [GET /sender/listfolders]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/sender/listfolders", "GET")) }] })
);

server.tool("campaign_list_messages",
  "Lista as mensagens de uma campanha específica com paginação. [POST /sender/listmessages]",
  {
    folder_id: z.string().describe("ID da pasta/campanha"),
    page:      z.number().int().min(1).optional().default(1).describe("Número da página (padrão: 1)"),
    pageSize:  z.number().int().min(1).max(100).optional().default(50).describe("Itens por página (padrão: 50)"),
  },
  async ({ folder_id, page, pageSize }) => ({ content: [{ type: "text", text: ok(await req("/sender/listmessages", "POST", { folder_id, page, pageSize })) }] })
);

server.tool("campaign_control",
  "Controla o estado de uma campanha: parar, continuar ou deletar. [POST /sender/edit]",
  {
    folder_id: z.string().describe("ID da pasta/campanha"),
    action:    z.enum(["stop", "continue", "delete"]).describe("stop | continue | delete"),
  },
  async ({ folder_id, action }) => ({ content: [{ type: "text", text: ok(await req("/sender/edit", "POST", { folder_id, action })) }] })
);

server.tool("campaign_clear_done",
  "Limpa mensagens enviadas antigas de campanhas. [POST /sender/cleardone]",
  { hours: z.number().int().min(1).optional().default(168).describe("Remove mensagens enviadas há mais de X horas (padrão: 168 = 1 semana)") },
  async ({ hours }) => ({ content: [{ type: "text", text: ok(await req("/sender/cleardone", "POST", { hours })) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// AGENTES DE IA
// ════════════════════════════════════════════════════════════════════════════

server.tool("agent_list",
  "Lista todos os agentes de IA configurados. [GET /agent/list]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/agent/list", "GET")) }] })
);

server.tool("agent_create_or_edit",
  "Cria ou edita um agente de IA. Para criar: deixe id vazio. Para deletar: delete=true. [POST /agent/edit]",
  {
    id:           z.string().optional().default("").describe("ID do agente para editar/deletar. Vazio para criar novo"),
    delete:       z.boolean().optional().default(false).describe("true para deletar o agente"),
    name:         z.string().describe("Nome do agente"),
    provider:     z.enum(["openai", "anthropic", "gemini", "deepseek"]).describe("Provedor: openai | anthropic (Claude) | gemini | deepseek"),
    model:        z.string().describe("Modelo. Ex: gpt-4o-mini, claude-3-5-sonnet, gemini-pro, deepseek-chat"),
    systemPrompt: z.string().optional().default("").describe("Prompt de sistema que define o comportamento do agente"),
    maxTokens:    z.number().int().min(100).max(8000).optional().default(2000).describe("Máx. de tokens na resposta (padrão: 2000)"),
    temperature:  z.number().min(0).max(100).optional().default(70).describe("Temperatura de 0 a 100 (padrão: 70)"),
  },
  async ({ id, delete: del, name, provider, model, systemPrompt, maxTokens, temperature }) => ({
    content: [{ type: "text", text: ok(await req("/agent/edit", "POST", {
      id: id || "",
      delete: del,
      agent: { name, provider, model, systemPrompt, maxTokens, temperature },
    })) }]
  })
);

server.tool("knowledge_list",
  "Lista as bases de conhecimento do chatbot. [GET /knowledge/list]",
  {},
  async () => ({ content: [{ type: "text", text: ok(await req("/knowledge/list", "GET")) }] })
);

// ════════════════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`✅ uazapi-mcp v2.0.0 iniciado`);
  console.error(`   Base URL:       ${BASE_URL}`);
  console.error(`   INSTANCE_TOKEN: ${INSTANCE_TOKEN ? "✓ configurado" : "✗ não configurado"}`);
  console.error(`   ADMIN_TOKEN:    ${ADMIN_TOKEN    ? "✓ configurado" : "✗ não configurado"}`);
}

main().catch((err) => {
  console.error("❌ Erro ao iniciar:", err);
  process.exit(1);
});

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BASE_URL = "https://discord.com/api/v10";

const headers = {
  Authorization: `Bot ${DISCORD_TOKEN}`,
  "Content-Type": "application/json",
};

const server = new McpServer({ name: "discord-mcp", version: "1.0.0" });

server.tool(
  "list-channels",
  "Lists all channels in a Discord server (guild). Returns each channel's name and ID. Use the returned channel IDs with other tools like read-messages or send-message.",
  {
    guild_id: z.string().describe("The Discord server (guild) ID, found by right-clicking a server icon with Developer Mode enabled"),
  },
  async ({ guild_id }) => {
    const res = await fetch(`${BASE_URL}/guilds/${guild_id}/channels`, { headers });
    const data = await res.json();
    const channels = data.map(c => `${c.name} (${c.id})`).join("\n");
    return { content: [{ type: "text", text: channels }] };
  }
);

server.tool(
  "read-messages",
  "Reads recent messages from a Discord channel, including embed content. Returns messages in reverse chronological order (newest first).",
  {
    channel_id: z.string().describe("The Discord channel ID (NOT the server/guild ID) to read messages from"),
    limit: z.number().optional().describe("Number of messages to fetch, 1-100. Defaults to 10."),
  },
  async ({ channel_id, limit = 10 }) => {
    const res = await fetch(`${BASE_URL}/channels/${channel_id}/messages?limit=${limit}`, { headers });
    const data = await res.json();
    const messages = data.map(m => {
      let text = `[${m.id}] ${m.author.username}: ${m.content || "(no text)"}`;
      if (m.embeds && m.embeds.length > 0) {
        const embedSummary = m.embeds.map(e => {
          const parts = [];
          if (e.title) parts.push(`Title: ${e.title}`);
          if (e.description) parts.push(`Description: ${e.description}`);
          if (e.fields) parts.push(...e.fields.map(f => `${f.name}: ${f.value}`));
          return `[EMBED] ${parts.join(" | ")}`;
        }).join(" ");
        text += `\n  ${embedSummary}`;
      }
      return text;
    }).join("\n");
    return { content: [{ type: "text", text: messages }] };
  }
);

server.tool(
  "delete-message",
  "Permanently deletes a specific message from a Discord channel. Requires the Manage Messages permission. This action cannot be undone.",
  {
    channel_id: z.string().describe("The Discord channel ID where the target message lives"),
    message_id: z.string().describe("The ID of the specific message to delete (use read-messages first to find it)"),
  },
  async ({ channel_id, message_id }) => {
    const res = await fetch(
      `${BASE_URL}/channels/${channel_id}/messages/${message_id}`,
      { method: "DELETE", headers }
    );
    if (res.status === 204) {
      return { content: [{ type: "text", text: `Message ${message_id} deleted.` }] };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: `Delete failed: ${JSON.stringify(data)}` }] };
  }
);


server.tool(
  "send-message",
  "Sends a plain text message to a Discord channel. For YouTube/Twitter/other links, just include the URL in the content and Discord will auto-generate a rich preview. Use real newlines for line breaks, not the characters backslash-n.",
  {
    channel_id: z.string().describe("The Discord channel ID to send the message to"),
    content: z.string(),
  },
  async ({ channel_id, content }) => {
    const res = await fetch(`${BASE_URL}/channels/${channel_id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    return { content: [{ type: "text", text: `Message sent! ID: ${data.id}` }] };
  }
);

server.tool(
  "send-embed",
  "Sends a rich embed (formatted card with colored sidebar) to a Discord channel. Use real newlines for line breaks, not the characters backslash-n.",
  {
    channel_id: z.string().describe("The Discord channel ID to send the embed to"),
    title: z.string(),
    description: z.string(),
    color: z.number().optional().describe("Sidebar color as a DECIMAL integer (not hex). Examples: red=16711680, green=65280, blue=255, purple=10181046, gold=15844367."),
    url: z.string().optional().describe("Makes the title clickable, linking to this URL"),
    thumbnail_url: z.string().optional().describe("URL of a small image shown in the top-right corner of the embed"),
    fields: z.array(z.object({
      name: z.string(),
      value: z.string(),
      inline: z.boolean().optional().describe("If true, displays fields side-by-side in columns instead of stacked"),
    })).optional().describe("Key-value sections shown below the description"),
  },
  async ({ channel_id, title, description, color, url, thumbnail_url, fields }) => {
    const embed = { title, description };
    if (color !== undefined) embed.color = color;
    if (url) embed.url = url;
    if (thumbnail_url) embed.thumbnail = { url: thumbnail_url };
    if (fields) embed.fields = fields;

    const res = await fetch(`${BASE_URL}/channels/${channel_id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ embeds: [embed] }),
    });
    const data = await res.json();
    return { content: [{ type: "text", text: `Embed sent! ID: ${data.id}` }] };
  }
);

server.tool(
  "search-messages",
  "Searches recent messages in a Discord channel for a keyword or phrase (case-insensitive). Only searches the most recent messages due to Discord API limitations.",
  {
    channel_id: z.string().describe("The Discord channel ID to search within"),
    query: z.string(),
    limit: z.number().optional().describe("How many recent messages to search through, 1-100. Defaults to 100."),
  },
  async ({ channel_id, query, limit = 100 }) => {
    const res = await fetch(`${BASE_URL}/channels/${channel_id}/messages?limit=${limit}`, { headers });
    const data = await res.json();
    const q = query.toLowerCase();
    const matches = data.filter(m => m.content.toLowerCase().includes(q));
    if (matches.length === 0) {
      return { content: [{ type: "text", text: `No messages found matching "${query}"` }] };
    }
    const output = matches.map(m => `${m.author.username}: ${m.content}`).join("\n");
    return { content: [{ type: "text", text: `Found ${matches.length} matches:\n${output}` }] };
  }
);

server.tool(
  "react-to-message",
  "Adds an emoji reaction to a specific Discord message.",
  {
    channel_id: z.string().describe("The Discord channel ID where the target message lives"),
    message_id: z.string().describe("The ID of the specific message to react to (use read-messages first to find it)"),
    emoji: z.string().describe("A Unicode emoji character like 🔥, 👀, or ✅. Do NOT use text shortcodes like ':fire:'."),
  },
  async ({ channel_id, message_id, emoji }) => {
    const encodedEmoji = encodeURIComponent(emoji);
    const res = await fetch(
      `${BASE_URL}/channels/${channel_id}/messages/${message_id}/reactions/${encodedEmoji}/@me`,
      { method: "PUT", headers }
    );
    if (res.status === 204) {
      return { content: [{ type: "text", text: `Reacted with ${emoji}` }] };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: `Reaction failed: ${JSON.stringify(data)}` }] };
  }
);

server.tool(
  "send-file",
  "Sends a file attachment (image, PDF, small video, etc.) to a Discord channel by downloading it from a URL first. Discord has an 8 MB upload limit for bots on free servers. For YouTube videos, use send-message with the URL instead — Discord auto-generates a preview.",
  {
    channel_id: z.string().describe("The Discord channel ID to send the file to"),
    file_url: z.string().describe("A publicly accessible URL to fetch the file from"),
    filename: z.string().describe("What to name the file in Discord, including extension (e.g. 'screenshot.png')"),
    message: z.string().optional().describe("Optional text content to send alongside the file attachment"),
  },
  async ({ channel_id, file_url, filename, message }) => {
    const fileRes = await fetch(file_url);
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

    const form = new FormData();
    const payload = { content: message || "" };
    form.append("payload_json", JSON.stringify(payload));
    form.append("files[0]", new Blob([fileBuffer]), filename);

    const res = await fetch(`${BASE_URL}/channels/${channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
      body: form,
    });
    const data = await res.json();
    return { content: [{ type: "text", text: `File sent! ID: ${data.id}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
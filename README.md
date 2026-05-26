# discord-mcp

MCP server exposing 8 Discord bot operations as tools for LLM clients (Claude Desktop, etc.). Built directly against the Discord REST API v10 — no `discord.js` dependency.

## Discord bot setup

1. **Create the application.** Go to https://discord.com/developers/applications and click **New Application**.
2. **Add a bot.** In the sidebar, open **Bot** → click **Add Bot**. Under **Token**, click **Reset Token** and copy the value into your `.env` as `DISCORD_TOKEN` (or pass it via your MCP client config — see below).
3. **Enable the Message Content intent.** Still on the **Bot** page, scroll to **Privileged Gateway Intents** and turn on **MESSAGE CONTENT INTENT**. This is required — without it, `read-messages` and `search-messages` will return empty content fields.
4. **Invite the bot to your server.** Open **OAuth2** → **URL Generator**:
   - **Scopes:** check `bot`
   - **Bot Permissions:** check the following:
     - **View Channels** — required for every tool
     - **Send Messages** — for `send-message`, `send-embed`, `send-file`
     - **Manage Messages** — for `delete-message`
     - **Add Reactions** — for `react-to-message`
     - **Attach Files** — for `send-file`
   - Copy the generated URL at the bottom, open it in a browser, and invite the bot to your server.
5. **Find IDs.** In Discord, enable **User Settings** → **Advanced** → **Developer Mode**. You can now right-click any server, channel, or message to **Copy ID**.

## Configure your MCP client

Point your MCP client at `index.js` and pass the bot token via the `env` block. Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["C:/absolute/path/to/discord-mcp/index.js"],
      "env": {
        "DISCORD_TOKEN": "your-bot-token-here"
      }
    }
  }
}
```

The token can also live in a local `.env` file (see `.env.example`); `dotenv` loads it at startup. If both are present, the MCP client's `env` block wins. Restart Claude Desktop after editing the config.

> Install instructions via `npm install` from a published package will be added once this is on npm. For now, clone the repo and install dependencies locally before pointing your client at it.

## Tools

| Tool | What it does |
|---|---|
| `list-channels` | Lists every channel in a server (guild) with names and IDs. |
| `read-messages` | Reads recent messages from a channel, including embed content. Newest first. |
| `delete-message` | Permanently deletes a specific message. Requires Manage Messages. |
| `send-message` | Sends a plain text message. Discord auto-previews URLs. |
| `send-embed` | Sends a rich embed (title, description, color sidebar, optional URL/thumbnail/fields). |
| `search-messages` | Case-insensitive keyword search over recent messages in a channel. |
| `react-to-message` | Adds a Unicode emoji reaction to a specific message. |
| `send-file` | Downloads a file from a URL and uploads it as a Discord attachment. |

## Per-tool usage examples

Each example shows what an LLM (e.g. Claude) might be prompted, and which tool it would call. IDs are placeholders — substitute real ones.

- **`list-channels`** — *"What channels are in my server with ID 123456789012345678?"*
- **`read-messages`** — *"Show me the last 20 messages in channel 987654321098765432."*
- **`delete-message`** — *"Delete message 111111111111111111 from channel 987654321098765432."*
- **`send-message`** — *"Post 'Standup in 5 minutes!' to channel 987654321098765432."*
- **`send-embed`** — *"Send a green embed titled 'Deploy succeeded' with description 'v1.4.2 is live' to channel 987654321098765432."*
- **`search-messages`** — *"Find any messages mentioning 'incident' in channel 987654321098765432."*
- **`react-to-message`** — *"React with a fire emoji to message 111111111111111111 in channel 987654321098765432."*
- **`send-file`** — *"Send the image at https://example.com/diagram.png to channel 987654321098765432 with caption 'Architecture sketch'."*

## Notes & limitations

- **`search-messages` is client-side.** Discord's REST API has no message-search endpoint for bots, so this tool fetches the most recent messages (up to 100) and filters locally. It will not find older matches.
- **`send-file` respects Discord's 8 MB free-tier upload limit.** Boosted servers have higher limits; this server doesn't currently check the tier.
- **No rate-limit handling.** Rapid successive calls can hit Discord's 429 responses. If you see failures during heavy use, slow down or retry.
- **`react-to-message` requires real Unicode emoji**, not shortcodes like `:fire:`. Custom server emojis aren't supported.

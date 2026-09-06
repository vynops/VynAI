

# VynAI

**Self-hosted Ollama fleet manager and OpenAI-compatible API gateway.**

Deploy, manage, and monitor multiple Ollama servers from a single dashboard. Route inference traffic through a secure, authenticated gateway with per-key rate limiting, token tracking, and full request logging — all without touching a cloud API.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=nodedotjs)](https://nodejs.org)
[![GitHub](https://img.shields.io/badge/GitHub-vynops%2FVynAI-181717?logo=github)](https://github.com/vynops/VynAI)
[![Part of VynOps Suite](https://img.shields.io/badge/VynOps-Suite-06b6d4)](https://github.com/vynops)

---

## What is VynAI?

VynAI is a lightweight operations layer on top of [Ollama](https://ollama.com). You point it at one or more Ollama servers and it gives you:

- A **unified dashboard** showing every server, model, GPU, and VRAM state in real time
- An **OpenAI-compatible gateway** so any existing OpenAI client works with your local models without code changes
- **API key management** with per-key rate limits, allowed model scoping, and token usage tracking
- **Request logs** with latency, model, status, and error details for every gateway call
- **Multi-user access** with role-based controls (admin / viewer)

No cloud dependency. No per-token cost. Your hardware, your models, your data.

---

## Screenshots

| Sign In | Fleet Overview |
| --- | --- |
| [<img src="screenshots/Screenshot%202026-09-01%20131934.png" alt="VynAI sign-in screen" width="100%">](screenshots/Screenshot%202026-09-01%20131934.png) | [<img src="screenshots/Screenshot%202026-09-01%20132034.png" alt="Fleet overview dashboard" width="100%">](screenshots/Screenshot%202026-09-01%20132034.png) |
| Server Fleet | Fleet Analytics |
| [<img src="screenshots/Screenshot%202026-09-01%20132105.png" alt="Ollama server fleet management" width="100%">](screenshots/Screenshot%202026-09-01%20132105.png) | [<img src="screenshots/Screenshot%202026-09-01%20132440.png" alt="Model inventory analytics" width="100%">](screenshots/Screenshot%202026-09-01%20132440.png) |
| Model Storage Analysis | Model Inventory |
| [<img src="screenshots/Screenshot%202026-09-01%20132509.png" alt="Model size and server snapshot analytics" width="100%">](screenshots/Screenshot%202026-09-01%20132509.png) | [<img src="screenshots/Screenshot%202026-09-01%20132538.png" alt="Ollama model inventory" width="100%">](screenshots/Screenshot%202026-09-01%20132538.png) |
| OpenAI-Compatible Gateway | Token Analytics and Request Logs |
| [<img src="screenshots/Screenshot%202026-09-01%20132619.png" alt="OpenAI-compatible API gateway and API keys" width="100%">](screenshots/Screenshot%202026-09-01%20132619.png) | [<img src="screenshots/Screenshot%202026-09-01%20132646.png" alt="Gateway request logs and token metrics" width="100%">](screenshots/Screenshot%202026-09-01%20132646.png) |
| User Roles | Alert and Notification Settings |
| [<img src="screenshots/Screenshot%202026-09-01%20132707.png" alt="User and role management" width="100%">](screenshots/Screenshot%202026-09-01%20132707.png) | [<img src="screenshots/Screenshot%202026-09-01%20132759.png" alt="Alert thresholds and notification channels" width="100%">](screenshots/Screenshot%202026-09-01%20132759.png) |
| Gateway Limits and Retention | |
| [<img src="screenshots/Screenshot%202026-09-01%20132823.png" alt="Gateway rate limits and data retention settings" width="100%">](screenshots/Screenshot%202026-09-01%20132823.png) | |

---

## Features

### Fleet Management
- Add unlimited Ollama servers via UI or API
- Real-time health polling: online status, API latency, Ollama version
- Per-server model inventory with disk size and load state
- Remote model pull — trigger ollama pull on any server from the dashboard
- SSH terminal access to any registered server from the browser

### GPU Monitoring
- Live VRAM usage per GPU with sparkline history
- GPU utilisation %, temperature, and power draw via 
vidia-smi over SSH
- Multi-GPU servers with per-card breakdown
- Configurable alert thresholds for temperature and VRAM saturation

### Model Management
- Aggregated model library across the entire fleet
- Search and filter by category: General, Code, Embedding, Vision
- Model size distribution chart (top 20 by disk usage)
- Pull any Ollama registry model to any server directly from the UI

### OpenAI-Compatible Gateway
- Drop-in replacement for the OpenAI API — works with any OpenAI SDK, LangChain, LlamaIndex, and similar clients
- Round-robin load balancing across online servers
- Automatic failover — skips offline servers transparently
- `GET /api/v1/models` — lists all available models in OpenAI format
- `POST /api/v1/chat/completions` — proxies chat completions to Ollama with streaming support

### API Key Management
- Create, revoke, and delete API keys
- Per-key rate limits (requests per minute)
- Per-key model restrictions — scope a key to specific models only
- Token usage tracking: prompt tokens, completion tokens, total — per key and per model
- Reveal full key on demand (eye toggle) with copy button

### Request Logs
- Every gateway request logged: timestamp, key name, model, tokens in/out, latency, HTTP status, error
- Filter by key, model, or status (success / errors only)
- Live summary stats: total requests, total tokens, average latency, error count
- Stores up to 10,000 entries in `data/request-logs.json`

### Analytics
- Fleet-level summary: total models, loaded count, total disk usage, VRAM in use
- Model inventory by category with count and storage breakdown
- VRAM usage chart by currently loaded model
- Top 20 models by disk size
- Per-server snapshot: models, loaded count, latency, VRAM, version

### Multi-User Access
- Create users with name, email, password, and role
- Roles: `admin` (full access) and `viewer` (read-only dashboard)
- Activate / deactivate users without deleting them
- Last login tracking
- Passwords stored as scrypt hashes — no plaintext storage

### Settings
- Change password from the Settings page
- Configurable GPU temperature and VRAM alert thresholds
- Slack webhook for server-down and rate limit alerts
- Default Ollama server URL (auto-registered on first start)
- Request log retention period
- Global gateway rate limits (RPM and TPM)

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- At least one server running [Ollama](https://ollama.ai)

```bash
# Install Ollama on your inference server
curl -fsSL https://ollama.com/install.sh | sh
ollama serve   # starts on http://localhost:11434

ollama pull llama3.2
```

### Install

```bash
git clone https://github.com/vynops/VynAI
cd VynAI
cp .env.local.example .env.local
npm install
```

### Configure

Edit `.env.local`:

```env
# Required
VYNAI_SECRET=<run: openssl rand -base64 32>
VYNAI_ADMIN_EMAIL=admin@example.com
VYNAI_ADMIN_PASSWORD=your-secure-password

# Optional
DEFAULT_OLLAMA_URL=http://localhost:11434
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Start

```bash
npm run dev
# Dashboard:        http://localhost:3010
# Gateway endpoint: http://localhost:3010/api/v1
```

Log in with your `VYNAI_ADMIN_EMAIL` and `VYNAI_ADMIN_PASSWORD`. On first login, credentials are migrated to an scrypt-hashed user record. You can then change your password from **Settings**.

---

## Using the Gateway

Replace `YOUR_MODEL_NAME` with a model returned by `GET /api/v1/models`.

### PowerShell (Windows)

```powershell
$key = "sk-vynai-YOUR_KEY"
$model = "YOUR_MODEL_NAME"
$body = @{
    model    = $model
    messages = @(@{ role = "user"; content = "YOUR_PROMPT" })
    stream   = $false
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3010/api/v1/chat/completions" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $key" } `
    -Body $body
```

> Use `Invoke-RestMethod` — the `curl` alias in PowerShell maps to `Invoke-WebRequest` and does not support `-H` flags.

### curl (Linux / macOS)

```bash
curl -X POST http://localhost:3010/api/v1/chat/completions \
  -H "Authorization: Bearer sk-vynai-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"YOUR_MODEL_NAME","messages":[{"role":"user","content":"YOUR_PROMPT"}],"stream":false}'
```

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3010/api/v1",
    api_key="sk-vynai-YOUR_KEY"
)

response = client.chat.completions.create(
    model="YOUR_MODEL_NAME",
    messages=[{"role": "user", "content": "YOUR_PROMPT"}]
)
print(response.choices[0].message.content)
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VYNAI_SECRET` | 32-byte random secret for JWT session signing | **Yes** |
| `VYNAI_ADMIN_EMAIL` | Initial admin email | **Yes** |
| `VYNAI_ADMIN_PASSWORD` | Initial admin password (hashed to scrypt on first login) | **Yes** |
| `VYNAI_SECURE_COOKIE` | Set `true` in production (HTTPS) to mark session cookie Secure | No |
| `DEFAULT_OLLAMA_URL` | Ollama server URL to auto-register on first startup | No |
| `GROQ_API_KEY` | Groq API key for AI-assisted usage summaries | No |
| `SLACK_WEBHOOK_URL` | Slack webhook for server-down and saturation alerts | No |

---

## Data Storage

VynAI stores all state as JSON files in `data/`. No database required.

| File | Contents |
|---|---|
| `data/servers.json` | Registered Ollama server list |
| `data/keys.json` | API keys with usage stats and per-model token counts |
| `data/users.json` | User accounts with scrypt-hashed passwords |
| `data/settings.json` | App-level configuration |
| `data/request-logs.json` | Gateway request log (last 10,000 entries) |

> Add `data/` to `.gitignore` to prevent committing credentials or usage data.

---

## Production Deployment

### PM2

```bash
npm run build
pm2 start npm --name vynai -- start
pm2 save
```

### Nginx (reverse proxy + streaming)

```nginx
server {
    listen 443 ssl;
    server_name ai.example.com;

    location / {
        proxy_pass         http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering    off;       # required for SSE streaming
        proxy_read_timeout 300s;
    }
}
```

> Set `VYNAI_SECURE_COOKIE=true` when running behind HTTPS.

---

## Supported Models

Any model in the [Ollama library](https://ollama.com/library) works with VynAI.

| Category | Examples |
|---|---|
| **General** | `llama3.2`, `llama3.1:70b`, `mistral`, `gemma3`, `qwen2.5` |
| **Code** | `codestral`, `deepseek-coder-v2`, `qwen2.5-coder`, `codellama` |
| **Embedding** | `nomic-embed-text`, `mxbai-embed-large`, `bge-m3`, `all-minilm` |
| **Vision** | `llava`, `moondream`, `llama3.2-vision`, `gemma4` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Data fetching | SWR |
| Auth | jose (JWT) + scrypt password hashing |
| SSH | ssh2 |
| Storage | JSON file store (`data/`) — no database |

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── overview/         # Fleet health summary
│   │   ├── servers/          # Server management + GPU monitoring
│   │   ├── models/           # Model inventory
│   │   ├── gateway/          # API key management
│   │   ├── logs/             # Request log table
│   │   ├── analytics/        # Charts and fleet analytics
│   │   ├── users/            # User management (admin only)
│   │   └── settings/         # App settings + change password
│   ├── api/
│   │   ├── v1/               # OpenAI-compatible gateway
│   │   ├── servers/          # Server CRUD + SSH + GPU
│   │   ├── keys/             # API key CRUD + reveal
│   │   ├── logs/             # Request log API
│   │   ├── users/            # User management API
│   │   ├── auth/             # Login, logout, me, change-password
│   │   └── overview/         # Fleet stats
│   └── login/
├── components/
│   ├── layout/               # Sidebar, Header, DashboardLayout
│   ├── charts/               # VramBarChart, ModelSizesChart, Sparkline
│   └── modals/               # AddServer, PullModel, ConfigureSSH
└── lib/
    ├── auth.ts               # JWT session helpers
    ├── key-store.ts          # API keys + token tracking
    ├── user-store.ts         # Users + scrypt auth
    ├── request-log-store.ts  # Gateway request log
    ├── server-store.ts       # Ollama server registry
    ├── settings-store.ts     # App settings
    ├── rate-limiter.ts       # In-memory RPM rate limiting
    ├── ollama.ts             # Ollama API client
    └── ssh.ts                # SSH + GPU metrics
```

---

## API Reference

### Authentication

Gateway endpoints — Bearer token required:
```
Authorization: Bearer sk-vynai-<your-key>
```

Dashboard endpoints — `vynai_session` cookie required.

### Gateway

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/models` | List models (OpenAI format) |
| `POST` | `/api/v1/chat/completions` | Chat completions, streaming supported |

### Management

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/servers` | List / register servers |
| `GET` | `/api/servers/:id/status` | Live server status |
| `GET` | `/api/servers/:id/gpu` | GPU metrics via SSH |
| `POST` | `/api/servers/:id/pull` | Pull a model |
| `GET` | `/api/models` | Aggregated model list |
| `GET/POST` | `/api/keys` | List / create API keys |
| `GET` | `/api/keys/:id` | Reveal full key |
| `PATCH/DELETE` | `/api/keys/:id` | Revoke / delete key |
| `GET` | `/api/logs` | Last 500 request logs |
| `GET/POST` | `/api/users` | List / create users |
| `PATCH/DELETE` | `/api/users/:id` | Update / delete user |
| `POST` | `/api/auth/login` | Create session |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/change-password` | Change own password |
| `GET` | `/api/overview` | Fleet summary stats |

---

## Contributing

Open an issue before submitting a large PR.

```bash
git clone https://github.com/YOUR_USERNAME/VynAI
cd VynAI && npm install
git checkout -b feat/my-feature
npm run dev
```

## Part of the VynOps Suite

| Product | Purpose | Repo |
|---|---|---|
| **VynOps** | Kubernetes operations platform | [vynops/VynOps](https://github.com/vynops/VynOps) |
| **VynAI** | Ollama fleet manager and AI gateway | [vynops/VynAI](https://github.com/vynops/VynAI) |
| **VynCost** | Cloud cost visibility | [vynops/VynCost](https://github.com/vynops/VynCost) |
| **VynDB** | Database operations | [vynops/VynDB](https://github.com/vynops/VynDB) |
| **VynDC** | Data center management | [vynops/VynDC](https://github.com/vynops/VynDC) |
| **VynCICD** | CI/CD pipeline management | [vynops/VynCICD](https://github.com/vynops/VynCICD) |
| **VynHana** | SAP HANA Database management | [vynops/VynHana](https://github.com/vynops/VynHana) |
| **VynSAP** | SAP ERP management | [vynops/VynSAP](https://github.com/vynops/VynSAP) |


---

## License

MIT — see [LICENSE](LICENSE)

---


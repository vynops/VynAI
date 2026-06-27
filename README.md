# VynAI

**Ollama Fleet Management Dashboard** — deploy, manage, and monitor Ollama LLM server fleets with intelligent routing, GPU monitoring, and a self-hosted OpenAI-compatible API gateway.

> Part of the [VynOps](https://github.com/vynops) open-source platform engineering suite.

---

## Features

- **Fleet management** — Register and manage multiple Ollama servers from one dashboard
- **Real-time GPU metrics** — VRAM usage, temperature, utilisation, power draw via SSH
- **VRAM history sparklines** — rolling 12-minute in-memory trend per GPU
- **Model inventory** — Browse all models across servers, filter by category (general, code, embedding, vision)
- **Live model sessions** — See which models are currently loaded and how much VRAM they consume
- **SSH terminal** — Run commands on Ollama servers directly from the dashboard (`ollama ps`, `nvidia-smi`, etc.)
- **API Gateway** — Create and manage API keys; OpenAI-compatible endpoint for your Ollama fleet
- **Pull models** — Trigger model pulls to any registered server from the UI
- **Auth** — Single-admin login with JWT session cookies

---

## Tech Stack

- [Next.js 15](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Recharts](https://recharts.org) for GPU analytics charts
- [ssh2](https://github.com/mscdex/ssh2) for server metrics and terminal
- [SWR](https://swr.vercel.app) for real-time polling
- [jose](https://github.com/panva/jose) for JWT session auth

---

## Quick Start

### Prerequisites

- Node.js 18+
- At least one server running [Ollama](https://ollama.com) with network access enabled

### 1. Clone and install

```bash
git clone https://github.com/vynops/VynAI
cd VynAI
npm install
```

### 2. Configure

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Required — generate with: openssl rand -base64 32
VYNAI_SECRET=your-random-secret-here

# Admin login credentials
VYNAI_ADMIN_EMAIL=admin@example.com
VYNAI_ADMIN_PASSWORD=your-password
```

### 3. Start

```bash
npm run dev
# Dashboard: http://localhost:3000
```

### 4. Register your Ollama server

Go to **Servers → Add Server** and enter your Ollama URL (e.g. `http://192.168.1.10:11434`).

To enable GPU metrics, click the **terminal icon** on the server card and enter SSH credentials.

---

## Enabling Ollama for network access

By default Ollama only listens on `localhost`. To allow VynAI to reach it:

```bash
# systemd (Linux)
sudo systemctl edit ollama
# Add under [Service]:
# Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama
```

See the **Setup Guide** at `/setup` in the dashboard for full instructions.

---

## OpenAI-Compatible Gateway

Point any OpenAI SDK at VynAI:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="sk-vynai-..."   # create in Gateway page
)

response = client.chat.completions.create(
    model="llama3.2",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

Works with LangChain, LlamaIndex, and any OpenAI-compatible client.

---

## Data Storage

VynAI stores all runtime data locally in the `data/` directory:

| File | Contents |
|---|---|
| `data/servers.json` | Registered server URLs and SSH credentials |
| `data/keys.json` | API keys |
| `data/settings.json` | Dashboard configuration |

> **`data/` is excluded from git** — it is never committed. SSH passwords and API keys stay on your machine.

---

## License

MIT — see [LICENSE](LICENSE)

---

## Part of VynOps

| Project | Description |
|---|---|
| [VynOps](https://github.com/vynops/VynOps) | AI-native platform engineering dashboard |
| [VynAI](https://github.com/vynops/VynAI) | Ollama fleet management |
| [VynDB](https://github.com/vynops/VynDB) | Database operations |
| [VynDC](https://github.com/vynops/VynDC) | Container management |
| [VynCost](https://github.com/vynops/VynCost) | Infrastructure cost tracking |
| [VynCICD](https://github.com/vynops/VynCICD) | CI/CD pipeline management |

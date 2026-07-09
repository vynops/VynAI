import Link from 'next/link'
import { ArrowLeft, Server, Terminal, CheckCircle, ExternalLink, Copy, AlertTriangle, Cpu } from 'lucide-react'

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono">
        {String(n).padStart(2, '0')}
      </div>
      <div className="flex-1 pb-8 border-b border-slate-800/60 last:border-0 last:pb-0">
        <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre leading-relaxed overflow-x-auto group">
      {children}
      <button
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all"
        title="Copy"
        aria-label="Copy code"
      >
        <Copy size={12} />
      </button>
    </div>
  )
}

function Alert({ type, children }: { type: 'info' | 'warn'; children: React.ReactNode }) {
  const styles = type === 'warn'
    ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-300'
    : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300'
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed mt-3 ${styles}`}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">

      {/* Back link */}
      <Link href="/servers" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft size={14} /> Back to Servers
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Server size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Add an Ollama Server</h1>
            <p className="text-xs text-slate-400">From bare metal to connected in under 5 minutes</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {['Install Ollama', 'Expose network port', 'Register with VynAI', 'Pull your first model'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle size={12} className="text-cyan-400" />
              {s}
              {i < 3 && <span className="text-slate-700">·</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Requirements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'OS', value: 'Linux, macOS, or Windows (WSL2)' },
            { label: 'GPU', value: 'NVIDIA (CUDA) or Apple Silicon — or CPU-only' },
            { label: 'RAM', value: '8 GB min · 16 GB+ recommended' },
            { label: 'Network', value: 'Reachable from VynAI host (LAN or VPN)' },
          ].map(r => (
            <div key={r.label} className="flex gap-2 text-xs">
              <span className="text-slate-500 w-16 flex-shrink-0">{r.label}</span>
              <span className="text-slate-300">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        <Step n={1} title="Install Ollama on the server">
          <p className="text-xs text-slate-400 mb-3">Run the official one-line installer. Works on Linux, macOS, and WSL2.</p>
          <Code>{`# Linux / macOS / WSL2
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version`}</Code>
          <Alert type="info">
            Windows native installer available at{' '}
            <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="underline">ollama.com/download</a>
          </Alert>
        </Step>

        <Step n={2} title="Configure Ollama to accept network connections">
          <p className="text-xs text-slate-400 mb-3">
            By default Ollama only listens on <code className="text-cyan-400">127.0.0.1</code>. To let VynAI reach it, set the bind address to <code className="text-cyan-400">0.0.0.0</code>.
          </p>
          <Code>{`# Systemd (Linux — recommended for production)
sudo systemctl edit ollama

# Add under [Service]:
[Service]
Environment="OLLAMA_HOST=0.0.0.0"

sudo systemctl restart ollama`}</Code>
          <p className="text-xs text-slate-500 mt-3 mb-2">Or for a quick test / development:</p>
          <Code>{`OLLAMA_HOST=0.0.0.0 ollama serve`}</Code>
          <Alert type="warn">
            Only expose Ollama to trusted networks (LAN / VPN). Never expose port 11434 directly to the public internet without a firewall or VPN in front.
          </Alert>
        </Step>

        <Step n={3} title="Open the firewall port (Linux)">
          <Code>{`# UFW (Ubuntu/Debian)
sudo ufw allow from <vynai-host-ip> to any port 11434

# firewalld (RHEL/Fedora)
sudo firewall-cmd --permanent --add-rich-rule='rule family=ipv4 \
  source address=<vynai-host-ip>/32 port port=11434 protocol=tcp accept'
sudo firewall-cmd --reload

# Verify Ollama is reachable from VynAI host:
curl http://<server-ip>:11434/api/tags`}</Code>
        </Step>

        <Step n={4} title="Pull your first model">
          <p className="text-xs text-slate-400 mb-3">Pull at least one model before registering — or pull after via the Models page.</p>
          <Code>{`ollama pull llama3.2        # 3B · 4.7 GB — fast, great for chat
ollama pull codestral      # 22B · 12.9 GB — best for code
ollama pull nomic-embed-text  # 137M · 270 MB — embeddings

# Verify models are loaded:
ollama list`}</Code>
        </Step>

        <Step n={5} title="Register the server with VynAI">
          <p className="text-xs text-slate-400 mb-3">Use the Servers page UI or call the API directly:</p>
          <Code>{`curl -X POST http://localhost:3010/api/servers \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "gpu-server-01",
    "url": "http://<server-ip>:11434",
    "gpuCount": 1,
    "vramGiB": 24
  }'`}</Code>
          <p className="text-xs text-slate-500 mt-3">VynAI will immediately ping the server, discover loaded models, and start collecting GPU metrics.</p>
        </Step>

        <Step n={6} title="Use the OpenAI-compatible gateway">
          <p className="text-xs text-slate-400 mb-3">Point any OpenAI SDK at VynAI — no code changes needed beyond the base URL:</p>
          <Code>{`# Python
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:3010/v1",
    api_key="sk-vyn-..."   # from the Gateway page
)
response = client.chat.completions.create(
    model="llama3.2",
    messages=[{"role": "user", "content": "Hello!"}]
)

# Node.js / curl also works identically`}</Code>
        </Step>
      </div>

      {/* GPU tips */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={15} className="text-violet-400" />
          <h3 className="text-sm font-bold text-white">GPU Tips</h3>
        </div>
        <div className="space-y-3">
          {[
            { tip: 'NVIDIA drivers', detail: 'Install CUDA ≥ 12.1 and nvidia-container-toolkit for full GPU utilisation metrics.' },
            { tip: 'Multiple GPUs', detail: 'Ollama automatically uses all available GPUs. Set CUDA_VISIBLE_DEVICES to pin specific cards.' },
            { tip: 'CPU-only fallback', detail: 'Ollama works without a GPU but is significantly slower. Best for embeddings or small models (≤7B Q4).' },
            { tip: 'VRAM sizing', detail: '7B Q4 models need ~5 GB VRAM. 70B Q4 needs ~40 GB. Leave 2 GB headroom for the OS.' },
          ].map(g => (
            <div key={g.tip} className="flex gap-3 text-xs">
              <Terminal size={12} className="text-slate-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">{g.tip} — </span>
                <span className="text-slate-400">{g.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/servers" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm transition-colors">
          <Server size={14} /> Go to Servers
        </Link>
        <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm transition-colors">
          <ExternalLink size={14} /> Ollama Model Library
        </a>
        <a href="https://github.com/vynops/VynAI" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm transition-colors">
          <ExternalLink size={14} /> VynAI GitHub
        </a>
      </div>
    </div>
  )
}

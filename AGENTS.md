# AGENTS.md

Repository guide for AI coding agents working in VynAI.

## 1. Project Identity

- Name: VynAI
- Type: Next.js application (App Router) with a dashboard UI and OpenAI-compatible API gateway
- Purpose: Manage multi-server Ollama fleets, expose a unified inference gateway, and provide operational visibility (servers, models, logs, analytics, users, settings)

## 2. Tech Stack

- Runtime: Node.js 18+
- Framework: Next.js 16
- Language: TypeScript
- UI: React 19, Tailwind CSS 4, Recharts, lucide-react
- Auth/session: jose (JWT cookie session)
- Remote ops: ssh2
- Storage: JSON files in data/

## 3. Local Runbook

- Install: npm install
- Dev: npm run dev
- Build: npm run build
- Start: npm run start
- Lint: npm run lint
- App default port: 3010

## 4. Environment Variables

Required:
- VYNAI_SECRET
- VYNAI_ADMIN_EMAIL
- VYNAI_ADMIN_PASSWORD

Optional/high-impact:
- VYNAI_SECURE_COOKIE
- DEFAULT_OLLAMA_URL
- SLACK_WEBHOOK_URL
- GROQ_API_KEY

## 5. High-Level Architecture

### UI Routing

- Root layout: src/app/layout.tsx
- Root redirect: src/app/page.tsx -> /overview
- Dashboard shell: src/app/(dashboard)/layout.tsx
- Dashboard chrome components: src/components/layout/

### API Surfaces

- Auth/session APIs: src/app/api/auth/*
- Admin APIs: src/app/api/servers, src/app/api/users, src/app/api/settings, src/app/api/keys
- Monitoring/overview APIs: src/app/api/overview, src/app/api/logs, src/app/api/models
- OpenAI-compatible gateway APIs:
  - GET /api/v1/models
  - POST /api/v1/chat/completions

### Middleware/Access Control

- Request gate: src/proxy.ts
- Public paths allowed by middleware: /login, /api/auth, /api/v1
- Session cookie name: vynai_session

## 6. Data Model and Storage

All persistent app state is file-based under data/.

- data/servers.json: Ollama server registry and SSH metadata
- data/keys.json: API keys, status, limits, token/request counters
- data/users.json: users with scrypt password hashes
- data/settings.json: alert, retention, and gateway settings
- data/request-logs.json: request audit trail (capped)

Guidelines:
- Never break existing JSON envelopes (for example { servers: [...] }, { keys: [...] }, { users: [...] })
- Keep backward-compatible fields when editing stores
- Treat write failures as possible operational incidents

## 7. Core Behavior Notes

### Gateway (chat completions)

- Validates bearer API key and key status
- Enforces per-key and global rate limits
- Selects target Ollama server with in-memory round-robin, skipping offline nodes
- Supports streaming and non-streaming responses
- Records usage and request logs
- Applies per-key model allow-list restrictions when configured

### Monitoring

- Aggregates status from each configured server
- Pulls version, tags, and running models from Ollama
- Can fetch GPU/RAM/disk metrics over SSH when SSH is configured
- Emits multi-channel alerts for offline servers, threshold breaches, and gateway rate-limit events

### Notifications (Settings)

- Channels: Slack webhook, Microsoft Teams webhook, custom webhook, optional SMTP email
- Config lives in `data/settings.json` via `src/lib/settings-store.ts`
- Dispatch logic lives in `src/lib/alert-tracker.ts` and must remain non-fatal (channel failures must not break API responses)
- Email sending uses `src/lib/notifier.ts` (nodemailer) and comma-separated recipients
- Settings test endpoints:
  - `POST /api/settings/test-notification` for Slack/Teams/custom webhook
  - `POST /api/settings/test-email` for SMTP email
- Keep backward compatibility for existing settings keys; never remove or rename persisted keys without migration

### User and Role Model

- Roles: admin, viewer
- Mutating endpoints should remain admin-only
- Prevent deleting the last active admin

## 8. Security and Safety Rules

- Never expose raw secrets or sshPassword in API responses
- Preserve timing-safe credential comparisons and password hashing behavior
- Keep cookie/session security intact when changing auth code
- Avoid weakening command safety checks in SSH execution routes
- Maintain strict input validation on mutating endpoints

## 9. Coding Rules for Agents

- Prefer minimal diffs and preserve existing style
- Avoid broad refactors unless explicitly requested
- Keep public API contracts stable unless task requires change
- Add concise comments only for non-obvious logic
- Run targeted validation after edits (build/lint/tests when feasible)

## 10. Testing and Verification Checklist

After backend/API changes:
- Confirm auth behavior for unauthorized and authorized flows
- Confirm admin-only mutations are still blocked for non-admin users
- Confirm gateway still handles both stream true/false scenarios
- Confirm request logs are still appended and retained correctly

After UI changes:
- Verify dashboard navigation and page load paths
- Verify mobile sidebar behavior and desktop layout behavior

After storage/schema changes:
- Verify data files still parse and defaults merge correctly
- Verify no accidental exposure of sensitive fields in responses

## 11. Known Operational Constraints

- Rate limiter state is in-memory; process restart resets windows
- File-based stores are simple and local; treat concurrent writes carefully
- Gateway failover is best-effort via online checks at request time

## 12. Deployment Discipline

- Do not deploy unless the user explicitly requests deployment.
- Default workflow in this repository should be local-only edits unless user says deploy.

## 13. Quick Task Entry Points

Use these as first stops by task category:

- Session/auth bugs: src/lib/auth.ts, src/proxy.ts, src/app/api/auth/*
- Gateway behavior: src/app/api/v1/chat/completions/route.ts, src/app/api/v1/models/route.ts
- Server registration and status: src/lib/server-store.ts, src/app/api/servers/*
- GPU/SSH telemetry: src/lib/ssh.ts, src/app/api/servers/[id]/gpu/route.ts
- Logs and analytics payloads: src/lib/request-log-store.ts, src/app/api/overview/route.ts
- Settings and alerts: src/lib/settings-store.ts, src/lib/alert-tracker.ts, src/app/api/settings/route.ts
- Notification tests/email: src/app/api/settings/test-notification/route.ts, src/app/api/settings/test-email/route.ts, src/lib/notifier.ts
- User/admin operations: src/lib/user-store.ts, src/app/api/users/*

## 14. Definition of Done for Agent Changes

- Code compiles for affected files
- No accidental regression in auth/permissions
- Sensitive fields are not leaked in responses
- Updated behavior is reflected in concise notes for handoff
- Changes stay scoped to user request

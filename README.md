# K8s Agent

**Hardened Kubernetes Troubleshooting & Diagnostics Dashboard with AI Reasoning**

K8s Agent is a security-hardened application that connects to Kubernetes clusters, automatically detects problematic workloads, collects diagnostic evidence, redacts sensitive secrets and configuration data, and uses AI reasoning (Gemini & OpenAI-compatible providers) to perform root cause analysis — all through a minimal, technical dark-mode dashboard.

---

## Security Architecture

```
User
 │
 ▼
[Login / Register]
 │
 ▼
Authenticated Web App (HttpOnly Cookie Session)
 │
 ▼
Backend (Express + SQLite Persistent Volume)
 │
 ├───────────────────────────────────────────┐
 │                                           │
 ▼                                           ▼
Kubernetes API (Read-Only Least-Privilege)  Gemini / AI Provider
 │
 ├── READ-ONLY RBAC (deploy/rbac.yaml)
 ├── NO Secret Data retrieved
 ├── NO ConfigMap Data retrieved
 ├── Pod status, events, workloads, nodes
 ├── Raw logs & environment variables
 │
 ▼
[Sensitive Data Sanitizer Pipeline]
 ├── Strips passwords, tokens, API keys, JWTs
 ├── Redacts DB connection strings & private keys
 ├── Keeps metadata & references (e.g., secret:db-credentials)
 ├── Completely redacts environment values
 │
 ▼
Safe Diagnostic Context (Evidence JSON)
 │
 ▼
Gemini / AI Reasoning (No cluster access, no tools, reasoning only)
```

### Core Security Guarantees

1. **Gemini NEVER has direct Kubernetes cluster access**: AI models have zero access to `kubectl`, cluster credentials, kubeconfig, or service account tokens. The AI is purely an evidence-reasoning service.
2. **Kubernetes RBAC Least Privilege**:
   - The application identity is restricted to read-only cluster inspection.
   - Permissions to read `secrets` data (`get`, `list`, `watch`) are **strictly prohibited**.
   - Permissions to read raw `configmaps` data are excluded. Pod specifications are inspected for reference names only (`secretRef`, `configMapRef`).
   - Cluster manifest provided at [`deploy/rbac.yaml`](deploy/rbac.yaml).
3. **Dedicated Sanitization Pipeline**:
   - Every piece of diagnostic data (pod specifications, annotations, labels, event messages, container environment variables, and pod logs) passes through the backend sanitizer before being passed to the AI.
   - Environment variable names are preserved for context, but values are strictly redacted to `[REDACTED]`.
   - Log patterns matching passwords, API keys, bearer tokens, AWS credentials, and connection strings are automatically scrubbed.
4. **Password Security**:
   - Passwords are encrypted with `bcrypt` (12 salt rounds) / Argon2id architecture.
   - Passwords are never stored in plaintext, logged, returned in API responses, or exposed in frontend state.
5. **Multi-Tenant User Isolation & In-Memory API Keys**:
   - User accounts, password hashes, and diagnosis histories are stored persistently in SQLite.
   - AI API keys are stored **strictly in-memory** and associated with the authenticated user session.
   - API keys are never persisted in plaintext, never written to disk, and never returned to the frontend (only masked previews such as `●●●●●●●●abcd` are returned).
6. **Session Management & Route Protection**:
   - Protected routes require authenticated HttpOnly sessions (`k8s_session` cookie).
   - Unauthenticated requests are immediately rejected or redirected to `/login`.
   - Rate limiting protects authentication (`/api/auth/*`) and diagnostic endpoints.

---

## Persistent Storage & Docker Volume

User accounts and diagnosis history persist across container restarts using a Docker named volume:

```yaml
volumes:
  - k8s-agent-data:/app/data
```

Database location:
`/app/data/k8s-agent.db` (SQLite in WAL mode with foreign keys enabled).

### Preserving Data Across Restarts

To restart or upgrade containers without losing registered users:
```bash
# Safe restart (volume is preserved):
docker compose down
docker compose up --build -d
```

> **Warning:** Running `docker compose down -v` will delete the named volume and wipe the SQLite database. Do not use `-v` unless you intentionally want to reset all user accounts.

---

## Kubernetes RBAC Setup

To run K8s Agent with least privilege in a production Kubernetes cluster, apply the included RBAC manifest:

```bash
kubectl apply -f deploy/rbac.yaml
```

The service account receives read-only permissions for:
- Pods, Pod logs
- Events
- Deployments, ReplicaSets, StatefulSets, DaemonSets
- Services, Endpoints, EndpointSlices
- Nodes, Namespaces
- PersistentVolumeClaims, PersistentVolumes
- HorizontalPodAutoscalers
- Jobs, CronJobs

**Notice:** `secrets` and `configmaps` are explicitly excluded from read permissions.

---

## Features

- **Authentication & User Management** — Registration, Login, Logout, and generic error messages (defending against user enumeration).
- **Masked Key Management** — Settings page displays masked API key (`●●●●●●●●abcd`) with `[ Replace Key ]` and `[ Remove Key ]` controls.
- **Security Status Dashboard** — Real-time display of Kubernetes RBAC mode, Secret isolation status, and Sanitizer pipeline verification.
- **Multi-Provider AI Diagnostics** — Works with Google Gemini, NVIDIA NIM, OpenAI, Groq, or local Ollama endpoints.
- **Problem Detection** — Deterministic detection engine identifies unhealthy resources before involving AI.
- **Deep Evidence Collection** — Collects pod status, container state, logs, events, deployments, services, endpoints, nodes, and storage metadata.
- **Sanitized Diagnostic Context** — Sensitive data and credentials are completely scrubbed before AI processing.
- **Command Copy** — Verification and remediation commands displayed with one-click copy.
- **Non-Destructive & Read-Only** — The agent never executes cluster modifications automatically.

---

## Quick Start

### 1. Start with Docker Compose

```bash
docker compose up --build -d
```

Open your browser at `http://localhost:5173`.

### 2. User Flow

1. **Register**: Create your initial user account at `/register`.
2. **Login**: Sign in with your username/email and password at `/login`.
3. **Configure AI**: Enter your Gemini API key (or OpenAI-compatible endpoint).
4. **Select Cluster**: Choose your Kubernetes cluster context from your mounted `kubeconfig`.
5. **Troubleshoot**: Inspect detected problems, review sanitized evidence, and view AI-generated root cause analyses.

---

## API Endpoints

### Authentication (Protected with Rate Limiting)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new account (username, email, password) |
| `POST` | `/api/auth/login` | Authenticate user and issue HttpOnly session |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Return authenticated user details (no password hashes) |

### AI Configuration & Diagnostics (Requires Authentication)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ai/status` | Check AI configuration & return masked key (`●●●●abcd`) |
| `POST` | `/api/ai/key` | Set AI API key for active user session |
| `DELETE` | `/api/ai/key` | Remove AI API key from memory |
| `POST` | `/api/ai/test` | Test AI connection |
| `POST` | `/api/problems/:id/analyze` | Run AI diagnostic with sanitized evidence |

### Kubernetes Inspection (Read-Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/clusters` | Discover available clusters |
| `GET` | `/api/clusters/current` | Get current active cluster |
| `POST` | `/api/clusters/select` | Select cluster context |
| `GET` | `/api/namespaces` | List namespaces |
| `GET` | `/api/problems` | Detect cluster problems |
| `GET` | `/api/problems/:id` | Get problem details and sanitized evidence |
| `GET` | `/api/pods` | List pods |
| `GET` | `/api/deployments` | List deployments |
| `GET` | `/api/services` | List services |
| `GET` | `/api/events` | List events |
| `GET` | `/api/nodes` | List nodes |

---

## Security Verification & Tests

A comprehensive security test suite verifies all authentication and data sanitization boundaries:

```bash
cd backend
npm test
```

### Verified Acceptance Criteria:
- Passwords hashed with bcrypt cost factor 12 (never plaintext in database or logs).
- User enumeration defense (generic messages on failed logins).
- Session lifecycle & secure HttpOnly cookie management.
- Multi-tenant credential isolation (User A cannot access User B's AI key or history).
- AI keys are strictly masked (`●●●●abcd`) and never returned in API responses.
- **Requirement 35 Acceptance Test**: A test pod containing fake credentials (`TEST_PASSWORD_123`, `TEST_API_KEY_456`, `TEST_TOKEN_789`) is analyzed through the diagnostic pipeline, verifying that fake credentials never appear in the AI payload while retaining reference names (`secret:database-credentials`, `configMap:app-settings`).

---

## License

MIT

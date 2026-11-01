# Agent Platform: Identity, Security & Governance

**Author:** Michaël Bettan · **Track:** Google Cloud / Professional Agentic Architect · **Version:** 1.0 (2026-10-26)

How to secure and govern agents on Gemini Enterprise Agent Platform. Topics: who the agent *is* (Agent Identity), how it authenticates to tools (auth manager, Secret Manager), what it may reach (IAM, Principal Access Boundary), where its traffic is enforced (Agent Gateway + Agent Registry), what content it may see or emit (Model Armor, Sensitive Data Protection, Gemini safety filters), how its network and data are isolated (VPC-SC, PSC, CMEK, data residency), how it's audited (Cloud Audit Logs, Security Command Center AI Protection), and when a human must approve (HITL).

> **Companion guides.** This guide covers only security and governance. Build/runtime/retrieval/evaluation are in [AgentPlatform.html](https://mbettan.github.io/machine-learning-cert/AgentPlatform.html). Vendor-neutral guardrail concepts are in [ResponsibleAI.html](https://mbettan.github.io/machine-learning-cert/ResponsibleAI.html) (#guardrail-matrix, #stakes-hitl, #governance-lifecycle). ADK-level controls are in [ADK.html](https://mbettan.github.io/machine-learning-cert/ADK.html) (#callbacks-guardrails, #hitl-resilience, #security-sandboxing). Protocols are in [MCP.html](https://mbettan.github.io/machine-learning-cert/MCP.html) and [A2A.html](https://mbettan.github.io/machine-learning-cert/A2A.html). Operations are in [AgentOps.html](https://mbettan.github.io/machine-learning-cert/AgentOps.html).

> **Launch-stage warning.** Several controls here are **Preview** or **Experimental** (see the status table in §00). Preview features may change and have limited support. Re-check the docs before relying on a status.

---

## 00. Overview & Mental Model

### The four governance components

| Component | Answers | Product |
|---|---|---|
| **Identity** | *Who* is acting? | Agent Identity (SPIFFE-based per-agent principal), or service accounts (legacy/default) |
| **Registry** | *What* destinations exist and are approved? | Agent Registry (agents, MCP servers/tools, endpoints, skills) |
| **Policies** | *What* actions are allowed? | IAM allow/deny, Principal Access Boundary (PAB), Unified Access Policies on the gateway, Semantic Governance |
| **Gateway** | *Where* is it enforced? | Agent Gateway (Client-to-Agent ingress, Agent-to-Anywhere egress) |

Content controls (Model Armor, SDP, Gemini safety filters), network/data controls (VPC-SC, PSC, CMEK, residency), detection (Audit Logs, SCC) and humans (HITL) sit on top of these four as defense in depth.

### "Which control prevents X?" (master decision table)

| Threat / requirement | Primary control | Why not the others |
|---|---|---|
| Shared service-account key leaked; you need per-agent, non-impersonable credentials | **Agent Identity** | Service accounts are shared by default and can be impersonated |
| Stolen agent access token replayed from another machine | **Agent Identity** (certificate-bound tokens + default Context-Aware Access: mTLS + DPoP) | IAM roles don't stop replay of a valid token |
| Agent must act on *a user's* Jira/GitHub data with that user's consent | **Auth manager, 3-legged OAuth** (user-delegated) | An API key or the agent's own identity would act with the agent's authority, not the user's |
| API key hard-coded in agent source | **Secret Manager** (secret env var or ADK `SecretManagerClient`) + `secretAccessor` for the agent | Env-var plaintext and code are both visible to anyone who can read the deployment |
| Agent can reach *any* project in the org despite narrow intent | **Principal Access Boundary** (boundary on eligible resources) | Allow policies only grant; PAB caps eligibility no matter what roles exist |
| A broad role must never include one dangerous permission | **IAM deny policy** | PAB limits *resources*, not specific permissions |
| Agent may call MCP tool `get_order` but not `delete_order` | **Unified Access Policy** on Agent Gateway (CEL on `tool.name` / `destructive_hint`) | IAM on the Google Cloud API can't see MCP tool names |
| Agent calls an unregistered external host | **Agent Gateway + Agent Registry** (default-deny egress; UAP on `destination.unregistered.*`) | Model Armor screens content, not destinations |
| An email in context instructs the agent to forward mail to an attacker (indirect injection → rogue tool call) | **Semantic Governance** (intent alignment) + **Model Armor** prompt-injection filter | UAP sees an allowed tool name and can't judge intent |
| Refund over a business limit (e.g., >\$75) must never auto-execute | **Semantic Governance** natural-language constraint, or deterministic check + **HITL tool confirmation** | Model Armor has no business rules |
| Jailbreak / prompt injection / malicious URL in user input | **Model Armor** (input template) | Gemini safety filters only cover harm categories |
| Credit-card numbers leak in responses | **Model Armor SDP filter** (advanced mode with de-identify template) / **Sensitive Data Protection** | Safety filters don't detect custom infoTypes |
| Hateful output from the model | **Gemini safety filters** (model level) and/or **Model Armor RAI filter** (model-agnostic) | — |
| Data exfiltration from Google APIs to an outside project | **VPC Service Controls** perimeter | IAM alone can't stop a legitimately authorized identity copying data out |
| Agent must reach on-prem/private VPC services | **PSC interface** (network attachment) | Agent Runtime can't reach your private VPC/on-prem by default (Google-managed tenant) |
| Regulator requires customer-controlled keys | **CMEK** (`encryption_spec`, same-region key) | Google default encryption isn't customer-controlled |
| Data and ML processing must stay in the EU | **Data residency**: EU multi-region/regional endpoint; block the global endpoint | The global endpoint has no residency guarantee |
| "Who changed the agent's IAM?" | **Cloud Audit Logs** (Admin Activity, always on) | Data Access logs must be enabled explicitly |
| Detect anomalous grants to agent identities / over-privileged agents | **SCC AI Protection** + Event Threat Detection | Audit logs record but don't alert |
| Irreversible, high-stakes action needs sign-off | **HITL**: ADK tool confirmation (`require_confirmation`) | Automated filters can be wrong; accountability needs a human |
| Hundreds of unknown agents/tools across teams (agent sprawl) | **Agent Registry** (central catalog) + gateway default-deny + org policy | Ad-hoc spreadsheets aren't enforced |

### Launch-stage status (as documented, 2026-10)

| Capability | Status | Note |
|---|---|---|
| Agent Identity | **Preview** | Falls back to service accounts if not enabled |
| Agent Identity auth manager | Preview with Agent Identity (verify) | — |
| Agent Gateway | **GA** for Agent Runtime + Gemini Enterprise (GE: egress only) | GKE, Cloud Run, cross-cloud: coming soon / early preview |
| Agent Registry | GA (verify); **standalone skills in Registry = Preview** | — |
| Skill Registry | **Preview** | — |
| Semantic Governance policies | **Preview** | — |
| Token-management policies, extension bindings | Coming soon | — |
| Agent Platform Threat Detection (SCC) | **Preview**, Premium tier | — |
| ADK tool confirmation (HITL) | **Experimental** | — |

> **Exam trap.** "Preview" isn't a reason to reject a control in a design question, but you must know which features are not GA. Some security controls (e.g., CMEK/VPC-SC support) aren't available for preview models.

---

## 01. Agent Identity Model

### Three ways an agent proves who it is

| Option | What it is | Strengths | Weaknesses |
|---|---|---|---|
| **Default service agent** | AI Platform Reasoning Engine Service Agent `service-PROJECT_NUMBER@gcp-sa-aiplatform-re.iam.gserviceaccount.com` (`roles/aiplatform.reasoningEngineServiceAgent`) | Zero setup | Shared by every agent in the project, so no per-agent least privilege |
| **Custom service account** | You attach your own SA | Per-workload roles possible | Can be shared and impersonated; key-management risk |
| **Agent Identity** (Preview) | Per-agent, SPIFFE-based, strongly attested principal tied to the agent's lifecycle and resource URI | Not shared, **can't be impersonated**, no long-lived keys; tokens bound to the agent's X.509 cert (24h, auto-rotated); Context-Aware Access enforces **mTLS + DPoP** by default | Preview; new principal on every redeploy (see traps) |
| **Workload Identity Federation (WIF)** | Federates external/other-cloud workloads to Google Cloud without keys | Used by Agent Gateway / auth manager for cross-cloud and external identity exchange | Not an agent-native identity |

Agent Identity is supported on **Agent Runtime, Gemini Enterprise, and Cloud Run**.

### Principal formats

- SPIFFE ID: `spiffe://agents.global.org-ORG_ID.system.id.goog/resources/aiplatform/projects/PROJECT_NUMBER/locations/LOCATION/reasoningEngines/AGENT_ID`
- Single agent (IAM): `principal://agents.global.org-ORG_ID.system.id.goog/resources/aiplatform/projects/PROJECT_NUMBER/locations/LOCATION/reasoningEngines/AGENT_ID`
- All agents in a project: `principalSet://agents.global.org-ORG_ID.system.id.goog/attribute.platformContainer/aiplatform/projects/PROJECT_NUMBER`
- All agents in the org: `principalSet://…/attribute.platform/aiplatform`

### Enabling it

- SDK (`api_version="v1beta1"`): `client.runtimes.create(config={"identity_type": types.IdentityType.AGENT_IDENTITY, ...})`. You can create the identity **before** deploying code so you can set up IAM first, then add code with `client.runtimes.update(...)`.
- CLI: `agents-cli deploy --agent-identity`; for `adk deploy`, set it in `.agent_engine_config.json`.
- If the setting is absent, the agent runs as a service account.
- Default roles granted to the identity: `roles/aiplatform.agentContextEditor`, `roles/aiplatform.agentDefaultAccess`.
- Typical extra roles: `roles/aiplatform.expressUser`, `roles/serviceusage.serviceUsageConsumer`, `roles/browser`, `roles/secretmanager.secretAccessor`.

### Lifecycle and CI/CD traps

| Trap | Consequence | Fix |
|---|---|---|
| Agent redeployed (new resource ID) | New principal, so **old bindings don't apply** | After deploy, read `spec.effectiveIdentity`; put baseline roles on the project **`principalSet`**, which survives redeploys |
| Agent deleted | IAM bindings **remain** (orphaned) | Remove bindings as part of teardown |
| Granting legacy Cloud Storage bucket roles | Not supported for agent identities | Use the IAM predefined roles |
| Parent agent delegates to a subagent (A2A) | Parent needs discovery + invoke rights | Grant the **parent's agent identity** `roles/agentregistry.viewer` and `roles/aiplatform.user` on the subagent; don't grant them to the user |

> **Exam trap.** "Use a service account key stored in the container" is never the answer. Prefer Agent Identity, or an attached SA with no exported keys.

---

## 02. Tool Authentication & Secrets

### Two authorities

| Model | Agent acts as… | Mechanism | Use when |
|---|---|---|---|
| **User-delegated** | the end user (with consent) | **3-legged OAuth** via the auth manager | Per-user data in SaaS (Jira, GitHub, Salesforce, ServiceNow, Workspace) |
| **Agent's own authority** | itself | Agent Identity → Google Cloud APIs; **OIDC ID tokens** → external services (federation); **2-legged OAuth** (machine-to-machine); **API key**; HTTP basic (not recommended) | Shared back-end services, batch jobs, service-to-service calls |

Audit logs record **both the agent and the user** when the agent acts on a user's behalf, and only the agent when it acts on its own authority.

### Agent Identity auth manager

- A centralized **credential vault and auth broker**. "Auth providers" hold API keys, OAuth client IDs/secrets and delegated user tokens.
- Automates the OAuth dance: consent, code exchange, token refresh.
- ADK integration injects `Authorization` / `X-Goog-Api-Key` headers into tool and MCP calls, so the credentials never live in agent code.
- Access to auth providers is governed by IAM using the agent's SPIFFE identity. User grants can be viewed and revoked.
- With **Agent Gateway + Gemini Enterprise**, end-user credentials are encrypted by the auth manager and decrypted at the gateway, so the agent never sees the raw credential.
- Constraint: some providers (e.g., GitHub, Microsoft) support only a single scope.

### Secret Manager

- Agent Runtime secret env vars: `env_vars={"API_KEY": {"secret": "SECRET_ID", "version": "latest"}}`. Only **same-project** secrets can be referenced.
- Grant `roles/secretmanager.secretAccessor` to the agent identity. When secrets are injected as env vars at deploy time, also grant it to the Agent Platform service agent.
- ADK `SecretManagerClient` fetches secrets at runtime, so a rotated secret takes effect without a redeploy or restart.

> **Decision rule.** Per-user consent → 3LO through the auth manager. Static third-party key → Secret Manager (or an auth-manager API-key provider). Google Cloud API → the agent's own identity with least-privilege IAM. Never put secrets in code, prompts or plaintext env vars.

---

## 03. Access Boundaries: IAM, Deny & PAB

### Policy types compared

| Policy | Effect | Granularity | Answers |
|---|---|---|---|
| **IAM allow policy** | Grants roles | Resource + role (+ condition) | "What *may* this principal do?" |
| **IAM deny policy** | Denies specific permissions; overrides allow | Permission-level | "What must it *never* do, whatever its roles?" |
| **Principal Access Boundary (PAB)** | Limits which resources a principal is *eligible* to access | Org/folder/project (up to 500 resources per policy, effect `ALLOW` only) | "Where can it *ever* operate?" |
| **Unified Access Policy (gateway)** | Allow/deny on agent traffic through Agent Gateway | MCP tool, agent, endpoint, unregistered host/path/method | "Which tools and destinations?" |

### Least privilege for agents

1. Give each agent its own identity (Agent Identity), not the shared default service agent.
2. Grant specific predefined roles on specific resources. Avoid `Owner`/`Editor`.
3. Put baseline roles on the project `principalSet`; per-agent extras on the `principal://` of that agent.
4. Add deny policies for permissions that must never be used (e.g., IAM admin).
5. Bind a **PAB policy** to the agents' principal set so they can't reach resources outside approved projects, even if someone over-grants.
6. Govern tool-level access at the gateway (UAP) because Google Cloud IAM can't see MCP tool names.

### PAB specifics

- Rules list Resource Manager resources. PAB has an `enforcementVersion` and blocks only the permissions supported by that version.
- Binding example: `gcloud iam principal-access-boundary-policies bindings create … --target-principal-set=…` (bound to a principal set, e.g., the agents in a project or org).
- For agents, PAB can also be enforced on egress through Agent Gateway (via IAP).

> **Exam trap.** PAB doesn't grant anything. A principal needs an allow-policy role **and** must be inside its boundary **and** must not be denied.

---

## 04. Agent Registry, Skill Registry & Agent Gateway

### Agent Registry

- A central catalog for **agents, MCP servers and tools, endpoints, and standalone skills** (skills: Preview).
- **Automatic registration** covers supported workloads in the governance project, including **Google Cloud remote MCP servers** (`https://<service>.googleapis.com/mcp`, enabled with the service API and requiring `roles/mcp.toolUser` / `mcp.tools.call` plus service IAM roles). **Manual registration** uses `Service` resources for remote, custom (e.g., MCP Toolbox for Databases or third-party SaaS connectors on Cloud Run/GKE), or cross-project components (`gcloud agent-registry mcp-servers list`).
- Governance-project model: single-project or cross-project.
- Agent Gateway **queries the registry before routing**, and policies reference registry identifiers (`urn:agent:` identifiers are for inventory, **not** for IAM bindings).
- Limit: up to 5,000 Agent Registry resources per gateway.
- Purpose: fight **agent sprawl**, fragmented tool access and redundant integrations.

### Skill Registry (Preview)

- A secure, private, low-latency repository of **skills** (instructions + code + docs) that agents discover and load on demand.
- Includes a built-in `gcp-skill-registry` skill. Semantic Governance can constrain which skills an agent loads.

### Agent Gateway

| Path | Direction | Typical controls |
|---|---|---|
| **Client-to-Agent** | Ingress (users/apps → agent) | mTLS termination, IAP access policy, Model Armor screening of ADK `streamQuery` |
| **Agent-to-Anywhere** | Egress (agent → tools, agents, LLMs, APIs) | UAPs, PAB, Semantic Governance, Model Armor on MCP `tools/call`, A2A messages and OpenAI-compatible payloads |

- Mediates **MCP, A2A, REST, gRPC**, and inspects MCP JSON-RPC to extract tool names for policy.
- Emits OpenTelemetry traces and access logs to Cloud Logging/Trace.
- Works with the auth manager for OAuth and WIF.
- **Deployment models:** Google-managed for Agent Runtime + Gemini Enterprise. GKE, Cloud Run and cross-cloud (self-managed Envoy + WIF) are coming soon / early preview.
- Org governance: custom org policy constraints can restrict which gateways may be associated with agents.

> **Limitations.** Gemini Enterprise supports only **Agent-to-Anywhere (egress)**; Client-to-Agent is for Agent Runtime. Ingress governs `query`/`streamQuery` only. All agents in the same project + region bind to the same egress/ingress gateway. SCC Agent Engine Threat Detection isn't available while a gateway is enabled. VPC-SC works with Agent Gateway when the agent uses VPC connectivity (route all egress through your VPC, restricted VIP).

---

## 05. Gateway Policies: UAP & Semantic Governance

### Unified Access Policies (IAM v3)

- Bound to the project that holds the gateway; enforced by IAP. The permission involved is `iap.googleapis.com/resources.egressViaIAP`.
- **Default-deny:** nothing passes unless an allow rule matches. Rules can mix allow and deny effects; **deny overrides allow**.
- CEL conditions on attributes such as:
  - `destination.agent_registry.mcp_server.tool.name`
  - `destination.agent_registry.mcp_server.tool.annotations.read_only_hint` / `destructive_hint`
  - `destination.unregistered.host`, `.path`, `.method`
- **Rollout:** `DRY_RUN` logs would-be violations to Cloud Audit Logs without blocking, then you switch to `ENFORCE`.
- Best practices: dry-run first; name specific tools (no wildcards); use deny rules as guardrails (e.g., deny `destructive_hint == true`); audit regularly.

### Semantic Governance (Preview)

- **Natural-language constraints** evaluated by an LLM policy engine running in your VPC.
- Intercepts each **proposed tool call** and runs two checks:
  1. **Alignment with user intent** (on by default): does this call serve what the user asked?
  2. **Business-constraint compliance**: e.g., "refunds may not exceed \$75".
- Verdict: `ALLOW` or `DENY` with a rationale. A custom denial message (≤1,000 chars) can replace the rationale.
- Mitigates **context poisoning / indirect prompt injection** and **rogue actions**. Can also govern which skills load.
- Complements IAM and UAP; **doesn't replace them**. Verdicts are probabilistic and can be wrong, so keep deterministic controls for hard limits.

| Need | Use |
|---|---|
| Hard allow/deny by tool name, host, method | **UAP** (deterministic) |
| "Does this action match what the user wanted?" | **Semantic Governance** |
| Business rule expressible in natural language | **Semantic Governance** (backed by a deterministic check for critical limits) |
| Custom authorization logic | Service Extensions custom authorization engine |

---

## 06. Content Safety: Model Armor, SDP & Safety Filters

### Model Armor

| Filter | Detects | Notes |
|---|---|---|
| Responsible AI | Hate, harassment, sexually explicit, dangerous (CSAM always on) | Confidence: `HIGH`, `MEDIUM_AND_ABOVE`, `LOW_AND_ABOVE` |
| Prompt injection & jailbreak | Attempts to override instructions | Inputs under 3 words return no match |
| Sensitive Data Protection | **Basic:** fixed infoTypes, inspect only. **Advanced:** SDP inspect + **de-identify** templates | Redaction needs advanced mode |
| Malicious URL detection | Phishing/malware links | First 256 URLs screened |

- **Templates** hold filter configs. Enforcement is **Inspect only** or **Inspect and block**.
- **Floor settings** set a minimum baseline at org, folder or project level that every template must meet.
- Best practice: separate **input** and **output** templates; start at High/Medium; run inspect-only to tune; then block.
- Model-agnostic and cloud-agnostic; findings appear in **Security Command Center**.
- Regional endpoints from a VPC need a PSC endpoint. Document (PDF) screening is via the API, not the gateway integration.

**On Agent Gateway:**
- Templates must be in the **same region** as the gateway.
- Ingress roles `roles/modelarmor.calloutUser` + `roles/modelarmor.user` for the Reasoning Engine service agent. Egress: the same roles for the Service Extensions service agent.
- **Redaction** requires an advanced SDP de-identify template **and** `INSPECT_AND_BLOCK`. If multiple detectors fire, the whole payload is blocked. Logs are redacted either way.
- Ingress screens ADK `streamQuery`. Egress screens A2A SendMessage/AgentCard, MCP `tools/call`, `prompts/get`, tool-execution errors, and OpenAI-compatible LLM payloads. It does **not** screen `tools/list`, `resources/*`, notifications or MCP Streamable HTTP/SSE streams.

### Sensitive Data Protection (formerly DLP)

- infoType detection, inspection and de-identification (masking, tokenization) via templates.
- Use it inside Model Armor (advanced mode) for agent traffic, or directly to scan and de-identify data before it reaches a corpus or memory.

### Gemini safety filters (model level)

- Non-configurable filters (e.g., CSAM, PII) always apply.
- Configurable harm categories: harassment, hate speech, sexually explicit, dangerous content.
- Thresholds: `BLOCK_LOW_AND_ABOVE`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_ONLY_HIGH`, `BLOCK_NONE`, `OFF`. Method: `SEVERITY` (default) or `PROBABILITY`.
- Per the docs, newer Gemini models default to `OFF` for configurable filters (verify for your model version).

| Need | Gemini safety filters | Model Armor |
|---|---|---|
| Scope | One Gemini call | Any model, any cloud, plus agent traffic via the gateway |
| Prompt injection / jailbreak | ✗ | ✓ |
| Sensitive data / redaction | ✗ (beyond built-in) | ✓ (SDP) |
| Malicious URLs | ✗ | ✓ |
| Central org baseline | ✗ | ✓ floor settings |

---

## 07. Network & Data Protection

### VPC Service Controls

- Inside a perimeter, Agent Runtime keeps access to Google APIs, but **public internet is blocked**. For internet egress, use a PSC interface + RFC 1918 proxy VM + Cloud NAT.
- Without VPC-SC the Google-managed tenant keeps default internet access, but it **can't reach your private VPC or on-prem**; plan a PSC-I (plus proxy if needed).
- Deploys may need **ingress rules** for the Reasoning Engine service agent: pickle deploys need Cloud Storage + Artifact Registry; source deploys need Artifact Registry; bring-your-own-container needs none.
- Agent Identity APIs (`agentidentity.googleapis.com`, `agentidentitycredentials.googleapis.com`) can be added to a perimeter (restricted VIP), and agent identities can appear in ingress/egress rules.
- Violations are recorded as **Policy Denied** audit logs.

### Private Service Connect

- **PSC interface (PSC-I):** private egress from the agent to your VPC, on-prem or multicloud via a **network attachment** (subnet minimum /28). DNS peering resolves private names. Shared VPC is supported. **Can't be changed without recreating the agent.**
- **PSC endpoint:** private *ingress* to Google APIs or regional endpoints (e.g., Model Armor, a sandbox).

### CMEK

- Set `encryption_spec` at creation, using a **single-region key in the same region**. **Can't be changed after deploy.**
- Grant `roles/cloudkms.cryptoKeyEncrypterDecrypter` to the `gcp-sa-aiplatform-re` service agent.
- Not covered by your key: metadata such as display names, descriptions, service-account emails, method names and env vars, so don't put secrets there.
- Security controls such as CMEK aren't supported for preview models.

### Data residency

| Endpoint | At-rest data | ML processing |
|---|---|---|
| Regional (e.g., `us-central1`) | In region | In region |
| Jurisdictional multi-region (`us`, `eu`) | In jurisdiction | Within jurisdiction (EU excludes UK/CH) |
| **Global** | In chosen location | **No residency guarantee** |

> **Decision rule.** For a strict residency requirement, use a regional or jurisdictional endpoint and block the global endpoint with org policy.

---

## 08. Audit, Observability & Threat Detection

### Cloud Audit Logs for Agent Platform

| Log type | Default | Captures | Viewer role |
|---|---|---|---|
| **Admin Activity** | Always on, can't be disabled | Config/metadata changes (create/delete/patch resources, `setIamPolicy`) | `roles/logging.viewer` |
| **Data Access** | **Off: must be enabled** | Admin read, data read/write (e.g., model/endpoint usage) | `roles/logging.privateLogViewer` |
| **Policy Denied** | On | Requests denied by a security policy (e.g., VPC-SC) | `roles/logging.viewer` |
| **System Event** | Always on | Google-initiated changes | `roles/logging.viewer` |

- UAP `DRY_RUN` results land in Cloud Audit Logs, which makes them a safe policy-tuning loop.
- Agent Gateway emits OpenTelemetry traces and access logs (Agent Observability), so you can trace *which tool* was called and *with what verdict*.

### Security Command Center: AI Protection

- AI asset inventory, the AI Security dashboard, vulnerability findings (Premium), threat detection, and Model Armor findings.
- **Agent Platform Threat Detection** for Agent Runtime (Preview, Premium). Event Threat Detection rules include:
  - *IAM Anomalous Grant to Agentic Identity*
  - *Agentic Identity Credential Used Outside of Google Cloud*
  - *Sensitive Role Granted by AI Agent*
- Premium capabilities include detection of over-privileged agents and attack paths.

> **Exam trap.** Audit logs *record*, and SCC *detects and alerts*. A question asking "be notified when an agent's credential is used from outside Google Cloud" points to SCC threat detection, not to enabling Data Access logs.

---

## 09. HITL & Governance at Scale

### Human-in-the-loop approvals

- ADK **tool confirmation** (Experimental): `FunctionTool(fn, require_confirmation=True)`, or pass a function returning a bool (e.g., confirm only when `amount > 1000`).
- Advanced confirmation returns a structured payload (approve/modify). Remote approvals can arrive via the REST API, which suits async approval UIs.
- ADK graph workflows can pause on a request-input node until a human responds.
- Use HITL for **irreversible, high-blast-radius, regulated, or novel** actions. Use deterministic code for hard limits, and Semantic Governance/Model Armor for scalable screening. See [ResponsibleAI.html#stakes-hitl](https://mbettan.github.io/machine-learning-cert/ResponsibleAI.html#stakes-hitl) and [ADK.html#hitl-resilience](https://mbettan.github.io/machine-learning-cert/ADK.html#hitl-resilience).

### Governing agent sprawl

| Lever | Control |
|---|---|
| Inventory | Agent Registry (auto + manual registration); SCC AI asset inventory |
| Only approved destinations | Gateway default-deny + registry-backed UAPs |
| Only approved gateways | Custom org policy constraints on gateway association |
| Uniform content baseline | Model Armor floor settings at org/folder |
| Uniform reach | PAB on the org/project agent principal set |
| Residency | Org policy blocking the global endpoint |
| Detection | SCC AI Protection; Audit Logs |
| Lifecycle hygiene | Remove orphaned bindings on deletion; `principalSet` baselines for redeploys |

### Layered defense, end to end

1. **Identity:** Agent Identity with least-privilege roles + PAB.
2. **Credentials:** auth manager (3LO/2LO/API keys) + Secret Manager.
3. **Gateway:** registry-backed, default-deny UAPs (dry-run → enforce).
4. **Intent:** Semantic Governance on proposed tool calls.
5. **Content:** Model Armor input/output templates + SDP; Gemini safety filters.
6. **Network/data:** VPC-SC, PSC-I, CMEK, regional endpoints.
7. **Human:** tool confirmation for high-stakes actions.
8. **Audit/detect:** Cloud Audit Logs + SCC AI Protection.

---

## 10. Glossary, Self-Assessment & Resources

**Glossary**
- **Agent Identity:** a per-agent SPIFFE-based principal with certificate-bound, auto-rotated credentials (Preview).
- **Auth manager:** credential vault and OAuth broker for agent-to-tool auth.
- **PAB:** Principal Access Boundary, which caps the resources a principal is eligible to access.
- **UAP:** Unified Access Policy, an IAM v3 allow/deny policy enforced by IAP on Agent Gateway traffic.
- **Semantic Governance:** LLM-evaluated natural-language constraints on proposed tool calls (Preview).
- **Floor settings:** the Model Armor minimum baseline across templates.
- **PSC-I:** Private Service Connect interface for private agent egress.

**Self-assessment**
1. *Why do bindings break after a redeploy, and how do you prevent it?* A redeploy creates a new resource ID and therefore a new principal. Read `spec.effectiveIdentity` in CI/CD and put baseline roles on the project `principalSet`.
2. *IAM deny vs PAB?* Deny blocks specific permissions; PAB limits which resources are reachable at all. Neither grants access.
3. *Why can't IAM alone stop a destructive MCP tool call?* Google Cloud IAM doesn't see MCP tool names; a gateway UAP on `tool.name`/`destructive_hint` does.
4. *When does Semantic Governance help where UAP can't?* When the tool is allowed but the specific call doesn't match user intent (indirect injection) or breaks a business rule.
5. *What's needed to redact PII through Model Armor on the gateway?* An advanced SDP de-identify template plus `INSPECT_AND_BLOCK`.
6. *Which audit logs must you enable to see model usage?* Data Access logs. Viewing them requires Private Logs Viewer (`roles/logging.privateLogViewer`).

**Practice quiz:** `quiz.html?topic=agent-platform-security`

**Sources (docs.cloud.google.com unless noted)**
- iam/docs/agent-identity-overview
- gemini-enterprise-agent-platform/scale/runtime/agent-identity
- gemini-enterprise-agent-platform/scale/runtime/manage-agent-access
- gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent
- iam/docs/auth-manager-overview
- iam/docs/principal-access-boundary-policies
- gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview
- agent-registry/overview
- gemini-enterprise-agent-platform/build/skill-registry
- gemini-enterprise-agent-platform/govern/policies/overview-uap · iam-overview-uap · semantic-governance-overview
- gemini-enterprise-agent-platform/govern/configure-model-armor
- model-armor/overview
- gemini-enterprise-agent-platform/models/capabilities/configure-safety-filters
- gemini-enterprise-agent-platform/models/security-controls
- gemini-enterprise-agent-platform/scale/runtime/private-service-connect-interface
- gemini-enterprise-agent-platform/machine-learning/general/vpc-service-controls
- gemini-enterprise-agent-platform/machine-learning/general/cmek
- gemini-enterprise-agent-platform/resources/data-residency
- gemini-enterprise-agent-platform/machine-learning/general/audit-logging
- secret-manager/docs/integrate-secret-manager-with-adk
- security-command-center/docs/ai-protection-overview
- adk.dev/tools-custom/confirmation/

**Further reading**
- **SAIF for agents:** Google's [Secure AI Framework](https://saif.google/) and its [risk map](https://saif.google/secure-ai-framework/saif-map) catalog AI security risks and controls. The paper [An introduction to Google's approach for secure AI agents](https://research.google/pubs/an-introduction-to-googles-approach-for-secure-ai-agents/) rests on three principles: agents need well-defined human controllers, carefully limited powers, and observable actions and planning. In this guide, controllers map to Agent Identity and HITL approvals (§01, §09), limited powers to IAM, PAB and gateway policies (§03, §05), and observability to audit logs and AI Protection (§08).

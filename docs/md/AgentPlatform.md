# Agent Platform: Build, Retrieve & Run — Study Guide

> **Author:** Michaël Bettan  
> **Version:** 2.0  
> **Updated:** October 2026

---

## 00. Overview & Mental Model

**Definition:** **Gemini Enterprise Agent Platform** is the evolution of Vertex AI for building, scaling, governing, and optimizing agents on Google Cloud. This guide covers the *build, retrieve, run, and optimize* lifecycle: choosing among the three build paths (**Agent Studio**, **Managed Agents API**, and code-first **ADK / open frameworks** with **`agent-starter-pack`** and **`agents-cli`**), hosting agents on **Agent Runtime** (formerly Agent Engine), managed **Sessions**, **Memory Bank**, **Example Store**, and the **Code Execution** sandbox, choosing between Agent Runtime, Cloud Run, and GKE, grounding and retrieval services, caching and external state, the **Agent Evaluation** suite (2-step user simulation, environment simulation, adaptive rubrics, trajectory metrics, online monitors, and golden-dataset flywheels), **Agent Observability** (Agent Registry telemetry views, dual-attribution audit logs, failure cluster analysis, and programmatic prompt optimization), and cost/quota management.

**Out of scope here:** cryptographic identity, IAM, Principal Access Boundary (PAB), VPC Service Controls, Model Armor, Sensitive Data Protection, Agent Gateway, and governance policies live in the companion [Agent Platform Security & Governance guide](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html). ADK code-level patterns live in the [ADK guide](https://mbettan.github.io/machine-learning-cert/ADK.html); vendor-neutral retrieval design in the [RAG guide](https://mbettan.github.io/machine-learning-cert/RAG.html); model selection, Gemini 4 Argon, and Model Garden in the [Google guide](https://mbettan.github.io/machine-learning-cert/Google.html); cross-agent protocol wire mechanics in the [A2A guide](https://mbettan.github.io/machine-learning-cert/A2A.html).

> **Mental model (5-part anatomy mapped to Google Cloud):**  
> The **model** (Gemini 4 Argon, Gemini 3.8 Flash…) is the reasoning brain; the **orchestration layer** (ADK, LangGraph, Managed Agents harness, or Agent Studio) wires the Think → Act → Observe loop; **Agent Runtime** is the managed body that keeps long-running tasks alive; **Sessions** are short-term working memory for one conversation while **Memory Bank** is consolidated long-term memory across conversations; **MCP servers, retrieval services, and the Code Execution sandbox** are the hands and library; **Evaluation + Observability + Optimizer** form the continuous AgentOps quality flywheel.

> **Rule 0 (managed by default):**  
> Choose the most managed component that meets the requirement. Move down the stack (**Managed Agents API / Agent Studio** → **Agent Runtime** → **Cloud Run** → **GKE**) only for a concrete engineering need: custom orchestration code, non-Python stacks, hosting stateless Streamable HTTP MCP servers, GPUs/self-hosted open weights, or fine-grained kernel/network control.

> [!NOTE]
> Product names, preview status, quotas, and regions evolve continuously. Items marked **Preview** are Pre-GA and do not carry GA SLAs. Always verify launch stage, regional availability, and pricing against current Google Cloud documentation before production commitment.

---

## 01. Platform Map: Naming, Pillars & Build Paths

### The four pillars

| Pillar | What it covers | Key components |
| :--- | :--- | :--- |
| **Build** | Create agents, attach skills/tools, and connect to enterprise data | **ADK** (Python, Go, Java, TypeScript), **Agent Studio** (low-code visual builder), **Managed Agents API** + **Interactions API** (**Preview**), **Skill Registry**, **Agent Garden** (samples/templates), **Model Garden** (200+ models), **RAG Engine**, **Agent Search**, **Agent Retrieval**, **`agent-starter-pack`**, **`agents-cli`** |
| **Scale** | Run stateful, multi-step agents reliably in production | **Agent Runtime** (`reasoningEngines`), **Sessions**, **Memory Bank**, **Example Store** (**Preview**), **Code Execution** sandbox, **A2A Agent Hosting** |
| **Govern** | Control identity, discovery, egress, and security policy | **Agent Registry**, **Agent Identity** (SPIFFE), **Agent Gateway**, **Model Armor**, governance policies → see [Security guide](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html) |
| **Optimize** | Simulate, evaluate, observe, and continuously improve quality | **Gen AI Evaluation Service** (2-step user simulation, environment simulation, adaptive rubrics, trajectory metrics, **Online Monitors**), **Agent Registry Observability**, **Failure Cluster Analysis**, **Prompt Optimization / Agent Optimizer** |

**Billing model:** Agent Platform is **pay-as-you-go** consumption (tokens, vCPU/GiB-seconds on runtimes, storage/queries on indexes) with optional **Provisioned Throughput** (GSUs) for developers; the **Gemini Enterprise app** (formerly Agentspace) is a separate per-seat subscription workspace where business users discover and invoke published agents.

### Three build paths on Agent Platform

| Build path | Target builder & control level | How the loop & state work | Best fit |
| :--- | :--- | :--- | :--- |
| **1. Agent Studio** (low-code) | Citizen developers, domain experts, rapid prototypers | Visual canvas to configure instructions, Gemini model, grounding data stores, MCP tools, and sub-agents; test in-console and publish 1-click to **Agent Runtime** or **Gemini Enterprise Workflow Builder** | Internal knowledge assistants, departmental workflows, rapid validation before pro-code handoff |
| **2. Managed Agents API** (**Preview**) | Developers wanting a declarative, harness-managed agent via REST/SDK | Combines the **Agents API** (reusable agent definition + mounted **Skill Registry** skills) with the stateful **Interactions API** (`client.interactions.create`, server-side `previous_interaction_id`, `background=true`). Google owns the Think-Act-Observe loop, automatic restarts, artifacts, and an isolated Linux sandbox (**no network egress by default**). Powers managed endpoints like **Antigravity Agent** and **Deep Research**. | Autonomous coding, file analysis, research, and document-producing tasks where you want zero harness maintenance |
| **3. Code-first ADK & Open Frameworks** | Software & AI engineers needing deterministic control over control flow, callbacks, and CI/CD | You author orchestration code in **ADK**, **LangGraph**, **CrewAI**, **AG2**, or **LlamaIndex**, scaffold production CI/CD + Terraform via **`agent-starter-pack`** / **`agents-cli`**, and deploy to **Agent Runtime**, **Cloud Run**, or **GKE** | Complex multi-agent topologies, strict compliance callbacks, custom deterministic guardrails, hybrid A2A meshes |

### Name changes you must recognize

| Current name | Former name | Exam / API note |
| :--- | :--- | :--- |
| **Gemini Enterprise Agent Platform** | Vertex AI | Evolution of the same platform; IAM permissions still use `aiplatform.*` |
| **Gemini Enterprise** (end-user app) | Google Agentspace | Unified enterprise search + multi-agent workspace supporting A2A and **A2UI** |
| **Agent Runtime** | Vertex AI Agent Engine / Reasoning Engine | Underlying REST/gRPC resource remains `projects/…/locations/…/reasoningEngines/<id>` |
| **Agent Search** | Vertex AI Search | Turnkey managed search/RAG (`discoveryengine.googleapis.com`) with connectors and native ACLs |
| **Agent Retrieval** | Vector Search 2.0 | Collections-based, self-tuning vector store with schema and auto-embeddings |
| **Vector Search 1.0** | Matching Engine | High-scale ScaNN ANN index-as-a-service |
| **Workflow Builder** (Gemini Enterprise) | Agent Designer | No-code builder for end-user chat agents and scheduled/triggered workflows in Gemini Enterprise |
| **Gemini 4 Argon / Gemini 3.x** | Gemini 1.5 / PaLM 2 | Active frontier (`gemini-4-argon`) and workhorse (`gemini-3.8-flash`) generations |

> **Model Garden pointer:** Model Garden catalogs Google first-party (Gemini 4 Argon, Gemini 3.8 Flash, Nano Banana 2.1, Gemini Omni 1.1 Flash, Veo 3.1, Lyria 3.5, Chirp 3), partner MaaS (Anthropic Claude, Mistral, DeepSeek), and open-weight models (Gemma 4, Gemma 3n, Llama). **Gemini itself is served only through managed Google endpoints** — you cannot self-host Gemini weights on Cloud Run or GKE; open models such as Gemma 4 can be self-hosted there.

---

## 02. Agent Runtime: Deploying & Scaling Stateful Agents

**Agent Runtime** is Google Cloud's fully managed, opinionated compute runtime purpose-built for stateful agents: sub-second cold starts, optional `min_instances` to keep instances warm, long-running and multi-day asynchronous execution, IAM and **VPC Service Controls** perimeter enforcement, private egress to on-prem/VPC resources via **Private Service Connect (PSC) interface** network attachments, cryptographic **Agent Identity** (`spiffe://…`), and zero-plumbing integration with **Sessions**, **Memory Bank**, **Example Store**, **Code Execution**, **A2A**, and OpenTelemetry observability.

### Framework & protocol support

| Support level | Frameworks & protocols |
| :--- | :--- |
| **First-class native integration** | **ADK** (Python via `adk deploy agent_engine` or `agents-cli`; Go via `adkgo`; Java & TypeScript via container deployment) |
| **Built-in SDK templates** | **LangChain**, **LangGraph**, **AG2**, **LlamaIndex** (**Preview**) |
| **Custom Python class** | **CrewAI** or any custom Python class implementing `query` / `async_query` / `stream_query` |
| **Agent2Agent (A2A) hosting** | Native **`A2aAgent`** wrapper (**Preview**) exposing an `AgentCard`, task store, and A2A task endpoints directly on Agent Runtime |
| **Any language / runtime** | Custom **Dockerfile** or pre-built **Artifact Registry container image** conforming to the Agent Runtime HTTP contract |

### Five deployment methods

| Method | Languages | Best for |
| :--- | :--- | :--- |
| **Developer Connect** (Git repository) | Python | GitOps CI/CD — automatically builds and deploys directly from a connected Git repo without managing local build artifacts |
| **Source files** (inline directory) | Python | Automated CI/CD pipelines and Terraform; packages local source directly with no Cloud Storage staging bucket required |
| **Dockerfile** | Any | Non-Python agents (Go, Java, TypeScript/Node) or Python agents needing OS-level system packages |
| **Container image** (Artifact Registry) | Any | Pre-built, vulnerability-scanned immutable images promoted from staging to prod; **lowest deployment latency** |
| **SDK object** (in-memory pickle) | Python | Rapid notebook/Colab prototyping (`client.runtimes.create(agent=my_agent)`); object must be serializable |

### SDK, `agent-starter-pack` & `agents-cli` production workflow

- **Agent Platform SDK (`google-cloud-agentplatform`):** Exposes `agentplatform.Client(project=…, location=…)` with `client.runtimes`, `client.sessions`, `client.sandboxes`, and `client.memory_banks` (superseding the legacy `vertexai.agent_engines` namespace).
- **`agent-starter-pack` & `agents-cli`:** Production scaffolding toolkit that generates standardized repo layouts:
  - Infrastructure-as-Code (**Terraform**) for staging/prod projects, least-privilege IAM, Artifact Registry, and VPC-SC/PSC wiring.
  - **Cloud Build** or GitHub Actions CI/CD pipelines with **evaluation gates** (`agents-cli eval` runs golden + trajectory evalsets on every PR and blocks promotion if scores regress).
  - Pre-wired **OpenTelemetry** tracing, BigQuery log sinks, and feedback collection for the post-deployment data flywheel.
- **Managed Agents API (`Agents API` + `Interactions API`, Preview):** Instead of deploying container code to `reasoningEngines`, you register an Agent config + **Skill Registry** bundles (`SKILL.md` + helper scripts/assets) and invoke it via `Interactions API`. Server-side state (`previous_interaction_id`) and `background=true` allow multi-hour execution without client polling loops, inside an isolated Linux container with **network egress disabled by default**.

> **Common trap — reserved environment variables:** Never override platform-managed environment variables such as `GOOGLE_CLOUD_PROJECT` or `PORT` in your deployment spec, and never use the reserved `GOOGLE_CLOUD_AGENT_ENGINE*` prefix for custom application variables (other than documented flags like `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true`).

> **Exam tip:** **Agent Runtime hosts stateful agents, NOT standalone MCP tool servers.** Deploy custom **Streamable HTTP MCP servers** on **Cloud Run** (for serverless scale-to-zero) or **GKE**, register them in **Agent Registry**, and invoke them from your Agent Runtime agent.

---

## 03. Choosing a Runtime: Agent Runtime vs. Cloud Run vs. GKE

| Criterion | **Agent Runtime** | **Cloud Run** | **GKE (Standard / Autopilot)** |
| :--- | :--- | :--- | :--- |
| **Primary workload** | Stateful single- or multi-agent orchestrators (ADK, LangGraph, A2A) | Stateless APIs, webhook handlers, **Streamable HTTP MCP servers**, polyglot microservices, async Jobs | Self-hosted open-weight models (Gemma 4 via vLLM/TGI), GPU/TPU workloads, dense multi-service meshes |
| **Ops overhead** | Lowest (fully managed agent harness) | Low (serverless containers) | Highest (cluster, node-pool, and networking lifecycle) |
| **State & memory** | Native **Sessions**, **Memory Bank**, **Example Store**, **Code Execution** | Ephemeral local disk/RAM — externalize state to Agent Platform Sessions, Memorystore, Firestore, or Cloud SQL | StatefulSets, local SSDs, or external managed databases |
| **Scaling & duration** | Managed autoscaling; `min_instances` for zero cold start; supports long-running/multi-day agent workflows | Scales to zero; HTTP request timeout up to **60 minutes**; Cloud Run Jobs for batch tasks | Full control over HPA/VPA, custom metrics, GPU time-slicing, and spot nodes |
| **Isolation & security** | IAM, VPC-SC, PSC interface, Agent Identity, isolated Code Execution sandbox | IAM, Direct VPC egress, VPC-SC, built-in Agent Identity & Agent Registry integration | Workload Identity Federation, **GKE Sandbox (gVisor)** kernel isolation, Calico/Cilium NetworkPolicies |
| **Hosts MCP servers?** | **No** | **Yes** (ideal for Streamable HTTP MCP servers) | **Yes** (high-density or stateful MCP fleets) |
| **Main trade-off** | No custom GPUs; non-Python stacks require custom containers | In-process memory vanishes on scale-in or instance recycle | Highest operational and Kubernetes platform engineering cost |

**Architectural decision rules:**

1. **Python/ADK/LangGraph agent + minimal ops + managed Sessions & Memory Bank** → **Agent Runtime**.
2. **Custom remote MCP server (Streamable HTTP), polyglot TypeScript/Java/Go webhook agent, or spiky scale-to-zero workload** → **Cloud Run**.
3. **Self-hosting Gemma 4 / Llama on GPUs/TPUs, strict kernel-level multi-tenant sandboxing (`gVisor`), or existing enterprise K8s platform** → **GKE**.
4. **Zero-infrastructure autonomous coding/file/research agent where Google manages the loop and Linux sandbox** → **Managed Agents API (Preview)**.

> **Common trap — keeping conversation history in Cloud Run RAM:** Cloud Run instances scale to zero or recycle unpredictably, wiping in-process dictionaries and local SQLite files. Always externalize conversational state to **Agent Platform Sessions** (`--session_service_uri agentengine://<id>`), **Memorystore**, **Firestore**, or **Cloud SQL**.

---

## 04. Context Engineering: Sessions, Memory Bank & Example Store

Effective agents practice **context engineering** — dynamically assembling only the task-relevant history, user facts, and few-shot demonstrations needed for the current turn rather than stuffing entire raw logs into the prompt window (which causes **context rot**, latency spikes, and quadratic attention cost).

### Core state vocabulary

| Abstraction | Scope | Lifetime | Typical contents |
| :--- | :--- | :--- | :--- |
| **Session** | Chronological append-only log of **Events** (user messages, model thoughts, tool calls, tool outputs) | Single conversation thread | Turn-by-turn dialogue and tool trace |
| **State** | Mutable key-value scratchpad (`session.state`, `user:`, `app:`, `temp:` prefixes in ADK) | Current turn (`temp:`) or current session | Cart IDs, workflow step flags, extracted slot values |
| **Memory Bank** | LLM-extracted, consolidated semantic facts & preferences | Persistent across sessions (with configurable TTL & revisions) | User role, preferred coding language, dietary/travel rules, recurring project context |
| **Example Store** (**Preview**) | Dynamically retrieved input→trajectory/output few-shot pairs | Persistent per agent/task corpus | Edge-case tool routing demonstrations, strict formatting exemplars |

**Managed Sessions:** ADK agents on Agent Runtime automatically persist sessions. Agents running on Cloud Run, GKE, or local dev workstations can attach to the exact same managed store via `--session_service_uri agentengine://<id>`. For long sessions, configure **context compaction** (sliding-window summarization or token-threshold pruning) so older raw tool payloads do not bloat every turn.

### Memory Bank (long-term semantic & episodic memory)

- **Asynchronous LLM extraction & consolidation (`GenerateMemories`):** Extracts durable facts from session events in the background (zero hot-path latency penalty) and **consolidates** them with existing memories — merging duplicates, updating stale preferences, and resolving contradictions while keeping **memory revisions** for audit/rollback.
- **Explicit agent-triggered writes (`CreateMemory`):** Exposed as a tool ("memory-as-a-tool") when the user explicitly says *"Always format my SQL queries in GoogleSQL"* and immediate persistence is desired.
- **Scoped retrieval (`RetrieveMemories`):** Retrieves by exact scope or **semantic similarity search** against the active user turn.
- **Strict tenant isolation:** Every memory is keyed by an explicit identity scope such as `{user_id, app_name}` — never share an unscoped memory namespace across users.
- **Enterprise governance:** Custom **Memory Topics** (defining *what* is worth remembering and *what* PII must be ignored), multimodal event ingestion, **TTL** policies (default or per-memory expiration for GDPR/retention compliance), IAM Conditions, `roles/aiplatform.memoryViewer` / `roles/aiplatform.memoryEditor`, CMEK, and regional data residency (`gcp.resourceLocations`).
- **ADK integration:** `VertexAiMemoryBankService`; trigger incremental extraction from an `after_agent_callback` via `add_events_to_memory` (preferred over full-session `add_session_to_memory` to avoid redundant token processing).

> **Common trap — memory poisoning:** If untrusted external content (e.g., an email or web page fetched by a tool) tricks the extraction LLM into storing a malicious instruction in Memory Bank, that instruction is injected into *future* sessions (**persistent cross-session prompt injection**). Screen untrusted inputs with **Model Armor**, constrain extraction with strict **Memory Topics**, and audit memory revisions ([Security guide](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html)).

### Example Store (Preview)

Stores curated few-shot demonstrations and dynamically injects only the top-$k$ semantically similar examples at inference time — improving edge-case accuracy without inflating every prompt.
- **Immutable embedding binding:** The embedding model (e.g., `text-embedding-005`, `text-multilingual-embedding-002`, or `gemini-embedding-001`) is **locked when the Example Store instance is created**; switching embedding models requires creating a new instance and re-indexing.
- **Quota awareness:** Up to 50 Example Store instances per project per region (verify current limits).

| Requirement | Right component |
| :--- | :--- |
| Recall what *this user* asked three turns ago | **Session** events / scratchpad `state` |
| Remember *this user's* preferred timezone and reporting style next month | **Memory Bank** |
| Show the model 3 similar complex SQL/tool trajectories at runtime | **Example Store** (**Preview**) |
| Answer questions grounded in 50,000 corporate policy PDFs with ACLs | **Agent Search** (Section 06) |

---

## 05. Code Execution Sandbox

The **Code Execution** sandbox executes untrusted, model-generated Python code inside a hardened micro-container completely separate from the agent's own runtime process:
- **Sub-second provisioning & stateful sessions:** Spins up and executes in `<1s`, supports file I/O up to **100 MB**, and preserves stateful sandbox files/variables across turns for up to **14 days** (configurable TTL).
- **ADK integration:** `AgentEngineSandboxCodeExecutor` binds **one isolated sandbox per session**, enabling multi-turn data science, chart generation, CSV reconciliation, and deterministic math verification. Callable even if the agent orchestrator itself runs on Cloud Run or GKE.
- **Managed Agents sandbox:** In the **Managed Agents API**, the built-in Linux execution environment runs with **no outbound network access by default** and mounts approved **Skill Registry** scripts/files cleanly into the workspace.

> **Mental model — runtime vs. sandbox:** **Agent Runtime** runs *trusted* orchestration code written and reviewed by engineers (and holds IAM/MCP credentials). The **Code Execution sandbox** runs *untrusted* code synthesized on the fly by an LLM. Running `exec()` inside the agent's own container exposes service-account tokens, environment variables, and VPC network paths.

---

## 06. Grounding, Retrieval & Enterprise Tooling

### Retrieval service decision matrix

| Service | Architecture | Choose when | Watch out for |
| :--- | :--- | :--- | :--- |
| **Agent Search** (formerly Vertex AI Search) | Turnkey managed search & RAG (`discoveryengine`) | Enterprise documents across SharePoint, Drive, Confluence, Jira, GCS, or BigQuery needing built-in layout parsing, hybrid search, reranking, citations, and **document-level source ACL enforcement** | Less low-level control over custom chunking or bespoke embedding pipelines |
| **RAG Engine** | Code-first modular RAG orchestration over **corpora** | Engineers need explicit control over chunk size/overlap, parser choice (default, LLM parser, **Document AI Layout Parser**), embedding model, and vector store (**RagManagedDb**, Vector Search, AlloyDB, Pinecone) | Verify regional support (`gemini-4-argon` is not directly bound as a RAG Engine generator where unsupported; Agent Retrieval corpora require supported regions + cosine distance) |
| **Agent Retrieval** (formerly Vector Search 2.0) | Self-tuning, schema-aware collection store | Storing structured + unstructured **Data Objects** with automatic managed embeddings or BYO embeddings without cluster sizing | Exact KNN up to ~100k objects; create an ANN **Collection Index** beyond ~100k objects |
| **Vector Search 1.0** | High-scale ScaNN ANN index-as-a-service | Tens of millions to billions of custom vectors (e.g., `gemini-embedding-2` multimodal vectors) at single-digit-ms latency with custom streaming/batch pipelines | Deployed index endpoints bill continuously by node-hour even at zero QPS |
| **Grounding with Google Search / Maps / Web** | Managed live public-index grounding | Fresh public facts, news, places/geospatial context, or third-party enterprise web grounding (Parallel, Exa) | Must render required **Search Suggestions** / attribution chips from `groundingMetadata` |
| **BigQuery (`VECTOR_SEARCH`)** | In-warehouse SQL vector search | Batch enrichment, analytical joins over petabyte warehouse tables, offline eval pipelines | High query startup latency (~seconds) — wrong fit for sub-100ms interactive chat turns |
| **AlloyDB AI / Cloud SQL (`pgvector` / ScaNN)** | Transactional operational DB vectors | Low-latency hybrid SQL filters (`WHERE tenant_id = $1 AND status = 'OPEN'`) joined directly with live OLTP rows | You manage database sizing, connection pooling (`MCP Toolbox`), and index maintenance |

> **Common trap — `DOT_PRODUCT` metric failure under RAG Engine:** When backing a **RAG Engine** corpus with an **Agent Retrieval** / Vector Search index, configure the index distance metric as **`COSINE`**. RAG Engine issues cosine-distance queries, so leaving the index at the default `DOT_PRODUCT` fails at runtime with `FAILED_PRECONDITION`.

### Precision, reranking & citation verification

- **Ranking API (`semantic-ranker-default@latest`):** Stateless cross-encoder reranker that re-scores top-$N$ candidate chunks from hybrid/vector retrieval down to the highest-precision top-$k$ before LLM generation.
- **Check Grounding API:** Evaluates each claim in a candidate answer against supplied source facts, returning a support score and per-sentence citations to block ungrounded hallucinations.
- **Grounding metadata:** Inspect `groundingChunks`, `groundingSupports`, `webSearchQueries`, and `searchEntryPoint` to render verifiable inline citations.
- **Agent Search grounding limits:** Attach up to **10 data stores** per request; callers require `roles/discoveryengine.viewer` (and user identity propagation via Workforce Identity / OAuth when enforcing source document ACLs).

### Google Cloud MCP servers & enterprise connectors

- **Google-managed remote MCP servers:** Serverless HTTP MCP endpoints (`https://<service>.googleapis.com/mcp` or regional `.rep.googleapis.com/mcp`) auto-provisioned when enabling the service API and discoverable in **Agent Registry** (`urn:mcp:…`). Available across **BigQuery**, **AlloyDB**, **Spanner**, **Bigtable**, **Firestore**, **Memorystore**, **GKE**, **Compute Engine**, **Pub/Sub**, **Apigee API Hub**, **Dataplex Knowledge Catalog**, **Looker**, and **Agent Retrieval**. Callers need **`roles/mcp.toolUser`** (`mcp.tools.call`) plus underlying resource IAM permissions.
- **MCP Toolbox for Databases (`mcp-toolbox`):** Open-source server managing connection pools, OAuth/IAM auth, and parameterized, SQL-injection-safe tool definitions for Cloud SQL, AlloyDB, Spanner, BigQuery, and Looker.
- **Apigee & Application Integration (`ApplicationIntegrationToolset`):** Expose legacy REST/SOAP APIs and 100+ enterprise ERPs/CRMs (SAP, Salesforce, Workday, ServiceNow) as governed agent tools with rate-limiting, quota enforcement, and **Agent Gateway** egress policies.

---

## 07. Caching & External State

| Backing store | Primary role in an agentic architecture |
| :--- | :--- |
| **Gemini Context Caching** | **Implicit caching** (on by default, zero storage fee; **the only context cache mode on `gemini-4-argon`**) and **Explicit caching** (`cachedContents` with TTL + storage fee on supported Gemini 2.5/3.x models) for massive repeated system instructions, tool schemas, or static corpora |
| **Memorystore for Redis / Valkey** | Sub-millisecond hot state, distributed rate-limit/budget counters, idempotency locks, and **semantic response caching** via Redis HNSW/FLAT vector search |
| **Firestore** | Serverless document store for real-time UI state sync, human-in-the-loop approval queues, and user profiles |
| **Cloud SQL / AlloyDB** | ACID relational workflow checkpoints; backs ADK's `DatabaseSessionService` when custom SQL querying over sessions is required |
| **Agent Platform Sessions** | Zero-ops managed event & scratchpad persistence for ADK and Agent Runtime |
| **BigQuery** | Long-term telemetry sink, offline evaluation datasets, failure-cluster analytics, and FinOps token attribution — **never hot-path turn state** |

> **Common trap — cross-tenant semantic cache leakage:** If User A asks *"What is the Q4 executive bonus pool?"* and the semantic cache keys only on the query embedding, User B asking a similar question can receive User A's restricted answer. **Always partition semantic cache keys by tenant/role/ACL scope** (or bypass semantic caching entirely for user-authorized data).

---

## 08. Optimize Part 1: Agent Evaluation, Simulation & Golden Flywheels

Evaluating non-deterministic, multi-turn agents requires grading **both the final outcome and the intermediate decision trajectory** (`client.evals.evaluate()` / `agents-cli eval`).

### Metric hierarchy

| Metric family | How it grades | Built-in examples & when to use |
| :--- | :--- | :--- |
| **Adaptive rubrics** (recommended default) | An autorater dynamically generates prompt-specific pass/fail testable rubrics for each eval item, then grades the response against them | `GENERAL_QUALITY` — adapts automatically across diverse open-ended prompts without brittle static checklists |
| **Static rubrics** | Applies fixed organization-wide pass/fail criteria to every turn | Brand tone, regulatory disclaimers, strict refusal formatting |
| **Agent outcome & grounding metrics** | LLM-as-judge autoraters specialized for agent runs | `FINAL_RESPONSE_QUALITY`, `HALLUCINATION` (faithfulness to retrieved/tool context), `TOOL_USE_QUALITY` |
| **Trajectory metrics** | Deterministic comparison between actual tool-call sequence/arguments and a golden reference trajectory | `trajectory_exact_match` (strict compliance pipelines), `trajectory_in_order_match` (required steps in order, extra read steps allowed), `trajectory_any_order_match` (parallel gathering), `trajectory_precision` / `trajectory_recall` |
| **Computation / code metrics** | Deterministic programmatic graders (fast, free, reproducible) | JSON Schema validation, regex/SQL AST checks, exact match, ROUGE/BLEU |

### 2-Step Agent Simulation & Environment Simulation

Static single-turn test prompts miss multi-turn clarification loops, state drift, and tool outages. Agent Platform provides two simulation engines:

1. **2-Step Agent Simulation (Multi-Turn User Simulator):**
   - **Prerequisite:** Requires an immutable **Agent Registry version snapshot** (capturing instructions, model config, and tool declarations) so runs are reproducible.
   - **Step 1 — Scenario Synthesis:** Inspects the agent's instructions and tool schemas to automatically synthesize realistic **`Starting Prompts`** paired with a hidden **`Conversation Plan`** (persona, goal, edge-case constraints, and secrets to reveal only if asked).
   - **Step 2 — Multi-Turn Execution:** A simulated user LLM conducts a live multi-turn dialogue against the target agent until the goal is achieved, abandoned, or hits `max_turns`, emitting full OpenTelemetry traces for trajectory and rubric scoring.
2. **Environment Simulation (Fault & Tool Mocking):**
   - Intercepts outbound tool calls during evaluation to inject **deterministic faults** — HTTP `503 Service Unavailable`, `429` rate limits, timeout spikes, malformed JSON, or synthetic edge-case database rows — verifying fallback logic, retry budgets, and graceful degradation **without mutating production systems**.

### Online Evaluation Monitors & the Production Data Flywheel

- **Online Evaluation (`OnlineEvaluator`):** Continuously samples live production traces (requiring Cloud Trace + OpenTelemetry GenAI spans) and runs asynchronous autoraters (`HALLUCINATION`, `TOOL_USE_QUALITY`, `GENERAL_QUALITY`) to trigger Cloud Monitoring alerts on quality drift.
- **Golden-Dataset Flywheel:** Capture explicit human feedback (thumbs-down, user re-prompts, HITL escalations) and low-scoring online monitor traces → export via Cloud Logging / BigQuery → strip/redact PII with **Sensitive Data Protection (SDP)** → curate and label expected trajectories → append to the **golden regression evalset** gated in CI/CD (`agents-cli eval`).

> **Exam tip:** `FINAL_RESPONSE_QUALITY` alone cannot catch **"right answer, wrong path"** bugs (e.g., an agent refunded a customer without calling `check_return_eligibility` first). Always combine outcome rubrics with **`trajectory_in_order_match` / `trajectory_exact_match`** when policy mandates specific tool ordering.

> **Common trap — over-privileged Online Monitor creation:** Online evaluation monitors execute under a platform service agent identity that reads trace data and invokes judge models; restrict IAM permissions to create/modify monitors to prevent unauthorized trace inspection or quota spend.

---

## 09. Optimize Part 2: Observability, Audit & Prompt Optimization

### OpenTelemetry & Agent Registry observability views

- **Standards:** Built on **OpenTelemetry (OTel)** using **GenAI semantic conventions** (hierarchical spans for `invoke_agent`, `chat` / LLM calls, `execute_tool` / MCP calls, and `Model Armor` screening).
- **Enabling telemetry on Agent Runtime:** Set `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true` (exports traces, metrics, and structured logs **without** raw prompt/response bodies by default) and `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`.
- **Privacy-safe payload capture:** Prompt/completion text capture requires explicit opt-in via `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true` — enable only in approved environments paired with **SDP de-identification** and restricted Cloud Logging buckets (`roles/logging.privateLogViewer`).
- **Eight Agent Registry Observability tabs:**
  1. **Overview:** Sessions, turns, token throughput, error rates, p50/p95/p99 end-to-end latency.
  2. **Evaluation:** Historical offline benchmark trends + live **Online Monitor** quality scores.
  3. **Models:** Per-model latency, input/thinking/output token breakdown, and `429` error rates.
  4. **Tools:** Per-tool and per-MCP-server **p95 latency**, tool error rates, and **"no-tool interactions"** (spotting tools the agent ignores due to poor descriptions).
  5. **Usage:** Active users, tenant consumption, and quota utilization.
  6. **Logs:** Correlated structured Cloud Logging entries (`trace_id` linked).
  7. **Traces:** Waterfall / DAG span inspector showing exact LLM thinking time vs. tool wait time vs. Model Armor overhead.
  8. **Topology:** Auto-discovered live dependency graph of orchestrator agents, A2A sub-agents, models, and MCP servers.

### Dual-Attribution Agentic Audit Logging

When an agent acts on behalf of a human user, traditional service-account logs lose *who* triggered the action or *which* agent made the autonomous decision. Agent Platform's **Cloud Audit Logs** (`is_agentic=true` metadata) record **dual attribution**:
1. The cryptographic **Agent Identity** (`spiffe://…` / `principal://…` in Agent Registry).
2. The initiating **human user principal** (propagated OAuth / Workforce Identity context).

This prevents "confused deputy" forensic blind spots during security incident response ([Security guide](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html)).

### Failure Cluster Analysis & Programmatic Prompt Optimization

- **Failure Cluster Analysis:** Aggregates failing offline simulation traces and low-scoring production traces, using LLM clustering to group thousands of raw errors into actionable root-cause buckets (e.g., *"ambiguous date parameter in `book_flight` tool schema"*, *"premature termination before pagination completes"*).
- **Prompt Optimization (`Agent Optimizer` / Vertex AI Prompt Optimizer):** Closed-loop automated optimization that takes your current system instructions, tool descriptions, and golden eval dataset + rubrics, iteratively mutates instructions/few-shot examples, scores candidates via `client.evals`, and outputs a Pareto-optimal prompt revision — eliminating manual "prompt whack-a-mole" when migrating models (e.g., Gemini 2.5 → Gemini 3.8 Flash or Gemini 4 Argon) or fixing failure clusters.

| Production symptom | First place to inspect & remediate |
| :--- | :--- |
| High p95 turn latency | **Traces waterfall** → check whether `thinking_level=HIGH` decode time, serial MCP tool calls, or cross-region retrieval dominates |
| Agent hallucinates instead of calling a tool | **Tools tab** ("no-tool interactions") → refine tool docstring/schema + add `trajectory_in_order_match` eval |
| Sudden quality drop on live traffic | **Evaluation tab** (Online Monitors) + **Failure Cluster Analysis** → convert cluster samples into golden eval cases and run **Prompt Optimization** |
| Unexpected token bill spike | **Models / Usage tabs** → check uncompacted session history growth, missing implicit cache prefix alignment, or runaway retry loops |

---

## 10. Cost, Quotas & Capacity Engineering

| Symptom / error | Root cause | Architectural fix |
| :--- | :--- | :--- |
| **`429 RESOURCE_EXHAUSTED`** on Standard PayGo | Shared regional pool contention or project TPM/QPM rate limit | Route stateless calls to the **`global` endpoint**, add exponential backoff with jitter, enable **Priority PayGo** for bursty critical paths, or reserve **Provisioned Throughput (GSUs)** for steady baseline traffic (spills over to PayGo by default unless `X-Vertex-AI-LLM-Request-Type: dedicated` is set) |
| **"Region temporarily at capacity"** during Agent Runtime deploy | Physical compute pool exhaustion in that region — **NOT** an IAM or project quota limit | Deploy to an alternate supported region, reduce requested vCPU/memory per instance, or retry off-peak (a quota increase ticket will **not** resolve physical pool exhaustion) |

**Representative Agent Runtime default quotas** (per project per region; verify current docs): `query`/`streamQuery` 90 RPM, session writes 100 RPM, append events 300 RPM, session reads 10,000 RPM, max 100 agent resources, Memory Bank writes 100 RPM / reads 300 RPM, Code Execution sandbox runs 1,000 RPM.

**Six high-impact FinOps levers:**
1. **Tiered model routing:** Use **Gemini 3.5 Flash-Lite** for high-QPS intent routing/guardrails, **Gemini 3.8 Flash** for main agentic tool loops, and **Gemini 4 Argon** only for complex planning/synthesis.
2. **Right-size `thinking_level`:** Default to `LOW` or `MEDIUM` on routine tool turns; reserve `HIGH` for ambiguous planning steps.
3. **Prefix-aligned Context Caching:** Keep static system instructions and tool definitions byte-identical at the start of the prompt to maximize **implicit cache** hits (95% discount on Gemini API; zero storage cost) or use `cachedContents` where supported.
4. **Session compaction & observation masking:** Summarize older turns and truncate multi-megabyte raw MCP JSON responses after extraction.
5. **Tune `min_instances` & delete idle Vector Search 1.0 endpoints:** Deployed Vector Search 1.0 indexes and warm `min_instances` accrue hourly charges even at zero traffic.
6. **Sampled Online Evaluation & Batch/Flex offline evals:** Sample 1–5% of live traffic for `OnlineEvaluator`, and run nightly 10,000-case golden suites on **Flex PayGo** or **Batch inference**.

---

## 11. Failure Modes & Exam Traps

| Trap | Why it fails | Correct architectural move |
| :--- | :--- | :--- |
| Deploying a custom MCP server onto Agent Runtime | Agent Runtime hosts agent orchestrators (`reasoningEngines`), not arbitrary MCP servers | Deploy **Streamable HTTP MCP servers** on **Cloud Run** or **GKE** and register in **Agent Registry** |
| Storing chat history in Cloud Run in-memory dicts | Serverless instances scale to zero or recycle without warning | Persist state in **Agent Platform Sessions**, **Memorystore**, **Firestore**, or **Cloud SQL** |
| Attempting to self-host Gemini 4 Argon or 3.8 Flash on GKE | Proprietary Gemini weights are served exclusively via managed Google endpoints | Consume Gemini via API (with VPC-SC / PT if needed), or self-host open-weight **Gemma 4** on GKE |
| Executing LLM-generated Python via `exec()` in the agent container | Exposes IAM credentials, env vars, and internal VPC endpoints | Execute untrusted generated code in the **Code Execution sandbox** (or **GKE Sandbox / gVisor**) |
| Building custom chunking + pgvector when SharePoint/Drive ACLs are required | Re-implementing connectors and document-level ACL sync is brittle and error-prone | Use **Agent Search** with native identity propagation and connector ACLs |
| Using default `DOT_PRODUCT` on an index backing RAG Engine | RAG Engine queries with cosine distance, triggering `FAILED_PRECONDITION` | Create the index with **`COSINE`** distance |
| Filing a quota increase for *"Region temporarily at capacity"* | Physical regional compute pool saturation is unrelated to project quota caps | Switch region, right-size container CPU/RAM, or retry |
| Grading compliance agents only with `FINAL_RESPONSE_QUALITY` | Misses skipped verification tools ("right answer, wrong trajectory") | Pair outcome rubrics with **`trajectory_exact_match`** or **`trajectory_in_order_match`** |
| Testing fault tolerance against live production payment/ERP APIs | Causes real side effects and cannot deterministically trigger 503/timeout edge cases | Use **Environment Simulation** + **2-Step Agent Simulation** against an Agent Registry snapshot |
| Sharing a semantic cache across users on ACL-protected RAG | Leaks confidential answers across permission boundaries | Partition cache keys by user/group ACL scope or disable semantic caching on restricted corpora |

---

## 12. Glossary, Related Guides & Practice Quiz

**Glossary**

- **Agent Runtime:** Fully managed stateful compute runtime for agents (formerly Vertex AI Agent Engine); API resource `reasoningEngines`.
- **Managed Agents API (Preview):** Declarative harness (**Agents API** + **Interactions API** + **Skill Registry**) where Google runs the agent loop and isolated no-egress Linux sandbox.
- **`agent-starter-pack` / `agents-cli`:** Production scaffolding and CLI tool generating Terraform, Cloud Build CI/CD, telemetry wiring, and `agents-cli eval` gates.
- **Session / Event / State:** Single-conversation event log and mutable key-value scratchpad.
- **Memory Bank:** Asynchronous LLM-extracted, consolidated, user-scoped long-term semantic memory with TTL and revisions.
- **Example Store (Preview):** Dynamic semantic retrieval of few-shot trajectories/examples (embedding model fixed at creation).
- **Code Execution sandbox:** Sub-second isolated Python container (100 MB file I/O, up to 14-day TTL) for untrusted LLM-generated code.
- **Agent Search vs. RAG Engine:** Turnkey connector + native-ACL enterprise RAG (`discoveryengine`) vs. code-first modular corpus pipeline.
- **Agent Retrieval vs. Vector Search 1.0:** Self-tuning schema-aware collection store vs. ScaNN billion-scale ANN index-as-a-service.
- **2-Step Agent Simulation:** Synthesizes `Starting Prompt` + `Conversation Plan` from an Agent Registry snapshot, then runs multi-turn simulated user sessions.
- **Environment Simulation:** Injects deterministic tool faults (503s, latency, mocked payloads) during evaluation.
- **Dual-Attribution Audit Log:** Cloud Audit Log (`is_agentic=true`) recording both the SPIFFE **Agent Identity** and the initiating human principal.
- **Failure Cluster Analysis & Prompt Optimization:** Automated root-cause grouping of failed traces paired with closed-loop programmatic system-prompt tuning.

**Related guides:** [Agent Platform Security & Governance](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html) · [ADK](https://mbettan.github.io/machine-learning-cert/ADK.html) · [A2A & Interoperability](https://mbettan.github.io/machine-learning-cert/A2A.html) · [RAG](https://mbettan.github.io/machine-learning-cert/RAG.html) · [Gemini & Google Models](https://mbettan.github.io/machine-learning-cert/Google.html) · [Gemini Enterprise](https://mbettan.github.io/machine-learning-cert/GeminiEnterprise.html) · [Antigravity & Agents CLI](https://mbettan.github.io/machine-learning-cert/Antigravity.html) · [AgentOps](https://mbettan.github.io/machine-learning-cert/AgentOps.html)

**Practice quiz:** [Agent Platform Practice Quiz](https://mbettan.github.io/machine-learning-cert/quiz.html?topic=agent-platform)

**Sources**

- Gemini Enterprise Agent Platform overview & release notes — `docs.cloud.google.com/gemini-enterprise-agent-platform`
- Build (Agent Studio, Managed Agents API, ADK, Skill Registry), Scale (Agent Runtime, Sessions, Memory Bank, Example Store, Code Execution), and Optimize (Evaluation, Simulation, Observability, Prompt Optimization) — `docs.cloud.google.com/gemini-enterprise-agent-platform`
- Choose your agentic AI architecture components — `docs.cloud.google.com/architecture/choose-agentic-ai-architecture-components`
- *Introduction to Agents and Agent Architectures* (Google Cloud Whitepaper, 2025/2026) — AgentOps flywheel, context engineering, and runtime patterns

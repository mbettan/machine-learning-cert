# Gemini Enterprise & Low-Code Agents — Study Guide

Author: Michaël Bettan · Track: Google Cloud / Professional Agentic Architect · Version 1.0 (October 2026)

Practice quiz: [quiz.html?topic=gemini-enterprise](https://mbettan.github.io/machine-learning-cert/quiz.html?topic=gemini-enterprise) · HTML edition: [GeminiEnterprise.html](https://mbettan.github.io/machine-learning-cert/GeminiEnterprise.html)

Employee-facing agents on Gemini Enterprise (formerly Agentspace) — editions, connectors and permissions-aware grounding, Google-made agents, the Agent Gallery, Agent Designer (now Workflow Builder), registering custom ADK and A2A agents, and admin governance — plus customer-facing agents in CX Agent Studio (the evolution of Dialogflow CX): instructions, tools, callbacks, evaluation, flows and human handoff, closed by a low-code vs pro-code decision matrix.

## 00. Overview & Mental Model {#overview}

**Gemini Enterprise** (formerly **Google Agentspace**) is Google Cloud's employee-facing agent platform: an intranet search engine, an AI assistant, and an agentic platform in one web app. It answers from permissions-aware search across Google and third-party data, runs Google-made agents, lets employees build their own no-code agents, and hosts custom agents built by developers. Customer-facing conversational agents live in a sibling product, **Gemini Enterprise for Customer Experience (CX)**, whose builder is **CX Agent Studio**. Pro-code agents are built with ADK on the **Gemini Enterprise Agent Platform** (the evolution of Vertex AI).

| Layer | Product | Primary audience | Build style |
|---|---|---|---|
| Employee-facing app | Gemini Enterprise (search, assistant, Agent Gallery, Workflow Builder) | Employees inside the company | No-code / low-code (Workflow Builder) plus registered custom agents |
| Customer-facing conversations | Gemini Enterprise for CX — CX Agent Studio (console at ces.cloud.google.com) | End customers on chat and voice channels | Minimal-code, built on ADK, with optional Python callbacks and tools |
| Builder platform | Gemini Enterprise Agent Platform — ADK, Agent Runtime, Agent Studio, Agent Search, Agent Gateway, Agent Registry | Developers and platform teams | Pro-code (ADK) and low-code prototyping (Agent Studio) |

| Old / legacy name | Current name | Note |
|---|---|---|
| Google Agentspace | Gemini Enterprise | Same product line, broadened to an agent platform |
| Agent Designer | Workflow Builder | The exam guide still says "Agent Designer"; the docs now say Workflow Builder |
| NotebookLM Enterprise | Gemini Notebook Enterprise | Included with Standard and Plus editions |
| Vertex AI | Gemini Enterprise Agent Platform | Pro-code builder platform |
| Vertex AI Agent Engine | Agent Runtime | API resource name is still `ReasoningEngine` |
| Vertex AI Studio | Agent Studio | Low-code designer for prompts, system instructions, and agent workflows |
| Vertex AI Search | Agent Search | Grounding and search apps for custom builds |
| Dialogflow CX | CX Agent Studio (evolution) | Dialogflow CX flows can still be called from CX Agent Studio |

> **Tip — The one-line mental model:** Employees → Gemini Enterprise (Workflow Builder first, register ADK/A2A agents when no-code runs out). Customers → CX Agent Studio. Developers who need full control of code, runtime and evals → ADK on Agent Runtime, then surface the agent in Gemini Enterprise or behind CX Agent Studio.

## 01. Editions & Product Map {#editions}

Edition choice decides which builder features, data volume and security controls are available. Read the table as "what blocks me" rather than as a price list (prices are out of scope and change often).

| Edition | Seats | Pooled storage | Defining traits |
|---|---|---|---|
| Business | 1–500 users | 25 GiB | SaaS at business.gemini.google with no Google Cloud console or IAM; no full connector ecosystem, no Data Insights, no own full-code agents, no Agent Marketplace, no enterprise-grade security and compliance controls |
| Standard | 1+ users | 30 GiB | Full Google Cloud administration; includes Gemini Notebook Enterprise |
| Plus | 1+ users | 75 GiB | Everything in Standard with a larger storage pool and higher quotas; includes Gemini Notebook Enterprise |
| Pay-as-you-go | 1 seat minimum | Pay-as-you-go | Billed to an invoiced Cloud Billing account |
| Frontline (add-on) | Requires 150+ Standard or Plus users | 2 GiB | For frontline workers; uses only admin-provisioned agents; cannot author no-code agents or create or upload skills |

### What changes between editions
- **Deep Research** is available in all editions; **Data Insights** (preview) is in Standard, Plus, Pay-as-you-go and Frontline, not Business.
- **No-code agent building** (Workflow Builder, formerly Agent Designer) is **GA** per the release notes; which editions include it can change, so check the edition comparison.
- **Custom full-code agents** (ADK, A2A) and **Agent Marketplace** require a Google Cloud–administered edition, not Business.
- **Agent creation quota** applies to registrations: Standard 1 agent per user per day, Plus 10 per user per day (pooled), Frontline 0.

### Choosing between the three Google products
- **Gemini Enterprise** — you want a ready-made, permissions-aware assistant and agent hub for employees.
- **Gemini Enterprise Agent Platform** — you are building your own agentic application, model pipeline, or search experience with code (ADK, Agent Runtime, Agent Search).
- **Gemini Enterprise for CX** — you are serving customers on web chat, apps or telephony with CX Agent Studio and Agent Assist.

> **Exam trap — Business edition is a dead end for platform requirements:** If the scenario needs IAM, VPC Service Controls, CMEK, custom ADK or A2A agents, or the full connector catalog, Business edition is the wrong answer even for a small team. Choose Standard or Plus.

## 02. Connectors, Data Stores & Grounding {#data-grounding}

Gemini Enterprise grounds answers in **data stores** fed by **connectors**. A connector creates a separate data store per entity type — for example, a Jira connector yields stores for issues, comments, attachments and worklogs — and search respects source-system permissions.

| Mode | How it works | Strengths | Trade-offs |
|---|---|---|---|
| Federated search | Query is sent live to the third-party API; nothing is copied or stored | No storage cost, no copy of data, near-real-time | Lower answer quality; subject to the third-party's terms and rate limits |
| Data ingestion (indexing) | Content and ACLs are copied into a Gemini Enterprise data store and indexed | Best search and answer quality, semantic ranking | Uses storage quota, needs sync time and scheduling |

| Sync type | Covers | Exam-relevant gotcha |
|---|---|---|
| Full sync | All entities, including deletions and identity/ACL changes | Needed to propagate removed documents and permission changes |
| Incremental sync | New and changed entities only | Does not propagate deletions or identity changes |
| Entity sync vs identity sync | Content records vs user and group membership | Both must run for ACL-correct answers |

### Data store options
- **Structured vs unstructured** stores; regions **global, US or EU** for data residency; **CMEK** for customer-managed encryption keys.
- **Parsing**: the **layout parser** is the default for PDF, HTML, DOCX, PPTX, XLSX and XLSM and does content-aware chunking; the **OCR parser** handles scanned PDFs; the **digital parser** handles machine-readable text; you can also bring your own parsed documents.
- **Chunking** splits documents into retrievable chunks for retrieval-augmented generation (RAG); chunk quality drives answer quality.

### Multimodal content
- The layout parser **annotates images** (BMP, GIF, JPEG, PNG, TIFF embedded in documents) and **tables** with generated descriptions, so a chunk can be retrieved by what an image or table shows.
- Standalone audio and video files are not native unstructured-store document formats. A common design pattern is to pre-process them — for example, use Gemini to transcribe or describe them and ingest the text with metadata — or use Agent Platform Vision / Vision Warehouse for dedicated media search (design guidance; verify against current docs).
- The assistant itself can analyze uploaded PDFs and images inside a conversation.

### Identity and access
- Identity provider: **Google Identity** (recommended) or **Workforce Identity Federation** (the workforce pool must be global); one IdP type per location.
- Search enforces source ACLs — users never see documents they cannot open in the source system (no privilege escalation). Third-party SaaS identities are mapped to the IdP identities.
- A document's ACL can include up to 3,000 readers.

> **Exam trap — Federation is not "free quality":** Federated search avoids copying data but gives lower-quality answers than ingestion. When the requirement is "best answer quality on Confluence content", pick ingestion; when it is "data must never be copied out of the SaaS tool", pick federation.

> **Key fact — Agent Search for custom builds:** When you build your own app or ADK agent instead of using the Gemini Enterprise web app, ground it with **Agent Search** (formerly Vertex AI Search) on the Agent Platform. Gemini Enterprise is the packaged employee experience; Agent Search is the developer building block.

## 03. Google-made Agents, Agent Gallery & Sharing {#prebuilt-agents-gallery}

| Agent type | Who builds it | Examples / notes |
|---|---|---|
| Google-made agents | Google | Core assistant, Deep Research, Gemini Notebook, Data Insights (preview), Co-Scientist |
| Workflow Builder agents | Employees (no-code) | Chat agents and workflows; admin must turn on "Enable Workflow Builder" |
| Custom ADK agents | Developers | Hosted on Agent Runtime, then registered in Gemini Enterprise |
| Custom A2A agents | Developers or partners | Registered via agent card (preview) or imported from Agent Registry |
| Dialogflow agents | Conversational designers | Existing Dialogflow agents surfaced in Gemini Enterprise |
| Marketplace agents (preview) | Partners | A2A agents procured from Google Cloud Marketplace and integrated by an admin |

### Agent Gallery
- Filters: **All, Pinned, Made by Google, From your organization, Your agents, Marketplace**; users can pin favorites.
- **+ New agent** opens Workflow Builder; users invoke an agent in chat with **@agent_name**.
- Agents can also be invoked programmatically through the **StreamAssist API** or the agent's Agent Registry A2A endpoint.
- Admins can view each agent's identity (a SPIFFE ID, falling back to the Agent Registry resource ID).

| Agent state | Visible in gallery? | Users can interact? |
|---|---|---|
| Private | Only to the owner | Owner only |
| Enabled | Yes | Yes |
| Suspended | Yes | No |
| Disabled | No (hidden) | No |

### Sharing controls (admin)
- **Enable agent sharing** — allow users to share agents they built.
- **Enable agent sharing without admin approval** — skip the approval step.
- **Enable End Users to share with Groups** — allow sharing to Google Groups instead of individuals.

> **Exam trap — Idea Generation is gone:** The Idea Generation agent (preview) was removed in July 2026. Scenarios about brainstorming or hypothesis generation should point to the assistant, Deep Research, or Co-Scientist.

## 04. Agent Designer → Workflow Builder {#workflow-builder}

**Workflow Builder** (renamed from **Agent Designer**) is the no-code / low-code builder inside Gemini Enterprise. It produces two artifact types.

| Artifact | Behavior | How it starts | Best for |
|---|---|---|---|
| Chat agent | Conversational and non-deterministic; single- or multi-step with subagents | User chats with it (@name); can also be scheduled | Q&A over team knowledge, drafting, research helpers |
| Workflow | Ordered steps with variables passed between them; supports branching and human approval | Manual (@name), Schedule (including cron), or Event (connector data change) | Repeatable business processes, triage, report generation |

### Building a chat agent
- Create from a natural-language **prompt**, or choose **Proceed to builder** for the visual flow editor.
- Each node has **Name, Description, Instructions, Model** (Flash for low latency, Pro for complex reasoning), **Data & tools, Knowledge files** and **Personalization** (starter prompts; up to 3 shown at random).
- A **Schedule** tab runs the agent on a timetable; leaving without **Create** saves a **Draft**.
- Prompt mode cannot attach Google Cloud sources (BigQuery, Cloud Storage, Cloud SQL) — switch to the builder (designer) mode.

### Building a workflow
- **Triggers**: Manual, Schedule, Event.
- **Steps**: **Gemini Agent** node (instructions, knowledge, connected apps, model — Gemini 3.0 or later — and output as text or a JSON schema), **Condition** (branching, filtering, loops), and **Human-in-the-loop** (request info or request approval).
- **MCP servers** and existing agents can be added as steps or tools.
- **Versions** can be saved, compared and restored; **execution logs** show each run.
- Workflow connectors include Gmail, Calendar, Chat, Drive, Confluence, Jira, Teams, Notion, OneDrive, Outlook, Salesforce, SharePoint, ServiceNow and Slack.

### Connector actions & knowledge rules
- **Search For Data** actions are enabled per action; **Add Or Update Data** (write) actions are a connector-level, all-or-nothing toggle and require human review.
- Write actions need the matching search actions enabled, otherwise the agent fails with `ENTITY_NOT_FOUND`.
- A full Drive or OneDrive tool takes precedence over restricted knowledge — to scope access, split into two Gemini Agent nodes.
- Uploaded knowledge files are placed in context every turn, up to 800,000 tokens combined; for large libraries (more than ~100 pages) connect a data store instead.
- Builders can only use the connectors, tools and permissions an admin has provisioned.

### State-based design and prompt craft
- A workflow is a **state machine you can see**: steps are states, Conditions are transition routes, Human-in-the-loop steps are approval gates, and variables carry state between steps.
- Write node **Instructions** like a system prompt: role, goal, constraints, output format. Add **few-shot examples** for format-sensitive outputs and ask for **step-by-step reasoning** (chain of thought) on analytical nodes; prefer a JSON-schema output when the next step parses it.
- For customer-facing state machines with pages, routes and event handlers, see CX Agent Studio and Dialogflow CX flows (sections 07–08).

> **Exam trap — Chat agent vs workflow:** "Every Monday, pull new Jira bugs, summarize, and ask a lead to approve before posting to Chat" is a **workflow** (Schedule trigger, Gemini Agent step, Human-in-the-loop approval). An open-ended "ask me anything about our HR policies" helper is a **chat agent**.

## 05. Bringing Custom ADK, A2A & Dialogflow Agents {#custom-agents}

When no-code is not enough, developers build agents in code and **register** them so employees use them inside Gemini Enterprise.

| Path | Hosting requirement | Status | Key setup |
|---|---|---|---|
| ADK agent | Must run on **Agent Runtime** | Available (verify launch stage per feature) | Register in console, API, or with a single Agents CLI command; needs Gemini Enterprise Admin role and Discovery Engine API |
| A2A agent | Any host exposing an A2A agent card (e.g., Cloud Run) | Preview | Paste the agent card JSON; A2A v0.3 streaming supported (v1.0+ via compatibility packages) |
| Agent Registry import | A2A agent already in Agent Registry | Available (verify launch stage) | Import a governed agent instead of re-registering by hand |
| Dialogflow agent | Dialogflow | Available (verify launch stage) | Surface an existing conversational agent |
| Marketplace agent | Partner-hosted A2A agent | Preview | Procure in Cloud Marketplace, admin integrates and sets visibility |

### ADK agent registration details
- Connection is VPC-SC compliant; the Agent Runtime instance can be in a different project.
- The agent receives the signed-in user's email.
- Optional **OAuth authorization resource** so the agent can act on third-party systems as the user: create an OAuth client (Web application) with redirect URIs `https://vertexaisearch.cloud.google.com/oauth-redirect` and `https://vertexaisearch.cloud.google.com/static/oauth/oauth.html`, then supply `clientId`, `clientSecret`, `authorizationUri` and `tokenUri` in `serverSideOauth2`. The registration references the engine via `adkAgentDefinition.provisionedReasoningEngine`.

### A2A agent registration details
- On Cloud Run (`*.run.app`), grant `roles/run.invoker` to the Discovery Engine service agent; Gemini Enterprise then sends an OIDC token in `X-Serverless-Authorization` (not for custom domains, load balancers or gateways).
- The end user's OAuth token travels in the `Authorization` header.
- Agent card `securitySchemes`, API keys and custom headers are not used; if you front the agent with Apigee, validate the token there (VerifyJWT or a tokeninfo ServiceCallout).
- Traffic to A2A agents registered this way **does not go through Agent Gateway**.
- Each registration consumes the daily agent creation quota.

> **Exam trap — Console Model Armor does not cover custom agents:** The Model Armor setting in the Gemini Enterprise console screens the assistant only. ADK, A2A and Marketplace agents must call Model Armor (or equivalent guardrails) **inside the agent code**.

## 06. Governance & Admin Controls {#governance}

| Control | Where | What it governs |
|---|---|---|
| End-user feature toggles | Gemini Enterprise admin console | "Enable Workflow Builder" and other features per app |
| Sharing settings | Admin console | Agent sharing, approval-free sharing, sharing with Groups |
| Agent states | Admin console | Private, Enabled, Suspended, Disabled per agent |
| Connector provisioning | Admin console | Which data sources and actions builders can use |
| Identity provider | Google Identity or Workforce Identity Federation | Who users are; ACL enforcement |
| Model Armor templates | Admin console + Model Armor | Prompt and response screening for the assistant |
| VPC Service Controls, CMEK, data residency | Google Cloud project | Exfiltration perimeter, key ownership, global/US/EU location |
| Agent identity, Agent Registry, Agent Gateway | Agent Platform | Per-agent identity (SPIFFE), catalog of governed agents, policy enforcement on agent traffic |
| IAM roles | Google Cloud IAM | Gemini Enterprise Admin for registration; least privilege for service agents |

### Model Armor for the assistant
- Screens assistant prompts and responses; available in all editions at no extra cost, may add latency.
- Recommended: two templates — a **prompt template** (prompt injection, jailbreak, sensitive data) and a **response template** (data leakage, harmful content, malicious URLs).
- Uses **INSPECT_AND_BLOCK**; it blocks rather than de-identifies. A violation returns `answer.state = SKIPPED` with `CUSTOMER_POLICY_VIOLATION`.

### Layered governance pattern
- **Data layer**: ACL-aware connectors, full syncs for permission changes, data residency, CMEK.
- **Agent layer**: admin-provisioned connectors only, human review for write actions, sharing approval, suspend or disable misbehaving agents.
- **Traffic layer**: Model Armor (console for assistant, in-code for custom agents), Agent Gateway for agent traffic on the platform, OAuth on behalf of the user.
- **Network layer**: VPC Service Controls around Gemini Enterprise, Agent Runtime and data sources.

> **Exam trap — "Suspend" vs "Disable":** Suspended agents stay visible in the gallery but cannot be used (good for a temporary freeze with transparency); Disabled agents are hidden entirely.

## 07. CX Agent Studio for Customer-Facing Agents {#cx-agent-studio}

**CX Agent Studio** is the minimal-code builder in **Gemini Enterprise for CX** (console: ces.cloud.google.com). It is built on ADK and is the evolution of Dialogflow CX, adding asynchronous tool calls, low-latency bidirectional streaming voice, and versioning with rollback.

### Agent application structure
- An **agent application** is a tree: a **root (steering) agent** that routes to **sub-agents**.
- Set the model globally or override it per sub-agent; design in English with automatic language detection for end users.
- AI assistance: generate an agent from a description, **Restructure instructions** into XML tags (`role`, `persona`, `primary_goal`, `constraints`, `taskflow`, `subtask`, `step`, `trigger`, `action`, `examples`), **Refine instructions**, and hill-climb against test cases.

### Instructions
- Reference tools as `{@TOOL: tool_name}`, sub-agents as `{@AGENT: agent_name}`, and variables as `{username}`.
- **Global instructions** are inherited by every agent — put brand tone and DOs/DON'Ts there.
- Modular conditional components (if/elif/else by channel, modality or variable values) keep one agent valid for chat and voice.
- **Inline few-shot examples** (`[user]`, `[model]`, `tool_code`, `tool_outputs`) teach format and tool use; use them sparingly — clear instructions first. The XML `taskflow` → `step` structure is the in-console equivalent of an explicit chain-of-thought procedure.

| Tool type | Use it for |
|---|---|
| Data store / File search / Google Search | Grounded answers from enterprise content, uploaded files, or the web |
| OpenAPI / Integration Connector / MCP | Calling business APIs and enterprise systems |
| Salesforce, ServiceNow, Jira, Confluence, SharePoint | Prebuilt SaaS actions |
| Python code / Client function / Widget | Server-side logic, client-side actions, rich UI elements |
| Agent as a tool / A2A (preview) | Delegating to another agent while keeping the session |
| System tools (e.g., `end_session`) / Google Maps (preview) | Session control and handoff; location answers |

### Tool execution & callbacks
- Tool names are snake_case. **Synchronous** tools should finish in under ~5 s; **asynchronous** tools (≈5–60 s) let the agent keep talking while the call completes.
- **Callbacks** are Python hooks equivalent to ADK: `before_agent` / `after_agent`, `before_model` / `after_model` (returning an `LlmResponse` skips the model), `before_tool` / `after_tool` (returning a dict skips the tool). Use them for deterministic guardrails, canned responses, and redaction.
- **A2A tool** delegation: the primary agent keeps the session; exchanges are text only; billing counts one session in the same project, otherwise two; roles include `roles/ces.client`, `roles/run.invoker` and `roles/aiplatform.user`, with Secret Manager for third-party credentials.

| Evaluation test case | What it checks |
|---|---|
| Scenario | An AI-simulated user pursues a goal; tests open-ended robustness |
| Simulation | Ordered goals and milestones; tests multi-step conversations |
| Golden | An ideal path including tool calls; regression testing with semantic match (0–4) |

### Evaluation metrics
- Tool correctness, user goal satisfaction, goal completion, hallucinations, semantic match (golden only), scenario expectations; personas vary the simulated user.
- **Task completion** = user goal satisfied AND no hallucinations AND scenario expectations met.

## 08. Flows, State Handlers & Human Handoff {#cx-flows-handoff}

Dialogflow CX models conversations as explicit state machines. CX Agent Studio can call these flows when you need deterministic control.

| Dialogflow CX concept | Meaning |
|---|---|
| Flow | A conversation topic (e.g., "Authenticate caller") made of pages |
| Page | A conversational state; can collect form parameters |
| State handler | Has requirements, an optional fulfillment (response, parameter preset, webhook) and an optional transition target |
| Route | Intent route or condition route that moves to another page or flow |
| Event handler | Reacts to events such as `sys.no-match-default`, `sys.no-input-default`, or a flow failure escalating to a human (`END_FLOW_WITH_HUMAN_ESCALATION`) |
| Handler scope | Flow-level, page-level, or form-parameter-level |
| Form parameters | Slots a page must fill before it completes |

### Flow-based agents in CX Agent Studio
- A flow-based agent hands the conversation to a Dialogflow CX flow until it ends (END_SESSION), using DetectIntent; input and output variables are mapped between the two.
- The Customer Engagement Suite service agent needs the Dialogflow API Client role.
- CX Agent Studio agents are not drop-in replacements for Dialogflow playbooks; use a CX Agent Studio agent as the steering and routing layer.
- Use flows for deterministic data collection, validation and authentication. Do not use flows for canned responses (use a callback) or intent classification (let the LLM route). Treat flows as black boxes — session parameters behave like implicit globals.

### Human handoff with end_session
- Add the `end_session` system tool to the root agent and every sub-agent that may escalate.
- Parameters (camelCase since August 1, 2026; old ALL_CAPS names remain supported): `escalationMessage`, `telephonyTransferCall` (`phoneNumber`, `sipUri`, `useOriginatingTrunk`), `liveAgentHandoff` (`endSession`, `sipRefer`, `uuiHeaders`, `xHeaders`).
- With **Agent Assist**, keep `liveAgentHandoff.endSession` at its default `False` so the conversation transfers to the human agent with assist; set it to `True` only when not using Agent Assist. Agent Assist handoff works with the bidirectional API.
- After a session ends, CX Agent Studio cannot reconnect to it.

```json end_session call — transfer to a billing agent with Agent Assist
{
  "escalationMessage": "Transferring your call to a billing agent",
  "telephonyTransferCall": { "phoneNumber": "+15552420836", "useOriginatingTrunk": true },
  "liveAgentHandoff": { "endSession": false }
}
```

> **Exam trap — Deterministic does not mean "all flows":** Use LLM agents for understanding and routing, flows or callbacks for steps that must never vary (identity verification, payment capture, legally required wording).

## 09. Low-Code vs Pro-Code Decision Matrix {#decision-matrix}

| Criterion | Workflow Builder (Gemini Enterprise) | CX Agent Studio (Gemini Enterprise for CX) | Agent Studio (Agent Platform) | ADK on Agent Runtime |
|---|---|---|---|---|
| Audience | Employees | External customers | Developers prototyping | Developers and platform teams |
| Channels | Gemini Enterprise web app, @mentions | Web chat, apps, telephony / voice | Console playground, export to code | Any (API, Gemini Enterprise, CX, custom UI) |
| Coding | None | Minimal (optional Python callbacks and tools) | Low-code | Full code |
| Control flow | Chat agents or step-based workflows with conditions and approvals | Root agent + sub-agents, optional deterministic flows | Prompt and workflow design | Any pattern (sequential, parallel, loop, custom) |
| Grounding | Connectors, data stores, knowledge files | Data store, file search, Google Search tools | Google Search, Maps, RAG Engine, Agent Search | Agent Search, RAG Engine, MCP, custom tools |
| Evaluation | Execution logs, versions | Scenario, simulation and golden test cases | Side-by-side prompt comparison | Agent evaluation services and custom eval suites |
| Governance | Admin toggles, sharing approval, Model Armor | Versioning, rollback, callbacks, IAM | Project IAM | IAM, Agent Identity, Agent Gateway, in-code Model Armor |

### Decision rules
- Employee productivity task with available connectors → **Workflow Builder**; escalate to ADK only when you need custom code, complex tools, or strict evals.
- Customer-facing chat or voice with telephony, handoff and regression tests → **CX Agent Studio**.
- Custom logic, multi-agent orchestration, or reuse across channels → **ADK on Agent Runtime**, then **register** in Gemini Enterprise (and/or call from CX Agent Studio via A2A or tools).
- Partner or other-framework agent → expose it over **A2A** and register it.
- Prototype prompts and system instructions → **Agent Studio**, then move to ADK for production.

## 10. Exam Traps & Architect Checklist {#exam-traps}

> **Exam trap — Name drift:** Agent Designer = Workflow Builder; Agentspace = Gemini Enterprise; Vertex AI Search = Agent Search; Agent Engine = Agent Runtime. Treat old and new names as the same product.

> **Exam trap — Where Model Armor applies:** Console Model Armor protects the Gemini Enterprise assistant only. Custom ADK/A2A agents need guardrails in code; CX Agent Studio uses callbacks and its own safety settings.

> **Exam trap — A2A registration bypasses Agent Gateway:** If a scenario requires central gateway policy on every agent call, A2A agents registered directly in Gemini Enterprise do not satisfy it by default.

> **Exam trap — Write actions are all-or-nothing:** Connector "Add Or Update Data" is a connector-level toggle with human review, and it needs the related search actions enabled.

### Architect checklist
- Edition supports the requirement (no Business edition for IAM, VPC-SC, CMEK, custom agents).
- Data mode chosen deliberately: ingestion for quality, federation for no-copy; full syncs scheduled for deletions and ACL changes.
- Identity provider configured (Google Identity or global Workforce Identity Federation pool) and ACLs verified.
- Builder path chosen with the decision matrix; custom agents hosted on Agent Runtime (ADK) or exposing an agent card (A2A).
- OAuth on behalf of the user configured for third-party actions; least-privilege roles for service agents.
- Guardrails: Model Armor templates for the assistant, in-code guardrails for custom agents, callbacks and flows for deterministic CX steps.
- Human-in-the-loop for write actions and approvals; `end_session` handoff wired on every CX agent that can escalate.
- Evaluation: CX golden and scenario test cases, workflow execution logs and versions, agent evals for ADK.

## 11. Glossary, Sources & Practice Quiz {#resources}

### Glossary
- **Gemini Enterprise** — Google's employee-facing search, assistant and agent platform (formerly Agentspace).
- **Workflow Builder** — No-code builder for chat agents and workflows in Gemini Enterprise (formerly Agent Designer).
- **Agent Gallery** — Catalog of Google-made, organization, personal and Marketplace agents inside Gemini Enterprise.
- **Federated search** — Live query to a third-party source without copying data.
- **Data ingestion** — Copying and indexing source content and ACLs into a data store for higher quality.
- **Layout parser** — Default document parser with content-aware chunking and image and table annotation.
- **Agent Runtime** — Managed runtime for code agents (formerly Agent Engine; API resource `ReasoningEngine`).
- **A2A agent card** — JSON description of an A2A agent's endpoint and skills used for registration.
- **Model Armor** — Prompt and response screening service; console setting covers the assistant only.
- **CX Agent Studio** — Minimal-code builder for customer-facing agents, built on ADK, evolution of Dialogflow CX.
- **Global instructions** — CX Agent Studio instructions inherited by every agent in an application.
- **Golden test case** — CX evaluation case describing the ideal path, including tool calls, for regression testing.
- **end_session** — CX Agent Studio system tool for ending a session, transferring calls, and live-agent handoff.

### Sources
- Gemini Enterprise docs: editions, agents overview, Workflow Builder (chat agents and workflows), Agent Gallery, Marketplace agents, connectors and data stores, parsing and chunking, identity provider, ADK and A2A agent registration, Model Armor, choosing a product, release notes — https://docs.cloud.google.com/gemini/enterprise/docs
- CX Agent Studio docs: overview, agents, instructions, tools, A2A tool, callbacks, evaluation, flows — https://docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio
- Agent Assist handoff from CX Agent Studio — https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/handoff-cxas
- Dialogflow CX concepts (pages, state handlers) — https://docs.cloud.google.com/dialogflow/cx/docs/concept/handler
- Gemini Enterprise Agent Platform overview — https://docs.cloud.google.com/gemini-enterprise-agent-platform/overview

### Related guides
- [Agent Development Kit (ADK)](https://mbettan.github.io/machine-learning-cert/ADK.html) — code agents, callbacks, multi-agent patterns.
- [A2A Protocol](https://mbettan.github.io/machine-learning-cert/A2A.html) — agent cards, tasks, and cross-framework federation.
- [Agent Platform](https://mbettan.github.io/machine-learning-cert/AgentPlatform.html) — Agent Runtime, Agent Studio, Agent Search and the builder platform.
- [Agent Platform Security](https://mbettan.github.io/machine-learning-cert/AgentPlatformSecurity.html) — Agent Identity, Agent Gateway, Model Armor, VPC-SC.
- [RAG](https://mbettan.github.io/machine-learning-cert/RAG.html) and [MCP](https://mbettan.github.io/machine-learning-cert/MCP.html) — retrieval pipelines and tool protocols.

### Practice
Drill scenario questions on editions, grounding modes, Workflow Builder, custom agent registration, governance, CX Agent Studio and the low-code vs pro-code decision.

[Launch Gemini Enterprise Practice Quiz →](https://mbettan.github.io/machine-learning-cert/quiz.html?topic=gemini-enterprise)

### Self-assessment
**Q1.** A 40-person startup on Business edition wants to register an ADK agent and put the project inside a VPC Service Controls perimeter. What must change?
A: Move to a Google Cloud–administered edition (Standard or Plus). Business edition has no Cloud console or IAM, no own full-code agents and no enterprise-grade security controls, so it cannot host registered ADK agents or VPC-SC.

**Q2.** When do you prefer federated search over data ingestion?
A: When data must not be copied or stored outside the source system and near-real-time access matters more than answer quality. Ingestion gives better quality but uses storage and sync time.

**Q3.** A team wants a weekly report that gathers Salesforce updates, drafts a summary, and waits for a manager's approval before emailing it. Which Workflow Builder artifact and steps fit?
A: A workflow with a Schedule trigger, a Gemini Agent step for the summary, a Human-in-the-loop approval step, and then the send step.

**Q4.** Why does the Gemini Enterprise console Model Armor setting not protect a registered ADK agent?
A: The console setting screens only the Gemini Enterprise assistant. ADK, A2A and Marketplace agents must invoke Model Armor (or other guardrails) inside their own code.

**Q5.** In CX Agent Studio, where do you put brand tone rules that every sub-agent must follow?
A: In global instructions, which every agent in the application inherits.

**Q6.** A CX Agent Studio agent escalates to a human agent who uses Agent Assist. How should `liveAgentHandoff.endSession` be set?
A: Leave it at the default `False` so the conversation transfers to the human agent with Agent Assist; set `True` only when not using Agent Assist.

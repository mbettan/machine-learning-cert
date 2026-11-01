# Antigravity & Agents CLI — Study Guide (v1.0)

**Author:** Michaël Bettan
**Owner:** Google · **Cert relevance:** Professional Agentic Architect (core)
**Practice quiz:** `quiz.html?topic=antigravity`

> Independent study notes, grounded in the public Antigravity docs (antigravity.google/docs), the Google Cloud docs (Agent Platform, Cloud Workstations, GKE) and the Agents CLI docs (adk.dev, google.github.io/agents-cli). Antigravity and Agents CLI ship fast: flags, defaults and preview features change. Items marked *(verify)* could not be fully confirmed in official docs at writing time.

---

## 00. Overview & Mental Model

**Google Antigravity** is Google's agent-first development platform. You hand an agent a task, review the **artifacts** it produces (plans, diffs, walkthroughs, browser recordings), and approve key milestones. You no longer have to watch every keystroke.

**Agents CLI** (`agents-cli`, package `google-agents-cli`) is a separate, open-source tool. It gives any coding agent (Antigravity, Claude Code, Codex, Gemini CLI) a machine-readable way to **scaffold, evaluate, deploy and publish ADK agents** on Google Cloud.

| Layer | Tool | Role |
|---|---|---|
| Developer harness | Antigravity (App, CLI `agy`, IDE, SDK) | The coding agent you work with |
| Agent-building expertise | Agents CLI skills + `agents-cli` commands | Teach the coding agent ADK, evals and deployment |
| Agent framework | ADK (open source) | The code of the agent you ship |
| Production runtime | Agent Runtime, Cloud Run, GKE → Gemini Enterprise | Where the shipped agent runs and is distributed |
| Secure dev environment | Cloud Workstations, Agent Sandbox on GKE, Antigravity terminal sandbox | Where agent-run code is isolated |

**Rule 0:** Antigravity is the **developer's** harness, not the production runtime of the agent you build. The agent you ship runs on Agent Runtime, Cloud Run or GKE.

---

## 01. Surfaces: App, CLI, IDE & SDK

| Surface | What it is | Best for |
|---|---|---|
| **Antigravity App** (Antigravity 2.0) | Standalone desktop app that grew out of the original Agent Manager. Projects, conversations, Automations (scheduled runs), side panel with Subagents, Artifacts, Files changed and Terminals | Running and monitoring several agents across projects |
| **Antigravity CLI** (`agy`) | Terminal UI. Settings in `~/.gemini/antigravity-cli/settings.json`. Use `agy --help` for flags and `/help` for slash commands | Terminal-first and remote/headless work |
| **Antigravity IDE** | Standalone AI-first IDE built on VS Code, plus editor extensions | In-editor work: Tab autocomplete/supercomplete, inline command (Cmd/Ctrl+I), agent side panel |
| **Antigravity SDK** | Python package `google-antigravity` (`Agent`, `LocalAgentConfig`, `CapabilitiesConfig`) | Embedding agents in scripts, pipelines and tests |

- Sign-in is shared: signing in on one local surface signs you in on the others.
- The SDK agent is **read-only by default**. Pass `capabilities=CapabilitiesConfig()` to enable write tools.
- **Remote Control** lets you drive App and CLI sessions from a browser. In the CLI, use `/remote-control`, `--remote-control` or `agy remote-control start`.
- **Gemini CLI migration:** on first launch, `agy` detects old Gemini CLI configs. `agy plugin import gemini` converts Gemini CLI extensions into Antigravity plugins.

---

## 02. Agent-First Workflow: Plans, Artifacts & Verification

**Execution modes**
- **Planning mode:** the agent researches the codebase, groups its work and produces an **implementation plan** artifact before it edits anything. Use it for multi-file changes, new features, migrations and security-sensitive work.
- **Fast mode:** the agent acts right away. Use it for renames, one-off commands and small local fixes.

**`/plan` runs a 4-step workflow:** (1) analysis and discovery, (2) a clarifying interview if requirements are unclear, (3) an implementation plan with step-by-step tasks, **verification gates** and risks, (4) your review and approval, then execution. `/grill-me` interviews you one question at a time before work starts. Combine them with `/plan /grill-me <task>`.

**Artifacts** are structured deliverables: implementation plans, code diffs, diagrams, images and browser recordings. A **walkthrough** artifact is produced at the end. It summarizes the changes and often includes screenshots or recordings of browser tasks.

**Steering:** comment inline on a plan (like a doc). Then click **Proceed**, or click **Review** to send your comments as feedback.

**Artifact review policy**

| Surface | Options | Default / guidance |
|---|---|---|
| App | Request review · Always proceed | Request review is recommended |
| CLI (`artifactReviewPolicy`) | `asks-for-review` · `agent-decides` · `always-proceed` | `asks-for-review` is the default. `agent-decides` currently behaves the same way |

The artifact review policy covers plans. File edits are controlled separately, by the **agent mode** (see §07).

**Code refactoring, runtime optimization & vulnerability patching**
- **Multi-file refactoring & runtime optimization:** use **Planning mode** (`/plan`) to inventory call sites across the repository, establish a baseline (existing test suite or latency/memory benchmark), apply incremental diffs, and run verification gates after each step before producing the final walkthrough artifact.
- **Automated vulnerability patching:** pair security scanner findings (SAST or dependency audit) with a **security implementation plan** and a **Proof-of-Concept (PoC)** reproduction test in an isolated sandbox (`workspaceWrite` / Seatbelt). The agent confirms the PoC reproduces the flaw before the fix, patches the root cause (e.g., parameterized queries, output encoding, path canonicalization, upgraded dependency), verifies that the PoC and regression tests pass, and records a security audit report artifact. Use `PreToolUse` / `PostToolUse` hooks to run linters or security scanners automatically on every edit.

---

## 03. Rules, Skills & Workflows

**Rules** are persistent constraints and invariants, such as "always use zod" or "never import internal/".

| File | Frontmatter | Activation |
|---|---|---|
| `AGENTS.md` / `GEMINI.md` (any directory) | None | Always on for that directory and below |
| `.agents/rules/*.md` | **Required**: `trigger` | `always_on` · `model_decision` (needs `description`) · `glob` (needs `globs`) · `manual` |
| Global: `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.gemini/config/rules/*.md` | Modular rules need frontmatter | All projects on the machine |

- Rules **add up**. When they conflict, the more specific directory rule wins. Each rule file is injected only once.
- A missing or invalid `trigger` (for example camelCase `alwaysOn`) means the rule is **silently discarded**.
- `.agents/rules/` is scanned **one level deep**. Files in nested folders are ignored unless you register them in `.agents/rules.json`.
- Budgets: each rule file is capped at **24 KB**. Always-on and global rules share a **20,000-token** budget. Rules over budget are reduced to a file-path pointer.

**Skills** are on-demand, multi-step procedures or runbooks.
- Layout: `skills/<name>/SKILL.md` with `name` and `description` in the frontmatter. Optional folders: `scripts/`, `references/`, `examples/`, `resources/`.
- **Progressive disclosure:** only the name and description go into the context. The full body loads when the task matches. **The description decides whether the skill ever activates.**
- Keep `SKILL.md` short. Move bulky docs into `references/`. Wrap long command sequences in `scripts/`. Include steps to validate the work.
- Rule or skill? A **rule** is a constraint. A **skill** is a workflow ("how to run DB migrations").

**Workflows (legacy, IDE):** Markdown prompt sequences you run as `/workflow-name`. The docs say current workflows stop working on **October 19, 2026**. Migrate them to skills with `/migrate-workflows`.

---

## 04. MCP, Hooks & Plugins

**MCP servers: `mcp_config.json`** (`mcpServers` map)
- Locations: global `~/.gemini/config/mcp_config.json`, workspace `.agents/mcp_config.json`, plugin `plugins/<name>/mcp_config.json`.
- **stdio** (local): `command`, `args`, `env`. **Streamable HTTP** (remote): `url` (`serverUrl` is also accepted).
- The legacy HTTP+SSE transport is **not supported**. For an SSE-only server, run a stdio bridge such as `mcp-remote`.
- Discovered tools are added to the agent's toolset. Plugin tools get a namespace prefix when needed to avoid name clashes.

**Hooks: `hooks.json`** (named hooks → event handlers)

| Event | Fires | Typical use |
|---|---|---|
| `SessionStart` | Once per new session | Inject startup context |
| `PreToolUse` (needs `matcher`) | Before a tool runs | Gate, block, audit, or rewrite arguments |
| `PostToolUse` (needs `matcher`) | After a tool runs | Lint, format, analyze |
| `PreInvocation` | Before each model call | Inject reminders |
| `PostInvocation` | Immediately after each model invocation completes | Inject follow-up steps; force the loop to continue or terminate |
| `Stop` | When the loop ends | Block stopping until the goal is met |

- `PreToolUse` returns `decision`: `allow` · `deny` · `ask` · `force_ask` (ignores cached approvals). It can also return `overwrite` (a shallow merge into the tool arguments).
- `Stop` can return `decision: "continue"` to re-enter the loop.
- Only `type: "command"` is supported. Hooks run **synchronously and block the loop**, so keep them fast. Set `"enabled": false` to turn a hook off.

**Plugins** are namespaced bundles: `plugins/<name>/plugin.json`, plus optional `skills/`, `rules/` (a consolidated `AGENTS.md` is recommended), `hooks.json` at the plugin root, `mcp_config.json` and `agents/`.
- Discovered plugins are on by default. Your on/off choice is stored in `config.json`, never inside the plugin.
- Install: `agy plugin install <name>@antigravity-plugins-official`, a GitHub URL or a local directory. Or use `/plugin` in the TUI.

---

## 05. Discovery & Precedence

**Where customizations are found**
1. **Workspace:** `.agents/` (also `.agent/`, `_agents/`, `_agent/`). The agent walks from the CWD up to the repo root. Commit this folder to share with the team.
2. **Directory rules:** `AGENTS.md`, `GEMINI.md` and `.agents/rules/*.md`, found by walking up from each file the agent reads or edits.
3. **Global:** `~/.gemini/config/` (applies only on this machine).

**Priority (highest → lowest).** When two customizations have the same name, the higher one wins.

| # | Source |
|---|---|
| 1 | Workspace project (walking up from the CWD) |
| 2 | Declared configs: workspace `skills.json` / `plugins.json` |
| 3 | Global discovery: `~/.gemini/config/` |
| 4 | Built-in customizations (mounted by name) |
| 5 | Global declared configs |

**`skills.json` / `plugins.json`**: `entries` (paths scanned one level deep, with `include_only` / `exclude`) and `inherits` (other config files). Paths can be absolute, `~/`-relative, or relative to the workspace/repo root.

**Team pattern:** commit shared skills to `tools/agents/skills/`. Then commit `.agents/skills.json` with `{"entries":[{"path":"tools/agents/skills"}]}`. Anyone who clones the repo gets the skills automatically.

---

## 06. Subagents, Browser Agent & Parallel Work

- The main agent calls `invoke_subagent` with a role and a prompt. Each subagent **starts with a clean context window** and does not see the parent's history. Subagents run in parallel, in the background.
- **Workspace modes:** `inherit` (same folder), `branch` (an isolated **Git worktree**), `share` (shared repo storage).
- **Built-in subagents:** `research` (codebase exploration), `browser` (only through `/browser`), `self` (a clone of the caller).
- **Custom subagents:** `.agents/agents/<name>.md` (workspace), `~/.gemini/config/agents/` (global) or `plugins/<name>/agents/`. YAML frontmatter: `name`, `description`, `tools`, `model` (`inherit`/`flash`/`pro`), `commandExecutionPolicy` (default `sandbox`), `mcpServers`, `skills`, `mainAgent`, `subagent`.
  - Known issue: a misspelled tool name in `tools` can make the subagent hang.
- **Lifecycle:** Running → Idle (sent its result; wakes up with full context when it gets a message) → Killed (permanent; temporary worktrees are cleaned up).
- **CLI:** the `/agents` panel (Agent Manager) shows ID, role, state and current step. `Alt+J` jumps to the next pending approval. `Ctrl+K` approves in place.
- **SDK:** dynamic self-cloning (`CapabilitiesConfig(enable_subagents=True)`) or static `SubagentConfig`. A custom tool given to a subagent must also be in the parent's `tools`.
- **Browser subagent (`/browser`):** drives Google Chrome through the Chrome DevTools MCP server. Its context is isolated, every session is recorded as a WebM artifact, and it is hidden from the normal subagent list. It is not available in the IDE, and admins can turn it off.
- **Automations** (App) run prompts on a schedule. `/schedule` sets a timer or recurring check inside a conversation.

---

## 07. Permissions, Execution Modes & Terminal Sandbox

**Permission rules:** `allow` / `ask` / `deny` lists with typed matchers: `command(npm test)`, `read_file(path)`, `write_file(src/)`, `read_url`, `execute_url`, `mcp`. **Deny > Ask > Allow.**

**Defaults when no rule matches:** reading and writing inside the workspace is allowed. Web actions (`read_url`, `execute_url`) default to **Ask**. Everything else (commands, MCP, files outside the workspace) defaults to Ask.

**CLI `agentMode`** (cycle with Shift+Tab)

| Mode | Behavior |
|---|---|
| `default` | Asks you to review a diff before every file write |
| `accept-edits` | Auto-approves file edits in the workspace. Commands still follow `toolPermission` |
| `auto` *(Preview)* | Auto-approves edits and runs commands **in the sandbox**. Commands that need to run outside the sandbox are auto-evaluated: safe, reversible ones run, risky ones pause |
| `plan` | Plans before editing (adds `/plan` to the prompt) |

**CLI `toolPermission`:** `request-review` (default) · `proceed-in-sandbox` · `strict` (asks before every tool call, even reads) · `always-proceed` (also turned on by `--dangerously-skip-permissions`). `strict` and `always-proceed` override `auto`.

**Terminal sandbox** (`enableTerminalSandbox` / `--sandbox`; off by default, turned on automatically in `auto` mode)
- Project folders are mounted read-write. `read_file` paths are mounted read-only and `write_file` paths read-write. Everything else is invisible (macOS/Linux). Files such as `.env` are blocked.
- Network: in the CLI, sandboxed commands get **no network by default**. Domains allowed under `read_url` are added to the outbound allowlist.
- A command that runs **outside** the sandbox runs on the host with **full privileges**. Business and enterprise accounts use `unsandboxed(...)` rules for this.
- App security presets (Default, Full machine, Turbo) **never turn the sandbox on**. You must enable sandbox mode yourself. A common combo is sandbox + *Proceed in Sandbox*.

**Other settings:** non-workspace file access (off by default), internet access policy, command allow/deny lists, browser domain allowlist. Project settings override global settings.

---

## 08. Secure Dev Environments: Cloud Workstations & GKE

**Cloud Workstations:** managed dev environments on Google Cloud.
- **Cluster:** region + VPC (not related to GKE clusters). **Configuration:** the template (VM type, persistent disk, container image, IDE, idle and running timeouts; access through IAM). **Workstation:** an instance started or stopped on demand.
- Access through a browser IDE, local VS Code or JetBrains IDEs, or SSH. You can bring your own Linux container image, as long as its entrypoint runs a blocking process.
- **Lock it down:** put it inside a VPC Service Controls perimeter, use a **private cluster** (clients connect through Private Service Connect), **turn off public IPs** (org policy `constraints/compute.vmExternalIpAccess`), and also restrict the Compute Engine API.
- **Agent-optimized development:** set `idleAction=SUSPEND` with an `idleTimeout` (for example `1800s`). Add **keep-alive lifecycle hooks**: start `/google/scripts/keep_alive.sh` when the agent starts working and kill it when the agent waits for input. Samples for Claude Code and Antigravity CLI ship in `/google/samples/agents/keepalive/`. A suspended workstation keeps RAM, processes and agent context, and stops vCPU and memory charges.

**Agent Sandbox on GKE:** a managed add-on that gives kernel-level isolation (gVisor) to untrusted, LLM-generated code. Pieces: `SandboxTemplate` (the blueprint) and `SandboxWarmPool` (pre-warmed pods). A core security policy that you cannot override requires gVisor and blocks `hostNetwork` and `hostPath`.

**Decision rule**

| Need | Pick |
|---|---|
| Stop a local coding agent from running wild on a laptop | Antigravity terminal sandbox + deny rules |
| Corporate, exfiltration-safe dev box for humans and their coding agents | Cloud Workstations (private cluster, VPC-SC, no public IP) |
| Run agent-generated code at scale inside a product | Agent Sandbox on GKE |

---

## 09. Agents CLI: Build → Evaluate → Deploy → Publish

**What it is:** a single, machine-readable interface that coding agents use to drive ADK projects end to end. It packages expert knowledge of ADK, evaluation and Google Cloud deployment as **skills**. Source: `github.com/google/agents-cli`.

**Install.** This is the only command you run yourself:
```bash
uvx google-agents-cli setup        # installs agents-cli, ADK packages and skills into the coding agents on this machine
# alternatives: pipx/pip install google-agents-cli && agents-cli setup
# skills only:  npx skills add google/agents-cli
```
Prerequisites: Python 3.11+, `uv`, Node.js (for the skills), a coding agent. For deployment you also need the gcloud CLI and Terraform.

**Skills that activate** (seen in the quickstarts): `google-agents-cli-workflow`, `-scaffold`, `-adk-code`, `-eval`, `-deploy`, `-publish`, `-observability`.

**Lifecycle commands** (the coding agent usually runs them for you)

| Stage | Command |
|---|---|
| Scaffold | `agents-cli create <name> --prototype --yes` then `agents-cli install` |
| Smoke test | `agents-cli run "<prompt>"` |
| Local UI | `agents-cli playground` (ADK web UI, hot reload, localhost:8080) |
| Evaluate | `agents-cli eval run` (evalsets in `tests/eval/evalsets/*.evalset.json`, LLM-as-judge criteria in `tests/eval/eval_config.json`) |
| Add deploy target | `agents-cli scaffold enhance --deployment-target cloud_run` |
| Deploy | `agents-cli deploy` (Agent Runtime, Cloud Run or GKE) |
| Publish | Register an Agent Runtime agent with Gemini Enterprise in one Agents CLI command (`agents-cli publish gemini-enterprise`, e.g. `--agent-runtime-id`) |

**Project layout:** `app/agent.py`, `app/fast_api_app.py`, `tests/{eval,integration,unit}`, `agents-cli-manifest.yaml`, `Dockerfile`, `GEMINI.md` (guidance for coding agents) and `.env`.

**Auth:** a Gemini API key in `.env` (comment out the `GOOGLE_CLOUD_*` lines), **or** Application Default Credentials (`gcloud auth application-default login`) with the `GOOGLE_CLOUD_*` lines set.

**Observability:** Cloud Trace is on by default. Asking the agent to "set up observability" provisions a service account, a Cloud Storage bucket and a BigQuery dataset.

**Templates:** `adk_a2a` (multi-agent over A2A) and `agentic_rag`. For a single-file learning agent, use `adk create` instead.

**Agent vs. human mode:** Agents CLI is built for two callers. In agent mode, your coding agent uses the installed Agents CLI skills and runs the commands for you, so it needs non-interactive flags (for example `--yes`). In human mode, you run the same commands yourself with the same syntax. Plugin options *(verify)*: check the current Agents CLI docs.

---

## 10. Dev-to-Prod Lifecycle & Claude Code Comparison

**End-to-end flow**
1. Plan in Antigravity (`/plan`) → design spec.
2. Agents CLI skills scaffold the ADK project → `agents-cli run` / `playground`.
3. Write evalsets → `agents-cli eval run` → iterate until they pass.
4. `agents-cli deploy` → Agent Runtime, Cloud Run or GKE.
5. Publish to Gemini Enterprise. Gemini Enterprise passes the user's email to the agent. The Agent Runtime ↔ Gemini Enterprise connection is VPC-SC compliant.
6. Observe with Cloud Trace. Govern with the Agent Platform services (see the Agent Platform guides).

**Vendor-neutral comparison** (see the [Claude Code guide](https://mbettan.github.io/machine-learning-cert/ClaudeCode.html))

| Concept | Antigravity | Claude Code |
|---|---|---|
| Always-on project memory | `AGENTS.md` / `GEMINI.md` | `CLAUDE.md` |
| Skills | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| Subagents | `.agents/agents/<name>.md` | `.claude/agents/<name>.md` |
| MCP config | `mcp_config.json` | `.mcp.json` |
| Hooks | `hooks.json` (`PreToolUse`, `PostToolUse`, `Stop`, …) | `settings.json` hooks (`PreToolUse`, …) |
| Permission precedence | Deny > Ask > Allow | deny → ask → allow |
| Agent-building helper | Agents CLI works with **both** | Agents CLI works with **both** |

**Key point:** MCP servers and SKILL.md skills carry over between harnesses. Agents CLI installs the same skills into Antigravity, Claude Code and Codex.

---

## 11. Exam Traps & Failure Modes

| Symptom | Root cause | Fix |
|---|---|---|
| A rule in `.agents/rules/` never applies | Missing or camelCase `trigger`, or file in a nested subfolder | Use snake_case `trigger`, keep the file flat, or register it in `rules.json` |
| A skill never activates | Vague `description` | Say **what** the skill does and **when** to use it |
| A huge always-on rule gets ignored | 20k-token rules budget exceeded → reduced to a pointer | Switch to `model_decision` or a skill |
| A remote MCP server fails | Legacy SSE endpoint | Point to the Streamable HTTP `/mcp` endpoint, or use a stdio bridge |
| The agent wipes files on the host | `always-proceed` / `--dangerously-skip-permissions` without a sandbox | Sandbox + `proceed-in-sandbox` + deny rules |
| Parallel subagents overwrite each other | Shared workspace, overlapping scope | `branch` (Git worktree) and non-overlapping scopes |
| The agent slows to a crawl | Slow synchronous hook | Keep hooks fast. Move heavy work out of the loop |
| A workstation loses agent state overnight | Idle timeout stops the VM | `idleAction=SUSPEND` + keep-alive hooks |
| Data exfiltration risk from dev VMs | Public IPs, public cluster | Private cluster, VPC-SC, `vmExternalIpAccess` constraint |
| The agent shipped without evals | Deploy before evaluating | `agents-cli eval run` with an evalset is a release gate |
| Treating Antigravity as the agent runtime | Mixing up the dev harness and production | Deploy the ADK agent to Agent Runtime, Cloud Run or GKE |

---

## 12. Glossary, Resources & Practice Quiz

- **Artifact:** a structured deliverable (plan, diff, walkthrough, recording) that you review in place of individual tool calls.
- **Planning vs. Fast mode:** plan-first execution vs. direct execution.
- **Progressive disclosure:** only the name and description of skills (and `model_decision` rules) go into the context until they are needed.
- **Plugin:** a namespaced bundle of skills, rules, hooks, MCP servers and agents.
- **Terminal sandbox:** an OS-level boundary for agent shell commands.
- **Agents CLI:** a skills and command toolkit that lets any coding agent build, evaluate, deploy and publish ADK agents.
- **Agent Sandbox on GKE:** a gVisor-isolated runtime for untrusted, LLM-generated code.
- **Workstation suspension:** `idleAction=SUSPEND` keeps VM memory and agent state through idle periods.

**Official sources:** antigravity.google/docs (overview, artifacts, implementation-plan, rules, skills, hooks, plugins, mcp, subagents, permissions, sandbox, settings, cli/gcli-migration) · adk.dev/get-started/agents-cli · docs.cloud.google.com/gemini-enterprise-agent-platform/agents/quickstart-adk · docs.cloud.google.com/gemini/enterprise/docs/register-and-manage-an-adk-agent · docs.cloud.google.com/workstations (overview, agent-optimized-development, VPC-SC & private clusters) · docs.cloud.google.com/kubernetes-engine/docs/concepts/machine-learning/agent-sandbox.

**Related guides:** [ADK](https://mbettan.github.io/machine-learning-cert/ADK.html) · [Claude Code](https://mbettan.github.io/machine-learning-cert/ClaudeCode.html) · [MCP](https://mbettan.github.io/machine-learning-cert/MCP.html) · [AgentOps](https://mbettan.github.io/machine-learning-cert/AgentOps.html) · [Responsible AI](https://mbettan.github.io/machine-learning-cert/ResponsibleAI.html)


### Self-Assessment

1. **Your new file in `.agents/rules/` has `trigger: alwaysOn` and the agent ignores it. Why?** The `trigger` value is invalid (camelCase), so the rule is silently discarded. Use `always_on`, and keep the file directly in `.agents/rules/` (nested folders need `rules.json`).
2. **When should a piece of guidance be a rule and when a skill?** A rule is a persistent constraint ("never import internal/"). A skill is an on-demand procedure ("how to run DB migrations"). Skills load through progressive disclosure: only the name and description sit in context until the task matches.
3. **A remote MCP server only exposes the legacy HTTP+SSE transport. How do you connect it?** Antigravity does not support legacy SSE. Point to a Streamable HTTP endpoint (`url`) if one exists, or run a stdio bridge such as `mcp-remote` (`command`/`args`).
4. **Two parallel subagents edit the same files and overwrite each other. What do you change?** Use the `branch` workspace mode so each subagent works in its own Git worktree, and give them non-overlapping scopes.
5. **You picked the App's "Full machine" preset. Are agent commands sandboxed?** No. App security presets never turn the terminal sandbox on. Enable sandbox mode yourself, typically with *Proceed in Sandbox*. Commands that run outside the sandbox have full host privileges.
6. **A coding agent on a Cloud Workstation loses its in-memory state after lunch. What is the fix?** Set `idleAction=SUSPEND` with an `idleTimeout` and add keep-alive lifecycle hooks (start `keep_alive.sh` while the agent works, kill it when it waits for input). Suspension keeps RAM, processes and agent context.
7. **List the Agents CLI path from an empty folder to Gemini Enterprise.** `uvx google-agents-cli setup` → `agents-cli create` + `install` → `run` / `playground` → `eval run` (release gate) → `scaffold enhance --deployment-target` if needed → `deploy` → register with Gemini Enterprise in one Agents CLI command (`agents-cli publish gemini-enterprise`).
8. **Is Antigravity where your shipped ADK agent runs in production?** No. Antigravity is the developer's harness. The ADK agent you ship runs on Agent Runtime, Cloud Run or GKE, and can be distributed through Gemini Enterprise.

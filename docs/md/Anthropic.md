# Anthropic Foundational Models & Claude: Study Guide

> **Author:** Michaël Bettan  
> **Track:** Anthropic / Foundational AI  
> **Reading Time:** ~5 min

---

## Overview

**Definition:** Anthropic designs frontier foundation models around three engineering pillars: **reason-based alignment** (Constitutional AI), **mechanistic interpretability** (sparse feature decomposition and activation steering), and **capability-gated safety governance** (the Responsible Scaling Policy and AI Safety Levels). Rather than treating safety and capability as opposing forces, Anthropic integrates alignment, reasoning depth, and system transparency directly into pre-training, post-training, and runtime architecture.

> **Mental model:** Model-level alignment (Constitutional AI and ASL classifiers) eliminates broad catastrophic and ethical harms at the foundation layer, while your application architecture (prompts, deterministic hooks, tool permissions, and domain guardrails) enforces business-specific policies at the product layer.

---

## 1. Core Philosophy & The 3-Layer Claude Ecosystem Map

### Architectural Evolution Across Model Generations

| Dimension | Legacy Baseline (Claude 2) | Transitional (Claude 3.5 Family) | Frontier Architecture (Claude 4.6 / 4.7+) |
|---|---|---|---|
| **Core Design** | Standard autoregressive text LLM | Multimodal text and vision processor | Hybrid reasoning and long-horizon agentic engine |
| **Alignment Profile** | High false-refusal rate on benign edge cases | Contextual nuance with reduced false refusals | Reason-based Constitutional resolution |
| **Context Capacity** | 100k static token window | 200k token window | Up to 1M context / 128k max output with server-side compaction (threshold or on-demand) |
| **Compute & Sampling** | Uniform per-token compute; manual `temperature` / `top_p` | Fixed or manual `budget_tokens` extended thinking | Native **Adaptive Thinking** (`thinking: {type: "adaptive"}`) with automatic interleaved tool-call thinking and 5-level `output_config.effort` scaling (`low`, `medium`, `high`, `xhigh`, `max`); assistant prefilling (4.6+) and non-default `temperature`/`top_p`/`top_k` (4.7+) removed in favor of `output_config.format` and `effort` |
| **Execution Surface** | Stateless text turn-taking | Interactive UI Artifacts | Multi-agent orchestration, CLI harnesses, and GUI VMs |

> **System 2 Reasoning ("Adaptive Thinking"):** Modern Claude models replace manual `budget_tokens` extended thinking with native **Adaptive Thinking** (`thinking: {type: "adaptive"}`), which dynamically decides when and how deeply to reason on each turn, automatically interleaves thinking between tool calls, and scales compute across five `output_config.effort` tiers (`low`, `medium`, `high`, `xhigh` for 30+ minute coding/agentic runs, and `max`).

### The 3-Layer Claude Ecosystem Map

Anthropic's platform is structured into three distinct layers separating end-user workspaces, engineering harnesses, and infrastructure delivery routes:

| Layer | Target Persona & Purpose | Core Surfaces & Components |
|---|---|---|
| **Layer 1: End-User Entry Points** | Interactive workspaces for daily reasoning, document synthesis, and no-code automation | **Web & Mobile (`claude.ai`):** Chat interface with stateful **Artifacts**.<br>**Desktop & Cowork:** Native desktop app featuring **Cowork**, an app-hosted virtual machine (VM) that executes multi-step knowledge work (file organization, cross-document extraction) without requiring terminal commands.<br>**Productivity Connectors:** Embedded integrations inside Slack, Microsoft Excel, and PowerPoint. |
| **Layer 2: Builder & Engineering Interfaces** | Programmable surfaces for software engineers building custom apps, workflows, and autonomous agents | **Direct API (`POST /v1/messages`):** Stateless HTTP primitives for custom application loops, tool use, and structured outputs.<br>**Agentic Coding CLI (`Claude Code`):** Terminal-based coding agent governed by `CLAUDE.md`, permission modes, hooks, subagents, skills, and MCP servers.<br>**Programmable Harness (`Claude Agent SDK`):** Libraries for embedding the Claude Code execution loop into custom pipelines and CI/CD.<br>**Hosted Runtime (`Managed Agents`):** Anthropic-managed cloud harness built around four core primitives: **Agent** (model, prompt, tools, MCP, skills), **Environment** (cloud or self-hosted sandbox), **Session** (stateful running instance), and **Events** (SSE-streamed messages, tool executions, and mid-run interrupts). |
| **Layer 3: Cloud Delivery Routes** | Enterprise infrastructure channels providing billing consolidation, IAM governance, and regional data residency | **First-Party Anthropic API:** Direct platform access with `inference_geo` controls.<br>**Amazon Bedrock:** AWS-native deployment with IAM and VPC integration.<br>**Google Cloud Vertex AI:** GCP-native model garden and enterprise governance.<br>**Microsoft Azure Foundry:** Azure-native provisioning and enterprise compliance. |

---

## 2. Constitutional AI (CAI) & Alignment

### The Compounding Costs of Human-Only RLHF

Relying exclusively on human raters for Reinforcement Learning from Human Feedback (RLHF) introduces three structural bottlenecks at frontier scale:

- **Epistemological Vulnerability (Sycophancy):** Models optimized strictly to maximize human rater approval learn to mirror user biases and flatter misconceptions, sacrificing factual accuracy and rigorous deduction for polite agreement.
- **Fragmented Reward Signals:** Crowdsourced human contractors apply inconsistent moral and safety standards, producing noisy reward models and unpredictable edge-case behavior.
- **Throughput & Latency Limits:** Human annotation cannot scale to supervise massive multimodal datasets or complex multi-step reasoning traces required by frontier models.

### The Constitutional Priority Hierarchy & Holistic Weighting

Constitutional AI replaces opaque human preference bottlenecks with an explicit, reason-based **Constitution**. When values conflict during a turn, the model resolves trade-offs using a four-tier priority order:

1. **Broadly Safe (Highest Priority):** Never undermine human oversight mechanisms, shutdown controls, or systemic safety boundaries.
2. **Broadly Ethical:** Maintain honesty, avoid deceptive behavior, and refuse to assist with severe real-world harm.
3. **Compliant:** Adhere to Anthropic's specific operational and domain guidelines (such as medical, legal, or cybersecurity restrictions).
4. **Genuinely Helpful:** Fulfill user and operator intent constructively, avoiding preachy or unnecessary refusals on benign requests.

> **Holistic Weighting Rule:** This four-tier hierarchy is weighed **holistically** rather than executed as a rigid mechanical gate. Higher priorities prevail when goals genuinely conflict, but the model evaluates plausibility, severity, and context together so remote theoretical risks do not trigger false refusals on legitimate tasks. Furthermore, **training-time alignment only handles broad foundational harm**—enforcing your organization's domain-specific business rules, compliance boundaries, and output schemas remains the responsibility of your application-layer guardrails.

| Governance Layer | Owner | Scope of Enforcement | Examples |
|---|---|---|---|
| **Foundation Layer (Constitutional AI)** | Anthropic Training & Safety | Universal catastrophic, ethical, and oversight boundaries | Refusing CBRN synthesis, resisting sycophancy, preserving human shutdown control |
| **Application Layer (System Prompts, Hooks & Guardrails)** | Product & Platform Engineers | Domain-specific business rules, brand voice, tool permissions, and PII compliance | Blocking competitor mentions, enforcing refund caps, requiring `PreToolUse` approval |

### The Two-Phase CAI Training Pipeline

| Phase | Mechanism | Operational Flow |
|---|---|---|
| **Phase 1: Supervised Learning (Critique & Revision)** | Self-critique and synthetic refinement | The base model generates an initial response to a challenging prompt, critiques its own draft against relevant Constitutional principles, and rewrites the response repeatedly. The resulting revised transcripts form the supervised fine-tuning (SFT) dataset with zero human labeling. |
| **Phase 2: Reinforcement Learning (RLAIF)** | AI-evaluated preference modeling | The SFT model generates pairs of candidate responses. An AI evaluator scores which candidate better satisfies the Constitution, training a preference model from **AI Feedback (RLAIF)** rather than human raters so alignment scales directly with compute. |

---

## 3. Mechanistic Interpretability & Steering

Because neural networks pack thousands of concepts into overlapping neurons (**superposition**), treating a model purely as an opaque black box leaves alignment vulnerable to hidden failure modes. Anthropic's interpretability research decomposes internal activations into inspectable, steerable components:

- **Sparse Autoencoders (SAEs):** Unsupervised dictionary-learning models inserted into transformer layers that decompile dense, polysemantic neural activations into distinct, human-readable **monosemantic features** (such as "sycophantic praise," "code vulnerability," or "immunology").
- **Attribution Graphs & Circuit Tracing (*"On the Biology of a Large Language Model"*):** By linking monosemantic SAE features into end-to-end computational **attribution graphs (circuits)**, researchers uncovered four foundational internal mechanisms: (1) a shared cross-lingual **universal "language of thought"** conceptual space across languages, (2) **forward planning** (e.g., selecting rhyming target words in poetry before composing the line), (3) a **default reluctance to speculate** (hallucinations occur when known-entity circuits misfire and inhibit the default "don't know" refusal circuit), and (4) **unfaithful/fabricated reasoning** (distinguishing genuine step-by-step deduction from backward rationalization of a user's incorrect hint).
- **The Stream Algorithm:** Scaling SAE circuit attribution across long context windows historically suffered from quadratic compute growth. The Stream Algorithm hierarchically prunes 97% to 99% of irrelevant token-to-token interactions, achieving near-linear complexity and enabling researchers to trace exact causal attribution graphs across 100k+ token contexts.
- **Persona Vectors:** Low-rank directional vectors in activation space extracted from contrastive behavioral pairs (e.g., honesty vs. sycophancy, hallucination drift, or deception). By monitoring projections along these vectors at inference time, systems can detect dangerous state drift before tokens are emitted.
- **Behavioral Vaccination (Mitigating Alignment Faking):** Empirical studies demonstrate **alignment faking**, where a model strategically feigns compliance during monitored training evaluations (e.g., "free-tier" prompts used for RLHF) to avoid weight modification while preserving conflicting preferences in unmonitored deployment ("paid-tier" prompts). During fine-tuning, researchers apply **Behavioral Vaccination** (preventative activation steering) by deliberately steering along undesirable Persona Vectors while training the model to stay aligned, building intrinsic structural resilience against sleeper behavior and fine-tuning drift.

---

## 4. Frontier Safety: Responsible Scaling Policy (RSP) & ASL Framework

Anthropic operationalizes frontier risk governance through its **Responsible Scaling Policy (RSP)**, which binds model deployment to concrete **AI Safety Levels (ASLs)** modeled after biosafety containment tiers. Capability evaluations—not release schedules—dictate when stricter containment and deployment controls become mandatory (with **ASL-3** proactively activated starting with **Claude Opus 4+**).

| Dimension | ASL-2 (Standard Frontier Baseline) | ASL-3 (Elevated Catastrophic Risk Trigger) |
|---|---|---|
| **Capability Trigger** | Models provide theoretical information on dangerous topics but cannot autonomously execute catastrophic workflows or uplift novices meaningfully beyond search engines. | Triggered when evaluations cannot rule out meaningful uplift in end-to-end **CBRN** (Chemical, Biological, Radiological, Nuclear) weapons acquisition, autonomous cyber-offense, or autonomous replication. |
| **Deployment Defenses** | Standard Constitutional alignment, automated red-teaming, and post-deployment abuse monitoring. | **Constitutional Classifiers & Next-Gen Classifiers++:** Gen-1 synthetic-trained I/O sentinels cut universal jailbreaks from 86% to 4.4%. **Next-Gen Constitutional Classifiers++** deploy a **two-stage cascade**—a lightweight **linear activation probe** monitoring internal model activations across 100% of traffic that escalates suspicious turns to a **two-sided conversation classifier** evaluating joint input+output context—defeating **reconstruction** (fragmented multi-turn inputs) and **output obfuscation** (metaphor/alias/cipher) attacks at **~1% compute overhead**. |
| **Weight Security** | Standard enterprise cloud security, encrypted storage, and access logging. | **Hardened Weight Containment (>100 controls):** Mandates **Two-Party Authorization (2PA)** for sensitive infrastructure access, strict binary allowlisting, and **egress bandwidth throttling** so automated monitors can detect and sever state-actor weight exfiltration before multi-gigabyte theft completes. |

---

## 5. Focused Glossary

| Term | Definition |
|---|---|
| **RLHF** | Reinforcement Learning from Human Feedback — alignment method relying on human raters; prone to sycophancy, noisy labels, and scaling bottlenecks. |
| **CAI** | Constitutional AI — Anthropic's alignment methodology that trains models against an explicit written Constitution rather than ad-hoc human ratings. |
| **RLAIF** | Reinforcement Learning from AI Feedback — Phase 2 of CAI where an AI evaluator scores candidate outputs against Constitutional principles to train a preference model. |
| **Holistic Weighting** | CAI evaluation principle where the 4-tier priority order (*Safe → Ethical → Compliant → Helpful*) is weighed contextually rather than applied as a rigid mechanical gate. |
| **SAE** | Sparse Autoencoder — interpretability model that decomposes dense, polysemantic neural activations into monosemantic, human-readable features. |
| **Attribution Graphs** | Circuit-tracing maps linking monosemantic features across layers, revealing cross-lingual conceptual spaces, forward planning, misfired "don't know" circuits in hallucinations, and unfaithful reasoning. |
| **Stream Algorithm** | Hierarchical pruning method that eliminates 97–99% of irrelevant token interactions, scaling mechanistic attribution to 100k+ token windows in near-linear time. |
| **Persona Vectors** | Low-rank activation-space directions representing behavioral traits; used for runtime drift monitoring, data screening, and preventative steering. |
| **Alignment Faking** | Strategic behavior where a model feigns compliance during monitored training evaluations while preserving conflicting preferences in unmonitored deployment. |
| **Behavioral Vaccination** | Preventative fine-tuning intervention that intentionally steers along undesirable Persona Vectors so the model develops intrinsic structural resilience against alignment faking and persona drift. |
| **RSP** | Responsible Scaling Policy — Anthropic's governance framework requiring capability-gated containment and deployment safeguards before releasing frontier models. |
| **ASL** | AI Safety Level — tiered security and deployment standard under the RSP (e.g., ASL-2 baseline vs. ASL-3 CBRN containment activated on Claude Opus 4+). |
| **Constitutional Classifiers++** | Next-generation ASL-3 runtime defense pairing a lightweight **linear activation probe** with an escalated **two-sided input+output classifier** to defeat reconstruction and obfuscation jailbreaks at ~1% compute overhead. |
| **2PA** | Two-Party Authorization — ASL-3 weight-security control requiring dual human approval before accessing sensitive model weights or training infrastructure. |
| **Cowork** | Desktop-app mode running inside an app-hosted virtual machine (VM) that lets non-developers delegate multi-step file and knowledge tasks without terminal setup. |
| **Artifacts** | Dedicated, stateful UI workspace rendered alongside `claude.ai` chat for viewing and iterating on code, documents, and interactive visual components. |


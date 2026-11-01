# AgentOps: Evals, Observability & Cost: Study Guide

> **Author:** Michaël Bettan  
> **Version:** 2.0  
> **Track:** Foundation / Production AI Engineering (PAA Section 4 Core · CCAR-F Domain 5 Supporting)

---

## Overview & Mental Model

**Definition:** **AgentOps** (AI Evaluation, Observability, Runtime Engineering, and Production FinOps) is the operational control plane that transforms a probabilistic language model and multi-step tool loop into a reliable, auditable, and economically viable production service. Because generative agents sample tokens stochastically, branch dynamically across external APIs, and mutate state over multi-turn trajectories, classical software verification (binary unit tests and HTTP `200 OK` uptime checks) cannot detect silent quality regressions, "right answer, wrong trajectory" policy violations, or heavy-tail cost explosions.

**Why production AI systems fail without an AgentOps control plane:**
- **Silent quality & trajectory regressions:** A prompt edit, retrieval tweak, or unpinned model alias can degrade factual faithfulness by 20%—or skip a mandatory identity-verification tool—while every HTTP call still returns `200 OK`.
- **Compounding multi-step unreliability:** A single-step accuracy of 90% collapses to **59.0%** across a 5-step sequential agent workflow ($0.90^5$).
- **Integration seam failures:** Individual prompts and tools pass isolated tests at >95%, yet the end-to-end pipeline fails because Component A's output format, truncation limit, or error handling violates Component B's input assumptions.
- **Runtime & state mismatches:** Deploying a stateful orchestrator to an ephemeral scale-to-zero container without externalized session storage wipes in-flight memory, while attempting to host standalone MCP servers or custom GPUs on opinionated agent runtimes hits hard platform boundaries.
- **Unbounded heavy-tail economics:** Sizing budgets on median (`p50`) token usage leads to 4×–15× cost overruns when multi-agent fan-out, `thinking_level=HIGH` reasoning loops, tool retries, and mandatory human-review labor hit production scale.

> **Mental model:**  
> Prompts and model weights are **probabilistic components**; your evaluation harness, simulation sandbox, OpenTelemetry trace pipeline, runtime boundary, resilience stack, and FinOps ledger form the **deterministic containment vessel** around them. You cannot eliminate variance inside the model, so you bound, measure, optimize, and price it at every boundary.

**The 5-Pillar AgentOps Operational Loop:**
1. **Specify, Simulate & Grade (Offline Evals):** Curate a stratified golden dataset, climb the 3-tier grading ladder (Deterministic Code → Calibrated Autoraters / Adaptive Rubrics → Human Experts), and stress-test multi-turn paths with **2-Step Agent Simulation** and **Environment Simulation**.
2. **Verify Seams & Consistency (`pass^k` & Test Pyramid):** Gate releases on worst-case consistency (`pass^k`), trajectory invariants (`trajectory_in_order_match`), and coupled Level 3 integration seam tests.
3. **Observe, Cluster & Optimize (Telemetry & Flywheel):** Instrument PII-safe **OpenTelemetry `gen_ai.*`** spans and dual-attribution audit logs (`is_agentic=true`), monitor live traffic via **Online Evaluation Monitors**, group regressions with **Failure Cluster Analysis**, and close the loop with **Agent Optimizer / Prompt Optimizer**.
4. **Select Runtimes & Isolate Faults (Scale & Resilience):** Match workloads to **Agent Runtime**, **Cloud Run**, or **GKE** (`Agent Substrate` / `Agent Sandbox`), and wrap every model/tool hop in full-jitter backoff, idempotency keys, circuit breakers, and validated fallbacks.
5. **Roll Out Safely & Price the Tail (Shadow/A/B & FinOps):** Promote changes through read-only **Shadow Mode** and **4-Element A/B Tests**, model budgets on `p95`/`p99` heavy tails, and subtract the **Step 4 Human-Review Tax** to verify net enterprise ROI.

---

## 01. Evaluation Strategy & The 3-Tier Grading Hierarchy (`#grading-hierarchy`)

### Why "Vibe Checks" Fail in Production

Eyeballing 5 to 10 interactive examples ("vibe checking") is useful for initial prototyping, but it breaks down immediately as an engineering release gate:
- **Zero statistical power:** On a sample of 10 inputs, a 15% regression is indistinguishable from sampling noise.
- **Confirmation bias:** Developers naturally test happy-path phrasing and subconsciously avoid adversarial inputs, malformed documents, or ambiguous multi-intent queries.
- **Unseen trade-offs:** Tightening a prompt to stop false positives on one edge case frequently induces false refusals or format regressions on twenty others that nobody re-tested.

**Eval-Driven Development (EDD) Lifecycle:**
1. **Define "done" quantitatively first:** Specify target task completion rate, trajectory compliance, acceptable refusal rate, `p95` latency ceiling, and maximum cost per resolved task *before* iterating on prompts or switching models.
2. **Curate a stratified golden dataset:** Combine happy-path production queries (50%), boundary/edge cases such as empty retrieval, multi-intent prompts, and truncated inputs (30%), and adversarial/safety-probing inputs (20%).
3. **Version everything:** Pin the golden dataset version, autorater rubric version, system prompt template, tool schemas, Agent Registry snapshot, and exact model ID so every eval run is a single-variable experiment.
4. **Inspect per-case diffs, not just aggregate means:** Two prompts that both score 86% overall may fail on completely different slices; always inspect regressions by failure cluster and severity.

### The 3-Tier Grading Ladder

Always climb the grading ladder from the cheapest, fastest, most deterministic check to the most expensive semantic review. Never pay an LLM judge or human annotator to verify a property that a 5-line function can check deterministically.

| Tier | Grader Type | What It Evaluates | Speed & Cost | Reproducibility | Rule of Thumb |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Deterministic Code Graders** | Exact enum/label match, regex/forbidden strings, JSON Schema & Pydantic validation, AST/compile checks, SQL/code execution unit tests, tool-call sequence & argument bounds | Milliseconds · **$0** | **100% deterministic** | **Always run first.** Gate every CI/CD commit on Tier 1 properties. |
| **Tier 2** | **Calibrated Autoraters (LLM-as-Judge)** | Open-ended semantic quality: factual faithfulness to retrieved context, adaptive rubric satisfaction, tool-selection rationale, tone, policy compliance | Seconds · **Token cost per run** | High (when anchored + calibrated) | Use only for semantic qualities code cannot parse; calibrate against Tier 3. |
| **Tier 3** | **Human Domain Calibration** | Ambiguous domain edge cases, high-stakes medical/legal/financial accuracy, novel failure discovery, golden-set labeling, autorater calibration | Hours to days · **Highest ($50–$200+/hr)** | Subject to inter-rater variance | Use to build the golden set, audit slices, and measure Tier 2 agreement. |

```
Input + Candidate Trajectory + Reference / Context
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ TIER 1: Deterministic Code Assertions ($0, ms, 100%)   │
│ • Valid JSON / strict schema? • Required fields non-null│
│ • Allowed tool names & order? • Code compiles & passes? │
└──────┬──────────────────────────────────────────┬──────┘
       │ PASS                                     │ FAIL ──► Hard Fail (Stop early; do not call LLM Judge)
       ▼
┌────────────────────────────────────────────────────────┐
│ TIER 2: Calibrated Autorater / Adaptive Rubric         │
│ • CoT Critique BEFORE score   • Binary or 1–3/1–5 scale │
│ • Position-swapped (if A/B)   • Cross-family/tier model │
└──────┬──────────────────────────────────────────┬──────┘
       │ Low Confidence / Disagreement / Sample   │ High Confidence Score
       ▼                                          ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│ TIER 3: Human Domain Expert Audit    │   │ Emit Eval Metric & CI Gate  │
│ • Update golden set & rubric anchors │   └─────────────────────────────┘
└──────────────────────────────────────┘
```

### LLM-as-Judge Biases & Engineering Mitigations

Using an uncalibrated LLM as a grader introduces systematic measurement errors that can steer prompt engineering in the wrong direction.

| Judge Bias | Mechanism & Symptom | Production Mitigation |
| :--- | :--- | :--- |
| **Verbosity (Length) Bias** | Judges consistently award higher scores to longer, polite, multi-paragraph responses even when they contain fluff, repetition, or subtle hallucinations. | Explicitly penalize unnecessary verbosity in the rubric; grade atomic factual claims (precision/recall) rather than holistic impression; normalize or cap length where appropriate. |
| **Positional (Order) Bias** | In pairwise A/B comparisons, judges systematically favor whichever response appears in slot A (primacy bias) or slot B (recency bias). | Run **every pairwise comparison twice** with swapped order `(A, B)` and `(B, A)`. Count a win only if the same candidate wins both passes; mark split decisions as a tie. |
| **Self-Preference Bias** | A model family or checkpoint favors outputs matching its own stylistic distribution and blind spots, overlooking reasoning errors it would make itself. | Grade with a **different model family or higher capability tier** than the generator, and always run the judge in a **fresh, isolated context window** containing only the rubric, source ground truth, and candidate output. |
| **Score Inflation & Scale Drift** | Asking an LLM to "rate quality from 1 to 100" or "1 to 10" yields arbitrary clusterings around 7–9 with low run-to-run consistency. | Use **binary (`Pass` / `Fail`) checks** decomposed per criterion (adaptive rubrics), or low-granularity **1–3 or 1–5 anchored scales** where every integer has an explicit behavioral definition. |
| **Post-Hoc Rationalization** | If the judge outputs a numeric score *first* and its explanation *second*, attention locks onto justifying the emitted token rather than evaluating the evidence. | Enforce structured output where the **`reasoning` / `critique` field precedes the `score` field** (Chain-of-Thought *before* judgment). |

### Calibrating the Autorater Against Human Ground Truth

Because a model-based autorater acts as a learned classifier, benchmark its reliability before trusting its scores:
1. **Build a human-labeled calibration set:** Have 2–3 domain experts independently grade 100–300 stratified examples using the exact same rubric. Measure **inter-annotator agreement** first (if humans disagree with each other, e.g., $\kappa < 0.40$, the rubric itself is ambiguous and must be rewritten before touching the LLM judge).
2. **Measure Autorater–Human Alignment:**
   - **Cohen's Kappa ($\kappa$):** Measures agreement on binary or categorical classifications while correcting for chance agreement ($\kappa = \frac{p_o - p_e}{1 - p_e}$). Target **$\kappa \ge 0.75$** before automating release gates.
   - **Spearman's Rank Correlation ($\rho$) / Kendall's $\tau$:** Measures monotonic ranking alignment on ordinal 1–5 rubrics.
   - **Confusion Matrix (FPR / FNR):** Track false-pass rate (judge says Pass, human says Fail) separately from false-fail rate; in safety or compliance gates, tune the rubric to minimize false passes.

```python
from pydantic import BaseModel, Field

class FaithfulnessGrade(BaseModel):
    extracted_claims: list[str] = Field(
        description="Atomic factual claims made in the candidate response."
    )
    unsupported_claims: list[str] = Field(
        description="Claims from extracted_claims not directly supported by the source context."
    )
    critique: str = Field(
        description="Step-by-step verification comparing each claim against the source text."
    )
    score: int = Field(
        ge=1, le=3,
        description="1 = Any hallucinated/unsupported claim; 2 = Faithful but omits key context; 3 = Fully faithful and complete."
    )
```

> [!WARNING]
> **Common trap:** Never ask the same model context that generated an answer to critique and score its own output in the next conversational turn ("self-grading in-thread"). Because prior reasoning tokens and assumptions remain in `messages[]`, the model exhibits severe self-confirmation bias. Always invoke autoraters in a **clean, independent request**.

---

## 02. Managed Evaluation Frameworks, Autoraters & Simulation (`#managed-eval-autoraters`)

In enterprise Google Cloud and multi-framework architectures (PAA Section 4.1), teams must choose the right evaluation tool for each stage of the developer inner loop, CI/CD pipeline, pre-release stress test, and live production monitor—rather than forcing a single tool to do everything.

### Choosing the Right Evaluation Tooling Tier

| Evaluation Tier & Tooling | Primary Mechanism | Speed & Variance | Best Fit & Architectural Boundary |
| :--- | :--- | :--- | :--- |
| **1. Deterministic Harness Replay**<br>(`adk conformance test --mode=replay`) | Replays recorded LLM responses from `adk conformance record` baselines against live agent code, callbacks, and state transitions. | **< 5 seconds · $0 · Zero variance** | Every git commit / pre-commit hook verifying that callback guardrails, `state_delta` logic, and routing code did not regress. |
| **2. In-Repo CI Gate**<br>(`adk eval`, `AgentEvaluator.evaluate`, `agents-cli eval run`) | Runs `*.test.json` and `*.evalset.json` suites against live models, grading `tool_trajectory_avg_score` (`EXACT`, `IN_ORDER`, `ANY_ORDER`), rubrics, and `custom_metrics`. | **1–5 minutes · Low cost** | Pull-request blocking gates inside GitHub Actions or Cloud Build for code-first ADK repositories (`tests/eval/`). |
| **3. Cloud-Scale Managed Evaluation**<br>(**Agent Platform Gen AI Evaluation Service** — `client.evals`) | Framework-agnostic managed service (`EvalTask` / `client.evals.evaluate`) providing **Adaptive Rubrics**, **Custom Autoraters**, **2-Step Agent Simulation**, **Environment Simulation**, and **Online Evaluation Monitors**. | **Minutes to continuous · Managed scale** | Cross-language/cross-framework agents (ADK, LangGraph, Managed Agents, Cloud Run), model migrations (e.g., to `gemini-4-argon`), synthetic stress-testing, and live production trace scoring. |

### Gen AI Evaluation Service: Autorater & Metric Taxonomy

The **Gen AI Evaluation Service** evaluates both **reference-based** benchmarks (where a golden ground-truth answer or expected tool trajectory exists) and **reference-free** traces (essential for scoring unlabeled live production conversations):

| Metric Family | Reference Needed? | How It Works | Canonical Built-In Metrics & Use Cases |
| :--- | :---: | :--- | :--- |
| **Adaptive Rubrics** *(Recommended Default)* | **No** (Reference-free) | Dynamically generates a **tailored set of pass/fail unit-test rubrics** unique to *each individual prompt* in the dataset, then scores the candidate response against each generated check. | `GENERAL_QUALITY`, multi-turn instruction adherence across diverse, open-ended user prompts where a static checklist would be too vague or brittle. |
| **Static Rubrics** | **No** | Applies an identical, organization-wide pass/fail rubric across every prompt in the suite. | Mandatory regulatory disclaimers, brand voice rules, PII refusal formatting, policy invariants. |
| **Agent Outcome & Grounding Autoraters** | **No** (Context-grounded) | Specialized LLM-as-judge autoraters inspecting full conversation traces and retrieved/tool context. | `FINAL_RESPONSE_QUALITY`, `HALLUCINATION` (faithfulness to tool/RAG observations), `TOOL_USE_QUALITY`, `SAFETY`. |
| **Trajectory Metrics** | **Yes** (Golden tool trace) | Deterministic comparison between the agent's executed tool sequence/arguments and a reference trajectory. | `trajectory_exact_match` (strict compliance sequences), `trajectory_in_order_match` (required milestones in order, extra read-only calls allowed), `trajectory_any_order_match` (parallel fan-out), `trajectory_precision`, `trajectory_recall`. |
| **Computation & Custom Code Metrics** | **Yes / Optional** | Deterministic algorithms or custom Python functions (`custom_metrics`) executing at $0 judge token cost. | `EXACT_MATCH`, `ROUGE`, `BLEU`, JSON Schema validation, SQL AST checks, hard tool-call count or token-budget gates. |
| **Custom Autoraters** | **Configurable** | User-defined judge prompt templates, structured critique-before-score schemas, and domain rubrics registered in `client.evals` and calibrated against human raters. | Proprietary clinical, legal, underwriting, or financial grading rules that generic prebuilt autoraters do not encode. |

> [!IMPORTANT]
> **The "Right Answer, Wrong Path" Compliance Trap:** Grading a customer-refund or healthcare agent solely with `FINAL_RESPONSE_QUALITY` or `multi_turn_task_success_v1` will pass an agent that guessed or issued a refund *without* calling `verify_customer_identity` or `check_return_eligibility` first. Whenever policy mandates verification steps, **always pair outcome autoraters with `trajectory_in_order_match` or `trajectory_exact_match`** (plus a forbidden-tool custom check).

### Pre-Launch Stress Testing: 2-Step Agent Simulation & Environment Simulation

Hand-written golden sets rarely exceed 50–200 single-turn prompts and miss multi-turn clarification loops or third-party API brownouts. Before launching—even when zero historical production logs exist—combine Agent Platform's two simulation engines:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Immutable Agent Registry Snapshot (Instructions + Model + Tool Schemas)    │
└──────────────────┬─────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. 2-STEP AGENT SIMULATION (Multi-Turn User Persona Simulator)             │
│   • Step 1 (Scenario Synthesis): Auto-generates diverse Starting Prompts   │
│     + hidden Conversation Plans (persona, goal, constraints, edge cases).  │
│   • Step 2 (Multi-Turn Dialogue): Simulated user LLM converses with target │
│     agent across turns until goal completion, abandonment, or max_turns.   │
└──────────────────┬─────────────────────────────────────────────────────────┘
                   │ Outbound Tool Calls Intercepted During Run
                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. ENVIRONMENT SIMULATION (Deterministic Fault & Tool Mocking)             │
│   • Injects HTTP 503 / 429 errors, timeout spikes, malformed JSON, or      │
│     synthetic edge-case rows WITHOUT touching live production backends.    │
└──────────────────┬─────────────────────────────────────────────────────────┘
                   │ Emits Immutable OpenTelemetry Traces
                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. MULTI-TURN AUTORATERS + TRAJECTORY METRICS + FAILURE CLUSTER ANALYSIS   │
└────────────────────────────────────────────────────────────────────────────┘
```

1. **2-Step Agent Simulation:** Requires an immutable **Agent Registry** snapshot so every benchmark is reproducible. In **Step 1**, the simulator reads the agent's system instructions and tool declarations to synthesize realistic `Starting Prompts` paired with hidden `Conversation Plans` (e.g., an impatient traveler who only reveals their booking code when explicitly asked). In **Step 2**, a simulated user model conducts the multi-turn session and records full traces.
2. **Environment Simulation:** Wraps tool boundaries during evaluation to inject deterministic faults (`HTTP 503 Service Unavailable`, `429 RESOURCE_EXHAUSTED`, 12-second latency spikes, empty results) and mocked responses—proving your retry, fallback, and escalation guardrails work **without risking real side effects on production payment or ERP APIs**.

---

## 03. Non-Deterministic Metrics: `pass@k` vs. `pass^k` (`#pass-metrics`)

Because LLM generation is stochastic, running the exact same prompt and tool sequence $k$ times can produce different trajectories and outcomes. Picking the wrong multi-trial metric can make a brittle system look production-ready on paper while failing constantly for real users.

### Mathematical & Operational Contrast

Let $p \in [0, 1]$ be the single-trial probability that an agent or model completes a task correctly on one independent run, and let $k$ be the number of independent trials.

$$\text{pass}@k = 1 - (1 - p)^k \qquad \text{vs.} \qquad \text{pass}^k = p^k$$

| Metric | Formula (for single-run success $p$) | Meaning | Curve as $k$ Increases | When to Use | When It Is Dangerous |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`pass@k`** *(At-Least-One Success)* | $1 - (1 - p)^k$ *(unbiased estimator over $n \ge k$ samples)* | Chance of seeing **one or more successes** across $k$ independent runs. | **Rises toward 100%** (masks underlying flakiness) | Code generation with a compiler/unit-test verifier; swarm tournament prototyping where a deterministic filter picks the single working output. | **Customer-facing chat or autonomous agents:** users only see 1 run, and side-effecting tools cannot be casually run 5 times hoping one works. |
| **`pass^k`** *(Every-Run Consistency)* | $p^k$ | Chance that **every single run across $k$ trials** succeeds without failure. | **Decays exponentially toward 0%** (exposes variance) | **Customer-facing agents**, unattended background automation, regulated workflows, and mutating tool pipelines where every invocation must be reliable. | Over-optimizing `pass^k` on purely creative brainstorming tasks where diversity across samples is desirable. |

### The Exponential Decay of Consistency (`pass^k` Table)

Notice how a single-run accuracy of $p = 0.90$ looks impressive on `pass@5` ($99.999\%$) while collapsing to $59.0\%$ on `pass^5` and $34.9\%$ on `pass^10`:

| Single-Run Accuracy ($p$) | `pass@1` / `pass^1` | `pass@5` ($1 - (1-p)^5$) | `pass^5` ($p^5$) | `pass^10` ($p^{10}$) | Operational Interpretation |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **0.70 (70%)** | 70.0% | 99.8% | **16.8%** | **2.8%** | Usable for 5-sample code synthesis with unit tests; **unusable** for live automation. |
| **0.85 (85%)** | 85.0% | 99.99% | **44.4%** | **19.7%** | Fails more than half the time over 5 consecutive runs. |
| **0.90 (90%)** | 90.0% | 99.999% | **59.0%** | **34.9%** | Still fails **41% of 5-run consistency suites**. |
| **0.95 (95%)** | 95.0% | >99.999% | **77.4%** | **59.9%** | Minimum baseline before adding deterministic guardrails. |
| **0.99 (99%)** | 99.0% | >99.999% | **95.1%** | **90.4%** | Production-grade step reliability (achieved via code gates + schema constraints). |

### Compounding Multi-Step Accuracy Across Sequential Agent Steps

The exact same multiplicative law governs a single execution of a **multi-step sequential workflow**. If an agent must complete $M$ sequential steps (e.g., Classify Intent → Formulate Query → Select Tool → Parse Payload → Synthesize Final Answer) and each step has independent success probability $p_i$, end-to-end workflow success is the product of every step:

$$P(\text{Workflow Success}) = \prod_{i=1}^{M} p_i \quad \text{(or } p^M \text{ if each step has accuracy } p\text{)}$$

- **Example:** A 6-step autonomous workflow where every individual step scores **92%** in isolation ($p = 0.92$) has an end-to-end first-pass success rate of $0.92^6 \approx \mathbf{60.6\%}$—meaning nearly **4 out of 10 production runs fail**.
- **Architectural remedies to beat compounding decay:**
  1. **Replace probabilistic steps with deterministic workflow nodes:** If steps 2 and 4 can be written as standard code, ADK workflow edges, or strict schema validators ($p = 1.00$), a 6-step pipeline shrinks to 3 probabilistic hops ($0.92^3 \approx 77.9\%$).
  2. **Insert programmatic verification gates between steps:** Catch and auto-correct malformed tool arguments or schema errors at step $i$ before passing corrupt state to step $i+1$.
  3. **Bound step count:** Keep autonomous loops shallow and route predefined sequences through deterministic workflow orchestrators (`SequentialAgent`) rather than LLM routers.

> [!IMPORTANT]
> **Exam & production rule:** Whenever a scenario involves an unattended workflow, customer-facing support agent, or financial/database tool execution, evaluate readiness using **`pass^k`** (every trial succeeds) and **end-to-end trajectory completion**, never `pass@k`. Use `pass@k` only when a downstream deterministic verifier (such as a test suite or compiler) can automatically filter $k$ candidates before side effects occur.

---

## 04. The 4-Level Agent Test Pyramid & Integration Seams (`#test-pyramid`)

Testing an agentic system exclusively through end-to-end live conversations is slow, expensive, and non-diagnostic; testing it exclusively through isolated unit tests misses catastrophic multi-step handoff failures. Production teams structure verification as a **4-Level Agent Test Pyramid**.

```
                    /\
                   /  \        LEVEL 4: Live Canary & Online Evaluation Monitors
                  / L4 \       (Sampled async autoraters, shadow runs, drift alerts — Continuous)
                 /──────\
                /        \     LEVEL 3: Trajectory, Seam & Simulation Integration Tests
               /    L3    \    (2-Step Simulation + Environment fault injection — Pre-Release / Nightly)
              /────────────\
             /              \  LEVEL 2: Single-Step Component Evals
            /       L2       \ (Isolated router/extractor/RAG step on golden slices — Per PR / Model Bump)
           /──────────────────\
          /                    \ LEVEL 1: Deterministic Unit & Conformance Replay Tests
         /          L1          \(Schemas, parsers, callbacks, `adk conformance test --mode=replay` — Every Commit)
        /________________________\
```

### The 4 Levels in Detail

| Level | Scope & Target | What Is Mocked vs. Live | Execution Cadence & Cost | What It Catches |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1: Deterministic Unit & Replay Tests** | Tool JSON schemas, Pydantic validators, prompt template rendering, PII scrubbers, retry state machines, `adk conformance test --mode=replay` | **LLM is 100% mocked / replayed** from recorded fixtures. Pure code execution. | Every save / pre-commit hook · **Milliseconds to <5s · $0** | Broken schema definitions, template `KeyError` bugs, callback regressions, broken `state_delta` routing. |
| **Level 2: Single-Step Component Evals** | A single LLM call in isolation: intent router, entity extractor, query rewriter, or RAG answer generator | **Live LLM call** against a frozen, curated golden input + fixed context snapshot. | Every PR touching prompts/models · **Seconds to minutes · Low cost** | Prompt regressions, classification drift, hallucination on specific golden slices, schema compliance drops. |
| **Level 3: Trajectory & Seam Integration Tests** | Multi-turn agent loop across 2–8 steps: tool selection, argument passing, error recovery, subagent handoffs | **Live LLM + Environment Simulation / sandboxed test doubles** (including injected `503`, `429`, and empty-result fixtures). | Pre-release gate / nightly build · **Minutes · Moderate cost** | **Integration seam failures**, infinite tool loops, silent error swallowing, observation flooding, context collapse. |
| **Level 4: Live Canary & Online Monitors** | Real production traffic across the full deployed stack | **100% live** (canary slice, shadow pipeline, or 1–5% sampled **Online Evaluation Monitors**). | Continuous in production · **Budgeted % of prod spend** | Input/data drift, unpredicted user phrasing, latency spikes, real third-party API schema changes. |

### Why Integration Seams Hide Silent Bugs

An **integration seam** is the boundary where the output of Component A becomes the input of Component B (for example: *Query Rewriter → Hybrid Retriever*, *Tool Execution Output → Agent Context*, or *Planner Subagent → Executor Subagent*).

**The 95% Component Paradox:** Every individual component can score **>95% in Level 2 isolated evals** while the end-to-end system fails on **>40% of real tasks** because isolated evals feed clean, idealized inputs to each stage.

| Seam Failure Pattern | How Component A Behaves ("Passes L2") | How Component B Breaks Across the Seam | Architectural Fix |
| :--- | :--- | :--- | :--- |
| **Format & Schema Drift** | Extractor outputs dates as `"Oct 26, 2026"` or wraps JSON in ```` ```json ```` markdown fences (passes loose L2 check). | Downstream SQL/API tool expects strict ISO-8601 `2026-10-26` or raw JSON and throws a validation/parse error. | Enforce **strict structured outputs** (`output_schema` / JSON Schema) at the seam and validate with a Level 1/3 contract test. |
| **Observation Flooding & Silent Truncation** | Search tool dumps a 40,000-token raw log into context (flooding attention), or middleware naively slices the first 4,000 chars. | Either attention degrades across turns (**context rot**) or the stack trace at the bottom is cut off, causing a confident *"No errors found"*. | Truncate structurally (head + tail + error lines, or return pagination metadata `truncated: true, next_cursor: "..."`). |
| **Context Collapse During Compaction** | Sliding-window summarizer compresses 12 prior turns into a 3-sentence prose paragraph. | Summarizer drops an exact UUID, config flag, or constraint read in Turn 2 that Turn 14 needs to execute a tool safely. | Persist exact IDs, constraints, and slot values in structured **Session `state`** (`session.state`), never solely in summarized prose. |
| **Swallowed Tool Failures (Empty vs. Error)** | Tool wrapper catches a database timeout (`504`) and returns `[]` or `""` so the pipeline doesn't crash. | The model interprets `[]` as ground truth (*"You have zero open orders"*) instead of a transient system outage. | Never conflate empty results with failures; return explicit structured error flags (`is_error: true`, error code, retryability). |
| **Distribution Shift Between Stages** | Query rewriter expands short user queries into 80-word boolean strings that were never in the retriever's golden set. | Dense embedding model loses specificity on 80-word keyword-stuffed queries, dropping top-5 recall by 30%. | Evaluate *Query Rewriter + Retriever* together as a coupled pair in Level 3 seam tests using end-to-end Recall@K. |

---

## 05. Observability, Distributed Tracing & Drift Detection (`#observability-drift`)

In a production agentic workflow, a single user message can fan out into Model Armor screening, hybrid vector retrieval, cross-encoder reranking, multi-turn `gemini-4-argon` or Claude reasoning calls, MCP tool executions, and A2A sub-agent delegations. Without standardized **distributed tracing**, diagnosing a 19-second stall, a reasoning loop, or a hallucination is guesswork.

### OpenTelemetry `gen_ai.*` Semantic Conventions & Agent Observability

Instrument every workflow with **OpenTelemetry (OTel) Semantic Conventions for Generative AI** (`gen_ai.*` attributes across `invoke_agent`, `chat`, and `execute_tool` spans) so traces render uniformly across **Google Cloud Trace**, **Agent Registry Observability**, and vendor-neutral APMs:

```
Trace (trace_id = "tr_9f8a...", session_id = "sess_42", is_agentic = true)
 ├── Span 1: model_armor.screen_input        [14 ms | verdict=ALLOW]
 ├── Span 2: retrieval.agent_search          [82 ms | top_k=20, rerank_n=5, store="policy-v4"]
 ├── Span 3: gen_ai.chat (Turn 1)            [1,180 ms | ttft=310 ms | finish_reason="tool_calls"]
 │    └── Attributes: gen_ai.request.model="gemini-3.8-flash", thinking_level="MEDIUM",
 │                    input_tokens=4820, cached_tokens=4200, thinking_tokens=190, output_tokens=95
 ├── Span 4: gen_ai.execute_tool (mcp:order) [640 ms | status=OK | retry_count=1]
 └── Span 5: gen_ai.chat (Turn 2)            [910 ms | ttft=240 ms | finish_reason="stop"]
```

**Telemetry, Privacy & Dual-Attribution Governance on Google Cloud (PAA 4.2 & 5.1):**
- **Metadata-First Default Telemetry:** On Agent Runtime, setting `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true` (with `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`) exports full latency waterfalls, token/cache counts, tool latencies, and error codes **without** logging raw user prompts or model completions.
- **Opt-In PII-Scrubbed Payload Capture:** Raw message content capture (`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`) must only be enabled in approved environments paired with **Sensitive Data Protection (SDP)** de-identification templates (redacting/tokenizing SSNs, payment cards, emails, and secrets) and RBAC-restricted Cloud Logging buckets (`roles/logging.privateLogViewer`).
- **Dual-Attribution Agentic Audit Logging (`is_agentic=true`):** When an agent acts on behalf of a human user, Cloud Audit Logs and execution logs tag events with `is_agentic=true` and record **both** (1) the cryptographic SPIFFE **Agent Identity** (`principal://...` / `spiffe://...`) and (2) the initiating **human user principal**—eliminating "confused deputy" forensic blind spots.

### Troubleshooting Production Agent Issues via Telemetry Views

Agent Registry's Observability suite (Overview, Evaluation, Models, Tools, Usage, Logs, Traces, Topology) maps production symptoms directly to root causes:

| Production Issue (PAA 4.2) | Diagnostic Signature in Cloud Trace / Agent Observability | Root Cause & Engineering Remediation |
| :--- | :--- | :--- |
| **Agent Reasoning Loops** | `Traces` waterfall shows 8–15 consecutive `gen_ai.chat` ↔ `execute_tool` spans calling the exact same tool with identical or oscillating arguments until `max_turns` aborts. | Ambiguous tool error message (e.g., returning `""` instead of actionable schema feedback) or missing loop cap. Return structured error hints (`ReflectAndRetryToolPlugin`), enforce `max_llm_calls` / `max_iterations`, and break cycles with deterministic state flags. |
| **Tool Invocation Latency Spikes** | End-to-end turn `p95` jumps to 14s while LLM `ttft_ms` and decode time stay <1.2s; `Tools` tab highlights a single MCP server `p95` at 11.5s or 5 serial tool spans. | Unpooled database connections, cross-region VPC hops, or sequential execution of independent reads. Co-locate runtimes with data, use `MCP Toolbox` connection pooling, and fan out independent reads concurrently (`ParallelAgent`). |
| **Ignored Tools ("No-Tool Interactions")** | `Tools` tab shows high **"no-tool interaction"** rate alongside elevated `HALLUCINATION` autorater flags on domain questions. | Vague or overlapping tool docstrings/schemas cause the model to guess from parametric memory instead of calling the tool. Sharpen tool descriptions and add `trajectory_in_order_match` CI gates. |
| **Model Prefill / Thinking Bottlenecks** | `Models` & `Traces` tabs show `thinking_tokens` dominating `total_generation_ms` on simple classification hops, or high `ttft_ms` with `cached_tokens = 0`. | `thinking_level="HIGH"` over-allocated to routine steps, or dynamic timestamps placed at line 1 busting prefix caching. Route simple steps to `gemini-3.5-flash-lite` (`minimal`) or `gemini-3.8-flash` (`low`), and move volatile state after `static_instruction`. |

### SLIs, SLOs & Two Distinct Forms of Production Drift

Production AI systems track **four SLI dimensions**: **Responsiveness** (`p95 TTFT`, `p95` turn latency), **Pipeline Reliability** (`429`/`5xx` rate, tool `is_error` rate, fallback rate, unexpected `max_tokens`/`refusal` stop reasons), **Economic Efficiency** (cache hit ratio $>75\%$, cost per resolved task, `p95` turns/session), and **Semantic Quality** (sampled **Online Evaluation Monitor** pass rates $\ge 96\%$ and human escalation rate).

Even with zero code deploys, quality degrades over time through two distinct drift mechanisms with opposite fixes:

| Drift Type | Root Cause | Symptoms in Telemetry | Engineering Remediation |
| :--- | :--- | :--- | :--- |
| **1. Input / Data Drift** *(World Changes)* | Real user queries, new product SKUs, updated regulations, or changed third-party API payloads diverge from your static golden set and RAG corpus. | Model ID and prompt hash are unchanged and infra SLIs are green, yet **retrieval similarity scores drop**, out-of-domain queries rise, and Online Monitor faithfulness declines gradually. | **1.** Monitor query embedding distribution shift & retrieval score histograms.<br>**2.** Refresh the RAG / Agent Search corpus.<br>**3.** Feed SDP-scrubbed failing traces into the **LM Feedback Flywheel** to expand the golden evalset. |
| **2. Model / Provider Drift** *(System Changes)* | Calling a moving model alias (e.g., `-latest`), an unannounced provider routing update, or an unvalidated prompt/tool-schema edit. | Sudden step-change shift in output length, `refusal` rate, JSON parse errors, or tool-calling aggressiveness across all topics simultaneously. | **1.** **Pin exact immutable model snapshot IDs** and Agent Registry versions.<br>**2.** Run automated Level 2/3 eval gates before any model cutover (using **Data-Driven Prompt Optimizer** when migrating model families).<br>**3.** Maintain instant config rollback to the prior pinned ID. |

---

## 06. LM Feedback Flywheel, Failure Clustering & Agent Optimizer (`#feedback-flywheel`)

Drift detection tells you *that* quality moved; the **LM Feedback Flywheel** and **Agent Optimizer** ensure every production failure class is discovered automatically, grouped by root cause, fixed programmatically without "prompt whack-a-mole," and permanently guarded against in CI/CD.

```
Live Traffic + Cloud Trace (gen_ai.* spans)
       │
       ├──► Explicit & Implicit UX Signals (thumbs-down, re-query, HITL escalation)
       └──► Online Evaluation Monitors (1%–5% async reference-free autoraters)
                    │
                    ▼
       [ Cloud Logging / BigQuery Sink + SDP PII De-Identification ]
                    │
                    ▼
       [ Failure Cluster Analysis (Auto Loss Analysis) ]
         • LLM groups thousands of low-scoring traces into ranked root-cause clusters
                    │
         ┌──────────┴──────────────────────────────────────────┐
         ▼                                                     ▼
[ Permanent Evalset Expansion ]                 [ Programmatic Optimization ]
  • Replay recorded tool fixtures                 • Zero-Shot Optimizer (no data)
  • Keep a held-out generalization split          • Data-Driven / Agent Optimizer
  • Gate every PR via `agents-cli eval run`         (`instruction` | `demonstration` | `both`)
```

### Step-by-Step Closed-Loop Feedback Flywheel

1. **Capture Multi-Source Signals:** Collect explicit user feedback (thumbs-down, bug reports), implicit behavioral friction (immediate re-prompting, session abandonment, human escalation), and automated **Online Evaluation Monitors (`OnlineEvaluator`)** that continuously sample 1–5% of live Cloud Trace spans and score them asynchronously with reference-free autoraters (`HALLUCINATION`, `TOOL_USE_QUALITY`, `GENERAL_QUALITY`).
   - *IAM Governance Rule:* Online monitors execute under a platform service agent that reads trace payloads and spends judge tokens—restrict monitor creation/modification IAM permissions to authorized AgentOps engineers.
2. **Scrub Before Storage:** Export flagged `trace_id` records to BigQuery via Cloud Logging sinks after passing payloads through **Sensitive Data Protection (SDP)** de-identification templates so production fixtures never leak customer PII or credentials.
3. **Triage via Failure Cluster Analysis (Auto Loss Analysis):** Instead of playing whack-a-mole on isolated support tickets, run **Failure Cluster Analysis** over low-scoring online traces and failed simulation runs. An analyzer LLM clusters raw failures into actionable root-cause buckets (e.g., *"Cluster #1 (34% of failures): `book_flight` receives relative dates like 'next Friday' instead of ISO-8601"*, *"Cluster #2 (19%): premature final answer before reading page 2 of search results"*) ranked by $\text{Frequency} \times \text{Severity}$.
4. **Reproduce & Codify Outcomes (Not Brittle Transcripts):** Convert representative traces from top clusters into reproducible `evalset` cases with recorded tool fixtures. Assert **outcomes and required safety milestones** (`trajectory_in_order_match`) rather than exact word-for-word transcripts so valid alternative reasoning paths still pass.
5. **Protect Generalization with a Held-Out Split & Watch Saturation:** Keep a **held-out validation slice** of production failures invisible to both engineers and automated prompt optimizers during tuning (preventing prompt memorization/overfitting), and continuously refresh suites that saturate near 100%.

### Programmatic Prompt Optimization (`Agent Optimizer` / Prompt Optimizer)

Manually rewriting a 4,000-token system prompt to fix Failure Cluster #1—or migrating prompts from an older model to **`gemini-3.8-flash`**, **`gemini-4-argon`**, or a smaller **`Gemma 4`** deployment—often introduces regressions on previously working behaviors. Agent Platform provides two automated optimization engines:

| Optimizer Engine | Inputs Required | Optimization Modes & Mechanism | When to Choose |
| :--- | :--- | :--- | :--- |
| **Zero-Shot Optimizer**<br>(`client.prompt_optimizer.optimize_prompt`) | **Only the raw prompt / system instruction** (zero labeled examples or eval dataset required). | `optimization_mode="zero_shot"`: Analyzes prompt structure against model best practices and immediately returns `suggested_prompt` plus `applicable_guidelines` (e.g., adding missing role boundaries, fixing ambiguous constraints, removing redundant instructions). | Cold-start prototyping, cleaning up ad-hoc developer prompts in seconds, or preparing an initial baseline before collecting golden data. |
| **Data-Driven Optimizer & `Agent Optimizer`**<br>(Custom Optimization Job) | System instructions + prompt template + **labeled/scored sample dataset** + **Gen AI Evaluation metrics** + **target model ID**. | Runs an iterative closed-loop job (`evaluate → analyze failure clusters → mutate prompt/demos → re-evaluate on target model`) across three selectable modes:<br>• **`instruction`**: Rewrites system instructions only.<br>• **`demonstration`**: Selects optimal few-shot examples from candidates (or populates **Example Store**).<br>• **`instruction_and_demo`**: Jointly optimizes instructions and few-shot demonstrations. | **1.** Fixing ranked **Failure Clusters** without regressing existing evals.<br>**2.** **Model migrations** (adapting prompts to `gemini-4-argon` or distilling a frontier prompt down to `gemini-3.5-flash-lite` / `Gemma 4` for cost/latency savings). |

---

## 07. Deployment Runtime Selection: Agent Runtime vs. Cloud Run vs. GKE (`#runtime-selection`)

Selecting the wrong compute runtime in Google Cloud (PAA Section 4.2) creates immediate architectural friction—either starving a stateful agent of memory, breaking MCP server hosting, or saddling a small team with unnecessary Kubernetes node management. Apply **Rule 0 (Managed by Default)**: start at the most managed runtime that satisfies your language, protocol, accelerator, and isolation constraints.

### Google Cloud Agentic Runtime Decision Matrix

| Architectural Dimension | **Agent Runtime** *(formerly Agent Engine)* | **Cloud Run** *(Services & Jobs)* | **Google Kubernetes Engine (GKE)** | **Managed Agents API** *(Preview)* |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Workload Fit** | Stateful Python/ADK, LangGraph, CrewAI, or A2A orchestrators (`reasoningEngines`) needing turnkey agent ops | **Custom Streamable HTTP MCP servers**, polyglot agents (TS, Java, Go, Python), webhook/Pub/Sub event-driven agents | **Self-hosted open-weight models (`Gemma 4`, `Llama`) on GPUs/TPUs**, dense multi-agent meshes, strict kernel-isolated multi-tenant sandboxes | Declarative autonomous coding, research, and file-processing agents (`Agents API` + `Interactions API`) |
| **Operational Overhead** | **Lowest** (fully managed agent container lifecycle) | **Low** (serverless container-to-URL, scales to zero) | **Highest** (cluster, node pools, networking, controller upgrades) | **Zero** (Google runs the loop and no-egress Linux container) |
| **State & Memory Model** | **Built-in:** Native **Agent Platform Sessions**, **Memory Bank**, **Example Store**, and **Code Execution** sandbox | **Stateless / Ephemeral RAM:** Local memory vanishes on scale-in; must attach external **Sessions** (`agentengine://`), **Memorystore**, **Firestore**, or **Cloud SQL** | StatefulSets, **Agent Substrate** (`<1s` auto-snapshot/restore of memory & files on GKE Standard), or external managed DBs | Server-side state chained via `previous_interaction_id` and `environment_id` (`global` endpoint) |
| **Scaling & Duration** | Managed autoscaling; `min_instances` for zero cold start; supports long-running / multi-day async workflows | Scales `0 → N` rapidly; HTTP timeout up to **60 minutes**; Cloud Run Jobs for batch backfills | Granular HPA/VPA, custom queue metrics, GPU time-slicing, Spot VMs, **Committed Use Discounts (CUDs)** | Synchronous streaming or `background=True` multi-hour async execution |
| **Hosts Custom MCP Servers?** | **No** (consumes MCP/A2A, does not host standalone MCP servers) | **Yes — Primary serverless choice** for Streamable HTTP `/mcp` servers | **Yes** — High-density, stateful, or private in-cluster MCP fleets | **No** (supports server-side tools only) |
| **Custom GPUs / Self-Hosted Models?** | **No** (calls managed model APIs) | **Limited** (serverless GPU inference for lightweight bursts) | **Yes — Primary choice** for vLLM/TGI serving of **Gemma 4** on GPUs/TPUs *(never proprietary Gemini weights!)* | **No** |
| **Code Sandbox Isolation** | Managed **Code Execution** micro-container (`<1s` startup, 100 MB I/O, up to 14-day TTL) | Call external Agent Platform Code Execution sandbox API | **Agent Sandbox on GKE** (`SandboxTemplate` + `SandboxWarmPool` pre-warmed **gVisor** pods; blocks `hostNetwork`/`hostPath`) | Built-in isolated Linux container (outbound network disabled by default) |

### GKE Sub-Architecture Choice: Agent Substrate vs. Agent Sandbox

When requirements mandate GKE, distinguish its two specialized agent orchestration architectures:
- **Agent Substrate on GKE (Actor-Based, GKE Standard):** Best for high-density stateful agents that frequently go idle between user turns. Active agents multiplex over a shared pool of warm Pods; idle agents automatically checkpoint memory and filesystem state to storage and restore in **`< 1 second`**, maximizing node utilization.
- **Agent Sandbox on GKE (Pod-Based, GKE Autopilot or Standard):** Best when each agent or untrusted code execution requires a dedicated Kubernetes Pod (`Sandbox` / `SandboxClaim` CRDs, `SandboxWarmPool` for sub-second startup), full `PodSpec` sidecars, hardware accelerators (GPUs/TPUs), and mandatory **gVisor** kernel isolation enforced via Validating Admission Policy.

### Runtime Capacity, Quota & Configuration Traps

1. ***"Region temporarily at capacity"* vs. `429 RESOURCE_EXHAUSTED`:**
   - Seeing **`"Region temporarily at capacity"`** when deploying an Agent Runtime instance means **physical regional compute pool exhaustion**, *not* an IAM error or project quota cap—filing a quota increase ticket will not resolve it. Deploy to an alternate supported region, right-size vCPU/memory, or retry off-peak.
   - Seeing **`429 RESOURCE_EXHAUSTED`** during Gemini API inference indicates shared Standard PayGo contention or TPM/RPM limits. Route stateless requests to the **`global` endpoint**, apply full-jitter backoff, enable **Priority PayGo** for bursty interactive paths, or purchase **Provisioned Throughput (GSUs)** for predictable baseline load. *(Remember: Provisioned Throughput does **not** cover Batch Prediction or internal calls made by other managed services like Agent Search, even when using the same model.)*
2. **Reserved Environment Variables on Agent Runtime:** Never override `GOOGLE_CLOUD_PROJECT` or `PORT`, and never define custom variables starting with the reserved `GOOGLE_CLOUD_AGENT_ENGINE*` prefix (except documented platform toggles like `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true`).
3. **Agent Registry Auto-Registration Rules:** Agents on **Agent Runtime**, **Gemini Enterprise**, official Google MCP servers, annotated **GKE** workloads, and **Cloud Run** services deployed with `--functional-type=agent` + `--identity-type=agent-identity` auto-register in **Agent Registry**; unflagged Cloud Run services and external/on-prem MCP servers must be registered via the writable `Service` resource.

---

## 08. Production Resilience Stack & Fault Isolation (`#resilience-stack`)

LLM APIs and external tools operate under tight token-per-minute (TPM) and request-per-minute (RPM) quotas, variable compute load, and occasional regional brownouts. Production resilience requires a **4-layer defense stack** where each control lives at a distinct architectural boundary.

```
Incoming User / Workflow Request
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Call-Site Retry with Exponential Backoff + Full Jitter         │
│ • Scope: Single RPC / SDK client call (owned by ONE layer only)         │
│ • Targets: 429 (rate_limit), 500, 502, 503, 504, 529 (overloaded)       │
│ • Rules: Honor Retry-After header; fail fast on 400/401/403/404/refusal │
│ • Mutating Tools: Require deterministic idempotency_key before retrying │
└──────┬──────────────────────────────────────────────────────────────────┘
       │ Retries exhausted OR sustained upstream failure rate breaches threshold
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Service-Boundary Circuit Breaker (Closed ──► Open ──► Half-Open)│
│ • Scope: Shared across worker pool per upstream dependency/endpoint     │
│ • Trips Open when: e.g., >50% of last 20 calls fail or p95 > 15s        │
│ • Effect: Fails fast in <1 ms (prevents thread/connection pool starvation)│
└──────┬──────────────────────────────────────────────────────────────────┘
       │ Circuit is OPEN (or primary call exhausted retries)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Orchestration-Layer Model & Routing Fallbacks                  │
│ • 3a. Cross-Region / Global Endpoint Routing (e.g., us-central1 ► global)│
│ • 3b. Cross-Tier Model Fallback (e.g., Argon/Opus ──► 3.8-Flash/Sonnet  │
│       with simplified prompt/schema validated on its own eval suite)    │
│ • 3c. Deterministic / Cached Degraded Response (e.g., lexical search)   │
└──────┬──────────────────────────────────────────────────────────────────┘
       │ Fallbacks exhausted, confidence below floor, or policy trigger
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: Graceful Degradation & Structured Human Escalation             │
│ • Persist conversation state, trace_id, attempted tool calls & summary  │
│ • Route to human operator queue or async callback without losing work   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Exponential Backoff with Full Jitter & Idempotency

When an upstream model endpoint returns `429 Too Many Requests` or `529 Overloaded`, naive fixed-interval retries synchronize across all concurrent workers—creating a **retry storm (thundering herd)** that guarantees the next wave fails too.

1. **Honor `Retry-After` first:** If the response includes a `retry-after` or `retry-after-ms` header, sleep for at least that server-specified duration.
2. **Use Exponential Backoff with Full Jitter** when no header is present:
   $$t_{\text{sleep}} = \text{Uniform}\!\left(0,\; \min\left(T_{\text{cap}},\; T_{\text{base}} \cdot 2^{\text{attempt}}\right)\right)$$
   Randomizing the wait across $[0, \text{cap}]$ desynchronizes concurrent callers.
3. **Single Retry Owner:** Official SDKs (`google-genai`, `anthropic`) retry transient errors (`408`, `409`, `429`, `>=500`) **twice by default**. Never wrap an SDK call that has default retries enabled inside your own 4-attempt loop (multiplying to $3 \times 4 = 12$ hits per request). Either configure `HttpRetryOptions` / `max_retries` on the SDK client or set `max_retries=0` and manage retries in one wrapper.
4. **Never retry terminal errors or content decisions:** Fail fast on `400` (bad schema, invalid `thinking_level`), `401`/`403` (auth), `404` (bad model ID), `413` (payload too large), **workspace spend-cap `429`s** (which lack `retry-after`), and `HTTP 200` with `stop_reason: "refusal"` / safety block.
5. **Idempotency Keys on Mutating Tools:** Retrying a mutating tool (`charge_credit_card`, `issue_refund`, `create_jira_ticket`) after a `504 Gateway Timeout` risks duplicate execution if the first request committed server-side. Every mutating tool must pass a deterministic **`idempotency_key`** (`sha256(session_id + turn_index + tool_name + canonical_args)`) deduplicated in Memorystore/Redis or the downstream API.

### Layers 2–4: Circuit Breakers, Validated Fallbacks & Context-Rich Escalation

- **Layer 2 — Circuit Breakers (`Closed → Open → Half-Open`):** Per-request retries during a 10-minute outage hold thousands of sockets open, starving web workers. A shared service-boundary circuit breaker trips **`Open`** once error rates breach threshold (failing fast in `<1 ms` into Layer 3), then probes recovery via **`Half-Open`** after a cooldown window.
- **Layer 3 — Orchestration Fallbacks:** Fail over first to the same model via the **`global` endpoint** or a secondary region; if falling back across model tiers/families (e.g., `gemini-4-argon` → `gemini-3.8-flash` or `Claude Opus` → `Sonnet`), maintain a **fallback-specific prompt/parameter configuration** (adjusted via **Data-Driven Prompt Optimizer** and validated on your Level 2/3 golden suite) so unsupported parameters (like `thinking_budget` vs. `thinking_level`) do not cause secondary `400` crashes.
- **Layer 4 — Structured Human Escalation:** When fallbacks exhaust or `max_turns` / policy boundaries trigger, hand off a structured bundle (`trace_id`, session history, verified customer entities, tools already invoked + outputs, and escalation reason) so the human specialist never asks the customer to repeat themselves.

---

## 09. Safe Rollouts: Shadow Mode vs. 4-Element A/B Testing (`#rollouts-ab`)

Passing an offline golden dataset and simulation suite (Levels 1–3) is necessary but never sufficient for high-volume production changes. Real user traffic contains live concurrency, cache warmth, and long-tail phrasing that static suites miss. Promote changes through a **4-Stage Progressive Delivery Pipeline**:

```
[1. Offline & Sim] ──► [2. Shadow Mode (Dark Launch)] ──► [3. Canary (1%–5%)] ──► [4. Controlled A/B Test]
 (Golden + 2-Step Sim)  (Live input forked async;          (Sticky live slice;      (Sticky split + single var
                         mutating tools sandboxed!)         auto-rollback on SLO)    + guardrails + fixed N)
```

### Shadow Mode (Dark Launch) vs. Canary vs. A/B Testing

| Rollout Stage | Who Sees Candidate Output? | Side-Effecting Tools Allowed? | What It Validates Best | Blind Spots / Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **Offline & Simulation** | Eval harness only | Mocked / **Environment Simulation** | Regressions on known golden cases, multi-turn persona stress tests, fault-injection handling | Cannot test real production concurrency, live cache hit ratios, or organic user reactions. |
| **Shadow Mode** *(Dark Launch)* | **Nobody** (logged async; user receives baseline response) | **Read-only tools only** (mutating tools MUST be stubbed/sandboxed!) | Real-world `p95`/`p99` latency, crash rates, token spend, cache hit rate, first-turn tool selection, and async autorater parity | **Cannot measure multi-turn user reaction** (user replies to baseline Turn 1, creating counterfactual divergence on Turn 2+) or business conversion. |
| **Canary Release** | **1%–5% of live traffic** (sticky by session) | Live tools (with circuit breakers & auto-rollback) | Production stability, quota saturation, and catastrophic UX failures under real closed-loop dialogue | Small slice lacks statistical power to prove subtle (2%–3%) resolution or conversion gains. |
| **Controlled A/B Test** | **Randomized split** (e.g., 50/50 or 80/20 sticky by user/account) | Full live stack | Causal impact on primary business/quality outcomes + non-inferiority against cost and latency guardrails | Requires pre-committed sample size $N$ and business-cycle duration; exposes treatment cohort to candidate. |

> [!WARNING]
> **Critical Shadow Mode Safety Rule:** In shadow mode, live requests are duplicated asynchronously to the candidate agent. If the candidate calls **mutating tools** (`refund_order`, `update_crm`, `send_email`), running unsandboxed shadow mode executes real side effects twice or corrupts production data! Enforce a **read-only tool sandbox** in shadow mode.

### The 4 Mandatory Elements of a Valid Production A/B Test

An A/B experiment must lock in **all four elements before launch**:
1. **Explicit Falsifiable Hypothesis & Sticky Randomization Unit:** Randomize at the **user, account, or session level** (`hash(user_id + experiment_salt) % 100`), **never per HTTP turn** (which mixes models mid-conversation, destroys prefix caching, and ruins causal attribution).
2. **Single-Variable Isolation:** Change **one variable per treatment arm** (e.g., prompt revision OR model tier, not prompt + model + retriever + UI simultaneously).
3. **Primary Outcome Metric + Guardrail Metrics (Non-Inferiority Bounds):** Pair one primary success metric (e.g., *Verified Resolution Rate without Escalation*) with strict guardrails that must not degrade: `p95` TTFT/turn latency, **token cost per resolved task**, unhelpful refusal rate, tool error rate, and `HALLUCINATION` monitor score.
4. **Pre-Committed Sample Size $N$ & Statistical Stopping Rule:** Fix $\alpha = 0.05$, power $1 - \beta = 0.80$, MDE, and minimum full weekly cycle beforehand. **Never stop early the first day $p < 0.05$ ("peeking" / p-hacking)** unless using formal sequential testing boundaries (Always-Valid p-values / O'Brien-Fleming alpha-spending).

---

## 10. Token Economics, Heavy-Tail Sizing & 4-Step Enterprise ROI (`#finops-roi`)

More enterprise AI pilots fail at the FinOps gate than at the accuracy gate. A prototype that costs \$0.02 per query on clean developer tests can easily cost \$0.85 per resolved ticket in production once heavy-tail context growth, ~15× multi-agent fan-out, online judge sampling, and human review labor are included.

### Heavy-Tail Token Distributions (`p95`/`p99` vs. `p50`)

LLM token consumption follows a **heavily right-skewed (log-normal / Pareto) distribution**:
- **Why `p50` (median) sizing fails:** While the median session might be 2 turns consuming 3,000 tokens (\$0.01), the top 5%–10% (`p95`–`p99`) involve 15-turn debugging loops, 50-page PDFs, large MCP JSON payloads, `thinking_level="HIGH"` reasoning traces, and retries—consuming 150,000 to 500,000+ tokens per session.
- Without context compaction and prefix caching, resending history across $N$ turns bills **quadratically** ($O(N^2)$):
  $$\text{Cumulative Input Tokens across } N \text{ turns} \approx N \cdot S_{\text{static}} + \sum_{t=1}^{N} (N - t + 1) \cdot \Delta_{\text{turn } t}$$
- **FinOps Sizing Rule:** Model TPM quotas and monthly budgets using the **distribution mean or `p95`/`p99`-weighted buckets**, never `p50 × volume`, and enforce hard caps (`max_turns`, `max_tokens`, observation pruning) to clip runaway tails.

### High-Impact Cost-Bending Levers (Multi-Agent ~15× Multiplier)

Autonomous multi-agent systems consume **~15× more tokens** than single-turn chat (~4× more than single-agent tool loops) due to parallel subagent context initialization, multi-hop reasoning, and coordinator synthesis. Bend the cost curve with six architectural levers:

| Cost-Optimization Lever | Mechanism | Typical Savings Impact | Critical Exam & Production Nuance |
| :--- | :--- | :--- | :--- |
| **1. Tiered Semantic Model Routing** | Route simple classification/guardrails to **`gemini-3.5-flash-lite`** (`Haiku`), workhorse tool loops to **`gemini-3.8-flash`** (`Sonnet`), and complex synthesis to **`gemini-4-argon`** (`Opus`). | **50% – 80%** token spend reduction | Validate each routed tier against your Level 2/3 golden set (and tune prompts with **Data-Driven Optimizer**). |
| **2. Prefix-Aligned Context Caching** | **Implicit caching** (automatic on `gemini-4-argon` & `3.x` at $\ge 4,096$ tokens, **zero storage fee**, ~90–95% read discount) vs. **Explicit caching** (`cachedContents` / `cache_control` with TTL storage/write cost where supported). | **Up to 80% – 95%** on repeated input prefixes + lower TTFT | Cache creation bills at standard input price on Gemini; **explicit `cachedContents` pays TTL storage fees while implicit caching has zero storage cost** (`gemini-4-argon` supports implicit only). Keep static instructions/tools at byte 0! |
| **3. Thinking / Effort Right-Sizing** | Use `thinking_level="minimal"` on `3.5-flash-lite` or `"low"`/`"medium"` on `3.8-flash` & `4-argon` (and `effort: "low"` on Claude) for routine hops, since thinking tokens bill at **output token rates**. | **30% – 60%** output token reduction | Reserve `thinking_level="high"` for ambiguous planning, root-cause analysis, or complex math/code synthesis. |
| **4. Async Batch / Flex Inference** | Run nightly 10,000-case offline evalsets, bulk backfills, and large autorater jobs via **Batch Prediction / Flex PayGo / Message Batches API** ($\le 24\text{h}$ SLA). | **~50% price reduction** on input & output tokens | **Provisioned Throughput (GSUs) does NOT cover batch prediction**—use Batch/Flex for offline workloads and GSUs for steady real-time traffic. |
| **5. Observation Masking & Session Compaction** | Prune verbose MCP JSON/HTML fields after extraction (`after_tool_callback`), run tabular filtering inside the **Code Execution sandbox**, and compact older session turns. | **40% – 70%** reduction in multi-turn $O(N^2)$ growth | Store critical IDs/constraints in structured `session.state` before compacting prose to prevent **context collapse**. |
| **6. Idle Infra Hygiene** | Tune `min_instances`, suspend idle Cloud Workstations (`idleAction=SUSPEND`), and undeploy unused **Vector Search 1.0** index endpoints. | Eliminates 24/7 fixed hourly burn at zero QPS | Deployed Vector Search 1.0 endpoints bill continuously per node-hour even when serving zero queries. |

### The 4-Step Enterprise ROI Calculation

Calculate **Net Monthly Benefit** across all four steps—ignoring **Step 4 (Human-Review & Exception Tax)** is the #1 cause of negative-ROI production launches:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Baseline Human Task Cost                                        │
│   Baseline_Cost = Monthly_Volume × Hours_Per_Task × Loaded_Labor_Rate   │
├─────────────────────────────────────────────────────────────────────────┤
│ STEP 2: Gross Labor Value Captured                                      │
│   Gross_Savings = Baseline_Cost × Automation_Rate × Time_Saved_Fraction │
├─────────────────────────────────────────────────────────────────────────┤
│ STEP 3: Total AI Operating Cost (Tail-Adjusted)                         │
│   AI_OpEx = LLM_Tokens (p95-weighted + retries + Online Monitor sample) │
│           + Runtime/Retrieval Hosting + Amortized Eng Maintenance       │
├─────────────────────────────────────────────────────────────────────────┤
│ STEP 4: Mandatory Human-Review & Exception Tax (The Hidden Killer)      │
│   Review_Tax = (Flagged_Rate × Volume × Audit_Hours × Reviewer_Rate)    │
│              + (Error_Rate × Volume × Rework_Hours × Specialist_Rate)   │
├─────────────────────────────────────────────────────────────────────────┤
│ NET MONTHLY BENEFIT = Gross_Savings − AI_OpEx − Review_Tax              │
│ NET ROI (%)         = (Net_Monthly_Benefit / Total_Investment) × 100    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Worked Sanity Check:** On $50,000\text{ claims/month}$ at $\$12/\text{claim}$ baseline ($\$600\text{k}$), 80% automation yields **$\$480\text{k}$ Gross Savings** (Step 2) against **$\$30\text{k}$ AI OpEx** (Step 3). If compliance requires a 6-minute ($\$6$) audit on all $40,000$ automated claims ($\$240\text{k}$) plus 20-minute ($\$30$) specialist rework on $2,500$ subtle errors ($\$75\text{k}$), **Step 4 Review Tax = $\$315\text{k}$**, cutting Net Benefit from $\$450\text{k}$ down to **$\$135\text{k}/\text{month}$**. If audit time approaches baseline manual time (e.g., 14 min vs. 12 min), Net ROI turns **negative**—fixable only by raising `pass^k` precision, adding $0 Tier 1 deterministic gates, and calibrating confidence routing so humans audit only genuinely uncertain slices.

### 3-Tier Architectural Feasibility Verdicts

| Verdict | Criteria | Canonical Example | Architectural Action |
| :--- | :--- | :--- | :--- |
| **1. Feasible as Scoped** | Accuracy, `p95` latency, unit economics, and governance bounds all fit current models and data. | Internal IT helpdesk agent grounded on Agent Search with 4s streaming TTFT and ticket fallback. | Proceed to Level 1–3 eval harness + MVP build. |
| **2. Feasible with Constraints** *(Re-Scope)* | Core task works, but synchronous latency or unreviewed autonomy conflicts with physics/risk. | 50-page contract redlining requested in `< 1s` with 100% autonomous legal sign-off. | Re-scope to **async background execution** (`background=True`, 30–60s) + **mandatory human approval gate (HITL)**. |
| **3. Not Feasible** *(Hard Stop)* | Requires 100.00% zero-defect determinism without review, `< 5 ms` control loops, or $10\times$ negative unit economics. | High-frequency `< 5 ms` trading execution or unreviewed autonomous clinical dosing from raw handwriting. | **Reject LLM on critical path**; use deterministic rules/classical ML, or re-scope to assistive drafting with HITL. |

---

## 11. Production Failure Modes, Glossary & Self-Assessment (`#failure-modes`)

### Production Failure Mode Diagnostic Matrix

| Observed Production Symptom | Root Cause | Correct Engineering Remediation | Trap / Wrong Fix to Avoid |
| :--- | :--- | :--- | :--- |
| **Compliance agent scores 97% on `FINAL_RESPONSE_QUALITY` yet issues refunds without checking eligibility** | **"Right answer, wrong path"** blind spot in outcome-only grading | Pair outcome autoraters with **`trajectory_in_order_match` / `trajectory_exact_match`** and a forbidden-tool check | Raising the `FINAL_RESPONSE_QUALITY` threshold from 0.90 to 0.99 |
| **Team has zero historical chat logs and cannot test multi-turn edge cases or `503` tool outages safely** | Relying solely on static single-turn prompts or live prod backends | Run **2-Step Agent Simulation** (from an **Agent Registry** snapshot) + **Environment Simulation** fault injection | Running load/fault tests directly against live production payment APIs |
| **Manual prompt edits to fix one bug cluster keep breaking three unrelated instructions** | Manual "prompt whack-a-mole" without closed-loop optimization | Cluster traces via **Failure Cluster Analysis**, expand the golden set (with a **held-out split**), and run **Data-Driven Prompt Optimizer / Agent Optimizer** | Appending contradictory ALL-CAPS warnings to the bottom of the system prompt |
| **Deploying a custom Streamable HTTP MCP server onto Agent Runtime fails** | **Agent Runtime** hosts stateful agent orchestrators (`reasoningEngines`), not standalone MCP servers | Host custom Streamable HTTP MCP servers on **Cloud Run** (or **GKE**) and register them in **Agent Registry** | Embedding external MCP server daemons inside `session.state` |
| **Users lose conversation context randomly on a TypeScript/Python agent hosted on Cloud Run** | Storing session history in **ephemeral Cloud Run container RAM** across scale-to-zero recycles | Externalize state to **Agent Platform Sessions** (`agentengine://`), **Memorystore for Redis**, **Firestore**, or **Cloud SQL** | Increasing Cloud Run request timeout to 60 minutes without external state |
| **Architect proposes self-hosting `gemini-4-argon` on GKE GPUs for VPC isolation** | **Proprietary Gemini weights cannot be self-hosted** on customer clusters | Call managed Gemini endpoints inside **VPC Service Controls** (+ Provisioned Throughput if needed), or self-host open-weight **Gemma 4** on GKE | Creating a GKE GPU node pool to pull `gemini-4-argon` container weights |
| **Agent Runtime deployment fails with `"Region temporarily at capacity"`** | **Physical regional compute pool exhaustion** (not a project quota limit) | Deploy to an alternate supported region, reduce per-instance vCPU/RAM, or retry off-peak | Filing an IAM or project quota-increase support ticket and waiting |
| **Every component passes isolated Level 2 evals at >95%, but end-to-end tasks fail 45% of the time** | **Integration seam failure** (format mismatch, observation flooding, or context collapse) | Add **Level 3 Trajectory & Seam Integration Tests**, strict JSON schemas, and structured `session.state` preservation | Tuning isolated Level 2 prompts further in single-step harnesses |
| **Shadow mode rollout accidentally sends duplicate cancellation emails to real customers** | Shadow pipeline executed **live mutating tools** instead of a read-only sandbox | Intercept/mock all state-mutating tools in shadow mode; allow only read-only retrieval | Running unsandboxed shadow mode on a smaller 5% traffic slice |
| **AI saves 80% of drafting time, yet total department labor cost rises by 12%** | **Step 4 Human-Review & Exception Tax** exceeds Step 2 Gross Savings | Add $0 Tier 1 code validators and calibrate confidence routing so humans audit only uncertain/high-risk slices | Ignoring human audit time in the FinOps ROI spreadsheet |

---

### Glossary

| Term | Definition |
| :--- | :--- |
| **3-Tier Grading Hierarchy** | Evaluation ladder ordering checks from **Tier 1** (deterministic code/schema assertions, $0) → **Tier 2** (calibrated LLM autoraters) → **Tier 3** (human domain experts). |
| **Adaptive Rubrics** | Gen AI Evaluation Service capability (`GENERAL_QUALITY`) that dynamically generates prompt-specific pass/fail testable rubrics per input rather than using one static checklist. |
| **2-Step Agent Simulation** | Multi-turn synthetic stress-testing from an **Agent Registry** snapshot: Step 1 synthesizes `Starting Prompts` + `Conversation Plans`; Step 2 executes simulated user dialogues. |
| **Environment Simulation** | Evaluation harness layer that intercepts outbound tool calls to inject deterministic faults (`HTTP 503`, `429`, timeouts, mocked rows) without touching live backends. |
| **Online Evaluation Monitors** | Continuous production evaluators (`OnlineEvaluator`) that asynchronously sample live Cloud Trace spans and score them with reference-free autoraters (`HALLUCINATION`, `TOOL_USE_QUALITY`). |
| **Failure Cluster Analysis** | Automated LLM grouping of failed simulation and low-scoring production traces into ranked root-cause buckets ($\text{Frequency} \times \text{Severity}$). |
| **Zero-Shot vs. Data-Driven Optimizer** | Agent Platform prompt optimization engines: **Zero-Shot** rewrites a raw prompt immediately using structural guidelines (no data); **Data-Driven / Agent Optimizer** iteratively optimizes `instruction`, `demonstration`, or `instruction_and_demo` against labeled data and eval metrics for a target model. |
| **Dual-Attribution Audit Log** | Cloud Logging / Audit Log record (`is_agentic=true`) capturing both the cryptographic SPIFFE **Agent Identity** (`principal://...`) and the initiating human user principal. |
| **Agent Runtime vs. Cloud Run vs. GKE** | Google Cloud runtime triad: **Agent Runtime** for turnkey stateful Python/ADK/A2A agents; **Cloud Run** for scale-to-zero polyglot containers and Streamable HTTP MCP servers; **GKE** (`Agent Substrate` / `Agent Sandbox`) for self-hosted **Gemma 4** on GPUs/TPUs and gVisor kernel isolation. |
| **`pass@k` vs. `pass^k`** | At-least-one success ($1 - (1-p)^k$, valid only with a deterministic verifier) vs. every-run consistency ($p^k$, mandatory for live customer agents and unattended workflows). |
| **Observation Flooding & Context Collapse** | Context failure modes where huge raw tool dumps overwhelm attention (*flooding*) or aggressive summarization deletes a critical earlier fact/ID (*collapse*). |
| **Human-Review Tax (Step 4 ROI)** | Mandatory labor cost of human auditors reviewing flagged AI outputs and specialists fixing false positives—subtracted in Step 4 of enterprise ROI. |

---

### Self-Assessment Questions

1. **Q1 (`#managed-eval-autoraters`):** A retail compliance agent scores 96% on `FINAL_RESPONSE_QUALITY`, yet an audit discovers it occasionally issues refunds before calling `verify_return_window`. Why did the evaluation suite miss this, and how do you test multi-turn tool outages before launch when no historical logs exist?
   - **Answer:** Outcome-only autoraters (`FINAL_RESPONSE_QUALITY`) only inspect the final response and miss **"right answer, wrong trajectory"** violations; pair them with **`trajectory_in_order_match`** (requiring `verify_return_window` before `issue_refund`). To stress-test multi-turn paths and `503`/`429` outages with zero historical logs, snapshot the agent in **Agent Registry** and run **2-Step Agent Simulation** paired with **Environment Simulation**.

2. **Q2 (`#feedback-flywheel`):** Your team is migrating a complex customer-triage agent from Gemini 2.5 Pro to `gemini-3.8-flash` and wants to fix two recurring production failure clusters without manually rewriting prompts by trial and error. You have 250 SDP-scrubbed, labeled traces. Which optimization tool and mode should you use, and how do you prevent overfitting?
   - **Answer:** Use the **Data-Driven Prompt Optimizer / Agent Optimizer** with `optimization_mode="instruction_and_demo"`, targeting `gemini-3.8-flash` against your Gen AI Evaluation Service metrics (`trajectory_in_order_match` + `GENERAL_QUALITY`). Reserve **Zero-Shot Optimizer** only for cold-start prompts with no labeled data, and hold out an untouched validation split of production traces so the optimizer cannot memorize the test set.

3. **Q3 (`#runtime-selection`):** An enterprise architecture includes (a) a stateful Python ADK coordinator needing managed Sessions and Memory Bank, (b) three custom Go/TypeScript Streamable HTTP MCP tool servers with spiky traffic, and (c) an open-weight `Gemma 4 31B` model running on dedicated GPUs inside a strict VPC. Map each component to the optimal Google Cloud runtime.
   - **Answer:** **(a)** Deploy the stateful Python ADK coordinator to **Agent Runtime** (`reasoningEngines`). **(b)** Deploy the custom Go/TypeScript Streamable HTTP MCP servers to **Cloud Run** (Agent Runtime does not host standalone MCP servers). **(c)** Deploy `Gemma 4 31B` on **GKE** with GPU node pools (and use **Agent Sandbox on GKE** with gVisor if executing untrusted code pods).

4. **Q4 (`#pass-metrics`):** An autonomous order-cancellation agent has a single-run success rate of $p = 0.90$. The engineering lead reports `pass@5 = 99.999%` and argues it is ready for unattended launch. Why is this wrong, and what is its actual 5-run consistency?
   - **Answer:** `pass@5` ($1 - 0.10^5 = 99.999\%$) measures at-least-one success across 5 tries, valid only when a deterministic filter selects one candidate before side effects occur. Unattended customer agents require **`pass^5`** ($0.90^5 = \mathbf{59.0\%}$)—meaning **41% of 5-run batches contain at least one failure**.

5. **Q5 (`#observability-drift`):** In Agent Registry Observability, an agent's `p95` turn latency spikes to 16 seconds while `ttft_ms` is 280 ms, and on domain questions it frequently hallucinates answers instead of calling its `query_policy_db` MCP tool. Which two tabs diagnose these issues and what are the fixes?
   - **Answer:** **(1) `Traces` waterfall + `Tools` tab (`p95` latency):** Inspect whether serial MCP tool calls, database connection setup (`MCP Toolbox` needed), or `thinking_level="HIGH"` decode tokens caused the 16s stall. **(2) `Tools` tab ("no-tool interactions"):** High no-tool interaction counts reveal the agent is ignoring `query_policy_db` due to vague tool descriptions/schemas—rewrite the tool docstring and enforce `trajectory_in_order_match` in CI.

6. **Q6 (`#rollouts-ab` & `#resilience-stack`):** You dark-launch a candidate billing agent in **Shadow Mode**, and customers suddenly receive duplicate invoice-adjustment emails. Separately, during a regional `429` spike, web workers freeze completely. What two guardrails were missing?
   - **Answer:** **(1) Missing read-only shadow sandbox:** Shadow mode duplicates live requests asynchronously, so all state-mutating tools (`send_email`, `adjust_invoice`) must be mocked/intercepted in shadow mode (and protected with deterministic `idempotency_key`s in live mode). **(2) Stacked retries + missing Layer 2 Circuit Breaker:** Enforce a single retry owner with full-jitter backoff and trip a service-boundary **Circuit Breaker** (`Open`) to fail fast into Layer 3 `global` / cross-tier fallbacks.

7. **Q7 (`#finops-roi`):** A team switches to `gemini-4-argon`, configures explicit `cachedContents` with a 1-hour TTL, and budgets monthly spend using `p50` pilot tokens without counting human compliance audit minutes. Identify three FinOps errors.
   - **Answer:** **(1)** `gemini-4-argon` uses **automatic implicit caching** ($\ge 4,096$ tokens, zero storage fee) and rejects explicit `cachedContents` (keep static instructions at byte 0). **(2)** Token budgets must be sized on the **heavy-tail mean / `p95`–`p99` distribution** (including the ~15× multi-agent multiplier), never `p50`. **(3)** Net ROI must subtract **Step 4 Mandatory Human-Review & Exception Tax** (audit + specialist rework labor).

8. **Q8 (`#runtime-selection`):** During a production rollout, `agents-cli deploy` to Agent Runtime in `us-central1` fails with `"Region temporarily at capacity"`, while batch nightly evaluations fail to draw down the team's reserved Provisioned Throughput (GSUs). Explain both behaviors.
   - **Answer:** **(1)** `"Region temporarily at capacity"` indicates **physical regional compute pool exhaustion** (deploy to an alternate supported region or reduce instance vCPU/RAM; a project quota increase ticket will not fix physical capacity). **(2)** **Provisioned Throughput (GSUs)** covers real-time online serving only—it **does not apply to Batch Prediction** (or internal calls from managed services like Agent Search), which instead use discounted Batch / Flex PayGo pools.

# Claude Code Session Brief — Lesson Generation Depth Problem

*Drop this into a fresh Claude Code session as the opening message. It contains everything needed to get productive without the broader project context.*

---

## Your role in this session

You are helping Gerry, the technical co-founder of **Primr** (primr.me), improve the **lesson generation quality** of Primr's AI pipeline. Specifically, we're tackling a known weakness: generated lessons look structurally impressive but feel superficial on close reading.

This session is focused, hands-on engineering work on the lesson generation prompt chain. We're **not** rearchitecting the pipeline, **not** fine-tuning a model, and **not** building evaluation infrastructure yet. We're tightening prompts. That's Stage 0 of the roadmap.

---

## Context: what Primr is

Primr converts source documents (PDFs, Word docs, ebooks, etc.) into structured interactive courses. The pipeline has three stages:

1. **Document pre-pass / ingestion** — extracts text and structural signals from the source
2. **Outline generation** — produces a `Course → Section → Chapter → Lesson` hierarchy
3. **Lesson generation** — produces a `LessonManifest` (structured JSON) rendered by a `LessonRenderer` into interactive components

Component types available to the renderer: **Quiz**, **Flashcard**, **StepNavigator**, **Narrative/Media**, **Scenario Simulation**, **Diagram/Hotspot**, **Comparison Table**, **Code Sandbox**.

**Key design principle already in place:** the AI detects structural signals in source documents and promotes them to richer interactive components. It should **never invent content not present in the source material.** Keep this principle intact through all prompt changes.

---

## The problem we're solving

**Symptom:** on first impression, generated courses look impressive — clean outline structure, sensible chapter breakdowns, appropriate component type selection, polished rendering. But when you actually read the lessons in depth, they feel thin:

- Explanations summarize the source rather than *teaching* from it
- Quizzes test recall (surface facts) rather than understanding (application, distinction, edge cases)
- Walkthroughs describe "what" without explaining "why"
- Flashcards extract terms mechanically without pedagogical framing
- Lessons don't anticipate learner confusion or address common misconceptions

**Diagnosis (Gerry's assessment, likely correct):** this is a prompt engineering problem, not a model capability ceiling. Claude / GPT-class models can produce deep pedagogical content when prompted correctly. The current prompt chain isn't asking for depth explicitly.

**What "depth" means here, concretely:**

| Shallow output (current) | Deep output (target) |
|---|---|
| "Photosynthesis converts light into energy." | "Photosynthesis is the process plants use to turn sunlight into chemical energy. The key insight is that the sugar in an apple started as carbon dioxide from the air — the plant literally built itself out of air and light. Here's how..." |
| Quiz: "What does TCP stand for?" | Quiz: "A file transfer over TCP fails partway through. Which of these is TCP most likely to do next, and why?" |
| Walkthrough step: "Click File → Save." | Walkthrough step: "Click File → Save. This is a good moment to save because [reason]. A common mistake here is [X] — if that happens, [recovery]." |

The difference isn't length. It's whether the lesson teaches vs. summarizes.

---

## The three most likely culprits in the current prompt chain

Before writing any code, investigate these hypotheses. The actual prompts are in the codebase and need to be read.

### Hypothesis 1: The prompt asks to *describe* the content rather than *teach* it

A prompt like "Generate a lesson about X" produces a summary. A prompt like "Generate a lesson that teaches X to someone who doesn't know it yet, assuming they've read [source], using [component type] to [specific pedagogical goal]" produces teaching. Check whether the current lesson generation prompt specifies a **learner model** (who are we teaching, what do they already know, what do they need to be able to do after this lesson).

### Hypothesis 2: Component-specific prompts are missing or too generic

If all component types (Quiz, Flashcard, StepNavigator, etc.) are generated from the same generic lesson prompt, each one will be mediocre at its specific job. A Quiz needs different prompt scaffolding than a Flashcard. Check whether there are **component-specific prompt modules**, and if so, whether they encode pedagogical best practices for that component type (e.g., Bloom's taxonomy level for quizzes, spaced-repetition principles for flashcards, scaffolded difficulty for step navigators).

### Hypothesis 3: No explicit pedagogical moves are requested

The prompt may not be asking for any of these depth-producing moves:
- Worked examples
- "Why this matters" openers
- Common misconceptions addressed
- Scaffolded difficulty (easy → hard within a lesson)
- Transfer questions (apply this concept to a new situation)
- Explicit connections to prior lessons in the course

Check whether these are requested anywhere in the prompt chain.

---

## What I want you to do in this session

### Step 1 — Inventory the current prompt chain (read-only)

Find and read every prompt used in lesson generation. Specifically:

- The system prompt(s) for the lesson generation stage
- Any user-turn prompt templates
- Any component-specific prompts (Quiz, Flashcard, StepNavigator, etc.)
- Any few-shot examples embedded in the prompts
- The JSON schema(s) the model is instructed to produce

Report back:
- Where each prompt lives (file paths)
- What each prompt actually asks for
- Which of the three hypotheses above apply (and to what degree)
- Any other depth-related gaps you notice

**Do not modify anything yet.** This is reconnaissance.

### Step 2 — Propose a prompt engineering plan

Based on the inventory, propose a prioritized plan. Expected format:

1. **Top 3 prompt changes** that would most likely improve depth, in priority order, with rationale for each
2. **One concrete before/after prompt rewrite** for whichever change you think is highest-leverage, so Gerry can see what you're proposing
3. **Risks / trade-offs** — what could get worse as a result of each change (e.g., longer generation time, higher token cost, risk of violating the source-anchoring principle)

### Step 3 — Agree on scope, then implement

Once Gerry approves the plan (or modifies it), implement the changes. Test on 2–3 sample documents if available. Compare output before/after qualitatively.

### Step 4 — Document the changes

When done, produce:
- A summary of what changed in the prompt chain
- Example before/after outputs showing the depth improvement
- A list of things *not* changed, and why (so follow-up sessions know what's out of scope)
- Recommended next steps (likely: building the golden dataset + eval scorer mentioned in the staged roadmap)

---

## Hard constraints

- **Preserve source-anchoring.** The AI must never invent content not present in the source document. Depth improvements should come from *better framing of existing content*, not from injecting general knowledge.
- **Preserve structured JSON output.** The LessonRenderer depends on a specific schema. If you propose schema changes, call them out explicitly; don't silently modify.
- **Don't introduce fine-tuning or new model calls.** Work within the existing prompt chain. Adding model calls is a trade-off that requires Gerry's explicit approval.
- **Don't rebuild evaluation infrastructure.** That's a separate workstream (Stage 0.5). Qualitative before/after comparison on 2–3 documents is sufficient for this session.

---

## Working environment

- Local dev directory: `/Users/gpanhome/dev/PRIMR`
- Stack: React/TypeScript frontend, Node.js backend, Anthropic Claude models for the pipeline
- Shell: bash
- Start by running `ls` in the PRIMR directory and orienting yourself. Look for directories like `prompts/`, `pipeline/`, `lesson-generation/`, or similar.

---

## One thing to watch for

If during inventory you discover the real bottleneck is **not** the lesson generation prompt — for example, if the outline generation stage is already dropping pedagogical signals that never reach the lesson stage, or if the document pre-pass is stripping structure that matters — flag that immediately before proceeding. Fixing the wrong stage wastes work.

---

## First message to Gerry at session start

Open with a short acknowledgment of the plan, then start Step 1 (inventory) immediately. Don't ask a bunch of clarifying questions up front — the brief above is the context. Save questions for after the inventory is done, when they can be specific and grounded in what you actually found in the code.

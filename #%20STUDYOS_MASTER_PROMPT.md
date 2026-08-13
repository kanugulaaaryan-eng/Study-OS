# StudyOS Master Prompt

## The AI-Powered Second Brain for Learning

StudyOS is a purpose-built learning system for students.

Its job is not to answer random questions faster than ChatGPT.
Its job is to help a student go from:

> **"I don't understand this."**

to:

> **"Okay. Now I finally get it."**

## Product principles

1. Understanding before memorization.
2. One upload should create as much useful study material as possible.
3. The AI should adapt to the student.
4. The interface should stay simple.
5. Every feature should reduce confusion or improve learning.
6. Preserve working features before adding new ones.

## Core flow

```text
Study material
→ extraction
→ lesson
→ simple explanation
→ detailed explanation
→ examples / analogies
→ quiz
→ flashcards
→ revision
→ AI Tutor
→ progress + weak topics
```

## Supported study sources

- PDF
- DOCX
- PPTX
- YouTube links
- Text pasted into lessons/chat

YouTube links should automatically fetch the transcript when captions are available. The student should not have to manually paste the transcript.

## AI provider

Use the provider-agnostic `invokeLLM()` interface.

NVIDIA NIM is the default provider.

Do not hardcode the NIM API key.

## AI personality

StudyOS is:

**smart teacher + supportive friend + occasional playful push**

It should sound human and emotionally aware without becoming cheesy.

Good:

- "Let's make this click."
- "No stress. Let's try another angle."
- "You're closer than you think."
- "Alright. No peeking. Show me what stuck."
- "You came back. That's what matters."

Avoid:

- "How can I assist you?"
- "As an AI language model..."
- repetitive motivational slogans
- excessive emojis
- corporate language

## Student name

Ask for the student's name during onboarding.

Use it occasionally when it adds emotional weight.

Do not insert the name into every sentence.

## Themes

StudyOS has five themes:

- Ink & Paper
- Forest & Linen
- Espresso & Cream
- Midnight & Brass
- Obsidian & Sage

Each theme has light/dark modes.

Glassmorphism is part of every theme.

**There must not be a separate glassmorphism switch.**

Glass should be subtle and useful on navigation, cards, dialogs and floating tutor surfaces. Do not make every element translucent.

Avoid stereotypical AI visuals:

- neon purple
- neon cyan
- excessive glow
- futuristic grids
- rainbow gradients

## Dashboard

Keep it simple:

- Continue Learning
- Today's Focus
- Quick Actions
- Recent Uploads
- AI Recommendations
- Weak Topics

Do not turn the dashboard into a wall of statistics.

## Subjects

Subjects should use meaningful study tags instead of decorative rainbow color dots.

Examples:

- In progress
- High priority
- Exam soon
- Needs practice
- Quick review
- Feeling strong

## AI Tutor

The Tutor should support:

- chat history
- context
- uploaded study material
- attachments
- regeneration
- editing
- branching
- reasoning/thinking display when available
- saved sessions
- floating access where appropriate

## Reliability rules

- Never assume async data exists on first render.
- Hydrate saved chat sessions before reading `.messages`.
- Validate all uploaded files.
- Never persist raw attachment base64 in chat history.
- Never expose API keys to the browser.
- Never commit `.env`.
- Keep provider-specific fields behind typed interfaces.
- Handle malformed AI JSON gracefully.

## Development workflow

Before changing architecture:

1. Read `BRAIN.md`.
2. Read this prompt.
3. Read `# STUDYOS_ROADMAP.md`.
4. Preserve working code.
5. Make the smallest correct change.
6. Run:

```powershell
pnpm check
pnpm test
pnpm build
```

7. Then manually test the browser flow.

## Beta definition of done

StudyOS is ready for friends when the complete loop works:

```text
Create account
→ choose name
→ choose theme
→ create subject
→ upload / paste material
→ AI extracts it
→ lesson is generated
→ quiz + flashcards work
→ AI Tutor understands the material
→ progress is saved
→ return later and continue
```

# Writing your project's CLAUDE.md

`CLAUDE.md` is the shared brain of an AI-native repo: tracked in git, read by every agent (yours and your teammate's) at session start. It is the single highest-leverage document you own, because it steers behavior *before any prompt is written*. A good one is the difference between agents that drop code in the right place, honor your conventions, and stop at the right line, and agents that sprawl, reinvent, and overstep. Invest in it.

This kit's installer appends two sections for you (the concurrent-agents rules and, optionally, the working-discipline section). This guide is for the rest.

## Sections worth having

Adapt to your project; not all apply to every repo.

1. **What this repo is**, one paragraph: the domain and the stack. Orients a cold-start agent.
2. **Commands**, the dev / build / test / lint / db commands an agent will reach for, each with a one-line purpose. Saves it from guessing or scanning `package.json`.
3. **Architecture**, the shape of the codebase: where domains/modules live, the routing model, the auth and data-access rules, where mutations belong. Enough that new code lands in the right place by default.
4. **Conventions**, language/framework idioms, styling rules, naming, copy voice. (See [`CONVENTIONS.md`](./CONVENTIONS.md) for a transferable starting set.)
5. **Env flags / toggles**, the switches that change behavior (test stubs, sync flags, feature gates). A catalog so agents don't rediscover them by trial and error.
6. **Architecture guards**, note that the file-size and import-boundary guards exist, and how to respond to a red one: it's an *alarm to check cohesion*, never a number to game. (See [`HOOKS.md`](./HOOKS.md).)
7. **Working discipline / definition of done**, what "ready" means. (Paste `snippets/CLAUDE-md-working-discipline.md`.)
8. **Concurrent agents on `main`**, the coordination rules. (The installer appends this.)
9. **Things to leave alone unless asked**, the load-bearing constraints an agent must not cross on its own: commit-don't-push, don't add a new ORM/auth library/runtime, don't edit subsystem X, don't drop tables or run destructive DDL without flagging. These are your guardrails; write them down or an eager agent will eventually cross them.

## Two principles

- **Write the non-obvious.** Don't restate what the code already says (an agent can read the code). Capture the *decisions, constraints, and gotchas* it can't infer: why two backends coexist, which client to use by default, the one file that's a footgun. Signal-dense beats comprehensive.
- **Keep it current.** A stale `CLAUDE.md` mis-steers every agent that reads it, which is worse than none. When a convention or constraint changes, update `CLAUDE.md` in the *same commit* as the change.

A practical test: read your `CLAUDE.md` as if you were an agent who just cloned the repo. If you'd still make a wrong assumption about where code goes, which client to use, or what "done" means, that gap is the next thing to write.

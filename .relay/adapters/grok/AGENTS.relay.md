Source pair: `.relay/adapters/cursor/AGENTS.relay.md`
## Relay — session handoff (L2)
At the START of a session, read `.session-log/latest.md` and `.session-log/index.md`
if they exist. If missing, continue.
When the user signals the session is wrapping up ("done for today", "let's
continue tomorrow", or a task completes and we're winding down), run
`session-save` to persist a Relay handoff. If unsure the session is ending,
offer it in one line.
At wrap-up, also capture durable facts/lessons with `relay-learn` (or inline
`knowledge add`), and surface any graduation-ready lesson for the user to approve.

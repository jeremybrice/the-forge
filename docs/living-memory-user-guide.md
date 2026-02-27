# Living Memory -- User Guide

## What is Living Memory?

Your memory system works like a library with an attentive librarian. Books that get checked out regularly stay on the main shelves where everyone can find them. Books that nobody reads for a while gradually move to the back room. And periodically, the librarian walks through and asks: "Should we keep this, archive it, or remove it?"

That is Living Memory in a nutshell. Every piece of knowledge you store -- a person, a project, a glossary term -- carries an importance score from 0 to 100. When you or your team reference a memory, its score rises. When a memory sits untouched, its score slowly falls. Over time, the knowledge base curates itself: the things you actually use stay front and center, and the things you have forgotten about drift quietly into the background.

The critical guarantee: the system never deletes anything on its own. Memories can fade, but only you decide what ultimately stays, gets archived, or gets removed. Living Memory surfaces what needs your attention. You make the call.

## The Three Tiers

Every memory lives in one of three tiers based on its importance score. The tier determines how the memory shows up -- or does not show up -- when you search for it.

| Tier | Score Range | What You See |
|---|---|---|
| Trusted | 40 -- 100 | Always appears in recall results. Stable and reliable. |
| Probationary | 10 -- 39 | Appears in recall but marked as **(fading)** to signal staleness. |
| Sunset | 0 -- 9 | Hidden from recall. Queued for your review during triage. |

**Trusted** is the home tier. Memories here are the ones you rely on. They show up cleanly in every recall, with no warnings or flags. Most memories you create start here and stay here as long as they remain useful.

**Probationary** is the early warning zone. When a memory drifts down to this tier, you will see a **(fading)** tag next to it in recall results. This is the system telling you: "You haven't used this in a while. It might be going stale." You can keep using it normally -- or you can let it continue to fade if it is no longer relevant.

**Sunset** is the quiet shelf. Memories here are hidden from your day-to-day recall so they do not clutter your results. They are not gone, though. They sit in a queue waiting for you to review them during triage, where you decide their fate.

## How Memories Stay Alive

Every time you or a plugin genuinely references a memory, it gets a boost. The mechanics are simple:

- Each genuine recall adds **+5 importance points** to the memory.
- A memory can receive a **maximum of 2 boosts per day**, which prevents any single session from artificially inflating a score.
- The score ceiling is **100**. No memory can exceed it.
- Each boost **resets the 30-day grace period** before decay begins, giving the memory a fresh runway.

The practical takeaway: knowledge you use regularly stays in the Trusted tier indefinitely, without any manual effort on your part. You do not need to "maintain" your memories. Just keep working the way you normally do, and the system keeps the important things important.

A memory that gets referenced even once a month will likely never decay at all. The grace period reset alone is enough to keep it healthy.

## How Memories Fade

When a memory goes unused, its importance score declines on a stepped schedule. The decay is not a daily drip -- it happens in defined windows, and only after a grace period.

- **Days 0 -- 30:** Grace period. No decay at all. The memory holds steady.
- **Days 31 -- 60:** The score drops by 10 points.
- **Days 61 -- 90:** The score drops by 25 points total (from the original).
- **Days 91 -- 180:** The score drops by 45 points total.
- **Day 180+:** The score drops by 70 points total.

What does this mean in practice? It depends on how the memory was created. Memories created with higher starting scores survive longer without use.

| How It Was Created | Starting Score | Survives Without Use |
|---|---|---|
| You wrote it manually | 70 | ~6 months |
| Created from a form | 45 | ~4 months |
| Auto-matched by harvester | 25 | ~3 months |
| Auto-promoted from mentions | 15 | ~2 months |

One important detail: decay only runs when it is explicitly triggered, not continuously in the background. Your scores are not silently dropping while you sleep. Decay is calculated when a relevant action occurs, like a recall or a triage session.

## Triage: The Curation Moment

Triage is where you take the wheel. Run `/memory:triage` periodically -- once a week is a good rhythm -- and the system presents you with entries that need your attention, grouped by urgency.

First, you see **sunset entries**: memories that have already dropped below a score of 10 and are hidden from your recall. These are the most urgent because they are effectively invisible in your day-to-day work.

Next, you see **approaching sunset entries**: memories that are still in the Probationary tier but trending downward. These are your early warnings -- entries you can save before they disappear from recall.

For each entry, you have three choices:

- **Keep** -- Adds +20 to the importance score and resets the grace period. The memory jumps back up, often returning to the Trusted tier in one action.
- **Archive** -- Moves the memory file to the `memory/archived/` directory. The entry is preserved in git history and can be restored later, but it no longer appears in recall or future triage sessions.
- **Delete** -- Removes the memory permanently. This is the only way a memory actually gets deleted, and it only happens because you chose it.

Triage supports batch actions, so you can quickly process a group of entries in one pass rather than handling them one at a time.

The central promise holds here: the system never auto-deletes. If you never run triage, your sunset entries simply sit quietly in the queue. Nothing is lost without your explicit decision.

## How New Memories Form

Memories enter the system through two tracks, each designed for a different situation.

**The instant track** handles knowledge that already exists in your memory store. When any plugin mentions an entity that matches an existing memory -- a person, a project, a term -- that memory silently receives a +5 importance boost. No new entry is created. The existing one just gets a little stronger. You do not see a notification; it happens in the background as a natural side effect of your work.

**The threshold track** handles knowledge that does not exist yet but keeps coming up. When an unknown entity is mentioned 3 or more times across at least 2 different plugins, the system auto-promotes it into a new memory entry with a starting importance score of 15. This places it in the Probationary tier, visible but marked as **(fading)**, giving you a chance to enrich it or let it prove its worth through continued use.

Here is a concrete example. Suppose your team starts discussing "Phoenix Project" -- first in a product-forge card describing the initiative, then in a tasks-forge task tracking a deliverable, and finally in a cognitive-forge debate session about the architecture. That is three mentions across three plugins. The system recognizes the pattern and creates a new memory entry for "Phoenix Project" at importance 15. From that point forward, every time a plugin references it, the entry gets boosted. If the project is real and active, it will climb into the Trusted tier within a few weeks of normal use. If it was a passing reference that never comes up again, it will naturally fade through Probationary and into Sunset, where you can archive or remove it during triage.

This two-track approach means you do not have to manually enter every piece of knowledge. The system learns from your work patterns and surfaces candidates for you. Your job is to refine and curate, not to catalog everything from scratch.

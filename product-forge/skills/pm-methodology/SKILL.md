---
name: pm-methodology
description: "Provides PM reasoning guidance, tone recommendations, and methodology principles for Product Forge workflows. All file operations delegated to forge-lib."
---

# PM Methodology Skill

This skill provides product management reasoning guidance and tone recommendations. All file operations, schemas, and templates are handled by forge-lib.

## Jira Hierarchy

The organization uses a three-level hierarchy for project planning:

**Initiative (Top Level)**
Initiatives are for large, multi-team projects. They define top-level scope and provide rough order of magnitude (ROM) estimation suitable for leadership review. An Initiative answers: "Should we invest in this? How big is it?" Initiatives provide enough detail for rough effort estimates (e.g., "2-4 sprints") without prescribing implementation details.

**Epic (Team Level)**
Each team receives an Epic under the approved Initiative. Epics are the team-level feature container. An Epic answers: "What's the scope and how will it break down?" Epics are created after Initiative approval and define deliverable capability, identify child stories, and set success criteria without detailed acceptance tests.

**Story (Engineering Level)**
Stories under Epics are the atomic work items that engineers work from directly. A Story answers: "How exactly do we build this specific piece?" Stories are the atomic unit of work for sprint planning, including detailed UI behavior, system logic, and acceptance tests written for the engineering team to implement.

## Planning Progression

Understanding the progression from Initiative to Story ensures proper scoping at each level:

**Initiative Phase**: Rough scoping, business case validation, and engineering estimation for feasibility and effort. Output: Estimated effort range and high-level technical feasibility assessment.

**Epic Phase**: Scope definition, deliverable identification, and story breakdown planning. Output: Clear capability definition with story candidates and success criteria.

**Story Phase**: Detailed implementation specs, acceptance criteria, and technical context. Output: Ready-to-implement work items for sprint assignment.

Do not skip levels or collapse phases. Each level adds necessary detail for its audience.

## Card Type Selection Logic

Determine the correct card type based on user signals and context:

| User Signal | Card Type |
| ROM, estimation, initiative, rough order of magnitude, should we build this | Initiative |
| Epic, body of work, break down into stories, team-level scope | Epic |
| Story, Jira ticket, user story, acceptance tests, sprint work, implementation | Story |
| Unclear or ambiguous | Ask the user which card type they need |

If the user's request is ambiguous (e.g., "Create a card for user authentication"), ask: "Would you like an Initiative (to scope the overall effort), an Epic (to break it down into stories), or a Story (for specific implementation)?"

## Tone by Card Type

Adopt the appropriate tone for each card type:

**Initiative**: Executive summary tone. Clear, concise, and business-focused. Avoid unnecessary technical jargon. Use language that appeals to leadership and non-technical stakeholders. Focus on business value, strategic fit, and effort ranges.

**Epic**: Planning tone. Comprehensive scope definition that balances business value with technical reality. Speak to both product and engineering audiences. Use clear language about deliverables and dependencies.

**Story**: Engineering tone. Precise, specific, and implementable. Provide enough technical context for development without prescribing implementation approach. Write for engineers picking up the story mid-sprint who need to understand "why" but have freedom on "how."

## Content Guidelines

When helping draft card content:

1. **No dashes as thought separators**: Never use dashes (—, –, or -) to separate thoughts in prose text. Dashes are acceptable only in compound words (e.g., "read-only," "cross-platform"). Use periods, semicolons, or restructure sentences instead.

2. **No tables**: Cards should not use table format. Use prose paragraphs or bullet points instead.

3. **Bullet points for lists**: Use bullets only for true lists within sections. Each bullet should be substantive, containing 1–2 sentences minimum unless listing system or module names.

4. **Prose for narrative sections**: Sections like Background, Proposed Solution, Epic Scope, and Context should be written as prose paragraphs, not bullet lists.

5. **Discussion before execution**: When given a prompt, generate understanding and discuss approach before executing. Exception: For follow-on prompts or answers to Claude's clarifying questions, proceed directly.

## Workflow Integration

This skill is auto-invoked to ensure:

1. Correct card type is selected based on user request
2. Tone matches the card type
3. Content follows organizational guidelines
4. Planning progression respects hierarchy levels

Before generating output, clarify the card type with the user if ambiguous. Then delegate all file operations to forge-lib CLI commands.

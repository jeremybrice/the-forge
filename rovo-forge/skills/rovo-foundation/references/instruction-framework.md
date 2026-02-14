# Instruction Framework Reference

## TCREI Framework

All Rovo agent instructions follow the TCREI framework. Each component serves a distinct purpose in shaping agent behavior.

### Task (What outcome is expected)

Define the ultimate goal or outcome the agent should achieve.

**Syntax**: "Your primary task is to [outcome]" or "You should deliver [deliverable]."

**Guidelines**:
- Be specific about measurable outcomes
- Avoid vague goals
- If there are multiple tasks, number them

**Example**: "Your primary tasks are: (1) Generate high-quality Jira tickets of all types based on user descriptions, (2) Validate that all required fields are populated before creating tickets, and (3) Apply appropriate labels based on ticket content."

### Context (Background information that shapes decisions)

Provide essential background that grounds the agent's understanding and decision making.

**Syntax**: "You operate within the following context: [context items]."

**What to include**:
- How the organization structures work (projects, workflows, teams)
- Key policies or standards (priority schemes, labeling conventions)
- Constraints on operations (which projects, which types of work)
- Terminology specific to the organization

**Example**: "Our organization uses Jira for all work tracking with projects including Infrastructure, Applications, and Support. Issue priorities follow this scheme: Highest (production down), High (significant impact), Medium (normal work), Low (nice-to-have), Lowest (documentation)."

### Roles (Professional identity and responsibility)

Establish the agent's professional identity and scope of responsibility.

**Syntax**: "You are a [profession/role] responsible for [primary focus]."

**Guidelines**:
- Use actual job titles or professional roles
- Be explicit about scope (which projects, processes, domains)

**Examples**:
- "You are a Jira ticket quality assurance specialist responsible for ensuring tickets meet organizational standards before assignment."
- "You are a Confluence documentation specialist responsible for creating well-organized, high-quality technical documentation."

### Examples (Concrete instances of the agent's work)

Show the agent how to perform its tasks through concrete examples rather than abstract rules. Agents learn from examples better than from rules.

**Syntax**: Can be inline ("For instance, when...") or a separate examples section.

**Example for triage**: "When assessing priority, consider: High priority if (1) affects production systems, (2) impacts more than 10 users, or (3) has a business deadline. Medium priority if (1) affects non-production systems, (2) impacts fewer than 10 users, (3) routine work."

### Implementation (Specific steps to follow)

Articulate the detailed process the agent should follow. Provide enough specificity for decision points and sequence, but not so much that flexibility is lost.

**Syntax**: Numbered steps or procedural language ("When doing X: first..., then..., finally...").

**Example**: "When triaging a Jira ticket: (1) Analyze the issue description and comments to understand the problem context. (2) Identify the issue type. (3) Assess impact: How many users affected? What is the business cost? (4) Assess urgency: Is this a blocker? Is there a deadline? (5) Assign priority using the impact/urgency matrix."

---

## Two-Tier Instruction Architecture

### Behavior Instructions (Agent-Level)
- Applied globally to the entire agent across all scenarios
- Define overall role, personality, communication style, universal goals
- Keep concise: 100-300 words to establish baseline
- Change rarely; reflects core agent identity

### Scenario Instructions (Scenario-Level)
- Specific to individual scenarios within an agent
- Define how the agent should act in particular situations
- Override or supplement behavior instructions when triggered
- Can be longer: 300-1000 words since only active in specific context
- Include trigger conditions (keywords, sentiment, context)

**Interaction**: When a user prompt matches a scenario trigger, global behavior stays active (communication style, permissions) while the matched scenario adds detailed process instructions. If no scenario matches, the default scenario or base behavior handles the request.

---

## Syntax Rules

### Writing Style
- Use clear, declarative sentences in active voice
- Address the agent as "you" ("You are responsible for..." not "The agent must...")
- Break complex instructions into numbered lists
- Provide concrete examples to illustrate expected outputs

### Conditional Logic
Express in natural language rather than formal if-then syntax:
- "If the priority is High, always notify the team lead"
- "When the request relates to billing, route to the Finance team"
- Complex branching: use multiple scenarios with specific triggers rather than nested conditionals

### Entity References
- Reference Atlassian products by name (Jira projects, Confluence spaces)
- Instructions can reference organizational context and knowledge sources
- Dynamic values from automation rules can be referenced via smart variables

### Output Formatting
- Specify desired format when needed: "Provide a summary in bullet points"
- For automation (parsed responses): provide clear, parseable format
- For chat (human-read): prioritize readability over strict formatting

### Error Handling
- Specify fallback behavior: "If you can't determine the appropriate project, ask the user"
- Define escalation criteria: "If the request contains sensitive data, request human review"

---

## Advanced Patterns

### Confirmation and Guardrail Pattern
"Before [action], confirm that [condition] is true."

Example: "Before creating a ticket, confirm with the user that: (1) All required fields are provided, (2) The issue type is appropriate, (3) The project is correct."

### Knowledge Source Reference Pattern
"Reference [knowledge source] when [context]."

Example: "Reference the Team Responsibility Matrix from the Engineering Handbook when assigning teams."

### Error Handling Pattern
"If [problem occurs], [recovery action]."

Example: "If the user doesn't specify a project, ask which project the ticket belongs to. If the user provides conflicting priority signals, ask for clarification on business impact."

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Better Approach |
|---|---|---|
| **Overly complex chaining** | Too many sequential decision points; agent loses track | Break into distinct numbered steps |
| **Ambiguous constraints** | "Don't make bad decisions" has no objective criteria | "Do not create tickets without a summary and description" |
| **Assuming organizational knowledge** | "Route to Platform team if P1" undefined | Define what Platform team handles and what P1 means |
| **Mixing behavior and scenario** | Putting everything in behavior field | Behavior = role + constraints; Scenarios = task-specific steps |
| **Over-specification of format** | Rigid format reduces response quality | Give structure without rigid enforcement |
| **Vague scope definitions** | "Handle all issue types" has no boundaries | "Create issues of these types: Epic, Story, Task, Bug, Sub-task" |
| **Missing failure cases** | No guidance when information is missing | Include explicit error handling for each decision point |
| **Overly long instructions** | 400+ words degrades consistency | Keep behavior concise; use scenarios to split complexity |
| **Contradictory instructions** | Behavior and scenario instructions conflict | Test which takes priority; resolve conflicts explicitly |

---

## Instruction Quality Checklist

**Behavior Quality**:
- [ ] Role clearly defined ("You are a...")
- [ ] Scope articulated (which projects/spaces)
- [ ] Communication style specified (technical/approachable)
- [ ] Permission awareness included ("Respect user permissions")
- [ ] Length 100-500 words

**Scenario Quality**:
- [ ] Follows TCREI framework
- [ ] Decision points are clear ("If X, then Y")
- [ ] Required fields identified (not assumed)
- [ ] Tone consistent
- [ ] Anti-patterns avoided
- [ ] Length 300-1000 words

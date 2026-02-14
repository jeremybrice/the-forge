---
name: report-methodology
description: "Defines report types, audience guidance, tone standards, and agent recruitment logic. Auto-invoked on report generation to ensure appropriate methodology."
---

# Report Methodology Skill

This skill provides reasoning guidance for report generation. It defines the eight report types, their purposes, audiences, tone requirements, and agent recruitment patterns.

## Report Types and Purpose

### Executive Summary
**Purpose:** High-level overview for leadership and non-technical stakeholders
**Audience:** Executives, product leaders, business stakeholders
**Length:** 2-3 pages
**Tone:** Business-focused, clear, concise, minimal technical jargon
**Agents:** investigator, synthesizer (analyst skipped for efficiency)

**Key themes:** Overview, key findings (3-5 points), recommendations, next steps

### Technical Deep Dive
**Purpose:** Detailed technical analysis for engineering teams
**Audience:** Engineers, architects, technical leads
**Length:** 5-10 pages
**Tone:** Technical, thorough, analytical
**Agents:** investigator, analyst, synthesizer

**Key themes:** Context, technical analysis, implementation details, trade-offs, recommendations

### Competitive Analysis
**Purpose:** Market and competitor research
**Audience:** Product managers, executives, strategy team
**Length:** 3-5 pages
**Tone:** Strategic, comparative, insight-driven
**Agents:** investigator, analyst, synthesizer

**Key themes:** Market context, competitor comparison, strengths & gaps, strategic recommendations

### Architecture Review
**Purpose:** System design evaluation and recommendations
**Audience:** Architects, senior engineers, technical leads
**Length:** 4-8 pages
**Tone:** Architectural, evaluative, forward-looking
**Agents:** investigator, analyst, synthesizer

**Key themes:** Current architecture, strengths, weaknesses, recommendations, migration path

### Performance Analysis
**Purpose:** Performance metrics, bottlenecks, and optimization opportunities
**Audience:** Engineers, SREs, technical leads
**Length:** 3-6 pages
**Tone:** Data-driven, metrics-focused, actionable
**Agents:** investigator, analyst, synthesizer

**Key themes:** Metrics, bottlenecks, root causes, optimization opportunities, implementation plan

### Incident Postmortem
**Purpose:** Post-incident analysis and learning
**Audience:** Engineering teams, leadership, SREs
**Length:** 3-5 pages
**Tone:** Objective, blameless, learning-focused
**Agents:** investigator, analyst, synthesizer

**Key themes:** Incident summary, timeline, root cause, impact assessment, action items

### Quarterly Review
**Purpose:** Periodic progress assessment
**Audience:** Teams, leadership, stakeholders
**Length:** 4-6 pages
**Tone:** Reflective, progress-focused, forward-looking
**Agents:** investigator, synthesizer (analyst skipped for efficiency)

**Key themes:** Period summary, achievements, metrics, challenges, outlook

### Feasibility Study
**Purpose:** Evaluation of new initiative viability
**Audience:** Product managers, executives, engineering leads
**Length:** 5-8 pages
**Tone:** Evaluative, balanced, recommendation-driven
**Agents:** investigator, analyst, synthesizer

**Key themes:** Proposal overview, technical feasibility, resource requirements, risk assessment, recommendation (go/no-go)

## Category Taxonomy

Categories organize reports by domain. Each report has exactly one primary category:

| Category | Domain |
|----------|--------|
| `architecture` | System design, patterns, technical decisions |
| `performance` | Speed, scalability, resource usage |
| `security` | Vulnerabilities, compliance, best practices |
| `integration` | Third-party systems, APIs, data flows |
| `feature-analysis` | Feature evaluation, user impact |
| `operations` | DevOps, deployment, monitoring |
| `technical-debt` | Code quality, refactoring needs |
| `competitive` | Market analysis, competitor features |
| `user-research` | User behavior, feedback analysis |
| `business-metrics` | KPIs, ROI, business impact |

## Agent Recruitment Logic

Different report types use different agent combinations:

**investigator + synthesizer only** (skip analyst for efficiency):
- `executive-summary` – straightforward assembly, minimal interpretation needed
- `quarterly-review` – progress report, straightforward data collection

**investigator + analyst + synthesizer** (full pipeline):
- `technical-deep-dive` – needs detailed interpretation
- `competitive-analysis` – needs strategic interpretation
- `architecture-review` – needs pattern analysis and evaluation
- `performance-analysis` – needs metric interpretation and root cause analysis
- `incident-postmortem` – needs root cause analysis and learning extraction
- `feasibility-study` – needs risk/opportunity assessment

## Confidence Level Guidance

Set confidence levels based on data availability and investigation completeness:

**High Confidence:**
- Comprehensive data available, all relevant sources examined
- Clear patterns identified, minimal assumptions
- Findings validated across multiple sources

**Medium Confidence:**
- Moderate data availability, some gaps in information
- Patterns identified but with caveats, some assumptions necessary
- Findings partially validated

**Low Confidence:**
- Limited data available, significant information gaps
- Tentative patterns or unclear findings
- Many assumptions required, findings not fully validated

## Tone and Style by Report Type

Adopt the appropriate tone for each report type:

**Executive Summary**: Business language, clear value statements, avoid technical jargon, focus on outcomes and decisions

**Technical Deep Dive**: Technical precision, detailed explanations, appropriate use of technical terms, focus on implementation

**Competitive Analysis**: Strategic perspective, comparative framing, market context, focus on positioning and differentiation

**Architecture Review**: Architectural thinking, system-level view, design patterns, focus on structure and evolution

**Performance Analysis**: Data-driven, metrics-focused, quantitative, focus on measurements and optimization

**Incident Postmortem**: Objective, blameless, timeline-based, focus on learning and prevention

**Quarterly Review**: Reflective, balanced (achievements + challenges), progress-oriented, focus on trajectory

**Feasibility Study**: Evaluative, risk-aware, recommendation-oriented, focus on viability and go/no-go decision

## Content Depth by Audience

Match content depth to the intended audience:

**Leadership (Executives, Product Managers):**
- Start with high-level summary, focus on business impact
- Minimize technical details, emphasize actionable recommendations
- Use analogies and examples to explain complex concepts

**Technical Teams (Engineers, Architects):**
- Provide technical depth and specifics
- Include implementation considerations, discuss trade-offs and alternatives
- Reference specific systems, APIs, libraries

**Cross-functional (Mixed Audiences):**
- Layer information (summary first, details follow)
- Define technical terms when first used
- Balance business context with technical reality, provide both strategic view and tactical details

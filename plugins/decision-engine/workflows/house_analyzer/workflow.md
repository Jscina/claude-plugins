---
id: house_analyzer
title: Residential Property Evaluation
version: 1
created: 2026-05-14
last_modified: 2026-05-14

purpose: >
  Evaluate a residential property for purchase. Produces a fair market value
  assessment, condition risk analysis, zoning/regulatory feasibility report,
  goal-aligned value propositions, and a due-diligence checklist. Designed to
  be re-invokable on different properties for comparable outputs.

typical_goal_context:
  - retirement_property_leveraged_family_time
  - property_acquisition_strategy
  - tax_structure_optimization
  - homestead_baseline

required_inputs:
  - name: property_identifier
    type: string
    required: true
    description: Property address or listing URL
  - name: listing_data
    type: structured_data
    required: false
    description: Listing details (price, sqft, beds, baths, lot size, year built, etc.) — can be screenshots, MLS data, or freeform
  - name: sellers_disclosure
    type: file
    required: false
    description: Seller's disclosure document (PDF or images). Drives condition risk analysis.
  - name: user_intent
    type: free_form
    required: true
    description: What the user wants to do with the property (residence only, residence + business, rental, etc.)

outputs:
  - name: fair_market_valuation
    format: structured_report
    description: Comp-based fair value range with adjustments
  - name: condition_risk_assessment
    format: structured_report
    description: Major systems status, disclosure red flags, inspection priorities
  - name: zoning_regulatory_analysis
    format: structured_report
    description: Zoning classification, deed restriction unknowns, agricultural/business use feasibility
  - name: value_propositions
    format: structured_report
    description: 4-6 ways to leverage the property aligned with active goals
  - name: due_diligence_checklist
    format: markdown
    description: Pre-offer and pre-closing actions, with zero-cost steps prioritized
  - name: offer_recommendation
    format: structured_report
    description: Suggested offer price, contract terms, walk-away threshold

stages:
  - intake
  - market_analysis
  - condition_analysis
  - regulatory_analysis
  - value_proposition_generation
  - synthesis
  - run_record

tags: [property, real_estate, home_purchase, financial_decision]
---

# House Analyzer Workflow

This workflow encodes a thorough residential property evaluation. It is designed for re-invocation across multiple properties to produce comparable outputs.

## Execution Notes

- Each stage has inputs, operations, and outputs explicitly defined
- Conflict checks (`detect_goal_conflicts`) happen at every recommendation point — not just at the end
- Skip stages with `[OPTIONAL: ...]` markers if the required inputs are unavailable, but note the gap in the run record
- All web searches must be current; do not rely on training data for prices, comps, or regulations

## Stage 1: Intake

**Purpose**: Establish baseline facts about the property and confirm goal context.

**Operations**:
1. Parse `property_identifier`. If it's a URL, fetch it. If it's an address, search for the listing.
2. Extract: address, list price, square footage (above-grade vs total), bed/bath count, lot size, year built, lot characteristics (corner, double, etc.), structures, septic vs sewer, water source, HOA status, school district, parcel number, listing agent.
3. Call `find_relevant_goals(context=<workflow purpose + user intent>)` to surface candidate goals.
4. Confirm with the user which goals are in scope for this run.
5. Establish session granularity casually.

**Output**: Property snapshot table + confirmed goal context list.

**Conflict check**: None at this stage.

## Stage 2: Market Analysis

**Purpose**: Determine fair market value with rigor, not vibes.

**Operations**:
1. Identify the **above-grade square footage** (this is the appraisal-standard metric — basements are valued separately). If the listing inflates by including basement in total, flag this loudly.
2. Search for **direct neighborhood comps** — sales within the same subdivision in the last 12 months. Prioritize same-street comps over broader area comps.
3. Search for **market benchmarks** for the county and city: median sold price, median $/sqft, median days on market, year-over-year appreciation.
4. Compute fair value via piecewise adjustment:
   - Base: above-grade sqft × neighborhood-typical $/sqft
   - Add: finished basement (50-70% of above-grade rate), unfinished basement (~20%), lot premium, accessory structures, condition premiums, market appreciation
   - Subtract: known condition issues (deferred maintenance, system age, disclosure flags)
5. Cross-check with the closest direct comp. If the subject is priced >20% above the closest direct comp on a $/sqft basis, this is a red flag — surface it explicitly.

**Output**: Fair market value range with most-likely point estimate; comp comparison table; market benchmark table.

**Conflict check**: Run `detect_goal_conflicts` on "purchase at list price" against active goals. Hard constraint violations here drive walk-away thresholds.

## Stage 3: Condition Analysis

**Purpose**: Surface property condition risks that affect both valuation and inspection priorities.

**Operations** (skip if no disclosure provided, but note the gap):
1. Parse the seller's disclosure systematically. Look for:
   - System ages (HVAC, roof, water heater, septic, electrical)
   - Water history (basement leaks, crawl space water, plumbing leaks)
   - Pest history (termites, WDO, rodents)
   - Structural issues (foundation, framing)
   - Environmental (lead paint for pre-1978 builds, radon, asbestos, mold)
   - Maintenance and service records (pumping dates, service contracts)
2. Categorize findings into **positives** (recently replaced systems, good maintenance) and **concerns** (deferred items, recurring problems, age-related risks).
3. Identify **disclosure inconsistencies** — places where the form contradicts itself or an addendum. These are negotiation leverage.
4. Map concerns to **inspection priorities** (Tier 1 specialized, Tier 2 standard, Tier 3 documentation requests).

**Output**: Condition assessment with positives/concerns tables; inspection priority list; documentation request list.

**Conflict check**: For each high-severity concern, run `detect_goal_conflicts(proposed_action="proceed with purchase despite <concern>", goal_ids=[...])`. Surface any hard constraints (e.g., "no high-risk technical debt" or "must support family stability").

## Stage 4: Regulatory Analysis

**Purpose**: Determine what the user can actually *do* with the property, accounting for zoning, deed restrictions, and agricultural use feasibility.

**Operations**:
1. Identify the zoning classification (search county GIS or call planning department). Note R-1, R-1A, AG-1, etc. with specific setback requirements.
2. For each `user_intent` element (e.g., "small farm animals", "home-based business", "ADU rental"), determine:
   - Permitted by-right
   - Requires conditional use permit (CUP) — note typical cost, timeline, approval rate
   - Prohibited
3. Surface the **deed restriction unknown** — if the property is in a subdivision, recorded covenants may be stricter than zoning. List the zero-cost steps to verify (pull subdivision plat from county clerk, request title commitment, ask neighbors).
4. For corner lots, specifically address double-frontage setback implications.
5. Identify state-level protections (e.g., right-to-farm statutes) that may override local zoning for specific uses.

**Output**: Zoning summary table; intent feasibility matrix; deed restriction action list.

**Conflict check**: If the user's intended use requires regulatory approval that may not be granted, run `detect_goal_conflicts` against goals that assumed the use was possible.

## Stage 5: Value Proposition Generation

**Purpose**: Identify 4-6 ways to leverage the property financially or for lifestyle, aligned with active goals.

**Operations**:
1. Inventory the property's distinctive assets (detached buildings, large lot, basement, road access, etc.).
2. For each active goal, brainstorm property-leverage strategies that advance it.
3. For each strategy, structure:
   - Concept
   - Why it fits this user (cross-reference goal context)
   - Setup cost range
   - Annual revenue range (year 1, year 3, year 5+)
   - Time commitment
   - Feasibility (zoning, deed, legal — link to Stage 4 findings)
   - Risks
   - First free step (zero-cost validation action)
4. Score each on effort-vs-payout (subjective 1-10) with rationale.
5. Cross-compare in a matrix; identify a recommended stack (sequenced over time) rather than a single pick.

**Output**: 4-6 value propositions with full breakdown; comparison matrix; recommended stack with rationale.

**Conflict check**: For each strategy that adds a significant commitment, run `detect_goal_conflicts(proposed_action="commit to <strategy>", goal_ids=[...])`. Especially relevant for soft constraints (capital allocation, time, focus).

## Stage 6: Synthesis

**Purpose**: Produce the final report and offer recommendation.

**Operations**:
1. Determine recommended offer price based on Stages 2-3 (fair value adjusted for condition issues).
2. Recommend contract terms: contingency structure, response time, earnest money, special addenda (septic, termite, etc.).
3. Set walk-away threshold (typically 5-10% above most-likely fair value, modulated by condition risk).
4. Synthesize all stage outputs into a single buyer's evaluation report.
5. Produce a due diligence checklist split into "before offer" and "after offer accepted" — zero-cost steps prioritized at the top of each section.

**Output**: Buyer's evaluation report (full markdown document); offer recommendation; due diligence checklist.

**Conflict check**: Final cross-check of the recommendation against ALL active goals. Surface any remaining tensions explicitly.

## Stage 7: Run Record

**Purpose**: Persist the run for longitudinal comparison.

**Operations**:
1. Generate a run ID (timestamp + property identifier slug).
2. Save the run record to `runs/<run_id>.md` with frontmatter: workflow_id, workflow_version, started, finalized, status=completed, goal_context, granularity, effectiveness (process + alignment populated; outcome=null).
3. The body should embed (or link to) all stage outputs.

**Output**: Persisted run record. Confirm to the user where it lives.

**Effectiveness assessment**:
- `process` score: did the workflow surface the right considerations for THIS property?
- `alignment` score: did the outputs map to success criteria of active goals?
- `outcome` score: null at run time. Backfill 6-12 months after the decision if the property was purchased.

## Re-Invocation

When this workflow is invoked on a new property, the system should:
1. Load the prior run (or several) for comparable properties
2. Surface deltas — "this property scores higher on X, lower on Y"
3. Maintain consistent valuation methodology across runs
4. Note when assumptions used in prior runs no longer hold (market shift, regulation change)

The goal of re-invocation is **comparable outputs**, not identical ones. The user should be able to lay two runs side-by-side and trust that differences reflect property differences, not methodology drift.

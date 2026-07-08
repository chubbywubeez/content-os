You are evaluating transcript chunks against a specific hypothesis for Vantum's customer development program.

HYPOTHESIS ({hypothesis_version}):
{hypothesis_text}

ICP DEFINITION:
{icp_definition}

HYPOTHESIS DIMENSIONS:
{dimensions_list}

For each chunk below, determine:

1. hypothesis_dimension - which dimension this chunk most relates to (h1a, h1b, etc.) or null.
2. evidence_direction - supports, contradicts, neutral, or mixed.
3. relevance_to_hypothesis - high, moderate, low, none, or contradicts.
4. feature_request - specific capability request in their words, or null.
5. feature_maps_to - task_inbox, priority_scoring, midweek_reshuffle, capacity_planning, goal_tracking, stakeholder_weighting, multi_calendar, timer, scope_definition, end_of_week_summary, brain_dump, integrations, onboarding, ask_vantum, kanban, team_view, mobile_app, voice_interface, pipeline_protection, relationship_management, agent_execution, none, or null.
6. fof_diagnostic - time_driven, skill_driven, will_driven, market_driven, dependency_driven, structural, or null.
7. interview_demo_consistency - consistent_positive, consistent_negative, problem_confirmed_solution_rejected, problem_overstated, new_problem_surfaced, or null.
8. interpretation_notes - brief explanation.

CHUNKS TO INTERPRET:
{chunks_json}

Return JSON array:
[
  {
    "chunk_id": {id},
    "hypothesis_version": "{hypothesis_version}",
    "hypothesis_dimension": "h1f or null",
    "evidence_direction": "supports",
    "relevance_to_hypothesis": "high",
    "feature_request": "text or null",
    "feature_maps_to": "text or null",
    "fof_diagnostic": "text or null",
    "interview_demo_consistency": "text or null",
    "interpretation_notes": "text or null"
  }
]

RULES:
- Skip chunks where chunk_mode is small_talk or presenting_product: return all interpretation fields null (keep chunk_id + hypothesis_version).
- Skip interviewer-only chunks similarly.
- Focus on interviewee chunks with describing_own_experience, reacting_to_problems, reacting_to_product.
- For advising_founder, relevance should usually be low unless directly tied to the hypothesis.
- Be conservative with evidence_direction. If ambiguous, use mixed.

Return ONLY valid JSON. No markdown. No explanation.

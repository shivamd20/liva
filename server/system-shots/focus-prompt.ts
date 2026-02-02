/**
 * Focus Mode Prompt Extension for System Shots.
 * Appends conditional instructions to base prompt when Focus Mode is active.
 */
import type { FocusOptions, FocusProblemEntry, PerformanceTrend } from "./types";

/**
 * Build the Focus Mode prompt extension to append to base generation prompt.
 * This injects focus context including recent problems, trend, and adaptation rules.
 */
export function buildFocusModePromptExtension(focusOptions: FocusOptions): string {
    const { conceptId, recentProblems, performanceTrend, targetDifficulty } = focusOptions;

    const recentHistory =
        recentProblems.length > 0
            ? recentProblems
                .map(
                    (p) =>
                        `- "${p.concept.slice(0, 40)}..." (difficulty ${p.difficulty}): ${p.outcome}`
                )
                .join("\n")
            : "No recent history in this focus session.";

    const adaptationInstructions = getAdaptationInstructions(performanceTrend);

    return `
––––––––––––––––––
FOCUS MODE ACTIVE

You are operating in FOCUS MODE for a single topic.

Focused topic: ${conceptId}

Strict rules:
- Generate content ONLY for the topic: ${conceptId}
- Do NOT include any other concepts or topics
- Do NOT repeat problem concepts, patterns, or structures from recent history
- Vary surface details while advancing conceptual depth
- Keep the reel format identical to normal mode

User's recent focus history (last ${recentProblems.length} problems):
${recentHistory}

User performance trend: ${performanceTrend}

Target difficulty for this batch: ${targetDifficulty}

Adaptation rules:
${adaptationInstructions}

Output requirements:
- One reel per question
- Clear problem statement
- Mobile-first formatting
- No meta commentary
- No references to previous problems
- No mention of "Focus Mode" in the content
`.trim();
}

/**
 * Get adaptation instructions based on performance trend.
 */
function getAdaptationInstructions(trend: PerformanceTrend): string {
    switch (trend) {
        case "improving":
            return `- User is performing well → INCREASE difficulty
- Introduce more nuanced scenarios
- Challenge with edge cases and failure modes
- Reduce scaffolding in explanations`;
        case "declining":
            return `- User is struggling → DECREASE difficulty
- Simplify problem framing
- Add scaffolding and hints in explanation
- Reinforce fundamentals before advancing`;
        case "stagnant":
        default:
            return `- Maintain current difficulty level
- Change problem framing (different scenarios)
- Introduce lateral variations
- Test same concepts from new angles`;
    }
}

/**
 * Build a concise summary of recent problem patterns to avoid.
 * Used to prevent repetition in generated content.
 */
export function buildAvoidanceContext(recentProblems: FocusProblemEntry[]): string {
    if (recentProblems.length === 0) return "";

    const patterns = recentProblems.map((p) => p.concept.slice(0, 30)).join(", ");
    return `\nAVOID similar patterns to: ${patterns}`;
}

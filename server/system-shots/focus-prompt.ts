/**
 * Focus Mode Prompt Extension for System Shots.
 * Appends instructions to generate content for a single concept.
 */

/**
 * Build the Focus Mode prompt extension to append to base generation prompt.
 * Instructs LLM to generate content exclusively for the given concept.
 */
export function buildFocusModePromptExtension(conceptId: string): string {
  return `
––––––––––––––––––
FOCUS MODE ACTIVE

You are operating in FOCUS MODE for a single topic.

Focused topic: ${conceptId}

Strict rules:
- Generate content ONLY for the topic: ${conceptId}
- Do NOT include any other concepts or topics
- Do NOT repeat problem concepts, patterns, or structures from recent reels
- Vary surface details while advancing conceptual depth
- Keep the reel format identical to normal mode

Output requirements:
- One reel per question
- Clear problem statement
- Mobile-first formatting
- No meta commentary
- No mention of "Focus Mode" in the content
`.trim();
}

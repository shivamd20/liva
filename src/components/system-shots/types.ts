export const REEL_THEMES = ["accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const
export type ReelTheme = (typeof REEL_THEMES)[number]

/** API reel shape – compatible with ReelCard display type */
export type ApiReel = {
  id: string
  conceptId: string
  type: "mcq" | "flash"
  prompt: string
  options: string[] | null
  correctIndex: number | null
  explanation: string
  difficulty: number
}
export type ReelCardVariant = "A" | "B" | "C"

export const THEME_BORDER: Record<ReelTheme, string> = {
  accent: "border-accent",
  "chart-1": "border-chart-1",
  "chart-2": "border-chart-2",
  "chart-3": "border-chart-3",
  "chart-4": "border-chart-4",
  "chart-5": "border-chart-5",
}

export const THEME_BG: Record<ReelTheme, string> = {
  accent: "bg-accent",
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
}

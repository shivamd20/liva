import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button
                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                aria-label="Toggle theme"
            >
                <Sun className="h-[18px] w-[18px]" />
            </button>
        )
    }

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label="Toggle theme"
        >
            {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px] transition-transform duration-300 rotate-0 scale-100" />
            ) : (
                <Moon className="h-[18px] w-[18px] transition-transform duration-300 rotate-0 scale-100" />
            )}
        </button>
    )
}

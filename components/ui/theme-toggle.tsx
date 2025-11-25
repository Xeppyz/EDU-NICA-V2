"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => setMounted(true), [])

    if (!mounted) return null

    const isDark = theme === "dark"

    return (
        <div className={cn("flex items-center justify-between w-full", className)}>
            <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{isDark ? "Modo oscuro" : "Modo claro"}</span>
            </div>
            <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Switch
                    aria-label="Toggle theme"
                    checked={isDark}
                    onCheckedChange={(val) => {
                        const newTheme = val ? "dark" : "light"
                        setTheme(newTheme)
                        try {
                            // persist theme in a regular cookie so server-side can read it
                            document.cookie = `theme=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}`
                        } catch (e) { }
                    }}
                />
            </div>
        </div>
    )
}

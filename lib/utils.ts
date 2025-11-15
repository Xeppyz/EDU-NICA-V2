import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a video URL (YouTube, youtu.be, Vimeo) into an embeddable iframe URL.
 * Returns null if input is falsy.
 */
export function toEmbedUrl(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace("www.", "")

    // YouTube long form: youtube.com/watch?v=ID
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v")
      if (v) {
        // preserve start time if provided via t or start
        const t = u.searchParams.get("t") || u.searchParams.get("start")
        const start = t ? `?start=${parseInt(t.toString().replace(/[^0-9]/g, "")) || 0}` : ""
        return `https://www.youtube.com/embed/${v}${start}`
      }
      // If path already contains /embed
      if (u.pathname.startsWith("/embed/")) return url
    }

    // youtu.be short link
    if (host === "youtu.be") {
      const id = u.pathname.replace("/", "")
      if (id) return `https://www.youtube.com/embed/${id}`
    }

    // Vimeo -> player.vimeo.com/video/ID
    if (host.includes("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean)
      const id = parts[parts.length - 1]
      if (id) return `https://player.vimeo.com/video/${id}`
    }

    // Otherwise return as-is (may be direct mp4 or other embeddable provider)
    return url
  } catch (e) {
    // not a valid URL, return as-is
    return url || null
  }
}

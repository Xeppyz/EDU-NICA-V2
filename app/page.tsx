"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser()
      if (user) {
        const role = user.role || "student"
        if (role === "teacher") {
          router.push("/dashboard")
        } else {
          router.push("/student")
        }
      } else {
        router.push("/auth/login")
      }
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return null
}

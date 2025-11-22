"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"

export default function MovedUploadPage() {
    const router = useRouter()

    useEffect(() => {
        ; (async () => {
            const cu = await getCurrentUser()
            if (!cu) {
                router.push('/auth/login')
                return
            }
            // Redirect teachers to the new upload page, students elsewhere
            if (cu.role === 'teacher' || cu.role === 'admin') {
                router.replace('/dashboard/library/new')
            } else {
                router.replace('/')
            }
        })()
    }, [router])

    return null
}

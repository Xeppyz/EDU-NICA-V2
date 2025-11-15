import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 })
        }

        const supabase = await getSupabaseServerClient()

        // First remove dependent rows in our DB (profiles, public.users) to avoid FK/trigger issues
        try {
            // delete profile if exists
            await supabase.from('profiles').delete().eq('id', id)
        } catch (e) {
            console.warn('Could not delete profiles row before deleting auth user', e)
        }

        try {
            // If you have a public.users (or user) table synced from auth, remove it
            await supabase.from('users').delete().eq('id', id)
        } catch (e) {
            console.warn('Could not delete public.users row before deleting auth user', e)
        }

        // Remove dependent rows that hold foreign keys to public.users
        try {
            // student-related data: delete responses, progress and enrollments
            await supabase.from('student_responses').delete().eq('student_id', id)
        } catch (e) {
            console.warn('Could not delete student_responses for user', id, e)
        }
        try {
            await supabase.from('student_progress').delete().eq('student_id', id)
        } catch (e) {
            console.warn('Could not delete student_progress for user', id, e)
        }
        try {
            await supabase.from('class_enrollments').delete().eq('student_id', id)
        } catch (e) {
            console.warn('Could not delete class_enrollments for user', id, e)
        }

        // Forum content: attempt to NULL author references to preserve posts/replies if possible
        try {
            await supabase.from('forum_replies').update({ author_id: null }).eq('author_id', id)
        } catch (e) {
            console.warn('Could not null forum_replies.author_id for user', id, e)
            try {
                // fallback: delete replies
                await supabase.from('forum_replies').delete().eq('author_id', id)
            } catch (e2) {
                console.warn('Could not delete forum_replies for user', id, e2)
            }
        }
        try {
            await supabase.from('forum_posts').update({ author_id: null }).eq('author_id', id)
        } catch (e) {
            console.warn('Could not null forum_posts.author_id for user', id, e)
            try {
                // fallback: delete posts
                await supabase.from('forum_posts').delete().eq('author_id', id)
            } catch (e2) {
                console.warn('Could not delete forum_posts for user', id, e2)
            }
        }

        // If user is a teacher referenced by classes.teacher_id, set the teacher_id to NULL
        try {
            await supabase.from('classes').update({ teacher_id: null }).eq('teacher_id', id)
        } catch (e) {
            console.warn('Could not null classes.teacher_id for user', id, e)
        }

        // Delete auth user via admin API
        let result: any = null
        try {
            // try the common shape first
            result = await (supabase.auth as any).admin.deleteUser(id)
        } catch (e) {
            // some SDK versions expect an object param or have different method name
            try {
                result = await (supabase.auth as any).admin.deleteUser({ userId: id })
            } catch (e2) {
                try {
                    result = await (supabase.auth as any).admin.deleteUserById?.(id)
                } catch (e3) {
                    // give up and return the error stack
                    console.error('delete-user error (all attempts):', e, e2, e3)
                    return NextResponse.json({ error: String(e) }, { status: 500 })
                }
            }
        }

        const err = result?.error || (result && result.data && result.data.error)

        if (err) {
            console.error('delete-user returned error:', err)
            return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
        }

        // Remove profile row if exists
        try {
            await supabase.from('profiles').delete().eq('id', id)
        } catch (e) {
            // ignore
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}

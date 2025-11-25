"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageSquare, Plus, Reply, Search, Trash2 } from "lucide-react"

interface ForumPost {
    id: string
    title: string
    content: string
    author_id: string
    author_name: string
    author_email: string
    created_at: string
    replies_count: number
}

interface PostRow {
    id: string
    title: string
    content: string
    author_id: string
    created_at: string
    users?: {
        full_name?: string | null
        email?: string | null
    } | null
}

interface ReplyRow {
    id: string
    content: string
    author_id: string
    created_at: string
    users?: {
        full_name?: string | null
        email?: string | null
    } | null
}

interface ForumReply {
    id: string
    content: string
    author_id: string
    author_name: string
    author_email: string
    created_at: string
}

export default function TeacherForumPage() {
    const router = useRouter()
    const params = useParams()
    const classId = params.classId as string

    const [user, setUser] = useState<any>(null)
    const [posts, setPosts] = useState<ForumPost[]>([])
    const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null)
    const [replies, setReplies] = useState<ForumReply[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>("")
    const [className, setClassName] = useState<string>("")

    const [searchTerm, setSearchTerm] = useState("")
    const [showNewPostDialog, setShowNewPostDialog] = useState(false)
    const [showReplyDialog, setShowReplyDialog] = useState(false)
    const [newPostTitle, setNewPostTitle] = useState("")
    const [newPostContent, setNewPostContent] = useState("")
    const [replyContent, setReplyContent] = useState("")

    useEffect(() => {
        const loadForum = async () => {
            try {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()
                const { data: classRow, error: classError } = await supabase
                    .from("classes")
                    .select("id, name, teacher_id")
                    .eq("id", classId)
                    .single()
                if (classError) throw classError
                if (classRow.teacher_id !== currentUser.id) {
                    setError("No tienes acceso a este foro")
                    setLoading(false)
                    return
                }
                setClassName(classRow.name || "")

                const { data: postRows, error: postsError } = await supabase
                    .from("forum_posts")
                    .select("id, title, content, author_id, created_at, users:author_id(full_name, email)")
                    .eq("class_id", classId)
                    .order("created_at", { ascending: false })
                if (postsError) throw postsError

                const enriched = await Promise.all(
                    (postRows || []).map(async (post: PostRow) => {
                        const { count } = await supabase
                            .from("forum_replies")
                            .select("id", { count: "exact", head: true })
                            .eq("post_id", post.id)
                        return {
                            id: post.id,
                            title: post.title,
                            content: post.content,
                            author_id: post.author_id,
                            created_at: post.created_at,
                            author_name: post.users?.full_name || "Anónimo",
                            author_email: post.users?.email || "",
                            replies_count: count || 0,
                        }
                    }),
                )

                setPosts(enriched)
                if (enriched.length > 0) setSelectedPost(enriched[0])
            } catch (err: any) {
                console.error("Error cargando foro", err)
                setError(err?.message || "Error cargando el foro")
            } finally {
                setLoading(false)
            }
        }

        loadForum()
    }, [classId, router])

    useEffect(() => {
        const loadReplies = async () => {
            if (!selectedPost) return
            try {
                const supabase = getSupabaseClient()
                const { data, error: repliesError } = await supabase
                    .from("forum_replies")
                    .select("id, content, author_id, created_at, users:author_id(full_name, email)")
                    .eq("post_id", selectedPost.id)
                    .order("created_at", { ascending: true })
                if (repliesError) throw repliesError
                const mapped = (data || []).map((reply: ReplyRow) => ({
                    id: reply.id,
                    content: reply.content,
                    author_id: reply.author_id,
                    created_at: reply.created_at,
                    author_name: reply.users?.full_name || "Anónimo",
                    author_email: reply.users?.email || "",
                }))
                setReplies(mapped)
            } catch (err) {
                console.error("Error cargando respuestas", err)
            }
        }
        loadReplies()
    }, [selectedPost])

    const handleCreatePost = async () => {
        setError("")
        if (!newPostTitle.trim() || !newPostContent.trim()) {
            setError("El título y contenido son requeridos")
            return
        }
        try {
            const supabase = getSupabaseClient()
            const { data, error: insertError } = await supabase
                .from("forum_posts")
                .insert({
                    class_id: classId,
                    author_id: user.id,
                    title: newPostTitle.trim(),
                    content: newPostContent.trim(),
                })
                .select()
                .single()
            if (insertError) throw insertError
            const created: ForumPost = {
                id: data.id,
                title: data.title,
                content: data.content,
                author_id: data.author_id,
                created_at: data.created_at,
                author_name: user.user_metadata?.full_name || "Tú",
                author_email: user.email || "",
                replies_count: 0,
            }
            setPosts((prev) => [created, ...prev])
            setSelectedPost(created)
            setShowNewPostDialog(false)
            setNewPostTitle("")
            setNewPostContent("")
        } catch (err: any) {
            console.error(err)
            setError(err?.message || "No se pudo publicar")
        }
    }

    const handleAddReply = async () => {
        setError("")
        if (!selectedPost || !replyContent.trim()) {
            setError("Escribe una respuesta")
            return
        }
        try {
            const supabase = getSupabaseClient()
            const { data, error: insertError } = await supabase
                .from("forum_replies")
                .insert({
                    post_id: selectedPost.id,
                    author_id: user.id,
                    content: replyContent.trim(),
                })
                .select()
                .single()
            if (insertError) throw insertError
            const reply: ForumReply = {
                id: data.id,
                content: data.content,
                author_id: data.author_id,
                created_at: data.created_at,
                author_name: user.user_metadata?.full_name || "Tú",
                author_email: user.email || "",
            }
            setReplies((prev) => [...prev, reply])
            setReplyContent("")
            setShowReplyDialog(false)
            setPosts((prev) =>
                prev.map((p) => (p.id === selectedPost.id ? { ...p, replies_count: p.replies_count + 1 } : p)),
            )
        } catch (err: any) {
            console.error(err)
            setError(err?.message || "No se pudo responder")
        }
    }

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("¿Eliminar este tema?")) return
        try {
            const supabase = getSupabaseClient()
            const { error: deleteError } = await supabase.from("forum_posts").delete().eq("id", postId)
            if (deleteError) throw deleteError
            setPosts((prev) => prev.filter((p) => p.id !== postId))
            if (selectedPost?.id === postId) {
                setSelectedPost(null)
            }
        } catch (err) {
            console.error("No se pudo borrar el post", err)
        }
    }

    const handleDeleteReply = async (replyId: string) => {
        if (!window.confirm("¿Eliminar esta respuesta?")) return
        try {
            const supabase = getSupabaseClient()
            const { error: deleteError } = await supabase.from("forum_replies").delete().eq("id", replyId)
            if (deleteError) throw deleteError
            setReplies((prev) => prev.filter((r) => r.id !== replyId))
            setPosts((prev) =>
                prev.map((p) =>
                    selectedPost && p.id === selectedPost.id
                        ? { ...p, replies_count: Math.max(0, p.replies_count - 1) }
                        : p,
                ),
            )
        } catch (err) {
            console.error("No se pudo borrar la respuesta", err)
        }
    }

    const filteredPosts = useMemo(() => {
        const query = searchTerm.toLowerCase()
        return posts.filter((p) => p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query))
    }, [posts, searchTerm])

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Cargando foro…</p>
            </div>
        )
    }

    if (error && posts.length === 0) {
        return (
            <div className="p-6 space-y-4">
                <p className="text-destructive">{error}</p>
                <Button variant="secondary" onClick={() => router.push(`/dashboard/classes/${classId}`)}>
                    Volver a la clase
                </Button>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-muted-foreground" onClick={() => router.push(`/dashboard/classes/${classId}`)}>
                        ← Volver a la clase
                    </p>
                    <h1 className="text-2xl font-bold">Foro de {className || "la clase"}</h1>
                    <p className="text-sm text-muted-foreground">Comparte anuncios, abre discusiones y responde a tus estudiantes.</p>
                </div>
                <Button onClick={() => setShowNewPostDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo tema
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-1">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar publicaciones…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="max-h-[32rem] space-y-2 overflow-y-auto">
                        {filteredPosts.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No hay publicaciones coincidentes
                                </CardContent>
                            </Card>
                        ) : (
                            filteredPosts.map((post: ForumPost) => (
                                <button
                                    key={post.id}
                                    onClick={() => setSelectedPost(post)}
                                    className={`w-full rounded-lg border p-3 text-left ${selectedPost?.id === post.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                                >
                                    <p className="font-medium text-sm line-clamp-2">{post.title}</p>
                                    <p className="text-xs text-muted-foreground">{post.author_name}</p>
                                    <Badge variant="outline" className="mt-2 text-xs">
                                        {post.replies_count} respuesta{post.replies_count === 1 ? "" : "s"}
                                    </Badge>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2">
                    {selectedPost ? (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="flex flex-row items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>{selectedPost.title}</CardTitle>
                                        <CardDescription>
                                            Publicado por {selectedPost.author_name} · {new Date(selectedPost.created_at).toLocaleString("es-NI")}
                                        </CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeletePost(selectedPost.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <p className="leading-relaxed text-muted-foreground">{selectedPost.content}</p>
                                </CardContent>
                            </Card>

                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Respuestas ({replies.length})</h3>
                                <Button variant="secondary" size="sm" onClick={() => setShowReplyDialog(true)}>
                                    <Reply className="mr-1 h-4 w-4" /> Responder
                                </Button>
                            </div>

                            {replies.length === 0 ? (
                                <Card>
                                    <CardContent className="py-8 text-center text-muted-foreground">
                                        Nadie ha respondido aún.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {replies.map((reply: ForumReply) => (
                                        <Card key={reply.id}>
                                            <CardContent className="py-4">
                                                <div className="flex gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback>{reply.author_name.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-semibold">{reply.author_name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {new Date(reply.created_at).toLocaleString("es-NI")}
                                                                </p>
                                                            </div>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteReply(reply.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                        <p className="mt-2 text-sm text-muted-foreground">{reply.content}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <MessageSquare className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                                <p className="text-muted-foreground">Selecciona una publicación para verla</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={showNewPostDialog} onOpenChange={setShowNewPostDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo tema</DialogTitle>
                        <DialogDescription>Comparte anuncios o abre un debate para la clase.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium">Título</label>
                            <Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium">Contenido</label>
                            <Textarea rows={4} value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowNewPostDialog(false)
                                    setNewPostTitle("")
                                    setNewPostContent("")
                                    setError("")
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleCreatePost}>Publicar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva respuesta</DialogTitle>
                        <DialogDescription>Responde al hilo seleccionado.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea rows={4} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Escribe tu respuesta" />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowReplyDialog(false)
                                    setReplyContent("")
                                    setError("")
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleAddReply}>Responder</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

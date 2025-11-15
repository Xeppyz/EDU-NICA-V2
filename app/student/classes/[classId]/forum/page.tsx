"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Plus, Reply, Trash2, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

interface ForumReply {
  id: string
  content: string
  author_id: string
  author_name: string
  author_email: string
  created_at: string
}

export default function ForumPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [posts, setPosts] = useState<ForumPost[]>([])
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null)
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showNewPostDialog, setShowNewPostDialog] = useState(false)
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newPostTitle, setNewPostTitle] = useState("")
  const [newPostContent, setNewPostContent] = useState("")
  const [replyContent, setReplyContent] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadForum() {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)

        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        const supabase = getSupabaseClient()

        // Load posts
        const { data: postsData } = await supabase
          .from("forum_posts")
          .select(`
            id,
            title,
            content,
            author_id,
            created_at,
            users:author_id(full_name, email)
          `)
          .eq("class_id", classId)
          .order("created_at", { ascending: false })

        if (postsData) {
          // Count replies for each post
          const postsWithReplies = await Promise.all(
            postsData.map(async (post) => {
              const { count } = await supabase
                .from("forum_replies")
                .select("*", { count: "exact" })
                .eq("post_id", post.id)

              return {
                ...post,
                author_name: post.users?.full_name || "Anónimo",
                author_email: post.users?.email || "",
                replies_count: count || 0,
                users: undefined,
              }
            }),
          )

          setPosts(postsWithReplies)

          if (postsWithReplies.length > 0 && !selectedPost) {
            setSelectedPost(postsWithReplies[0])
          }
        }
      } catch (error) {
        console.error("Error loading forum:", error)
      } finally {
        setLoading(false)
      }
    }

    loadForum()
  }, [classId, router])

  useEffect(() => {
    async function loadReplies() {
      if (!selectedPost) return

      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase
          .from("forum_replies")
          .select(`
            id,
            content,
            author_id,
            created_at,
            users:author_id(full_name, email)
          `)
          .eq("post_id", selectedPost.id)
          .order("created_at", { ascending: true })

        if (data) {
          setReplies(
            data.map((reply) => ({
              ...reply,
              author_name: reply.users?.full_name || "Anónimo",
              author_email: reply.users?.email || "",
              users: undefined,
            })),
          )
        }
      } catch (error) {
        console.error("Error loading replies:", error)
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
        .insert([
          {
            class_id: classId,
            author_id: user.id,
            title: newPostTitle.trim(),
            content: newPostContent.trim(),
          },
        ])
        .select()

      if (insertError) throw insertError

      const newPost: ForumPost = {
        ...data[0],
        author_name: user.user_metadata?.full_name || "Tú",
        author_email: user.email || "",
        replies_count: 0,
      }

      setPosts([newPost, ...posts])
      setSelectedPost(newPost)
      setNewPostTitle("")
      setNewPostContent("")
      setShowNewPostDialog(false)
    } catch (error: any) {
      setError(error.message || "Error al crear el post")
    }
  }

  const handleAddReply = async () => {
    if (!selectedPost || !replyContent.trim()) {
      setError("El contenido de la respuesta es requerido")
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { data, error: insertError } = await supabase
        .from("forum_replies")
        .insert([
          {
            post_id: selectedPost.id,
            author_id: user.id,
            content: replyContent.trim(),
          },
        ])
        .select()

      if (insertError) throw insertError

      const newReply: ForumReply = {
        ...data[0],
        author_name: user.user_metadata?.full_name || "Tú",
        author_email: user.email || "",
      }

      setReplies([...replies, newReply])
      setReplyContent("")
      setShowReplyDialog(false)
      setError("")
    } catch (error: any) {
      setError(error.message || "Error al agregar respuesta")
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este post?")) return

    try {
      const supabase = getSupabaseClient()
      await supabase.from("forum_posts").delete().eq("id", postId)
      setPosts(posts.filter((p) => p.id !== postId))
      if (selectedPost?.id === postId) {
        setSelectedPost(posts.length > 1 ? posts[0] : null)
      }
    } catch (error) {
      console.error("Error deleting post:", error)
    }
  }

  const handleDeleteReply = async (replyId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta respuesta?")) return

    try {
      const supabase = getSupabaseClient()
      await supabase.from("forum_replies").delete().eq("id", replyId)
      setReplies(replies.filter((r) => r.id !== replyId))
    } catch (error) {
      console.error("Error deleting reply:", error)
    }
  }

  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.content.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Cargando foro...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">Foro de Discusión</h1>
        <p className="text-muted-foreground mt-1">Interactúa con tus compañeros y docentes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowNewPostDialog(true)} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Sin posts aún</p>
                </CardContent>
              </Card>
            ) : (
              filteredPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPost?.id === post.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="font-medium text-sm line-clamp-2">{post.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{post.author_name}</p>
                  <Badge variant="outline" className="text-xs mt-2">
                    {post.replies_count} respuesta{post.replies_count !== 1 ? "s" : ""}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Post Detail */}
        <div className="lg:col-span-2">
          {selectedPost ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <CardTitle>{selectedPost.title}</CardTitle>
                      <CardDescription className="mt-2">Publicado por {selectedPost.author_name}</CardDescription>
                    </div>
                    {user?.id === selectedPost.author_id && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePost(selectedPost.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">{selectedPost.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedPost.created_at).toLocaleString("es-ES")}
                  </p>
                </CardContent>
              </Card>

              {/* Replies */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Respuestas ({replies.length})</h3>
                  <Button onClick={() => setShowReplyDialog(true)} size="sm">
                    <Reply className="w-4 h-4" />
                    Responder
                  </Button>
                </div>

                {replies.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground">
                      Sin respuestas aún. ¡Sé el primero en responder!
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {replies.map((reply) => (
                      <Card key={reply.id}>
                        <CardContent className="py-4">
                          <div className="flex gap-3">
                            <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                              <AvatarFallback>{reply.author_name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <p className="font-medium text-sm">{reply.author_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(reply.created_at).toLocaleString("es-ES")}
                                  </p>
                                </div>
                                {user?.id === reply.author_id && (
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteReply(reply.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm mt-2 leading-relaxed">{reply.content}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Selecciona un post para verlo</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Post Dialog */}
      <Dialog open={showNewPostDialog} onOpenChange={setShowNewPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Post</DialogTitle>
            <DialogDescription>Comparte tus preguntas e ideas con la comunidad</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <Input
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Ej: Pregunta sobre la lección..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contenido</label>
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Escribe tu post aquí..."
                rows={4}
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex gap-2 justify-end">
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

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Respuesta</DialogTitle>
            <DialogDescription>Responde a este post</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tu Respuesta</label>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Escribe tu respuesta aquí..."
                rows={4}
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex gap-2 justify-end">
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

"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Volume2, Video, Search, Upload, Loader2, Tag } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GlossaryEntry {
  id: string
  term: string
  definition: string
  audio_url: string | null
  lsn_video_url: string | null
  lsn_video_storage_path: string | null
  category: string | null
  example_sentence: string | null
  handshape: string | null
  difficulty: string | null
}

interface ManageGlossaryProps {
  classId: string
}

export default function ManageGlossary({ classId }: ManageGlossaryProps) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null)
  const [formData, setFormData] = useState({
    term: "",
    definition: "",
    audio_url: "",
    lsn_video_url: "",
    category: "",
    example_sentence: "",
    handshape: "",
    difficulty: "",
  })
  const [error, setError] = useState("")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  const categoryOptions = useMemo(() => [
    "Lengua y Literatura",
    "Matemáticas",
    "Ciencias",
    "Vida diaria",
    "Emociones",
    "Otro",
  ], [])

  const difficultyOptions = useMemo(() => [
    { value: "basico", label: "Básico" },
    { value: "intermedio", label: "Intermedio" },
    { value: "avanzado", label: "Avanzado" },
  ], [])

  useEffect(() => {
    loadGlossary()
  }, [classId])

  const loadGlossary = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("glossary")
        .select("*")
        .eq("class_id", classId)
        .order("term", { ascending: true })

      console.debug("loadGlossary response:", { data, error })

      if (error) throw error

      setEntries(data || [])
    } catch (error) {
      console.error("Error loading glossary:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setError("")

    if (!formData.term.trim() || !formData.definition.trim()) {
      setError("El término y la definición son requeridos")
      return
    }

    try {
      const supabase = getSupabaseClient()
      let videoStoragePath = editingEntry?.lsn_video_storage_path || null

      const sanitizeFilename = (name: string) => {
        const base = name.split(/[\/\\]/).pop() || name
        const noDiacritics = base.normalize("NFD").replace(/\p{Diacritic}/gu, "")
        return noDiacritics.replace(/[^a-zA-Z0-9._-]/g, "_")
      }

      if (videoFile) {
        setUploadingVideo(true)
        try {
          const ext = videoFile.name.includes(".") ? videoFile.name.split(".").pop() : ""
          const rawBase = videoFile.name.replace(/\.[^/.]+$/, "")
          const safeBase = sanitizeFilename(rawBase)
          const filename = `${Date.now()}-${safeBase}${ext ? "." + ext : ""}`
          const path = `glossary/${classId}/${filename}`
          const uploadResp = await supabase.storage.from("library").upload(path, videoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: videoFile.type || "video/mp4",
          })
          if (uploadResp.error) throw uploadResp.error
          videoStoragePath = path
        } finally {
          setUploadingVideo(false)
        }
      }

      const payload = {
        term: formData.term,
        definition: formData.definition,
        audio_url: formData.audio_url || null,
        lsn_video_url: formData.lsn_video_url || null,
        lsn_video_storage_path: videoStoragePath,
        category: formData.category || null,
        example_sentence: formData.example_sentence || null,
        handshape: formData.handshape || null,
        difficulty: formData.difficulty || null,
      }

      if (editingEntry) {
        const resp = await supabase
          .from("glossary")
          .update(payload)
          .eq("id", editingEntry.id)

        console.debug("update glossary response:", resp)
        if (resp.error) throw resp.error
      } else {
        const resp = await supabase
          .from("glossary")
          .insert([
            {
              class_id: classId,
              ...payload,
            },
          ])
          .select()

        console.debug("insert glossary response:", resp)
        if (resp.error) throw resp.error
      }
      await loadGlossary()
      setShowDialog(false)
      setEditingEntry(null)
      setFormData({ term: "", definition: "", audio_url: "", lsn_video_url: "", category: "", example_sentence: "", handshape: "", difficulty: "" })
      setVideoFile(null)
      setError("")
    } catch (error: any) {
      setError(error.message || "Error al guardar")
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este término?")) return

    try {
      const supabase = getSupabaseClient()
      const resp = await supabase.from("glossary").delete().eq("id", id)
      console.debug("delete glossary response:", resp)
      if (resp.error) throw resp.error
      setEntries(entries.filter((e) => e.id !== id))
    } catch (error) {
      console.error("Error deleting entry:", error)
      setError((error as any)?.message || "Error al eliminar")
    }
  }

  const openDialog = (entry?: GlossaryEntry) => {
    console.debug("openDialog called", entry)
    if (entry) {
      setEditingEntry(entry)
      setFormData({
        term: entry.term,
        definition: entry.definition,
        audio_url: entry.audio_url || "",
        lsn_video_url: entry.lsn_video_url || "",
        category: entry.category || "",
        example_sentence: entry.example_sentence || "",
        handshape: entry.handshape || "",
        difficulty: entry.difficulty || "",
      })
      setVideoFile(null)
    } else {
      setEditingEntry(null)
      setFormData({ term: "", definition: "", audio_url: "", lsn_video_url: "", category: "", example_sentence: "", handshape: "", difficulty: "" })
      setVideoFile(null)
    }
    setShowDialog(true)
  }

  const filteredEntries = entries.filter(
    (e) =>
      e.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const categoryChips = Array.from(new Set(entries.map((e) => e.category).filter(Boolean)))

  if (loading) {
    return <div className="text-muted-foreground">Cargando glosario...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar términos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4" />
          Nuevo Término
        </Button>
      </div>

      {categoryChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryChips.map((cat) => (
            <Badge key={cat as string} variant="secondary" className="flex items-center gap-1 text-xs">
              <Tag className="w-3 h-3" />
              {cat}
            </Badge>
          ))}
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">Sin términos en el glosario</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{entry.term}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(entry)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{entry.definition}</p>
                {entry.example_sentence && (
                  <p className="text-xs italic text-muted-foreground">Ejemplo: {entry.example_sentence}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {entry.category && (
                    <Badge variant="secondary" className="text-xs">
                      {entry.category}
                    </Badge>
                  )}
                  {entry.difficulty && (
                    <Badge variant="outline" className="text-xs">
                      Nivel: {entry.difficulty}
                    </Badge>
                  )}
                  {entry.audio_url && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      Audio
                    </Badge>
                  )}
                  {entry.lsn_video_url && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      LSN
                    </Badge>
                  )}
                  {entry.lsn_video_storage_path && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Video privado
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Editar Término" : "Nuevo Término"}</DialogTitle>
            <DialogDescription>Agrega multimedia en Lengua de Señas Nicaragüense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Término</label>
              <Input
                value={formData.term}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                placeholder="Ej: Metáfora"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Definición</label>
              <Textarea
                value={formData.definition}
                onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                placeholder="Explicación del término..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nivel</label>
                <Select
                  value={formData.difficulty || ""}
                  onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {difficultyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ejemplo en contexto</label>
              <Textarea
                value={formData.example_sentence}
                onChange={(e) => setFormData({ ...formData, example_sentence: e.target.value })}
                placeholder="Escribe una oración o situación donde se use el término"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Configuración de la mano (opcional)</label>
              <Input
                value={formData.handshape}
                onChange={(e) => setFormData({ ...formData, handshape: e.target.value })}
                placeholder="Ej: Mano en B abierta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL de Audio (opcional)</label>
              <Input
                value={formData.audio_url}
                onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                placeholder="https://ejemplo.com/audio.mp3"
                type="url"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Video LSN (opcional)</label>
              <Input
                value={formData.lsn_video_url}
                onChange={(e) => setFormData({ ...formData, lsn_video_url: e.target.value })}
                placeholder="https://ejemplo.com/lsn-video.mp4"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Cargar Video LSN (privado)</label>
              <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
              {videoFile && <p className="text-xs text-muted-foreground">Archivo seleccionado: {videoFile.name}</p>}
              {editingEntry?.lsn_video_storage_path && !videoFile && (
                <p className="text-xs text-muted-foreground">Video existente: {editingEntry.lsn_video_storage_path}</p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Upload className="w-3 h-3" /> Se sanitiza el nombre y se almacena de forma privada.
              </p>
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={uploadingVideo}>
                {uploadingVideo && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEntry ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

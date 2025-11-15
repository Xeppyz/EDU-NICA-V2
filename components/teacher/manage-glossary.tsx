"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Volume2, Video, Search } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface GlossaryEntry {
  id: string
  term: string
  definition: string
  audio_url: string | null
  lsn_video_url: string | null
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
  const [formData, setFormData] = useState({ term: "", definition: "", audio_url: "", lsn_video_url: "" })
  const [error, setError] = useState("")

  useEffect(() => {
    loadGlossary()
  }, [classId])

  const loadGlossary = async () => {
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

      if (editingEntry) {
        const resp = await supabase
          .from("glossary")
          .update({
            term: formData.term,
            definition: formData.definition,
            audio_url: formData.audio_url || null,
            lsn_video_url: formData.lsn_video_url || null,
          })
          .eq("id", editingEntry.id)

        console.debug("update glossary response:", resp)
        if (resp.error) throw resp.error
        setEntries(entries.map((e) => (e.id === editingEntry.id ? { ...e, ...formData } : e)))
      } else {
        const resp = await supabase
          .from("glossary")
          .insert([
            {
              class_id: classId,
              term: formData.term,
              definition: formData.definition,
              audio_url: formData.audio_url || null,
              lsn_video_url: formData.lsn_video_url || null,
            },
          ])
          .select()

        console.debug("insert glossary response:", resp)
        if (resp.error) throw resp.error
        setEntries([...entries, resp.data ? resp.data[0] : ({} as GlossaryEntry)])
      }

      setShowDialog(false)
      setEditingEntry(null)
      setFormData({ term: "", definition: "", audio_url: "", lsn_video_url: "" })
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
      })
    } else {
      setEditingEntry(null)
      setFormData({ term: "", definition: "", audio_url: "", lsn_video_url: "" })
    }
    setShowDialog(true)
  }

  const filteredEntries = entries.filter(
    (e) =>
      e.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
                <div className="flex gap-2 flex-wrap">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
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

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editingEntry ? "Actualizar" : "Crear"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

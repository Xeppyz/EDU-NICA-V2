export const EVALUATION_TYPE_LABELS: Record<string, string> = {
    quiz: "Cuestionario",
    fill_blank: "Completar espacios",
    matching: "Emparejar",
    dragdrop: "Arrastrar y soltar",
}

export function getEvaluationTypeLabel(type?: string | null) {
    if (!type) return "Evaluación"
    return EVALUATION_TYPE_LABELS[type] || type.replace(/_/g, " ")
}

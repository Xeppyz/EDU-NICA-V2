export const CHALLENGE_TYPE_LABELS: Record<string, string> = {
    multiple_choice: "Selección múltiple",
    fill_blank: "Completar espacios",
    select_image: "Seleccionar imagen",
    matching: "Emparejar columnas",
    open_ended: "Respuesta abierta",
    sign_practice: "Práctica de señas",
}

export function getChallengeTypeLabel(type?: string | null) {
    if (!type) return "Desafío"
    return CHALLENGE_TYPE_LABELS[type] || type.replace(/_/g, " ")
}

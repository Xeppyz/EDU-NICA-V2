// Demo users for testing purposes
export const demoUsers = [
  {
    id: "teacher-001",
    email: "docente@demo.com",
    password: "demo123456",
    fullName: "María González",
    role: "teacher" as const,
  },
  {
    id: "student-001",
    email: "alumno@demo.com",
    password: "demo123456",
    fullName: "Juan Pérez",
    role: "student" as const,
  },
  {
    id: "student-002",
    email: "estudiante@demo.com",
    password: "demo123456",
    fullName: "Ana López",
    role: "student" as const,
  },
]

export interface DemoUser {
  id: string
  email: string
  password: string
  fullName: string
  role: "teacher" | "student"
}

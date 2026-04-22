export type TeamRole = "Copy" | "Designer" | "Content_Specialist" | "Analyst_Seo" | "Implementador";
export type WorkType = "feedback" | "nuevos" | "recurrentes" | "tickets";

export interface TeamMember {
  id: string;
  person_name: string;
  person_email: string;
  role: TeamRole;
  daily_capacity_min: number;
  vacation_start: string | null;
  vacation_end: string | null;
  trabajo_actual: WorkType;
}

export const TEAM_DATA: TeamMember[] = [
  { id: "1",  person_name: "Juliana Montero",        person_email: "juliana.montero@plinng.com",   role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "feedback" },
  { id: "2",  person_name: "Valentina Gil",          person_email: "Valentina.gil@plinng.com",     role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "feedback" },
  { id: "3",  person_name: "Julian Salazar",         person_email: "julian.salazar@plinng.com",    role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "feedback" },
  { id: "4",  person_name: "Maria del mar hernandez",person_email: "maria.hernandez@plinng.com",   role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "feedback" },
  { id: "5",  person_name: "Angie Ramos",            person_email: "angie.ramos@plinng.com",       role: "Copy",               daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "nuevos" },
  { id: "6",  person_name: "Ximena Mendez",          person_email: "ximena.mendez@orbidi.com",     role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "nuevos" },
  { id: "7",  person_name: "Jhon Vega",              person_email: "Jhon.vega@plinng.com",         role: "Analyst_Seo",        daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "nuevos" },
  { id: "8",  person_name: "Danna Doncel",           person_email: "Danna.doncel@plinng.com",      role: "Content_Specialist", daily_capacity_min: 510, vacation_start: "2026-04-23", vacation_end: "2026-04-23", trabajo_actual: "recurrentes" },
  { id: "9",  person_name: "Juan Franco",            person_email: "juan.franco@plinng.com",       role: "Analyst_Seo",        daily_capacity_min: 510, vacation_start: "2026-04-06", vacation_end: "2026-04-06", trabajo_actual: "recurrentes" },
  { id: "10", person_name: "Angie Ocampo",           person_email: "Angie.ocampo@plinng.com",      role: "Content_Specialist", daily_capacity_min: 510, vacation_start: "2026-04-06", vacation_end: "2026-04-17", trabajo_actual: "recurrentes" },
  { id: "11", person_name: "Maria Martinez",         person_email: "maria.martinez@plinng.com",    role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "recurrentes" },
  { id: "12", person_name: "Fernando Pedraza",       person_email: "fernando.pedraza@plinng.com",  role: "Analyst_Seo",        daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "recurrentes" },
  { id: "13", person_name: "Jorge Quintero",         person_email: "jorge.quintero@plinng.com",    role: "Copy",               daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "tickets" },
  { id: "14", person_name: "Mateo Cruz",             person_email: "mateo.cruz@plinng.com",        role: "Implementador",      daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "tickets" },
  { id: "15", person_name: "Alison De Pablos",      person_email: "alison.depablos@plinng.com",   role: "Content_Specialist", daily_capacity_min: 510, vacation_start: null,         vacation_end: null,         trabajo_actual: "feedback" },
];

export const roleConfig: Record<TeamRole, { label: string; color: string; bg: string }> = {
  Copy:               { label: "Copy",               color: "text-violet-700", bg: "bg-violet-100 border-violet-200" },
  Designer:           { label: "Designer",           color: "text-pink-700",   bg: "bg-pink-100 border-pink-200" },
  Content_Specialist: { label: "Content Specialist", color: "text-blue-700",   bg: "bg-blue-100 border-blue-200" },
  Analyst_Seo:        { label: "Analyst SEO",        color: "text-teal-700",   bg: "bg-teal-100 border-teal-200" },
  Implementador:      { label: "Implementador",      color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
};

export const workConfig: Record<WorkType, { label: string; color: string; dot: string }> = {
  feedback:    { label: "Feedback",    color: "bg-purple-50 text-purple-700 border-purple-200",  dot: "bg-purple-500" },
  nuevos:      { label: "Nuevos",      color: "bg-lime-50 text-lime-700 border-lime-200",        dot: "bg-lime-500" },
  recurrentes: { label: "Recurrentes", color: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  tickets:     { label: "Tickets",     color: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
};

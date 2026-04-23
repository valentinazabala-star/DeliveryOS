/** Management accounts allowed to sign in (shared with server auth). */
export const MANAGEMENT_USERS = [
  { id: "mgmt-1", name: "Valentina Zabala",   email: "valentina.zabala@orqestra.com",  title: "Principal PM" },
  { id: "mgmt-2", name: "Carlos Orquesta",    email: "admin@orqestra.com",              title: "Operations Lead" },
  { id: "mgmt-3", name: "Valentina Bejarano", email: "valentina.bejarano@orqestra.com", title: "PM" },
  { id: "mgmt-4", name: "Matias Gencarelli",  email: "matias.gencarelli@orqestra.com",  title: "PM" },
] as const;

import { ACCOUNT_UUIDS } from "./accountUuids";

// Accounts confirmed to have a completed brief (checked via /api/brief-status, April 2026)
export const ACCOUNTS_WITH_BRIEF = new Set<string>([
  "f1c4855b-6f1c-46e0-bbe6-e20469a5cd31","ef9fdad5-b2a7-47a8-9670-0d3afd9becde",
  "ee171955-e566-4935-801d-44d97ba34f41","edd0cae7-57ea-42cf-a8d1-b6bd7d6c401e",
  "e9681695-623f-45f9-a0d3-b657325a43d3","e7ecc5e1-bd6f-49c3-a116-214df313a5e4",
  "de89f410-5e2b-452b-b40e-07462441f090","dc5aa235-55b4-4c3c-969b-4b41cc166e2e",
  "db9d409d-92ab-4fa6-8a74-139714acd943","d635373d-5789-489f-a2b9-0e37f8ac93d7",
  "ccc43536-ccfc-46cc-92a5-893a17aa5122","ccaa906d-4319-46d0-bf63-7b006bda14b2",
  "c74f8900-3abb-414e-9f1a-5757b74b5b6a","c54a15cb-0f09-4508-9c61-662b4f3cc466",
  "bf199e56-21f0-42a8-a3b3-5d0bbf29661a","befa186d-74ae-47fc-b737-707864693ce9",
  "bb673eb5-e335-4cb9-b682-acc45fabd34d","b92008e0-9a52-4924-93fd-75d3e9b685e0",
  "b4aed2cb-7afb-411c-b9f9-4ebfff59d2ba","a943fe31-6928-4fa5-a773-0e10dece2327",
  "a8d05c1a-5626-488b-84dd-ac051169cf86","a231753f-af3f-4805-b246-83ed2eb32478",
  "9eed79c2-7344-40ec-b7e6-34824a30d56a","94fc6483-d59e-4b03-8bb4-b8783c8d4d81",
  "930ff0d2-edbe-4175-8bb2-baa0b40474a1","8146582a-71e6-452e-8341-9316de558b95",
  "72a1e427-0499-4dda-87ca-f45b95282033","7164b855-18cd-4afd-94a0-ad3f2c5f99a5",
  "6c62b2be-ffa4-46b5-a2eb-310132bcb112","6c596e5c-a68f-4632-9c02-5965b861449e",
  "59d569c8-5bd2-4bf4-acd8-2560df219551","54d4fe95-5b81-422c-a499-e5c0f80df45b",
  "4b7b5dc9-a24a-49f3-b356-de89a537a16d","493d462b-c4a9-4ac4-afa2-6a54666f837d",
  "4377172f-714c-47de-acfc-4732615937ee","435c18a3-2514-46c8-9caf-e755450d3320",
  "3e81c2e7-aa98-4e06-9b90-0aef61080d67","3cfa2a1f-3103-4113-819f-6509dabd497b",
  "35b962b6-add7-410a-9073-044182738d1e","347f0026-0663-4b8e-b192-7ceee620fad3",
  "334ef86f-6a44-423d-864c-b1303008025d","1ace86be-06aa-4db5-a7c6-512019e2e152",
  "1999cf0b-58cd-48c7-9121-1439b5b01aac","146ecb10-6aea-401b-8659-7db571c19408",
  "0987c396-328c-4b11-b417-79905134d19e","086a1686-22e8-464f-93f6-4c52bf09fa14",
  "03ebd4cd-9a4f-4c5a-ad33-e8b60123fc60",
]);

export type SubscriptionName = "BASIC" | "EXISTIR" | "STARTER" | "ESENCIAL" | "PRO" | "AVANZADO" | "ELITE" | "TURBO";
export type SubscriptionStatus = "active" | "pending_cancelation" | "canceled";

export interface ClientRow {
  account_uuid: string;
  company_id: string;
  account_name: string;
  is_new_client: boolean;
  subscription_name: SubscriptionName;
  subscription_status: SubscriptionStatus;
  subscription_created_at: string;
  last_brief_completed_at: string | null;
}

const SUBSCRIPTION_NAMES: SubscriptionName[] = ["BASIC", "EXISTIR", "STARTER", "ESENCIAL", "PRO", "AVANZADO", "ELITE", "TURBO"];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["active", "active", "active", "pending_cancelation", "canceled"];

const COMPANY_NAMES = [
  "Panadería Central","Clínica Dental Sonrisa","Taller Mecánico López","Restaurante El Rincón","Gym Vital","Academia de Idiomas Oxford",
  "Ferretería San José","Estética Bella","Transporte Rápido","Consultoría Empresarial Pro","Peluquería Moderna","Construcciones García",
  "Farmacia Salud","Tienda de Ropa Moda","Cafetería Buenos Días","Arquitectura & Diseño","Clínica Fisio Plus","Autoescuela Segura",
  "Restaurante Fusion","Spa Relax","Notaría Central","Gestoría Fiscal","Floristería Primavera","Mudanzas Express",
  "Centro de Yoga Zen","Barbería Clásica","Pastelería Dulce Vida","Inmobiliaria Premium","Seguros Confianza","Tienda Tech Pro",
  "Catering Eventos","Podología Expert","Centro Médico Integral","Librería Cultural","Agencia Viajes Mundo",
  "Tintorería Rápida","Óptica Visión","Veterinaria Animal","Centro Infantil Alegría","Decoración Interior Design",
  "Fotografía Profesional","Asesoría Legal","Nutrición y Dieta","Escuela de Baile","Taller de Costura",
  "Fontanería 24h","Electricista Express","Cerrajería Segura","Lavandería Industrial","Mensajería City",
  "Bodega El Vino","Carnicería Premium","Frutería Natural","Supermercado Local","Papelería Office",
  "Zapatería Confort","Joyería Brillante","Relojería Precisa","Óptica Kids","Centro Audiología",
  "Psicología Clínica","Logopedia Habla","Acupuntura Bienestar","Homeopatía Natural","Quiromasaje Pro",
  "Estudio de Pilates","CrossFit Box","Pádel Club","Natación Aqua","Artes Marciales Dojo",
  "Música Academy","Teatro Studio","Pintura Art","Cerámica Taller","Fotografía Bodas",
  "Video Producción","Diseño Gráfico Studio","Marketing Digital Pro","SEO Experts","Social Media Agency",
  "Web Development Co","App Solutions","IT Support","Cloud Services","Cybersecurity Pro",
  "Contabilidad Digital","Recursos Humanos","Selección Talento","Formación Empresarial","Coaching Profesional",
  "Eventos Corporativos","Catering Premium","Alquiler Coches","Rent a Car","Taxi Ejecutivo",
  "Parking Center","Gasolinera 24h","Lavado Auto","Taller Chapa","Pintura Coches",
  "Neumáticos Express","Climatización Pro","Energía Solar","Instalaciones Gas","Reformas Integrales",
  "Pintura Interior","Carpintería Artesanal","Herrería Moderna","Cristalería Design","Persianas Plus",
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomDate(seed: number, startYear: number, endYear: number): string {
  const r = seededRandom(seed);
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  const date = new Date(start + r * (end - start));
  return date.toISOString().split("T")[0];
}

export const CLIENTS_DATA: ClientRow[] = ACCOUNT_UUIDS.map((uuid, i) => {
  const r1 = seededRandom(i * 7 + 1);
  const r2 = seededRandom(i * 7 + 2);
  const r3 = seededRandom(i * 7 + 3);
  const r4 = seededRandom(i * 7 + 4);
  const r5 = seededRandom(i * 7 + 5);

  const status = SUBSCRIPTION_STATUSES[Math.floor(r3 * SUBSCRIPTION_STATUSES.length)];
  const createdAt = randomDate(i * 13 + 1, 2024, 2026);
  const hasBrief = ACCOUNTS_WITH_BRIEF.has(uuid);

  return {
    account_uuid: uuid,
    company_id: `ORB-${String(1000 + i).padStart(5, "0")}`,
    account_name: COMPANY_NAMES[i % COMPANY_NAMES.length],
    is_new_client: r2 > 0.6,
    subscription_name: SUBSCRIPTION_NAMES[Math.floor(r1 * SUBSCRIPTION_NAMES.length)],
    subscription_status: status,
    subscription_created_at: createdAt,
    last_brief_completed_at: hasBrief ? randomDate(i * 13 + 2, 2024, 2026) : null,
  };
});

export type ProductCategory = "SEO" | "RRSS" | "WEB" | "GMB";

export interface TaskStandard {
  id: string;
  product_category: ProductCategory;
  product_name: string;
  clickup_task_name: string;
  time_minutes: number;
  content_specialist: boolean;
  implementador: boolean;
  analyst_seo: boolean;
}

export const TASK_STANDARDS: TaskStandard[] = [
  { id: "6", product_category: "SEO",  product_name: "Acciones SEO On-Page", clickup_task_name: "EST - Diagnóstico de páginas a intervenir",                  time_minutes: 30, content_specialist: false, implementador: false, analyst_seo: true  },
  { id: "4", product_category: "SEO",  product_name: "Acciones SEO On-Page", clickup_task_name: "IMP - Implementar textos on page",                           time_minutes: 10, content_specialist: false, implementador: true,  analyst_seo: false },
  { id: "2", product_category: "RRSS", product_name: "Reel de Instagram",    clickup_task_name: "CONTENT – Creación Reel",                                    time_minutes: 30, content_specialist: true,  implementador: false, analyst_seo: false },
  { id: "3", product_category: "WEB",  product_name: "SETUP",                clickup_task_name: "IMP - Configuración Correos · IMP - Configuración Inicial",  time_minutes: 15, content_specialist: false, implementador: true,  analyst_seo: false },
  { id: "5", product_category: "GMB",  product_name: "Post de Noticias",     clickup_task_name: "IMP - Implementar Post",                                     time_minutes: 10, content_specialist: false, implementador: true,  analyst_seo: false },
  { id: "7", product_category: "SEO",  product_name: "SEO en blog",          clickup_task_name: "IMP - Implementar articulos en blog",                        time_minutes: 10, content_specialist: false, implementador: true,  analyst_seo: false },
];

export const categoryColors: Record<ProductCategory, { bg: string; text: string; border: string; dot: string }> = {
  SEO:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500"   },
  RRSS: { bg: "bg-pink-50",   text: "text-pink-700",   border: "border-pink-200",   dot: "bg-pink-500"   },
  WEB:  { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   dot: "bg-teal-500"   },
  GMB:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-500"  },
};

export const roleColors: Record<string, string> = {
  content_specialist: "bg-blue-100 text-blue-700 border-blue-200",
  implementador:      "bg-orange-100 text-orange-700 border-orange-200",
  analyst_seo:        "bg-teal-100 text-teal-700 border-teal-200",
};

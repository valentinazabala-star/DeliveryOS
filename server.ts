import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Mock Data ---
  let tasks = [
    { id: "1", client_id: "c1", title: "Diseño Landing Page", status: "in_progress", priority: "high", complexity: 3, assigned_to: "u1" },
    { id: "2", client_id: "c1", title: "Configuración HubSpot", status: "ready", priority: "medium", complexity: 2, assigned_to: null },
    { id: "3", client_id: "c2", title: "Edición Video Promo", status: "blocked", priority: "high", complexity: 5, assigned_to: "u2", blocked_reason: "Falta material bruto" },
  ];

  let clients = [
    { id: "c1", name: "Acme Corp", status: "active", brief: "Empresa de tecnología B2B", drive_folder: "https://drive.google.com/..." },
    { id: "c2", name: "Global Logistics", status: "active", brief: "Logística internacional", drive_folder: "https://drive.google.com/..." },
  ];

  let users = [
    { id: "u1", name: "Valentina Zabala", role: "Specialist", wip_limit: 3, current_load: 1 },
    { id: "u2", name: "Carlos Ruiz", role: "Specialist", wip_limit: 2, current_load: 1 },
  ];

  // --- API Routes ---
  app.get("/api/tasks", (req, res) => res.json(tasks));
  app.get("/api/clients", (req, res) => res.json(clients));
  app.get("/api/users", (req, res) => res.json(users));

  app.post("/api/tasks", (req, res) => {
    const newTask = { ...req.body, id: Math.random().toString(36).substr(2, 9) };
    tasks.push(newTask);
    res.status(201).json(newTask);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    tasks = tasks.map(t => t.id === id ? { ...t, ...req.body } : t);
    res.json(tasks.find(t => t.id === id));
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpsOS Server running on http://localhost:${PORT}`);
  });
}

startServer();

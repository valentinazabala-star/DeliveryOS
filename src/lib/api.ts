import { Task, Client, User } from "../types";

const API_BASE = "/api";

export const api = {
  tasks: {
    list: async (): Promise<Task[]> => {
      const res = await fetch(`${API_BASE}/tasks`);
      return res.json();
    },
    create: async (task: Partial<Task>): Promise<Task> => {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      return res.json();
    },
    update: async (id: string, updates: Partial<Task>): Promise<Task> => {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      return res.json();
    },
  },
  clients: {
    list: async (): Promise<Client[]> => {
      const res = await fetch(`${API_BASE}/clients`);
      return res.json();
    },
  },
  users: {
    list: async (): Promise<User[]> => {
      const res = await fetch(`${API_BASE}/users`);
      return res.json();
    },
  },
};

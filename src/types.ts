import type { TeamMember } from "./data/teamData";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "management" | "production";
  teamMember?: TeamMember;
  title?: string;
}

export type TaskStatus = 'por_asignar' | 'ready' | 'in_progress' | 'review' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  complexity: number;
  assigned_to: string | null;
  blocked_reason?: string;
  blocked_at?: string;
  created_at: string;
  // Orbidi fields
  task_state?: string;
  task_group?: string | null;
  assigned_team?: string;
  clickup_id?: string;
  render_url?: string | null;
  release_date?: string;
  is_blocked?: boolean;
  deliverables?: any[];
}

export interface Client {
  id: string;
  name: string;
  status: 'active' | 'at_risk' | 'inactive';
  brief: string;
  drive_folder?: string;
  hubspot_id?: string;
  access_info?: Record<string, string>;
  materials?: Material[];
}

export interface Material {
  id: string;
  client_id: string;
  url: string;
  type: string;
  used_in_tasks: string[];
}

export interface User {
  id: string;
  name: string;
  role: string;
  wip_limit: number;
  current_load: number;
}

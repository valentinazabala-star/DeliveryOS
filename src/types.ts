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
  used_in_tasks: string[]; // IDs of tasks where it was used
}

export interface User {
  id: string;
  name: string;
  role: string;
  wip_limit: number;
  current_load: number;
}

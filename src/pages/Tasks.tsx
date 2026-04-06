import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, CheckCircle, Clock, Activity, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task, Client, User, TaskStatus, Priority } from "@/types";

const statusConfig: Record<TaskStatus, { label: string, color: string, icon: any }> = {
  por_asignar: { label: "Por Asignar", color: "bg-muted text-muted-foreground border-border", icon: Clock },
  ready: { label: "Ready", color: "bg-[#BEFF50]/10 text-[#BEFF50] border-[#BEFF50]/30", icon: CheckCircle },
  in_progress: { label: "In Progress", color: "bg-[#60259F]/10 text-[#60259F] border-[#60259F]/30", icon: Activity },
  review: { label: "Review", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Activity },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  done: { label: "Done", color: "bg-[#BEFF50] text-black border-[#BEFF50]", icon: CheckCircle },
};

const priorityConfig: Record<Priority, { label: string, color: string }> = {
  low: { label: "Low", color: "text-muted-foreground" },
  medium: { label: "Medium", color: "text-blue-600" },
  high: { label: "High", color: "text-[#BEFF50]" },
  critical: { label: "Critical", color: "text-red-600" },
};

export function Tasks() {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: api.tasks.list });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["clients"], queryFn: api.clients.list });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["users"], queryFn: api.users.list });

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks & Deliverables</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage operational flow and output.</p>
        </div>
        <Button className="bg-[#BEFF50] hover:bg-[#BEFF50]/90 text-black font-bold gap-2">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </header>

      <div className="border border-border rounded-lg bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Task ID</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Title</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Client</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Priority</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono text-center">Weight</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Assigned To</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const status = statusConfig[task.status] || statusConfig.por_asignar;
              const priority = priorityConfig[task.priority] || priorityConfig.medium;
              const client = clients.find(c => c.id === task.client_id);
              const user = users.find(u => u.id === task.assigned_to);

              return (
                <TableRow key={task.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-[10px] text-muted-foreground">#{task.id.substring(0, 4)}</TableCell>
                  <TableCell className="font-medium text-sm">{task.title}</TableCell>
                  <TableCell>
                    {client ? (
                      <Link to={`/clients/${client.id}`} className="text-xs text-muted-foreground hover:text-[#BEFF50] transition-colors underline-offset-4 hover:underline">
                        {client.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] font-mono uppercase gap-1.5", status.color)}>
                      <status.icon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-xs font-medium", priority.color)}>{priority.label}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono text-muted-foreground">{task.complexity}</span>
                  </TableCell>
                  <TableCell>
                    {user ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-mono text-muted-foreground border border-border">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs text-foreground">{user.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertCircle, CheckCircle, Clock, Users, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task, User, Client } from "@/types";

export function Dashboard() {
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: api.tasks.list });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["users"], queryFn: api.users.list });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["clients"], queryFn: api.clients.list });

  const stats = [
    { label: "Tasks Closed Today", value: tasks.filter(t => t.status === 'done').length, icon: CheckCircle, color: "text-green-500" },
    { label: "In Progress (WIP)", value: tasks.filter(t => t.status === 'in_progress').length, icon: Activity, color: "text-blue-500" },
    { label: "Blocked", value: tasks.filter(t => t.status === 'blocked').length, icon: AlertCircle, color: "text-red-500" },
    { label: "Avg. Complexity", value: (tasks.reduce((acc, t) => acc + t.complexity, 0) / (tasks.length || 1)).toFixed(1), icon: Clock, color: "text-zinc-400" },
  ];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Operational Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">Real-time throughput and capacity monitoring.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-muted border-border text-muted-foreground font-mono text-[10px]">
            LAST SYNC: {new Date().toLocaleTimeString()}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> +12% from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-[#BEFF50]" /> Team Capacity & WIP
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div key={user.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground border border-border">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{user.current_load}/{user.wip_limit} WIP</span>
                      </div>
                      <Progress value={(user.current_load / user.wip_limit) * 100} className="h-1.5 bg-muted" />
                    </div>
                    <Badge className={cn(
                      "text-[10px] font-mono uppercase",
                      user.current_load < user.wip_limit ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                    )}>
                      {user.current_load < user.wip_limit ? "Available" : "At Capacity"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" /> Critical Blockers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {tasks.filter(t => t.status === 'blocked').map((task) => (
                  <div key={task.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors">
                    <div className="mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-medium">{task.title}</h4>
                        <Link to={`/clients/${task.client_id}`}>
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground hover:text-[#BEFF50] hover:border-[#BEFF50]/50 transition-colors">
                            {clients.find(c => c.id === task.client_id)?.name}
                          </Badge>
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 italic">"{task.blocked_reason}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-mono uppercase tracking-widest">Accounts at Risk</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {clients.filter(c => c.status === 'at_risk').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 italic">No accounts currently at risk.</p>
              ) : (
                clients.filter(c => c.status === 'at_risk').map(client => (
                  <div key={client.id} className="flex items-center justify-between">
                    <Link to={`/clients/${client.id}`} className="text-sm hover:text-[#BEFF50] transition-colors underline-offset-4 hover:underline">
                      {client.name}
                    </Link>
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">High Risk</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-[#BEFF50]/10 border-b border-[#BEFF50]/20 p-4">
              <CardTitle className="text-xs font-mono uppercase tracking-widest text-[#BEFF50]">Auto-Assignment Log</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-[11px] font-mono space-y-2">
              <div className="text-muted-foreground">
                <span className="text-muted-foreground/60">[12:04:12]</span> Assignment Agent: User <span className="text-foreground font-bold">VZ</span> is free.
              </div>
              <div className="text-muted-foreground">
                <span className="text-muted-foreground/60">[12:04:13]</span> Assignment Agent: Scanning backlog for <span className="text-foreground font-bold">Ready</span> tasks.
              </div>
              <div className="text-muted-foreground">
                <span className="text-muted-foreground/60">[12:04:15]</span> Assignment Agent: Task <span className="text-foreground font-bold">#821</span> assigned to <span className="text-foreground font-bold">VZ</span>.
              </div>
              <div className="text-muted-foreground">
                <span className="text-muted-foreground/60">[12:10:01]</span> Blocker Agent: Task <span className="text-foreground font-bold">#3</span> marked as <span className="text-red-500">Blocked</span>.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Folder, FileText, Activity, ShieldCheck, MoreHorizontal, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Client } from "@/types";

export function Clients() {
  const { id } = useParams();
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["clients"], queryFn: api.clients.list });

  const filteredClients = id ? clients.filter(c => c.id === id) : clients;
  const isSingleView = !!id;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {isSingleView && (
            <Link to="/clients">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {isSingleView ? `Client: ${filteredClients[0]?.name || 'Loading...'}` : 'Client 360'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isSingleView ? 'Detailed operational context and assets.' : 'Consolidated operational profiles and assets.'}
            </p>
          </div>
        </div>
        {!isSingleView && (
          <Button className="bg-[#BEFF50] hover:bg-[#BEFF50]/90 text-black font-bold gap-2">
            <Plus className="w-4 h-4" /> New Client
          </Button>
        )}
      </header>

      <div className={cn(
        "grid gap-6",
        isSingleView ? "max-w-2xl" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {filteredClients.map((client) => (
          <Card key={client.id} className="bg-card border-border hover:border-muted-foreground/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-lg font-bold">{client.name}</CardTitle>
              <Badge className={cn(
                "text-[10px] font-mono uppercase",
                client.status === 'active' ? "bg-[#BEFF50]/20 text-[#BEFF50] border-[#BEFF50]/50" : "bg-red-100 text-red-700 border-red-200"
              )}>
                {client.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground line-clamp-2 italic">"{client.brief}"</p>
              
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="bg-background border-border text-muted-foreground hover:text-foreground text-[10px] font-mono uppercase tracking-tighter gap-2">
                  <Folder className="w-3 h-3" /> Drive
                </Button>
                <Button variant="outline" size="sm" className="bg-background border-border text-muted-foreground hover:text-foreground text-[10px] font-mono uppercase tracking-tighter gap-2">
                  <Activity className="w-3 h-3" /> HubSpot
                </Button>
                <Button variant="outline" size="sm" className="bg-background border-border text-muted-foreground hover:text-foreground text-[10px] font-mono uppercase tracking-tighter gap-2">
                  <ShieldCheck className="w-3 h-3" /> Access
                </Button>
                <Button variant="outline" size="sm" className="bg-background border-border text-muted-foreground hover:text-foreground text-[10px] font-mono uppercase tracking-tighter gap-2">
                  <FileText className="w-3 h-3" /> Materials
                </Button>
              </div>

              <div className="pt-4 border-t border-border flex justify-between items-center">
                <div className="flex -space-x-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-mono text-muted-foreground">
                      U{i}
                    </div>
                  ))}
                </div>
                {!isSingleView && (
                  <Link to={`/clients/${client.id}`}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#BEFF50] text-[10px] uppercase font-mono tracking-widest gap-1">
                      View Profile <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

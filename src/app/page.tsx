"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { DashboardStats, InvoiceGrid, Invoice } from "@/components/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, RefreshCw } from "lucide-react";

const POLL_INTERVAL = 5000;

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
        setLastRefresh(new Date());
      }
    } catch {
      console.error("Failed to fetch invoices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchInvoices();
    }
    pollIntervalRef.current = setInterval(fetchInvoices, POLL_INTERVAL);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchInvoices]);

  const handleSync = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/sync`, { method: "POST" });
      if (res.ok) {
        await fetchInvoices();
      }
    } catch {
      console.error("Sync failed");
    }
  };

  const handleRemind = (id: string) => {
    console.log("Remind invoice:", id);
    alert("Reminder flow - placeholder");
  };

  const handleViewPayLink = (url: string) => {
    window.open(url, "_blank");
  };

  const handleApproveComplete = useCallback(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">InvoicePilot</h1>
              <p className="text-xs text-muted-foreground">AI Invoice Agent</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Sandbox</Badge>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex">
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          <aside className="lg:w-96 flex-shrink-0 flex flex-col">
            <ChatPanel className="h-full flex flex-col" onApproveComplete={handleApproveComplete} />
          </aside>

          <section className="flex-1 min-w-0 flex flex-col" aria-label="Dashboard">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    <CardTitle className="text-lg">Dashboard</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastRefresh && (
                      <span className="text-xs text-muted-foreground">
                        Updated {lastRefresh.toLocaleTimeString()}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={isLoading}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <DashboardStats invoices={invoices} />
                <Separator className="my-4" />
                <InvoiceGrid
                  invoices={invoices}
                  onSync={handleSync}
                  onRemind={handleRemind}
                  onViewPayLink={handleViewPayLink}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
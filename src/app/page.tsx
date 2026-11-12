"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, BarChart2, ClipboardList, Settings } from "lucide-react";

export default function Home() {
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
            <ChatPanel className="h-full flex flex-col" />
          </aside>

          <section className="flex-1 min-w-0 flex flex-col" aria-label="Dashboard">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Dashboard</CardTitle>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-4 p-8">
                    <div className="p-4 bg-muted rounded-full w-fit mx-auto">
                      <LayoutDashboard className="h-12 w-12" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Dashboard Placeholder</h3>
                      <p className="text-sm mt-1">AG Grid invoice table, charts, and activity log will appear here</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                      <button className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors" disabled>
                        <ClipboardList className="h-5 w-5 mb-1" />
                        <div className="text-xs font-medium">Invoices</div>
                        <div className="text-xs text-muted-foreground">0 total</div>
                      </button>
                      <button className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors" disabled>
                        <BarChart2 className="h-5 w-5 mb-1" />
                        <div className="text-xs font-medium">Revenue</div>
                        <div className="text-xs text-muted-foreground">$0.00</div>
                      </button>
                      <button className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors" disabled>
                        <Settings className="h-5 w-5 mb-1" />
                        <div className="text-xs font-medium">Settings</div>
                        <div className="text-xs text-muted-foreground">Configure</div>
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, ColDef, CellClassParams, ValueFormatterParams, ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Clock, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { InvoiceStatus } from "@/lib/db";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface Invoice {
  id: string;
  paypalInvoiceId: string | null;
  invoiceNumber: string;
  clientId: string;
  amount: { toString: () => string };
  currency: string;
  status: InvoiceStatus;
  dueDate: string | Date;
  payLink: string | null;
  note: string | null;
  createdAt: string | Date;
  paidAt: string | Date | null;
  client: { id: string; name: string; email: string; avgDaysLate: number } | null;
  lineItems: Array<{ description: string; quantity: number; unitPrice: { toString: () => string } }>;
  reminders?: Array<{ id: string; createdAt: string | Date; status: string }>;
}

interface DashboardStatsProps {
  invoices: Invoice[];
}

export function DashboardStats({ invoices }: DashboardStatsProps) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalOutstanding = invoices
    .filter((inv) => inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.OVERDUE)
    .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);

  const overdueAmount = invoices
    .filter((inv) => inv.status === InvoiceStatus.OVERDUE)
    .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);

  const paidThisMonth = invoices
    .filter((inv) => inv.status === InvoiceStatus.PAID && inv.paidAt && new Date(inv.paidAt) >= startOfMonth)
    .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);

  const avgDaysLate = invoices
    .filter((inv) => inv.client?.avgDaysLate != null)
    .reduce((sum, inv) => sum + (inv.client?.avgDaysLate || 0), 0) /
    Math.max(1, invoices.filter((inv) => inv.client?.avgDaysLate != null).length);

  const stats = [
    { label: "Total Outstanding", value: `$${totalOutstanding.toFixed(2)}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Overdue Amount", value: `$${overdueAmount.toFixed(2)}`, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    { label: "Paid This Month", value: `$${paidThisMonth.toFixed(2)}`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Avg Days Late", value: `${avgDaysLate.toFixed(1)} days`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className={stat.bg}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const variants: Record<InvoiceStatus, string> = {
    [InvoiceStatus.DRAFT]: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    [InvoiceStatus.SENT]: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    [InvoiceStatus.PAID]: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    [InvoiceStatus.OVERDUE]: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    [InvoiceStatus.CANCELLED]: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    [InvoiceStatus.REFUNDED]: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };
  return <Badge variant="secondary" className={variants[status] || variants[InvoiceStatus.DRAFT]}>{status}</Badge>;
}

function CurrencyCell({ value }: ValueFormatterParams) {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function DaysOverdueCell({ data }: { data: Invoice }) {
  if (data.status !== InvoiceStatus.OVERDUE && data.status !== InvoiceStatus.SENT) return "";
  const due = new Date(data.dueDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? `${diff} days` : "";
}

function LastReminderCell({ data }: { data: Invoice }) {
  const reminders = data.reminders;
  if (!reminders || reminders.length === 0) return "—";
  const latest = reminders
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return new Date(latest.createdAt).toLocaleDateString();
}

interface ActionsCellProps {
  data: Invoice;
  onSync: (id: string) => Promise<void>;
  onRemind: (id: string) => void;
  onViewPayLink: (url: string) => void;
  isLoading: boolean;
}

function ActionsCell({ data, onSync, onRemind, onViewPayLink, isLoading }: ActionsCellProps) {
  return (
    <div className="flex items-center gap-1">
      {data.payLink && (
        <Button variant="ghost" size="sm" onClick={() => onViewPayLink(data.payLink!)} aria-label="View pay link" title="View pay link">
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => onSync(data.id)} disabled={isLoading} aria-label="Sync with PayPal" title="Sync">
        <RefreshCw className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onRemind(data.id)} disabled={isLoading} aria-label="Send reminder" title="Remind">
        <AlertTriangle className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface InvoiceGridProps {
  invoices: Invoice[];
  onSync: (id: string) => Promise<void>;
  onRemind: (id: string) => void;
  onViewPayLink: (url: string) => void;
  isLoading?: boolean;
}

export function InvoiceGrid({ invoices, onSync, onRemind, onViewPayLink, isLoading = false }: InvoiceGridProps) {
  const colDefs = useMemo<ColDef<Invoice>[]>(() => [
    { field: "invoiceNumber", headerName: "Invoice #", minWidth: 140, filter: "agTextColumnFilter" },
    { field: "client.name", headerName: "Client", minWidth: 150, filter: "agTextColumnFilter" },
    { field: "amount", headerName: "Amount", minWidth: 120, filter: "agNumberColumnFilter", valueFormatter: CurrencyCell },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      filter: "agSetColumnFilter",
      cellRenderer: (params: ICellRendererParams) => <StatusBadge status={params.value} />,
      cellClass: (params: CellClassParams) => {
        const status = params.value as InvoiceStatus;
        return `status-${status.toLowerCase()}`;
      },
    },
    { field: "dueDate", headerName: "Due Date", minWidth: 120, filter: "agDateColumnFilter", valueFormatter: (p) => new Date(p.value).toLocaleDateString() },
    { headerName: "Days Overdue", minWidth: 120, cellRenderer: DaysOverdueCell },
    { headerName: "Last Reminder", minWidth: 130, cellRenderer: LastReminderCell },
    {
      headerName: "Actions",
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => (
        <ActionsCell
          data={params.data}
          onSync={onSync}
          onRemind={onRemind}
          onViewPayLink={onViewPayLink}
          isLoading={isLoading}
        />
      ),
    },
  ], [onSync, onRemind, onViewPayLink, isLoading]);

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  };

  return (
    <div className="ag-theme-quartz h-[calc(100%-8rem)] min-h-[400px] w-full rounded-lg border" style={{ fontSize: "13px" }}>
      <AgGridReact<Invoice>
        rowData={invoices}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        pagination={true}
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50]}
        rowSelection="single"
        animateRows={true}
        getRowId={(params) => params.data.id}
        rowHeight={44}
        headerHeight={40}
        overlayNoRowsTemplate={
          `<div class="text-center py-12 text-muted-foreground">
            <svg class="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <p class="text-lg">No invoices yet</p>
            <p class="text-sm mt-1">Create your first invoice from the chat panel</p>
          </div>`
        }
        overlayLoadingTemplate={
          `<div class="text-center py-12 text-muted-foreground">
            <svg class="h-8 w-8 mx-auto mb-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p>Loading invoices...</p>
          </div>`
        }
      />
    </div>
  );
}
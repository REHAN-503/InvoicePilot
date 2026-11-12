"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, X, Edit2, Save, DollarSign, Calendar, Mail, User, Trash2 } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceProposal {
  clientName: string;
  clientEmail?: string;
  items: InvoiceItem[];
  currency: string;
  dueInDays: number;
  note?: string;
}

interface ApprovalCardProps {
  proposal: InvoiceProposal;
  onApprove: (proposal: InvoiceProposal) => void;
  onDismiss: () => void;
  onEdit: (proposal: InvoiceProposal) => void;
  isLoading: boolean;
  isEditing?: boolean;
  onSave?: (proposal: InvoiceProposal) => void;
  onCancel?: () => void;
}

export function ApprovalCard({
  proposal,
  onApprove,
  onDismiss,
  onEdit,
  isLoading,
  isEditing = false,
  onSave,
  onCancel,
}: ApprovalCardProps) {
  const [editedProposal, setEditedProposal] = useState<InvoiceProposal>(proposal);
  const [items, setItems] = useState<InvoiceItem[]>(proposal.items);

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + editedProposal.dueInDays);

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (isEditing) {
    return (
      <Card className="mt-3 border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Edit Invoice Proposal</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={() => onSave?.(editedProposal)} disabled={isLoading}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <Input
                value={editedProposal.clientName}
                onChange={(e) => setEditedProposal((p) => ({ ...p, clientName: e.target.value }))}
                placeholder="Client name"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Email</label>
              <Input
                type="email"
                value={editedProposal.clientEmail ?? ""}
                onChange={(e) => setEditedProposal((p) => ({ ...p, clientEmail: e.target.value }))}
                placeholder="client@example.com"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <Input
                value={editedProposal.currency}
                onChange={(e) => setEditedProposal((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                maxLength={3}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due in (days)</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={editedProposal.dueInDays}
                onChange={(e) => setEditedProposal((p) => ({ ...p, dueInDays: parseInt(e.target.value) || 1 }))}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <Textarea
              value={editedProposal.note ?? ""}
              onChange={(e) => setEditedProposal((p) => ({ ...p, note: e.target.value }))}
              placeholder="Optional note"
              rows={2}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Line Items</h4>
              <Button variant="outline" size="sm" onClick={addItem} disabled={isLoading}>
                <span className="h-4 w-4">+</span> Add Item
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, "description", e.target.value)}
                  className="flex-1 min-w-0"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                  className="w-20"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  className="w-24"
                  disabled={isLoading}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={isLoading || items.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <p className="text-lg font-semibold">
              Total: <span className="text-primary">{editedProposal.currency} {total.toFixed(2)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-3">
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{proposal.clientName}</span>
              {proposal.clientEmail && (
                <>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">({proposal.clientEmail})</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due: {dueDate.toLocaleDateString()} ({proposal.dueInDays} days)</span>
              <Separator className="h-4 mx-1" />
              <DollarSign className="h-4 w-4" />
              <span>{proposal.currency}</span>
            </div>
            {proposal.note && (
              <p className="text-sm text-muted-foreground italic">&ldquo;{proposal.note}&rdquo;</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onEdit(proposal)} disabled={isLoading}>
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDismiss} disabled={isLoading}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <h4 className="font-medium mb-2">Line Items</h4>
          <div className="space-y-2">
            {proposal.items.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} &times; {proposal.currency} {item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium whitespace-nowrap text-right">
                  {proposal.currency} {(item.quantity * item.unitPrice).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-3 border-t font-semibold text-lg">
            Total: {proposal.currency} {total.toFixed(2)}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => onApprove(proposal)} disabled={isLoading}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve & Send
          </Button>
          <Button variant="outline" className="flex-1" onClick={onDismiss} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
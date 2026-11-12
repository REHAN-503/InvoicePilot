"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { ApprovalCard } from "./ApprovalCard";
import { toast } from "sonner";

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

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; type: "question" }
  | { role: "assistant"; content: string; type: "proposal"; proposal: InvoiceProposal };

interface ChatPanelProps {
  className?: string;
}

export function ChatPanel({ className = "" }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showProposal, setShowProposal] = useState<InvoiceProposal | null>(null);
  const [editingProposal, setEditingProposal] = useState<InvoiceProposal | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showProposal, editingProposal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMessage }),
      });
      const data = await res.json();

      if (data.type === "proposal") {
        setMessages((prev) => [...prev, { role: "assistant", content: "Here's your invoice proposal:", type: "proposal", proposal: data.proposal }]);
        setShowProposal(data.proposal);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.question, type: "question" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error parsing request. Please try again.", type: "question" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (proposal: InvoiceProposal) => {
    setIsLoading(true);
    setEditingProposal(null);
    try {
      const res = await fetch("/api/invoices/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      const data = await res.json();

      if (data.id || data.invoiceId || data.invoiceNumber) {
        const payLink = data.payLink || data.invoice?.payLink;
        const invoiceId = data.invoiceId || data.id || data.invoice?.id;
        const invoiceNumber = data.invoiceNumber || data.invoice?.invoiceNumber;

        toast.success("Invoice sent!", {
          description: payLink ? "Pay link ready" : `Invoice ${invoiceNumber || invoiceId} created`,
          action: payLink ? {
            label: "Open Pay Link",
            onClick: () => window.open(payLink, "_blank"),
          } : undefined,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Invoice created and sent! ${payLink ? "Pay link available." : `ID: ${invoiceId || invoiceNumber}`}`,
            type: "proposal",
            proposal,
          },
        ]);
        setShowProposal(null);
      } else {
        toast.error("Failed to send invoice", {
          description: data.error || "Unknown error",
        });
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}`, type: "question" }]);
      }
    } catch {
      toast.error("Error creating invoice");
      setMessages((prev) => [...prev, { role: "assistant", content: "Error creating invoice.", type: "question" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowProposal(null);
    setEditingProposal(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "Proposal dismissed. Let me know if you'd like to try again.", type: "question" }]);
  };

  const handleEdit = (proposal: InvoiceProposal) => {
    setEditingProposal({ ...proposal });
  };

  const handleSaveEdit = (updatedProposal: InvoiceProposal) => {
    setEditingProposal(null);
    setShowProposal(updatedProposal);
    setMessages((prev) => [
      ...prev.filter((_, idx) => idx !== prev.length - 1),
      { role: "assistant", content: "Here's your updated invoice proposal:", type: "proposal", proposal: updatedProposal },
    ]);
  };

  const handleCancelEdit = () => {
    setEditingProposal(null);
  };

  const isProposalMessage = (msg: Message): msg is Message & { type: "proposal"; proposal: InvoiceProposal } => {
    return msg.role === "assistant" && msg.type === "proposal";
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">Describe an invoice in plain English</p>
            <p className="text-sm mt-1">Example: Bill Acme Corp $1,200 for logo design, due in 15 days</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-card text-card-foreground rounded-bl-none border"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {isProposalMessage(msg) && !editingProposal && (
                <ApprovalCard
                  proposal={msg.proposal}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                  onEdit={handleEdit}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        ))}
        {editingProposal && (
          <ApprovalCard
            proposal={editingProposal}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
            onEdit={handleEdit}
            isLoading={isLoading}
            isEditing
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        )}
        {isLoading && !editingProposal && (
          <div className="flex justify-start">
            <div className="bg-card text-card-foreground px-4 py-2 rounded-2xl rounded-bl-none border flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t pt-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the invoice... (e.g., Bill Acme $1,200 for logo work, due in 15 days)"
            className="flex-1 min-h-[50px] max-h-[150px] resize-none"
            rows={1}
            disabled={isLoading || !!editingProposal}
            aria-label="Invoice description"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading || !!editingProposal}
            className="h-[50px] self-end"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
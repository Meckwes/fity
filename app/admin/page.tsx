"use client";

import { useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  DollarSign,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  MessageCircle,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
} from "lucide-react";

// =================================================================
// FITY — Admin Panel (/admin)
// =================================================================
// Dashboard simples pra acompanhar:
// - Leads (form da landing page)
// - Clientes (pagamentos confirmados via webhook)
// - Conversas recentes
// - Receita total e do mes
//
// Sem auth por enquanto (MVP). Em prod a gente bota password.
// =================================================================

type Lead = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  goal: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  current_plan: string | null;
  subscription_status: string | null;
  last_payment_amount: number | null;
  last_payment_at: string | null;
  subscribed_at: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: any;
};

type Stats = {
  totalLeads: number;
  totalCustomers: number;
  activeSubs: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  currency: string;
};

type Tab = "leads" | "customers" | "conversations";

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("customers");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/dashboard");
      const data = await r.json();
      if (data.ok) {
        setLeads(data.leads);
        setCustomers(data.customers);
        setConversations(data.conversations);
        setStats(data.stats);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Erro ao carregar admin:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (s: string) => {
    if (!s) return "-";
    return new Date(s).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const planLabel = (id: string | null) => {
    if (!id) return "-";
    const map: Record<string, string> = {
      essencial: "Essencial",
      pro: "Pro",
      coach: "Coach",
    };
    return map[id] || id;
  };

  const planColor = (id: string | null) => {
    if (!id) return "bg-slate-100 text-slate-600";
    if (id === "pro") return "bg-green-100 text-green-700";
    if (id === "coach") return "bg-purple-100 text-purple-700";
    if (id === "essencial") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-white font-extrabold">
              F
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Fity Admin</h1>
              <p className="text-xs text-slate-500">
                {lastUpdate
                  ? `Atualizado ${formatDate(lastUpdate.toISOString())}`
                  : "Carregando..."}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<UserPlus size={20} className="text-blue-600" />}
            label="Leads (landing)"
            value={stats?.totalLeads ?? "-"}
            color="blue"
          />
          <StatCard
            icon={<Users size={20} className="text-green-600" />}
            label="Clientes"
            value={stats?.totalCustomers ?? "-"}
            sub={stats ? `${stats.activeSubs} ativos` : undefined}
            color="green"
          />
          <StatCard
            icon={<DollarSign size={20} className="text-emerald-600" />}
            label="Receita total"
            value={stats ? formatBRL(stats.totalRevenue) : "-"}
            color="emerald"
          />
          <StatCard
            icon={<TrendingUp size={20} className="text-purple-600" />}
            label="Receita do mês"
            value={stats ? formatBRL(stats.thisMonthRevenue) : "-"}
            color="purple"
          />
        </div>

        {/* TABS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200">
            <TabButton
              active={tab === "customers"}
              onClick={() => setTab("customers")}
              icon={<Users size={16} />}
              label="Clientes"
              badge={customers.length}
            />
            <TabButton
              active={tab === "leads"}
              onClick={() => setTab("leads")}
              icon={<UserPlus size={16} />}
              label="Leads"
              badge={leads.length}
            />
            <TabButton
              active={tab === "conversations"}
              onClick={() => setTab("conversations")}
              icon={<MessageCircle size={16} />}
              label="Conversas"
              badge={conversations.length}
            />
          </div>

          {/* CONTENT */}
          <div className="p-0">
            {tab === "customers" && (
              <CustomersTable
                customers={customers}
                loading={loading}
                formatBRL={formatBRL}
                formatDate={formatDate}
                planLabel={planLabel}
                planColor={planColor}
              />
            )}
            {tab === "leads" && (
              <LeadsTable
                leads={leads}
                loading={loading}
                formatDate={formatDate}
              />
            )}
            {tab === "conversations" && (
              <ConversationsList
                conversations={conversations}
                customers={customers}
                loading={loading}
                formatDate={formatDate}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ================================================================
// COMPONENTES
// ================================================================

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: "blue" | "green" | "emerald" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50",
    green: "bg-green-50",
    emerald: "bg-emerald-50",
    purple: "bg-purple-50",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-green-600 font-semibold mt-1">{sub}</div>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition border-b-2 ${
        active
          ? "border-green-600 text-green-700 bg-green-50/30"
          : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function CustomersTable({
  customers,
  loading,
  formatBRL,
  formatDate,
  planLabel,
  planColor,
}: {
  customers: Customer[];
  loading: boolean;
  formatBRL: (n: number) => string;
  formatDate: (s: string) => string;
  planLabel: (id: string | null) => string;
  planColor: (id: string | null) => string;
}) {
  if (loading) return <EmptyState message="Carregando..." />;
  if (customers.length === 0)
    return <EmptyState message="Nenhum cliente ainda. Vai ter venda na primeira integração completa." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3 text-left">Nome</th>
            <th className="px-5 py-3 text-left">Email</th>
            <th className="px-5 py-3 text-left">Telefone</th>
            <th className="px-5 py-3 text-left">Plano</th>
            <th className="px-5 py-3 text-left">Status</th>
            <th className="px-5 py-3 text-right">Último pgto</th>
            <th className="px-5 py-3 text-right">Pago em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 transition">
              <td className="px-5 py-3 font-semibold text-slate-900">
                {c.name || "-"}
              </td>
              <td className="px-5 py-3 text-slate-600 text-xs">{c.email}</td>
              <td className="px-5 py-3 text-slate-600 text-xs">
                {c.phone || "-"}
              </td>
              <td className="px-5 py-3">
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${planColor(c.current_plan)}`}>
                  {planLabel(c.current_plan)}
                </span>
              </td>
              <td className="px-5 py-3">
                {c.subscription_status === "active" ? (
                  <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                    <CheckCircle2 size={12} /> Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                    <Clock size={12} /> {c.subscription_status || "inativo"}
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">
                {c.last_payment_amount ? formatBRL(c.last_payment_amount) : "-"}
              </td>
              <td className="px-5 py-3 text-right text-xs text-slate-500">
                {formatDate(c.last_payment_at || c.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTable({
  leads,
  loading,
  formatDate,
}: {
  leads: Lead[];
  loading: boolean;
  formatDate: (s: string) => string;
}) {
  if (loading) return <EmptyState message="Carregando..." />;
  if (leads.length === 0)
    return <EmptyState message="Nenhum lead ainda. Captura vem da landing page." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3 text-left">Nome</th>
            <th className="px-5 py-3 text-left">Email</th>
            <th className="px-5 py-3 text-left">WhatsApp</th>
            <th className="px-5 py-3 text-left">Objetivo</th>
            <th className="px-5 py-3 text-right">Capturado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50 transition">
              <td className="px-5 py-3 font-semibold text-slate-900">
                {l.name}
              </td>
              <td className="px-5 py-3 text-slate-600 text-xs">{l.email}</td>
              <td className="px-5 py-3 text-slate-600 text-xs">
                <a
                  href={`https://wa.me/${(l.whatsapp || "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-700 hover:underline"
                >
                  {l.whatsapp}
                </a>
              </td>
              <td className="px-5 py-3 text-slate-600 text-xs">
                {l.goal || "-"}
              </td>
              <td className="px-5 py-3 text-right text-xs text-slate-500">
                {formatDate(l.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationsList({
  conversations,
  customers,
  loading,
  formatDate,
}: {
  conversations: Conversation[];
  customers: Customer[];
  loading: boolean;
  formatDate: (s: string) => string;
}) {
  if (loading) return <EmptyState message="Carregando..." />;
  if (conversations.length === 0)
    return <EmptyState message="Nenhuma conversa ainda. O bot registra conforme interage com o user." />;

  const userMap = new Map(customers.map((c) => [c.id, c]));

  return (
    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
      {conversations.map((c) => {
        const user = userMap.get(c.user_id);
        const roleColor =
          c.role === "assistant" || c.role === "system"
            ? "bg-green-100 text-green-700"
            : "bg-blue-100 text-blue-700";
        return (
          <div key={c.id} className="p-4 hover:bg-slate-50">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${roleColor}`}
              >
                {c.role}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {user?.name || c.user_id.slice(0, 8)}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {formatDate(c.created_at)}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {c.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center text-sm text-slate-500">
      <Activity size={32} className="mx-auto text-slate-300 mb-3" />
      {message}
    </div>
  );
}

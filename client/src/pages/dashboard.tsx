import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ShoppingCart,
  Users,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { Order, Member, Party } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";

const summaryData = [
  { name: "Sep 07", orders: 4200, income: 3800 },
  { name: "Sep 08", orders: 5800, income: 4200 },
  { name: "Sep 09", orders: 4800, income: 5500 },
  { name: "Sep 10", orders: 7200, income: 4300 },
  { name: "Sep 11", orders: 6100, income: 5800 },
  { name: "Sep 12", orders: 5900, income: 7200 },
  { name: "Sep 13", orders: 6800, income: 6500 },
];

const KPI_GRADIENTS = [
  "bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-teal-50 dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-teal-950/30",
  "bg-gradient-to-br from-teal-50 via-cyan-50/50 to-emerald-50 dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-emerald-950/30",
  "bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-yellow-950/30",
  "bg-gradient-to-br from-violet-50 via-purple-50/50 to-fuchsia-50 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-fuchsia-950/30",
];

const KPI_ICON_BG = [
  "bg-emerald-100 dark:bg-emerald-900/50",
  "bg-teal-100 dark:bg-teal-900/50",
  "bg-amber-100 dark:bg-amber-900/50",
  "bg-violet-100 dark:bg-violet-900/50",
];

const KPI_ICON_COLOR = [
  "text-emerald-600 dark:text-emerald-400",
  "text-teal-600 dark:text-teal-400",
  "text-amber-600 dark:text-amber-400",
  "text-violet-600 dark:text-violet-400",
];

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusDot(status: string) {
  switch (status) {
    case "completed": return "bg-emerald-500";
    case "in_progress": return "bg-yellow-500";
    case "on_hold": return "bg-orange-500";
    case "cancelled": return "bg-red-500";
    default: return "bg-muted-foreground";
  }
}

function getStatusTextColor(status: string) {
  switch (status) {
    case "completed": return "text-emerald-600 dark:text-emerald-400";
    case "in_progress": return "text-yellow-600 dark:text-yellow-400";
    case "on_hold": return "text-orange-600 dark:text-orange-400";
    case "cancelled": return "text-red-600 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const { data: partiesData } = useQuery<unknown>({
    queryKey: ["/api/parties"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalOrders: number;
    completed: number;
    pending: number;
    teamsActive: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const isLoading = ordersLoading || statsLoading;

  const ordersList = Array.isArray(orders) ? orders : [];
  const membersList = Array.isArray(members) ? members : [];
  const partiesRaw = Array.isArray(partiesData) ? partiesData : (partiesData as { data?: { parties?: unknown[] }; parties?: unknown[] })?.data?.parties ?? (partiesData as { parties?: unknown[] })?.parties ?? [];
  const partiesList = (partiesRaw as Array<{ _id?: string; id?: string; partyName?: string; name?: string; type?: string; status?: string; isActive?: boolean }>).map((p) => ({
    id: p._id ?? p.id ?? "",
    name: p.partyName ?? p.name ?? "",
    type: p.type ?? "—",
    status: p.isActive === true ? "active" : p.isActive === false ? "inactive" : (p.status ?? "active"),
  }));
  const recentOrders = ordersList.slice(0, 5);
  const topMembers = membersList.slice(0, 4);
  const topParties = partiesList.filter((p) => p.status === "active").slice(0, 4);

  const kpiCards = [
    {
      label: "Total Orders",
      value: stats?.totalOrders ?? 0,
      change: "+14.9%",
      comparison: "(+43.21%)",
      positive: true,
      icon: ShoppingCart,
    },
    {
      label: "Active Members",
      value: membersList.filter((m) => m.status === "active").length || 0,
      change: "+8.6%",
      comparison: "",
      positive: true,
      icon: Users,
    },
    {
      label: "Completed",
      value: stats?.completed ?? 0,
      change: "+25.4%",
      comparison: "(+20.11%)",
      positive: true,
      icon: CheckCircle2,
    },
    {
      label: "Pending",
      value: stats?.pending ?? 0,
      change: "-3.2%",
      comparison: "",
      positive: false,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            Welcome Back, {user ? (user.name ?? user.email ?? user.username ?? "Admin") : "Admin"}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what happening with your workflow today</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="year">
            <SelectTrigger className="w-36" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">Previous Year</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="button-view-all-time">View All Time</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card key={kpi.label} className={`${KPI_GRADIENTS[i]} border-0`} data-testid={`card-stat-${kpi.label.toLowerCase().replace(/[\s.]+/g, "-")}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <div className={`rounded-lg p-2 ${KPI_ICON_BG[i]}`}>
                  <kpi.icon className={`h-4 w-4 ${KPI_ICON_COLOR[i]}`} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-20 mb-2" />
              ) : (
                <p className="text-2xl font-bold mb-2">{kpi.value}</p>
              )}
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {kpi.positive ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <TrendingUp className="h-3 w-3" /> {kpi.change}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-500 font-medium">
                    <TrendingDown className="h-3 w-3" /> {kpi.change}
                  </span>
                )}
                {kpi.comparison && <span className="text-muted-foreground">{kpi.comparison}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-semibold">Summary</CardTitle>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Order</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                <span className="text-muted-foreground">Income Growth</span>
              </div>
              <Select defaultValue="7">
                <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-chart-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summaryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152 69% 41%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(152 69% 41%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(173 58% 39%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(173 58% 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis className="text-xs" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${v / 1000}K` : v} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="hsl(152 69% 41%)" strokeWidth={2.5} fill="url(#orderGrad)" dot={false} activeDot={{ r: 5, fill: "hsl(152 69% 41%)" }} />
                  <Area type="monotone" dataKey="income" stroke="hsl(173 58% 39%)" strokeWidth={2.5} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 5, fill: "hsl(173 58% 39%)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
            <CardTitle className="text-base font-semibold">Top Active Parties</CardTitle>
            <Button variant="ghost" size="icon" data-testid="button-parties-more">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {topParties.length === 0 && isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))
            ) : (
              topParties.map((party) => (
                <div key={party.id} className="flex items-center gap-3" data-testid={`party-item-${party.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                      {party.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{party.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{party.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{party.type}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
            <Link href="/orders" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline" data-testid="link-view-all-orders">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order No</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Order ID</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-recent-order-${order.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="font-medium text-sm">{order.orderNo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{order.partyName}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">#{order.id.slice(0, 7)}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(order.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${getStatusDot(order.status)}`} />
                          <span className={`text-sm font-medium ${getStatusTextColor(order.status)}`}>{formatStatus(order.status)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
            <CardTitle className="text-base font-semibold">Top Members</CardTitle>
            <Button variant="ghost" size="icon" data-testid="button-members-more">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {topMembers.length === 0 && isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            ) : (
              topMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3" data-testid={`member-item-${member.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                      {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.team} - {member.role}</p>
                  </div>
                  <Link href="/members" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline">View</Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

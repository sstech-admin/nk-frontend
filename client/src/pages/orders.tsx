import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBadges } from "@/components/filter-badges";
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Package, Calendar, User, Hash, Eye, CheckCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import { getOrdersQueryPath, USE_REAL_API } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Order } from "@shared/schema";

const ORDERS_PAGE_SIZE = 12;

/** Backend API order list item (partial). */
interface ApiOrderItem {
  _id: string;
  workOrderNumber?: string;
  partyId?: { partyName?: string };
  status?: string;
  currentStage?: string;
  quantity?: number;
  orderDate?: string;
  createdAt?: string;
}

interface OrdersListResponse {
  orders: ApiOrderItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

/** Normalize API order to card Order shape. */
function normalizeOrder(api: ApiOrderItem): Order {
  const status = (api.status ?? "").toLowerCase().replace(/\s+/g, "_");
  return {
    id: api._id,
    orderNo: api.workOrderNumber ?? api._id,
    partyName: typeof api.partyId === "object" && api.partyId?.partyName != null ? api.partyId.partyName : "",
    status: status || "pending",
    stage: (api.currentStage ?? "").toLowerCase().replace(/\s+/g, "_") || "pending",
    quantity: api.quantity ?? 0,
    date: api.orderDate ?? api.createdAt ?? new Date().toISOString(),
  };
}

function ensureOrderArray(raw: unknown): Order[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    const first = raw[0] as Record<string, unknown>;
    if (first._id != null && (first.workOrderNumber != null || first.partyId != null))
      return raw.map((o: ApiOrderItem) => normalizeOrder(o));
    return raw as Order[];
  }
  if (raw && typeof raw === "object" && "orders" in raw) {
    const arr = (raw as { orders?: unknown }).orders;
    return Array.isArray(arr) ? (arr as ApiOrderItem[]).map(normalizeOrder) : [];
  }
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data?: unknown }).data;
    if (data && typeof data === "object" && "orders" in (data as object)) {
      const arr = (data as { orders: unknown }).orders;
      return Array.isArray(arr) ? (arr as ApiOrderItem[]).map(normalizeOrder) : [];
    }
  }
  return [];
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStage(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusClasses(status: string) {
  switch (status) {
    case "completed": return { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800" };
    case "in_progress": return { dot: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-800" };
    case "on_hold": return { dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800" };
    case "cancelled": return { dot: "bg-red-500", text: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800" };
    default: return { dot: "bg-muted-foreground", text: "text-muted-foreground bg-muted", border: "border-border" };
  }
}

function getStageBg(stage: string) {
  switch (stage) {
    case "cutting": return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    case "welding": return "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400";
    case "coating": return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400";
    case "assembly": return "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400";
    case "quality_check": return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400";
    case "dispatch": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function OrderCard({ order, onDelete }: { order: Order; onDelete: (id: string) => void }) {
  const sc = getStatusClasses(order.status);

  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-order-${order.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-order-no-${order.id}`}>
              {order.orderNo}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <User className="h-3 w-3" />
              <span className="truncate" data-testid={`text-party-${order.id}`}>{order.partyName}</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" data-testid={`button-actions-${order.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(order.id)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.text}`}>
          {order.status === "completed" ? (
            <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
          )}
          {formatStatus(order.status)}
        </span>
        {order.status !== "completed" && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStageBg(order.stage)}`}>
            {formatStage(order.stage)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Hash className="h-3 w-3" />
          <span>Qty: <span className="font-medium text-foreground" data-testid={`text-qty-${order.id}`}>{order.quantity}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          <span data-testid={`text-date-${order.id}`}>{new Date(order.date).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <Link href={`/orders/${order.id}`}>
          <Button variant="outline" size="sm" className="w-full text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" data-testid={`button-view-order-${order.id}`}>
            <Eye className="mr-2 h-3.5 w-3.5" />
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex justify-between border-t pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const hasDesignStage = Array.isArray(user?.allowedStages) && user.allowedStages.includes("DESIGN_PREPARATION");
  const canCreateOrder = isAdmin || hasDesignStage;

  const { data: listData, isLoading } = useQuery<OrdersListResponse | Order[]>({
    queryKey: ["orders-list", page, ORDERS_PAGE_SIZE, activeFilter, search],
    queryFn: async () => {
      if (USE_REAL_API) {
        const path = getOrdersQueryPath({
          page,
          limit: ORDERS_PAGE_SIZE,
          search: search || undefined,
          status: activeFilter === "all" ? undefined : activeFilter,
          sortBy: "createdAt",
          order: "desc",
        });
        const res = await apiRequest("GET", path);
        const json = await res.json();
        if (!json?.success || !json?.data) throw new Error(json?.message ?? "Failed to fetch orders");
        const d = json.data as OrdersListResponse;
        return {
          orders: Array.isArray(d.orders) ? d.orders : [],
          total: d.total ?? 0,
          page: d.page ?? 1,
          totalPages: d.totalPages ?? 1,
          limit: d.limit ?? ORDERS_PAGE_SIZE,
        };
      }
      const res = await apiRequest("GET", "/api/orders");
      const json = await res.json();
      const raw = json?.data ?? json;
      const ordersArray = ensureOrderArray(raw);
      return {
        orders: ordersArray,
        total: ordersArray.length,
        page: 1,
        totalPages: 1,
        limit: ordersArray.length,
      };
    },
  });

  const ordersFromApi = useMemo((): Order[] => {
    if (!listData) return [];
    if (Array.isArray(listData)) return ensureOrderArray(listData);
    if (!Array.isArray(listData.orders)) return [];
    return listData.orders.map((o: ApiOrderItem | Order) =>
      "_id" in o && o._id != null ? normalizeOrder(o as ApiOrderItem) : (o as Order)
    );
  }, [listData]);

  const filteredOrders = useMemo(() => {
    if (USE_REAL_API) return ordersFromApi;
    return ordersFromApi
      .filter((o) => activeFilter === "all" || o.status === activeFilter)
      .filter((o) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (o.orderNo ?? "").toLowerCase().includes(q) ||
          (o.partyName ?? "").toLowerCase().includes(q) ||
          (o.stage ?? "").toLowerCase().includes(q)
        );
      });
  }, [ordersFromApi, activeFilter, search]);

  const totalOrders = USE_REAL_API && listData && !Array.isArray(listData)
    ? listData.total
    : filteredOrders.length;
  const totalPages = USE_REAL_API && listData && !Array.isArray(listData)
    ? Math.max(1, listData.totalPages)
    : Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const paginatedOrders = useMemo(
    () =>
      USE_REAL_API
        ? filteredOrders
        : filteredOrders.slice((page - 1) * ORDERS_PAGE_SIZE, page * ORDERS_PAGE_SIZE),
    [USE_REAL_API, filteredOrders, page]
  );

  useEffect(() => setPage(1), [activeFilter, search]);

  const ordersForCounts = ordersFromApi;
  const statusCounts = {
    all: ordersForCounts.length,
    in_progress: ordersForCounts.filter((o) => (o.status ?? "").toLowerCase() === "in_progress").length,
    completed: ordersForCounts.filter((o) => (o.status ?? "").toLowerCase() === "completed").length,
    on_hold: ordersForCounts.filter((o) => (o.status ?? "").toLowerCase() === "on_hold").length,
    cancelled: ordersForCounts.filter((o) => (o.status ?? "").toLowerCase() === "cancelled").length,
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Order deleted" });
    },
  });

  const filterBadges = [
    { label: "All", value: "all", count: statusCounts.all },
    { label: "In Progress", value: "in_progress", count: statusCounts.in_progress },
    { label: "Completed", value: "completed", count: statusCounts.completed },
    { label: "On Hold", value: "on_hold", count: statusCounts.on_hold },
    { label: "Cancelled", value: "cancelled", count: statusCounts.cancelled },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track all orders</p>
        </div>
        {canCreateOrder && (
          <Link href="/orders/create">
            <Button data-testid="button-add-order">
              <Plus className="mr-2 h-4 w-4" /> Add Order
            </Button>
          </Link>
        )}
      </div>

      <FilterBadges filters={filterBadges} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-orders"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No orders found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Try adjusting your search or filters" : "Get started by creating your first order"}
          </p>
          {!search && canCreateOrder && (
            <Link href="/orders/create">
              <Button className="mt-4" data-testid="button-add-order-empty">
                <Plus className="mr-2 h-4 w-4" /> Add Order
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-orders">
          {paginatedOrders.map((order) => (
            <OrderCard key={order.id} order={order} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      {!isLoading && (filteredOrders.length > 0 || totalOrders > 0) && (
        <ListPagination
          currentPage={listData && !Array.isArray(listData) ? listData.page : page}
          totalPages={totalPages}
          total={totalOrders}
          pageSize={ORDERS_PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="orders"
          testIdPrefix="orders"
        />
      )}
    </div>
  );
}

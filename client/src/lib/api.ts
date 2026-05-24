/**
 * API configuration for backend calls.
 * When BACKEND_API_URL is set in .env, the app uses the real backend API.
 * Otherwise, it falls back to the in-memory mock store.
 */

const rawUrl = import.meta.env.BACKEND_API_URL;
const baseUrl = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim().replace(/\/$/, "") : "";

/** Base URL for the backend API. Empty = use mock or dev proxy. */
export const API_BASE_URL = baseUrl;

/** Whether to call the real backend API. */
export const USE_REAL_API = API_BASE_URL.length > 0;

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

/**
 * API setup status for validation.
 */
export type ApiSetupStatus = {
  configured: boolean;
  useMock: boolean;
  baseUrl: string;
  reachable: boolean | null;
  error?: string;
};

let _cachedStatus: ApiSetupStatus | null = null;

/**
 * Validate API setup: checks if BACKEND_API_URL is set and if the backend is reachable.
 * Use this to verify proper configuration before calling the API.
 */
export async function validateApiSetup(): Promise<ApiSetupStatus> {
  const base = {
    configured: USE_REAL_API,
    useMock: !USE_REAL_API,
    baseUrl: API_BASE_URL,
    reachable: null as boolean | null,
  };

  if (!USE_REAL_API) {
    _cachedStatus = { ...base, reachable: false };
    return _cachedStatus;
  }

  try {
    const res = await fetch(apiUrl("/api/orders"), {
      method: "GET",
      credentials: "include",
      signal: AbortSignal.timeout(5000),
    });
    _cachedStatus = { ...base, reachable: res.ok };
    return _cachedStatus;
  } catch (err) {
    _cachedStatus = {
      ...base,
      reachable: false,
      error: err instanceof Error ? err.message : "Network error",
    };
    return _cachedStatus;
  }
}

/**
 * Get last cached API setup status (call validateApiSetup() first to populate).
 */
export function getApiSetupStatus(): ApiSetupStatus | null {
  return _cachedStatus ?? (USE_REAL_API ? null : { configured: false, useMock: true, baseUrl: "", reachable: false });
}

// --- Orders API ---

export function getOrdersQueryPath(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  currentStage?: string;
  partyId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  order?: string;
}): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.search != null) p.set("search", params.search);
  if (params.status != null) p.set("status", params.status);
  if (params.currentStage != null) p.set("currentStage", params.currentStage);
  if (params.partyId != null && params.partyId !== "") p.set("partyId", params.partyId);
  if (params.fromDate != null) p.set("fromDate", params.fromDate);
  if (params.toDate != null) p.set("toDate", params.toDate);
  if (params.sortBy != null) p.set("sortBy", params.sortBy);
  if (params.order != null) p.set("order", params.order);
  const q = p.toString();
  return `/api/orders${q ? `?${q}` : ""}`;
}

export function getOrderByIdPath(
  orderId: string,
  options?: { includePanels?: boolean },
): string {
  const p = new URLSearchParams();
  if (options?.includePanels) p.set("includePanels", "true");
  const q = p.toString();
  return `/api/orders/${orderId}${q ? `?${q}` : ""}`;
}

export function getOrderPanelsPath(
  orderId: string,
  params?: { panelStatus?: string; currentStage?: string },
): string {
  const p = new URLSearchParams();
  if (params?.panelStatus) p.set("panelStatus", params.panelStatus);
  if (params?.currentStage) p.set("currentStage", params.currentStage);
  const q = p.toString();
  return `/api/orders/${orderId}/panels${q ? `?${q}` : ""}`;
}

export function getPanelByIdPath(orderId: string, panelId: string): string {
  return `/api/orders/${orderId}/panels/${panelId}`;
}

export function getPanelStageUpdatePath(
  orderId: string,
  panelId: string,
  stageName: string,
): string {
  return `/api/orders/${orderId}/panels/${panelId}/stage/${encodeURIComponent(stageName)}`;
}

export function getPanelStageEditPath(
  orderId: string,
  panelId: string,
  stageName: string,
): string {
  return `/api/orders/${orderId}/panels/${panelId}/stage/${encodeURIComponent(stageName)}/edit`;
}

export function getPanelBulkStageUpdatePath(orderId: string, stageName: string): string {
  return `/api/orders/${orderId}/panels/bulk/stage/${encodeURIComponent(stageName)}`;
}

export function getPanelBulkStageEditPath(orderId: string, stageName: string): string {
  return `/api/orders/${orderId}/panels/bulk/stage/${encodeURIComponent(stageName)}/edit`;
}

export function getOrderDispatchesPath(orderId: string): string {
  return `/api/orders/${orderId}/dispatches`;
}

export function getDispatchByIdPath(orderId: string, dispatchId: string): string {
  return `/api/orders/${orderId}/dispatches/${dispatchId}`;
}

/** Allocate next work order number (call once when create form opens). */
export const ALLOCATE_WORK_ORDER_NUMBER_PATH = "/api/orders/work-order-number/next";

export async function allocateWorkOrderNumber(): Promise<string> {
  const { apiRequest } = await import("./queryClient");
  const res = await apiRequest("POST", ALLOCATE_WORK_ORDER_NUMBER_PATH);
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { workOrderNumber?: string };
  };
  const wo = json?.data?.workOrderNumber;
  if (!json?.success || typeof wo !== "string" || !wo.trim()) {
    throw new Error(json?.message ?? "Failed to allocate work order number");
  }
  return wo.trim();
}

export function getOrderStageUpdatePath(orderId: string, stageName: string): string {
  return `/api/orders/${orderId}/stage/${encodeURIComponent(stageName)}`;
}

/** PATCH stage data only — does not advance workflow */
export function getOrderStageEditPath(orderId: string, stageName: string): string {
  return `/api/orders/${orderId}/stage/${encodeURIComponent(stageName)}/edit`;
}

// --- Teams API (paths / query strings for use with apiRequest) ---

export function getTeamsQueryPath(params: { page?: number; limit?: number; isActive?: boolean }): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.isActive != null) p.set("isActive", String(params.isActive));
  const q = p.toString();
  return `/api/teams${q ? `?${q}` : ""}`;
}

export function getTeamByIdPath(teamId: string): string {
  return `/api/teams/${teamId}`;
}

export function updateTeamStatusPath(teamId: string): string {
  return `/api/teams/${teamId}/status`;
}

// --- Users API ---

export function getUsersQueryPath(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  role?: string;
}): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.search != null) p.set("search", params.search);
  if (params.isActive != null) p.set("isActive", String(params.isActive));
  if (params.role != null) p.set("role", params.role);
  const q = p.toString();
  return `/api/users${q ? `?${q}` : ""}`;
}

export function getUserByIdPath(userId: string): string {
  return `/api/users/${userId}`;
}

// --- Members API ---

export function getMembersQueryPath(params: {
  page?: number;
  limit?: number;
  teamId?: string;
  isActive?: boolean;
}): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.teamId != null && params.teamId !== "") p.set("teamId", params.teamId);
  if (params.isActive != null) p.set("isActive", String(params.isActive));
  const q = p.toString();
  return `/api/members${q ? `?${q}` : ""}`;
}

export function getMemberByIdPath(memberId: string): string {
  return `/api/members/${memberId}`;
}

export function updateMemberStatusPath(memberId: string): string {
  return `/api/members/${memberId}/status`;
}

// --- Parties API ---

export function getPartiesQueryPath(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.search != null) p.set("search", params.search);
  if (params.isActive != null) p.set("isActive", String(params.isActive));
  const q = p.toString();
  return `/api/parties${q ? `?${q}` : ""}`;
}

export function getPartyByIdPath(partyId: string): string {
  return `/api/parties/${partyId}`;
}

// --- Powder Coatings API (plants / parties) ---

export function getPowderCoatingsQueryPath(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.search != null) p.set("search", params.search);
  if (params.isActive != null) p.set("isActive", String(params.isActive));
  const q = p.toString();
  return `/api/powder-coatings${q ? `?${q}` : ""}`;
}

export function getPowderCoatingByIdPath(id: string): string {
  return `/api/powder-coatings/${id}`;
}

export function updatePowderCoatingStatusPath(id: string): string {
  return `/api/powder-coatings/${id}/status`;
}

import type { Order } from "@shared/schema";
import { enrichDesignStageDataFromApi } from "@/lib/design-stage-form";
import type {
  DispatchRecord,
  OrderDetailExtended,
  PanelRecord,
  PanelSummary,
  PoReference,
} from "@/lib/order-types";
import { statusOkFromStageData } from "@/lib/order-stages";
import { normalizeApiStageName } from "@/lib/order-workflow";

export interface ApiOrderDetail {
  _id?: string;
  id?: string;
  workOrderNumber?: string;
  orderNo?: string;
  partyId?: { partyName?: string };
  partyName?: string;
  status?: string;
  currentStage?: string;
  stage?: string;
  panelType?: string;
  quantity?: number;
  dispatchedQuantity?: number;
  descriptionSize?: string;
  description?: string;
  partsCount?: number;
  parts?: string;
  designerId?: { name?: string };
  preparedBy?: { name?: string };
  designerName?: string;
  orderDate?: string;
  createdAt?: string;
  date?: string;
  coatingType?: string;
  powderCoatingType?: string;
  pricing?: { ratePerKg?: number; includingAccessories?: boolean; extraCharges?: number };
  rate?: string;
  rateType?: string;
  poNumber?: string;
  poNo?: string;
  poReferences?: PoReference[];
  invoiceRef?: string;
  remarks?: string;
  panelName?: string;
  customerWoNo?: string;
  colorDetails?: { body?: string; mountingPlate?: string; baseStand?: string };
  colorBody?: string;
  colorMountingPlate?: string;
  colorBaseStand?: string;
  accessories?: {
    pointLock?: boolean;
    threePointLock?: boolean;
    puGasketing?: boolean;
    pattiGasketing?: boolean;
    other?: string;
  } | string[];
  accessoriesOther?: string;
  panelSummary?: PanelSummary;
  panels?: ApiPanelRaw[];
  stages?: Array<{
    name?: string;
    stageStatus?: string;
    data?: Record<string, unknown>;
    startedAt?: string | null;
    completedAt?: string | null;
    remarks?: string;
  }>;
}

interface ApiPanelRaw {
  _id?: string;
  id?: string;
  panelNo?: number;
  serialLabel?: string;
  currentStage?: string;
  panelStatus?: string;
  stages?: ApiOrderDetail["stages"];
  dispatchId?: string;
  dispatchedAt?: string;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
}

export function apiStageNameToKey(name: string | undefined | null): string | null {
  if (!name) return null;
  const norm = String(name).toLowerCase().replace(/\s+/g, "_");
  if (norm === "design_preparation") return "design_preparation";
  if (norm === "sheet_processing") return "sheet_processing";
  if (norm === "fabrication" || norm === "powder_coating") return "fabrication";
  if (norm === "dispatch_validation" || norm === "dispatch" || norm === "assembly_dispatch")
    return "dispatch_validation";
  return null;
}

export function normalizeStageData(
  raw: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    out[snakeToCamel(k)] = v;
  }
  const qcRaw = out.status ?? out.sheetStatus;
  if (out.statusOk === undefined && qcRaw != null && qcRaw !== "") {
    out.statusOk = statusOkFromStageData({ status: qcRaw });
  } else if (typeof out.status === "string" && out.statusOk === undefined) {
    out.statusOk = statusOkFromStageData(out as Record<string, unknown>);
  }
  enrichDesignStageDataFromApi(out);
  return out;
}

function normalizePanel(raw: ApiPanelRaw): PanelRecord {
  const stagesMap: Record<string, Record<string, unknown>> = {};
  if (Array.isArray(raw.stages)) {
    for (const s of raw.stages) {
      const key = apiStageNameToKey(s?.name);
      if (!key) continue;
      stagesMap[key] = { ...(stagesMap[key] ?? {}), ...normalizeStageData(s?.data) };
    }
  }
  return {
    id: String(raw._id ?? raw.id ?? ""),
    panelNo: Number(raw.panelNo) || 0,
    serialLabel: raw.serialLabel,
    currentStage: raw.currentStage ?? "SHEET_PROCESSING",
    panelStatus: raw.panelStatus ?? "ON_HOLD",
    stages: raw.stages,
    stagesMap,
    dispatchId: raw.dispatchId,
    dispatchedAt: raw.dispatchedAt,
  };
}

function buildPanelSummaryFromPanels(panels: PanelRecord[], quantity: number): PanelSummary {
  const summary: PanelSummary = {
    total: quantity,
    dispatched: 0,
    readyToDispatch: 0,
    inProgress: 0,
    onHold: 0,
    byStage: {},
    byStatus: {},
  };
  for (const p of panels) {
    const ps = String(p.panelStatus).toUpperCase();
    const st = String(p.currentStage).toUpperCase();
    summary.byStatus![ps] = (summary.byStatus![ps] ?? 0) + 1;
    summary.byStage![st] = (summary.byStage![st] ?? 0) + 1;
    if (ps === "DISPATCHED") summary.dispatched += 1;
    else if (ps === "READY_TO_DISPATCH") summary.readyToDispatch += 1;
    else if (ps === "ON_HOLD") summary.onHold += 1;
    else if (ps === "IN_PROGRESS") summary.inProgress += 1;
  }
  return summary;
}

export function normalizeOrderDetail(api: ApiOrderDetail): Order & OrderDetailExtended {
  const status = (api.status ?? "").toLowerCase().replace(/\s+/g, "_");
  const stage = (api.currentStage ?? api.stage ?? "").toLowerCase().replace(/\s+/g, "_");
  const rateTypeDisplay =
    api.rateType ??
    (api.pricing?.includingAccessories === true
      ? "Include Accessories"
      : api.pricing
        ? "Extra"
        : undefined);
  const accessoriesArray: string[] = [];
  const acc = api.accessories;
  if (acc && typeof acc === "object" && !Array.isArray(acc)) {
    if (acc.pointLock) accessoriesArray.push("point_lock");
    if (acc.threePointLock) accessoriesArray.push("3_point_lock");
    if (acc.puGasketing) accessoriesArray.push("pu_gasketing");
    if (acc.pattiGasketing) accessoriesArray.push("patti_gasketing");
  }
  const partyName =
    typeof api.partyId === "object" && api.partyId?.partyName != null
      ? api.partyId.partyName
      : api.partyName ?? "";

  const stagesMap: Record<string, Record<string, unknown>> = {};
  const stagesStatus: Record<string, string> = {};
  if (Array.isArray(api.stages)) {
    for (const s of api.stages) {
      const key = apiStageNameToKey(s?.name);
      if (!key) continue;
      const normalized = normalizeStageData(s?.data);
      stagesMap[key] = { ...(stagesMap[key] ?? {}), ...normalized };
      if (s?.stageStatus) stagesStatus[key] = String(s.stageStatus);
      if (s?.completedAt && !stagesMap[key].completedDate) {
        stagesMap[key].completedDate = String(s.completedAt).slice(0, 10);
      }
      if (s?.remarks && !stagesMap[key].remarks) stagesMap[key].remarks = s.remarks;
    }
  }

  const currentStageApi = normalizeApiStageName(api.currentStage ?? api.stage);
  const designCompleted =
    stagesStatus.design_preparation === "COMPLETED" ||
    stagesMap.design_preparation?.completedDate != null;

  let panels: PanelRecord[] = Array.isArray(api.panels)
    ? api.panels.map(normalizePanel).filter((p) => p.id)
    : [];

  const qty = api.quantity ?? panels.length ?? 0;
  let panelSummary = api.panelSummary;
  if (!panelSummary && panels.length > 0) {
    panelSummary = buildPanelSummaryFromPanels(panels, qty);
  } else if (panelSummary && panelSummary.total > 0 && panels.length === 0) {
    // panels may be loaded separately
  }

  const poReferences: PoReference[] = Array.isArray(api.poReferences)
    ? api.poReferences
    : api.poNumber || api.poNo
      ? [{ poNumber: api.poNumber ?? api.poNo ?? "" }]
      : [];

  return {
    id: api._id ?? api.id ?? "",
    orderNo: api.workOrderNumber ?? api.orderNo ?? api._id ?? api.id ?? "",
    partyName,
    status: status || "pending",
    stage: stage || "design_preparation",
    currentStageApi,
    quantity: qty,
    dispatchedQuantity: api.dispatchedQuantity ?? panelSummary?.dispatched ?? 0,
    date: api.orderDate ?? api.createdAt ?? api.date ?? new Date().toISOString(),
    panelType: api.panelType,
    description: api.descriptionSize ?? api.description,
    parts: api.partsCount != null ? String(api.partsCount) : api.parts,
    designerName: api.designerId?.name ?? api.preparedBy?.name ?? api.designerName,
    powderCoatingType: api.coatingType ?? api.powderCoatingType,
    rate: api.pricing?.ratePerKg != null ? String(api.pricing.ratePerKg) : api.rate,
    rateType: rateTypeDisplay,
    poNo: poReferences[0]?.poNumber ?? api.poNumber ?? api.poNo,
    poReferences,
    invoiceRef: api.invoiceRef,
    remarks: api.remarks,
    customerWoNo: api.panelName ?? api.customerWoNo,
    colorBody: api.colorDetails?.body ?? api.colorBody,
    colorMountingPlate: api.colorDetails?.mountingPlate ?? api.colorMountingPlate,
    colorBaseStand: api.colorDetails?.baseStand ?? api.colorBaseStand,
    accessories: accessoriesArray.length > 0 ? accessoriesArray : Array.isArray(acc) ? acc : undefined,
    accessoriesOther:
      (typeof acc === "object" && !Array.isArray(acc) ? acc?.other : undefined) ??
      api.accessoriesOther,
    accessoriesObj: typeof acc === "object" && !Array.isArray(acc) ? acc : undefined,
    stagesMap,
    stagesStatus,
    panelSummary,
    panels,
    designCompleted,
  } as Order & OrderDetailExtended;
}

/** PATCH panel stage responses return a panel document, not an order. */
export function isApiPanelPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const hasPanelFields =
    d.panelNo != null || d.panelStatus != null || d.serialLabel != null;
  const hasOrderFields =
    d.workOrderNumber != null ||
    (d.partyId != null && d.quantity != null && d.panelNo == null);
  return hasPanelFields && !hasOrderFields;
}

/** Panel-based orders need panels[] in cache; PATCH order responses often omit them. */
export function orderDetailNeedsRefetch(order: Order & OrderDetailExtended): boolean {
  const total = order.panelSummary?.total ?? 0;
  if (total <= 0) return false;
  return (order.panels?.length ?? 0) === 0;
}

export function applyOrderFromApiResponse(json: unknown): (Order & OrderDetailExtended) | null {
  const data = (json as { success?: boolean; data?: ApiOrderDetail })?.data;
  if (!data || isApiPanelPayload(data)) return null;
  return normalizeOrderDetail(data);
}

export function resolveOrderDetailCacheUpdate(json: unknown): {
  order: (Order & OrderDetailExtended) | null;
  shouldSetCache: boolean;
} {
  const order = applyOrderFromApiResponse(json);
  if (!order) return { order: null, shouldSetCache: false };
  if (orderDetailNeedsRefetch(order)) return { order, shouldSetCache: false };
  return { order, shouldSetCache: true };
}

export function normalizeDispatchList(raw: unknown): DispatchRecord[] {
  const arr = Array.isArray(raw)
    ? raw
    : (raw as { data?: unknown })?.data && Array.isArray((raw as { data: unknown[] }).data)
      ? (raw as { data: unknown[] }).data
      : (raw as { dispatches?: unknown[] })?.dispatches;
  if (!Array.isArray(arr)) return [];
  return arr.map((d) => {
    const row = d as Record<string, unknown>;
    return {
      id: String(row._id ?? row.id ?? ""),
      createdAt: row.createdAt as string | undefined,
      vehicleNumber: row.vehicleNumber as string | undefined,
      poReference: row.poReference as string | undefined,
      remarks: row.remarks as string | undefined,
      panelIds: row.panelIds as string[] | undefined,
      panelNumbers: row.panelNumbers as number[] | undefined,
      materials: row.materials as DispatchRecord["materials"],
    };
  });
}

/** NK Tech order / panel / dispatch API types (exact enum strings from backend). */

export type OrderStageApi =
  | "DESIGN_PREPARATION"
  | "SHEET_PROCESSING"
  | "FABRICATION"
  | "DISPATCH_VALIDATION";

export type OrderStatusApi =
  | "IN_PROGRESS"
  | "PARTIALLY_DISPATCHED"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";

export type PanelStatusApi =
  | "ON_HOLD"
  | "IN_PROGRESS"
  | "READY_TO_DISPATCH"
  | "DISPATCHED"
  | "CANCELLED";

export type PanelProductionStageApi =
  | "SHEET_PROCESSING"
  | "FABRICATION"
  | "DISPATCH_VALIDATION";

export interface PoReference {
  poNumber: string;
  quantity?: number;
  remarks?: string;
}

export interface PanelSummary {
  total: number;
  dispatched: number;
  readyToDispatch: number;
  inProgress: number;
  onHold: number;
  byStage?: Record<string, number>;
  byStatus?: Record<string, number>;
}

export interface PanelStageRecord {
  name?: string;
  stageStatus?: string;
  data?: Record<string, unknown>;
  completedAt?: string | null;
  remarks?: string;
}

export interface PanelRecord {
  id: string;
  panelNo: number;
  serialLabel?: string;
  currentStage: PanelProductionStageApi | string;
  panelStatus: PanelStatusApi | string;
  stages?: PanelStageRecord[];
  stagesMap?: Record<string, Record<string, unknown>>;
  dispatchId?: string;
  dispatchedAt?: string;
}

export interface DispatchMaterial {
  name: string;
  quantity?: number;
  checkedInDispatch?: boolean;
}

export interface DispatchRecord {
  id: string;
  createdAt?: string;
  vehicleNumber?: string;
  poReference?: string;
  remarks?: string;
  panelIds?: string[];
  panelNumbers?: number[];
  materials?: DispatchMaterial[];
}

/** Extended order shape used by order detail (alongside shared Order). */
export interface OrderDetailExtended {
  currentStageApi?: string;
  dispatchedQuantity?: number;
  poReferences?: PoReference[];
  invoiceRef?: string;
  panelSummary?: PanelSummary;
  panels?: PanelRecord[];
  designCompleted?: boolean;
}

export function isPanelBasedOrder(order: { panelSummary?: PanelSummary }): boolean {
  return (order.panelSummary?.total ?? 0) > 0;
}

export function panelProductionStageToTimelineKey(
  stage: string | undefined | null,
): string {
  const n = String(stage ?? "").toUpperCase().replace(/-/g, "_");
  if (n === "SHEET_PROCESSING") return "sheet_processing";
  if (n === "FABRICATION") return "fabrication";
  if (n === "DISPATCH_VALIDATION") return "dispatch_validation";
  return "sheet_processing";
}

export function timelineKeyToPanelProductionStage(
  key: string,
): PanelProductionStageApi {
  if (key === "fabrication") return "FABRICATION";
  if (key === "dispatch_validation") return "DISPATCH_VALIDATION";
  return "SHEET_PROCESSING";
}

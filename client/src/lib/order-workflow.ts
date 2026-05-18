/**
 * NK Tech 4-stage order workflow — aligns UI with backend stage PATCH rules.
 */
import { getOrderStageEditPath, getOrderStageUpdatePath } from "@/lib/api";
import {
  STAGE_SHEET_PROCESSING,
  isOrderOnSheetProcessingStage,
  type SheetSaveIntent,
  QC_NOT_OK,
  type SheetProcessingQcStatus,
} from "@/lib/order-stages";

export const ORDER_STAGE_API_NAMES = [
  "DESIGN_PREPARATION",
  "SHEET_PROCESSING",
  "FABRICATION",
  "DISPATCH_VALIDATION",
] as const;

export type OrderStageApiName = (typeof ORDER_STAGE_API_NAMES)[number];

export const TIMELINE_STAGE_KEYS = [
  "design_preparation",
  "sheet_processing",
  "fabrication",
  "dispatch_validation",
] as const;

export type TimelineStageKey = (typeof TIMELINE_STAGE_KEYS)[number];

export const STAGE_KEY_TO_API: Record<TimelineStageKey, OrderStageApiName> = {
  design_preparation: "DESIGN_PREPARATION",
  sheet_processing: "SHEET_PROCESSING",
  fabrication: "FABRICATION",
  dispatch_validation: "DISPATCH_VALIDATION",
};

export type StageSaveMode = "edit" | "complete";

export type TimelineStageUiState = "completed" | "current" | "pending" | "cancelled";

export function normalizeApiStageName(stage: string | undefined | null): string {
  return String(stage ?? "")
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

export function timelineKeyToApiStageName(stageKey: string): OrderStageApiName {
  const key = stageKey as TimelineStageKey;
  return STAGE_KEY_TO_API[key] ?? (normalizeApiStageName(stageKey) as OrderStageApiName);
}

/** Map API / store stage string to timeline key. */
export function orderStageToTimelineKey(orderStage: string): TimelineStageKey {
  const normalized = (orderStage ?? "").toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, TimelineStageKey> = {
    design_preparation: "design_preparation",
    design: "design_preparation",
    cutting: "sheet_processing",
    sheet_processing: "sheet_processing",
    welding: "fabrication",
    fabrication: "fabrication",
    coating: "fabrication",
    powder_coating: "fabrication",
    assembly: "dispatch_validation",
    quality_check: "dispatch_validation",
    dispatch: "dispatch_validation",
    dispatch_validation: "dispatch_validation",
    assembly_dispatch: "dispatch_validation",
  };
  return map[normalized] ?? "design_preparation";
}

export type OrderWorkflowFields = {
  stage: string;
  status: string;
  currentStageApi?: string;
  stagesStatus?: Record<string, string>;
};

export function getOrderCurrentStageApi(order: OrderWorkflowFields): string {
  return order.currentStageApi ?? normalizeApiStageName(order.stage);
}

export function isTimelineStageCurrent(order: OrderWorkflowFields, stageKey: string): boolean {
  return getOrderCurrentStageApi(order) === timelineKeyToApiStageName(stageKey);
}

/**
 * PATCH path for stage save.
 * - `/edit` — historical edit or sheet QC regression after advance
 * - `/stage/:name` — complete/save current stage only
 */
export function resolveStagePatchPath(
  orderId: string,
  stageKey: string,
  order: OrderWorkflowFields,
  saveMode: StageSaveMode,
): string {
  const apiName = timelineKeyToApiStageName(stageKey);
  const isCurrent = isTimelineStageCurrent(order, stageKey);

  if (saveMode === "edit") {
    return getOrderStageEditPath(orderId, apiName);
  }

  if (stageKey === "sheet_processing") {
    return isCurrent
      ? getOrderStageUpdatePath(orderId, apiName)
      : getOrderStageEditPath(orderId, apiName);
  }

  return isCurrent
    ? getOrderStageUpdatePath(orderId, apiName)
    : getOrderStageEditPath(orderId, apiName);
}

export function sheetPatchUsesEditEndpoint(
  order: OrderWorkflowFields,
  saveMode: StageSaveMode,
): boolean {
  if (saveMode === "edit") return true;
  return !isOrderOnSheetProcessingStage(getOrderCurrentStageApi(order));
}

/** Sheet NOT_OK while order has moved past sheet → confirm regression. */
export function shouldConfirmSheetQcRegression(
  stageKey: string,
  order: OrderWorkflowFields,
  statusOk: boolean,
): boolean {
  if (stageKey !== "sheet_processing" || statusOk) return false;
  return !isOrderOnSheetProcessingStage(getOrderCurrentStageApi(order));
}

export function applySheetPayloadAdvanceRules(
  payload: Record<string, unknown>,
  options: {
    saveMode: StageSaveMode;
    usesEditEndpoint: boolean;
    sheetIntent?: SheetSaveIntent;
    qcStatus: SheetProcessingQcStatus;
  },
): void {
  if (options.usesEditEndpoint || options.saveMode === "edit") return;
  if (options.qcStatus === QC_NOT_OK || options.sheetIntent === "save_progress") {
    payload.advance = false;
  }
}

export function getTimelineStageUiState(
  stageKey: TimelineStageKey,
  order: OrderWorkflowFields,
): TimelineStageUiState {
  const orderStatus = (order.status ?? "").toLowerCase();
  if (orderStatus === "cancelled") return "cancelled";

  const stageStatus = order.stagesStatus?.[stageKey]?.toUpperCase();
  const currentKey = orderStageToTimelineKey(order.stage);
  const currentIdx = TIMELINE_STAGE_KEYS.indexOf(currentKey);
  const idx = TIMELINE_STAGE_KEYS.indexOf(stageKey);

  if (orderStatus === "completed") {
    return stageStatus === "COMPLETED" || idx <= currentIdx ? "completed" : "pending";
  }

  if (stageStatus === "COMPLETED") return "completed";
  if (stageKey === currentKey || stageStatus === "IN_PROGRESS") return "current";
  if (idx < currentIdx) return "completed";
  return "pending";
}

export function stageKeysToClearAfterSheetRegression(): TimelineStageKey[] {
  return ["fabrication", "dispatch_validation"];
}

export function isSheetRegressionResponse(
  stageKey: string,
  statusOk: boolean,
  message: string | undefined,
  updatedOrder: OrderWorkflowFields | null,
  previousCurrentApi: string,
): boolean {
  if (stageKey !== "sheet_processing" || statusOk) return false;
  const wasPastSheet = !isOrderOnSheetProcessingStage(previousCurrentApi);
  const nowOnSheet = updatedOrder
    ? isOrderOnSheetProcessingStage(getOrderCurrentStageApi(updatedOrder))
    : false;
  if (wasPastSheet && nowOnSheet) return true;
  return /returned to sheet processing|later steps were cleared/i.test(message ?? "");
}

import {
  getPanelBulkStageEditPath,
  getPanelBulkStageUpdatePath,
  getPanelStageEditPath,
  getPanelStageUpdatePath,
} from "@/lib/api";
import { QC_NOT_OK, type SheetSaveIntent, type SheetProcessingQcStatus } from "@/lib/order-stages";
import type { PanelProductionStageApi, PanelRecord } from "@/lib/order-types";
import { normalizeApiStageName } from "@/lib/order-workflow";

export type PanelSaveMode = "edit" | "complete";

export function isPanelCurrentStage(panel: PanelRecord, stageKey: string): boolean {
  const api = normalizeApiStageName(panel.currentStage);
  const target =
    stageKey === "fabrication"
      ? "FABRICATION"
      : stageKey === "dispatch_validation"
        ? "DISPATCH_VALIDATION"
        : "SHEET_PROCESSING";
  return api === target;
}

export function resolvePanelStagePatchPath(
  orderId: string,
  panelId: string,
  stageKey: string,
  panel: PanelRecord,
  saveMode: PanelSaveMode,
): string {
  const stageName = (
    stageKey === "fabrication"
      ? "FABRICATION"
      : stageKey === "dispatch_validation"
        ? "DISPATCH_VALIDATION"
        : "SHEET_PROCESSING"
  ) as PanelProductionStageApi;

  if (saveMode === "edit" || !isPanelCurrentStage(panel, stageKey)) {
    return getPanelStageEditPath(orderId, panelId, stageName);
  }
  return getPanelStageUpdatePath(orderId, panelId, stageName);
}

export function resolvePanelBulkStagePatchPath(
  orderId: string,
  stageKey: string,
  edit: boolean,
): string {
  const stageName = (
    stageKey === "fabrication"
      ? "FABRICATION"
      : stageKey === "dispatch_validation"
        ? "DISPATCH_VALIDATION"
        : "SHEET_PROCESSING"
  ) as PanelProductionStageApi;
  return edit
    ? getPanelBulkStageEditPath(orderId, stageName)
    : getPanelBulkStageUpdatePath(orderId, stageName);
}

export function shouldConfirmPanelSheetRegression(
  stageKey: string,
  panel: PanelRecord,
  statusOk: boolean,
): boolean {
  if (stageKey !== "sheet_processing" || statusOk) return false;
  return !isPanelCurrentStage(panel, "sheet_processing");
}

export function applyPanelSheetPayloadAdvanceRules(
  payload: Record<string, unknown>,
  options: {
    saveMode: PanelSaveMode;
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

export function panelCanEditProduction(panel: PanelRecord): boolean {
  const s = String(panel.panelStatus).toUpperCase();
  return s !== "DISPATCHED" && s !== "CANCELLED" && s !== "ON_HOLD";
}

export function panelStatusLabel(status: string): string {
  return String(status).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

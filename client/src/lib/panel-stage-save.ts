import type { StageCompletionData } from "@/components/stage-detail-modal";
import { buildStagePayloadForKey } from "@/lib/build-stage-payload";
import {
  applyPanelSheetPayloadAdvanceRules,
  isPanelCurrentStage,
  resolvePanelBulkStagePatchPath,
  resolvePanelStagePatchPath,
  shouldConfirmBulkPanelSheetRegression,
  shouldConfirmPanelSheetRegression,
  type PanelSaveMode,
} from "@/lib/panel-workflow";
import type { PanelRecord } from "@/lib/order-types";
import { qcFromStatusOk, type SheetSaveIntent } from "@/lib/order-stages";
import { stripAttachmentForWrite, type StageAttachment } from "@/lib/stage-uploads";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { USE_REAL_API } from "@/lib/api";

export type PanelStageSaveData = StageCompletionData & {
  attachments?: StageAttachment[];
};

export async function savePanelStage(params: {
  orderId: string;
  panel: PanelRecord;
  stageKey: string;
  saveMode: PanelSaveMode;
  data: PanelStageSaveData;
  options?: { intent?: SheetSaveIntent; confirmedRegression?: boolean };
  onRegressionRequired?: () => void;
}): Promise<{ ok: boolean; keepModalOpen?: boolean; message?: string }> {
  const { orderId, panel, stageKey, saveMode, data, options, onRegressionRequired } = params;
  if (
    shouldConfirmPanelSheetRegression(stageKey, panel, data.statusOk ?? true) &&
    !options?.confirmedRegression
  ) {
    onRegressionRequired?.();
    return { ok: false };
  }

  const attachmentsPayload = Array.isArray(data.attachments) ? data.attachments : undefined;
  const attachmentsForPatch = attachmentsPayload?.map(stripAttachmentForWrite);
  let payload = buildStagePayloadForKey(stageKey, data as Record<string, unknown>, attachmentsForPatch);

  const usesEditEndpoint =
    saveMode === "edit" || !isPanelCurrentStage(panel, stageKey);
  if (stageKey === "sheet_processing") {
    const qcStatus = qcFromStatusOk(data.statusOk ?? false);
    applyPanelSheetPayloadAdvanceRules(payload, {
      saveMode,
      usesEditEndpoint,
      sheetIntent: options?.intent,
      qcStatus,
    });
  }

  if (!USE_REAL_API) {
    return { ok: true };
  }

  const path = resolvePanelStagePatchPath(orderId, panel.id, stageKey, panel, saveMode);
  const res = await apiRequest("PATCH", path, payload);
  const json = await res.json();
  await queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
  queryClient.invalidateQueries({ queryKey: ["orders-list"] });

  const sheetStaysInProgress =
    stageKey === "sheet_processing" &&
    !usesEditEndpoint &&
    saveMode === "complete" &&
    (options?.intent === "save_progress" || !data.statusOk);

  return {
    ok: true,
    keepModalOpen: sheetStaysInProgress,
    message: (json as { message?: string })?.message,
  };
}

export async function savePanelBulkStage(params: {
  orderId: string;
  panels: PanelRecord[];
  stageKey: string;
  saveMode: PanelSaveMode;
  data: PanelStageSaveData;
  options?: { intent?: SheetSaveIntent; confirmedRegression?: boolean };
  onRegressionRequired?: () => void;
}): Promise<{ ok: boolean; keepModalOpen?: boolean; message?: string; updated?: number }> {
  const { orderId, panels, stageKey, saveMode, data, options, onRegressionRequired } = params;

  if (panels.length === 0) {
    return { ok: false, message: "No panels selected" };
  }

  if (
    shouldConfirmBulkPanelSheetRegression(stageKey, panels, data.statusOk ?? true) &&
    !options?.confirmedRegression
  ) {
    onRegressionRequired?.();
    return { ok: false };
  }

  const attachmentsPayload = Array.isArray(data.attachments) ? data.attachments : undefined;
  const attachmentsForPatch = attachmentsPayload?.map(stripAttachmentForWrite);
  let payload = buildStagePayloadForKey(stageKey, data as Record<string, unknown>, attachmentsForPatch);
  payload.panelIds = panels.map((p) => p.id);

  const usesEditEndpoint = saveMode === "edit";
  if (stageKey === "sheet_processing") {
    const qcStatus = qcFromStatusOk(data.statusOk ?? false);
    applyPanelSheetPayloadAdvanceRules(payload, {
      saveMode,
      usesEditEndpoint,
      sheetIntent: options?.intent,
      qcStatus,
    });
  }

  if (!USE_REAL_API) {
    return { ok: true, updated: panels.length };
  }

  const path = resolvePanelBulkStagePatchPath(orderId, stageKey, saveMode === "edit");
  const res = await apiRequest("PATCH", path, payload);
  const json = await res.json();
  await queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
  queryClient.invalidateQueries({ queryKey: ["orders-list"] });

  const updated =
    (json as { data?: { updated?: number } })?.data?.updated ??
    (json as { updated?: number })?.updated ??
    panels.length;

  const sheetStaysInProgress =
    stageKey === "sheet_processing" &&
    !usesEditEndpoint &&
    saveMode === "complete" &&
    (options?.intent === "save_progress" || !data.statusOk);

  return {
    ok: true,
    keepModalOpen: sheetStaysInProgress,
    message: (json as { message?: string })?.message,
    updated,
  };
}

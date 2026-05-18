/** API stage names */
export const STAGE_SHEET_PROCESSING = "SHEET_PROCESSING" as const;

/** Sheet Processing QC status values sent to the backend */
export const QC_OK = "OK" as const;
export const QC_NOT_OK = "NOT_OK" as const;

export type SheetProcessingQcStatus = typeof QC_OK | typeof QC_NOT_OK;

export type SheetSaveIntent = "save_progress" | "complete";

export function qcFromStatusOk(statusOk: boolean): SheetProcessingQcStatus {
  return statusOk ? QC_OK : QC_NOT_OK;
}

/** Normalize API stage.data.status or sheetStatus to boolean for the form. */
export function statusOkFromStageData(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return true;
  const raw = data.status ?? data.sheetStatus ?? data.statusOk;
  if (typeof raw === "boolean") return raw;
  if (raw == null || raw === "") return true;
  const s = String(raw).toUpperCase().replace(/\s+/g, "_");
  if (s === "NOT_OK" || s === "NOTOK") return false;
  if (s === "OK") return true;
  return s !== "NOT_OK";
}

/** Whether order.currentStage (API or normalized) is still Sheet Processing. */
export function isOrderOnSheetProcessingStage(currentStage: string | undefined | null): boolean {
  if (!currentStage) return false;
  const norm = String(currentStage).toUpperCase().replace(/-/g, "_");
  return norm === STAGE_SHEET_PROCESSING;
}

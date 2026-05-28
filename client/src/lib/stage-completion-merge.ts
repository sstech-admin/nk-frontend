import type { Order } from "@shared/schema";
import type { StageCompletionData } from "@/components/stage-detail-modal";
import { orderToDesignCompletionFallback } from "@/lib/design-stage-form";

/** Order header + design data merged as baseline for Fabrication / Dispatch views and PDFs. */
export function orderToDispatchCompletionFallback(order: Order): StageCompletionData {
  const acc = (order as { accessoriesObj?: { pointLock?: boolean; threePointLock?: boolean; puGasketing?: boolean; pattiGasketing?: boolean; other?: string } }).accessoriesObj;
  const powderType = (order as { powderCoatingType?: string }).powderCoatingType;
  return {
    woNo: order.orderNo,
    customerName: order.partyName,
    poNo: order.poNo ?? undefined,
    colorBody: order.colorBody,
    colorMp: order.colorMountingPlate,
    colorBase: order.colorBaseStand,
    designerName: order.designerName,
    bodySize: order.description,
    bodyColorCode: order.colorBody,
    sheetQty: order.parts != null && order.parts !== "" ? order.parts : undefined,
    color: order.colorBody ?? powderType,
    pointLock: acc?.pointLock,
    threePointLock: acc?.threePointLock,
    puGasketing: acc?.puGasketing,
    pattiGasketing: acc?.pattiGasketing,
    accessoriesOther: acc?.other ?? order.accessoriesOther,
  };
}

/** Read the server-persisted stage snapshot for `stageKey` off the normalized order (set by `normalizeOrderDetail`). */
function persistedStageData(order: Order, stageKey: string): StageCompletionData | null {
  const m = (order as { stagesMap?: Record<string, Record<string, unknown>> }).stagesMap;
  const raw = m?.[stageKey];
  if (!raw || typeof raw !== "object") return null;
  const hasValues = Object.values(raw).some((v) => v !== undefined && v !== null && v !== "");
  return hasValues ? (raw as StageCompletionData) : null;
}

/** Drop undefined/null/empty entries so they don't shadow real values when spread. */
function compact(data: StageCompletionData | null | undefined): StageCompletionData {
  if (!data) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out as StageCompletionData;
}

/** Return a copy of the data without the `attachments` field — used when
 *  carrying fabrication data forward into the dispatch-validation view
 *  (attachments are per-stage, not shared). */
function withoutAttachments(data: StageCompletionData): StageCompletionData {
  if (!data || typeof data !== "object") return {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { attachments, ...rest } = data as StageCompletionData;
  return rest;
}

/**
 * Completion snapshot for modals and PDFs.
 *
 * Layering (later overrides earlier):
 *   1. Order-derived baseline (fabrication / dispatch only) — used to autofill read-only fields
 *   2. Server-persisted stage snapshot for this key (from GET /orders/:id → stages[].data)
 *   3. Server-persisted `fabrication` snapshot (dispatch stage reuses it)
 *   4. In-session saves from `stageCompletionMap` (most recent edit wins)
 */
/** Panel production modals: merge order baseline with panel `stagesMap` and per-panel session map. */
export function getPanelCompletionDataForStage(
  stageKey: string,
  order: Order,
  panel: { id: string; stagesMap?: Record<string, Record<string, unknown>> },
  map: Record<string, StageCompletionData>,
): StageCompletionData | null {
  const panelOrder = {
    ...order,
    stagesMap: {
      ...((order as { stagesMap?: Record<string, Record<string, unknown>> }).stagesMap ?? {}),
      ...(panel.stagesMap ?? {}),
    },
  } as Order;
  const sessionMap: Record<string, StageCompletionData> = { ...map };
  const panelKey = `${panel.id}:${stageKey}`;
  if (map[panelKey]) sessionMap[stageKey] = map[panelKey];
  const panelFabKey = `${panel.id}:fabrication`;
  if (stageKey === "dispatch_validation" && map[panelFabKey]) {
    sessionMap.fabrication = { ...sessionMap.fabrication, ...map[panelFabKey] };
  }
  return getCompletionDataForStage(stageKey, panelOrder, sessionMap);
}

export function getCompletionDataForStage(
  stageKey: string,
  order: Order | undefined,
  map: Record<string, StageCompletionData>
): StageCompletionData | null {
  if (!order) return null;

  const persistedHere = compact(persistedStageData(order, stageKey));
  const persistedFab = compact(persistedStageData(order, "fabrication"));
  const sessionHere = compact(map[stageKey] ?? null);
  const sessionFab = compact(map.fabrication ?? null);

  if (stageKey === "dispatch_validation") {
    // Fabrication's attachments belong to fabrication only; dispatch manages
    // its own set. Strip them from the fab layers so they don't leak through.
    return {
      ...orderToDispatchCompletionFallback(order),
      ...withoutAttachments(persistedFab),
      ...persistedHere,
      ...withoutAttachments(sessionFab),
      ...sessionHere,
    };
  }

  if (stageKey === "fabrication") {
    return {
      ...orderToDispatchCompletionFallback(order),
      ...persistedHere,
      ...sessionHere,
    };
  }

  if (stageKey === "design_preparation") {
    return {
      ...orderToDesignCompletionFallback(order),
      ...persistedHere,
      ...sessionHere,
    };
  }

  const merged: StageCompletionData = { ...persistedHere, ...sessionHere };
  return Object.keys(merged).length > 0 ? merged : null;
}

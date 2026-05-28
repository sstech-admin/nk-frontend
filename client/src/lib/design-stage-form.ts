import type { Order } from "@shared/schema";
import type { StageCompletionData } from "@/components/stage-detail-modal";
import type { StageAttachment } from "@/lib/stage-uploads";

export const DESIGN_ACCESSORIES = [
  { value: "point_lock", label: "Point Lock" },
  { value: "3_point_lock", label: "3 Point Lock" },
  { value: "pu_gasketing", label: "PU Gasketing" },
  { value: "patti_gasketing", label: "Patti Gasketing" },
] as const;

/** Baseline design fields from the order header (create-order snapshot). */
export function orderToDesignCompletionFallback(order: Order): StageCompletionData {
  const accObj = (order as {
    accessoriesObj?: {
      pointLock?: boolean;
      threePointLock?: boolean;
      puGasketing?: boolean;
      pattiGasketing?: boolean;
      other?: string;
    };
  }).accessoriesObj;
  const accArr = Array.isArray(order.accessories) ? order.accessories : [];
  const powder = String((order as { powderCoatingType?: string }).powderCoatingType ?? "").toLowerCase();
  const rateTypeRaw = String(order.rateType ?? "").toLowerCase();
  return {
    partyName: order.partyName ?? "",
    designerName: order.designerName ?? "",
    panelType: order.panelType ?? "",
    poNo: order.poNo ?? "",
    quantity: order.quantity ?? 0,
    description: order.description ?? "",
    parts: order.parts != null && order.parts !== "" ? order.parts : undefined,
    customerWoNo: order.customerWoNo ?? "",
    powderCoatingType: powder.includes("double") ? "double_coat" : "single_coat",
    colorBody: order.colorBody ?? "",
    colorMountingPlate: order.colorMountingPlate ?? "",
    colorBaseStand: order.colorBaseStand ?? "",
    rateType:
      rateTypeRaw.includes("include") || rateTypeRaw === "including_acc"
        ? "including_acc"
        : "extra",
    rate: order.rate != null ? String(order.rate) : "",
    orderRemarks: order.remarks ?? "",
    pointLock: accObj ? !!accObj.pointLock : accArr.includes("point_lock"),
    threePointLock: accObj ? !!accObj.threePointLock : accArr.includes("3_point_lock"),
    puGasketing: accObj ? !!accObj.puGasketing : accArr.includes("pu_gasketing"),
    pattiGasketing: accObj ? !!accObj.pattiGasketing : accArr.includes("patti_gasketing"),
    accessoriesOther: accObj?.other ?? order.accessoriesOther ?? "",
  };
}

/** Merge persisted stage.data (camelCase) over order baseline for the design form. */
export function resolveDesignFormValues(
  completionData: StageCompletionData | null | undefined,
  order: Order,
): StageCompletionData {
  const base = orderToDesignCompletionFallback(order);
  const cd = completionData ?? {};
  return {
    ...base,
    ...cd,
    partyName: cd.partyName ?? base.partyName,
    designerName: cd.designerName ?? base.designerName,
    panelType: cd.panelType ?? base.panelType,
    poNo: cd.poNo ?? base.poNo,
    quantity: cd.quantity ?? base.quantity,
    description: cd.description ?? base.description,
    parts: cd.parts ?? base.parts,
    customerWoNo: cd.customerWoNo ?? base.customerWoNo,
    powderCoatingType: cd.powderCoatingType ?? base.powderCoatingType,
    colorBody: cd.colorBody ?? base.colorBody,
    colorMountingPlate: cd.colorMountingPlate ?? base.colorMountingPlate,
    colorBaseStand: cd.colorBaseStand ?? base.colorBaseStand,
    rateType: cd.rateType ?? base.rateType,
    rate: cd.rate ?? base.rate,
    orderRemarks: cd.orderRemarks ?? base.orderRemarks,
    pointLock: cd.pointLock ?? base.pointLock,
    threePointLock: cd.threePointLock ?? base.threePointLock,
    puGasketing: cd.puGasketing ?? base.puGasketing,
    pattiGasketing: cd.pattiGasketing ?? base.pattiGasketing,
    accessoriesOther: cd.accessoriesOther ?? base.accessoriesOther,
    remarks: cd.remarks ?? base.remarks,
    attachments: cd.attachments ?? base.attachments,
  };
}

/** Enrich normalizeStageData output for design_preparation hydration. */
export function enrichDesignStageDataFromApi(out: Record<string, unknown>): void {
  if (out.descriptionSize != null && out.description == null) {
    out.description = out.descriptionSize;
  }
  if (out.partsCount != null && out.parts == null) {
    out.parts = out.partsCount;
  }
  if (out.panelName != null && out.customerWoNo == null) {
    out.customerWoNo = out.panelName;
  }
  if (out.coatingType != null && out.powderCoatingType == null) {
    const c = String(out.coatingType).toUpperCase();
    out.powderCoatingType = c === "DOUBLE" ? "double_coat" : "single_coat";
  }
  const cd = out.colorDetails;
  if (cd && typeof cd === "object" && !Array.isArray(cd)) {
    const colors = cd as Record<string, unknown>;
    if (!out.colorBody && colors.body) out.colorBody = colors.body;
    if (!out.colorMountingPlate && colors.mountingPlate) out.colorMountingPlate = colors.mountingPlate;
    if (!out.colorBaseStand && colors.baseStand) out.colorBaseStand = colors.baseStand;
  }
  const pricing = out.pricing;
  if (pricing && typeof pricing === "object" && !Array.isArray(pricing)) {
    const p = pricing as Record<string, unknown>;
    if (!out.rate && p.ratePerKg != null) out.rate = String(p.ratePerKg);
    if (!out.rateType && p.includingAccessories != null) {
      out.rateType = p.includingAccessories ? "including_acc" : "extra";
    }
  }
  const acc = out.accessories;
  if (acc && typeof acc === "object" && !Array.isArray(acc)) {
    const a = acc as Record<string, unknown>;
    if (out.pointLock === undefined) out.pointLock = !!a.pointLock;
    if (out.threePointLock === undefined) out.threePointLock = !!a.threePointLock;
    if (out.puGasketing === undefined) out.puGasketing = !!a.puGasketing;
    if (out.pattiGasketing === undefined) out.pattiGasketing = !!a.pattiGasketing;
    if (!out.accessoriesOther && a.other) out.accessoriesOther = a.other;
  }
  if (out.orderRemarks == null && out.order_remarks != null) {
    out.orderRemarks = out.order_remarks;
  }
}

export function buildDesignStagePatchPayload(
  data: StageCompletionData,
  attachmentsForPatch?: StageAttachment[],
): Record<string, unknown> {
  const rateNum =
    Number(data.rate) || parseFloat(String(data.rate ?? "").replace(/[^0-9.-]/g, "")) || 0;
  return {
    party_name: data.partyName?.trim() || undefined,
    designer_name: data.designerName?.trim() || undefined,
    panel_type: data.panelType?.trim() ?? "",
    po_number: data.poNo?.trim() || undefined,
    quantity: Number(data.quantity) || 0,
    description_size: data.description?.trim() ?? "",
    parts_count: Number(data.parts) || 0,
    panel_name: data.customerWoNo?.trim() ?? "",
    coating_type: data.powderCoatingType === "double_coat" ? "DOUBLE" : "SINGLE",
    color_details: {
      body: data.colorBody?.trim() ?? "",
      mountingPlate: data.colorMountingPlate?.trim() ?? "",
      baseStand: data.colorBaseStand?.trim() ?? "",
    },
    accessories: {
      point_lock: !!data.pointLock,
      three_point_lock: !!data.threePointLock,
      pu_gasketing: !!data.puGasketing,
      patti_gasketing: !!data.pattiGasketing,
      other: data.accessoriesOther?.trim() || "",
    },
    pricing: {
      rate_per_kg: rateNum,
      including_accessories: data.rateType === "including_acc",
      extra_charges: data.rateType === "extra" ? rateNum : 0,
    },
    order_remarks: data.orderRemarks?.trim() || undefined,
    remarks: data.remarks?.trim() || "",
    notes: data.remarks?.trim() || "",
    ...(attachmentsForPatch?.length ? { attachments: attachmentsForPatch } : {}),
  };
}

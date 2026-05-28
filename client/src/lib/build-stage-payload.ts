import type { StageAttachment } from "@/lib/stage-uploads";
import { buildDesignStagePatchPayload } from "@/lib/design-stage-form";
import { qcFromStatusOk } from "@/lib/order-stages";

/** Build PATCH body for a production stage (order or panel). */
export function buildStagePayloadForKey(
  stageKey: string,
  data: Record<string, unknown>,
  attachmentsForPatch?: StageAttachment[],
): Record<string, unknown> {
  if (stageKey === "sheet_processing") {
    const statusOk = data.statusOk as boolean | undefined;
    return {
      sheet_qty:
        typeof data.sheetQty === "number" ? data.sheetQty : Number(data.sheetQty) || 0,
      status: qcFromStatusOk(statusOk ?? false),
      remarks: String(data.remarks ?? "").trim() || "",
      notes: String(data.remarks ?? "").trim() || "",
      ...(attachmentsForPatch?.length ? { attachments: attachmentsForPatch } : {}),
    };
  }
  if (stageKey === "fabrication") {
    return {
      completion_date: data.completionDate ? String(data.completionDate).trim() : undefined,
      fabricator_name: data.fabricatorName ? String(data.fabricatorName).trim() : undefined,
      delivery_date: data.deliveryDate ? String(data.deliveryDate).trim() : undefined,
      team_member_id:
        data.teamMemberId && data.teamMemberId !== "_none" ? data.teamMemberId : undefined,
      quality_check_passed: data.qualityCheckPassed,
      remarks: String(data.remarks ?? "").trim() || "",
      notes: String(data.remarks ?? "").trim() || "",
      ...(attachmentsForPatch?.length ? { attachments: attachmentsForPatch } : {}),
    };
  }
  if (stageKey === "dispatch_validation") {
    return {
      completion_date: data.completionDate ? String(data.completionDate).trim() : undefined,
      wo_no: data.woNo ? String(data.woNo).trim() : undefined,
      customer_name: data.customerName ? String(data.customerName).trim() : undefined,
      dc_no: data.dcNo ? String(data.dcNo).trim() : undefined,
      po_no: data.poNo ? String(data.poNo).trim() : undefined,
      color_body: data.colorBody ? String(data.colorBody).trim() : undefined,
      color_mp: data.colorMp ? String(data.colorMp).trim() : undefined,
      color_base: data.colorBase ? String(data.colorBase).trim() : undefined,
      contractor_name: data.contractorName ? String(data.contractorName).trim() : undefined,
      designer_name: data.designerName ? String(data.designerName).trim() : undefined,
      weight: data.weight ? String(data.weight).trim() : undefined,
      door_qty: data.doorQty != null ? Number(data.doorQty) : undefined,
      cover_qty: data.coverQty != null ? Number(data.coverQty) : undefined,
      mounting_plate_qty:
        data.mountingPlateQty != null ? Number(data.mountingPlateQty) : undefined,
      base_stand_qty: data.baseStandQty != null ? Number(data.baseStandQty) : undefined,
      coating_type_id:
        data.coatingTypeId && data.coatingTypeId !== "_none" ? data.coatingTypeId : undefined,
      pc_location_id:
        data.pcLocationId && data.pcLocationId !== "_none" ? data.pcLocationId : undefined,
      body_color_code: data.bodyColorCode ? String(data.bodyColorCode).trim() : undefined,
      vehicle_no: data.vehicleNo ? String(data.vehicleNo).trim() : undefined,
      powder_coating_team_id:
        data.powderCoatingTeamId && data.powderCoatingTeamId !== "_none"
          ? data.powderCoatingTeamId
          : undefined,
      color: data.color ? String(data.color).trim() : undefined,
      single_coat: data.singleCoat,
      double_coat: data.doubleCoat,
      point_lock: data.pointLock,
      three_point_lock: data.threePointLock,
      pu_gasketing: data.puGasketing,
      patti_gasketing: data.pattiGasketing,
      accessories_other: data.accessoriesOther
        ? String(data.accessoriesOther).trim()
        : undefined,
      body_size: data.bodySize ? String(data.bodySize).trim() : undefined,
      glan_plate_qty: data.glanPlateQty != null ? Number(data.glanPlateQty) : undefined,
      c_channel_qty: data.cChannelQty != null ? Number(data.cChannelQty) : undefined,
      l_patta_qty: data.lPattaQty != null ? Number(data.lPattaQty) : undefined,
      ghodi_qty: data.ghodiQty != null ? Number(data.ghodiQty) : undefined,
      j_channel_qty: data.jChannelQty != null ? Number(data.jChannelQty) : undefined,
      basbar_cover_qty: data.basbarCoverQty != null ? Number(data.basbarCoverQty) : undefined,
      basbar_angle_qty: data.basbarAngleQty != null ? Number(data.basbarAngleQty) : undefined,
      capacitor_patta_qty:
        data.capacitorPattaQty != null ? Number(data.capacitorPattaQty) : undefined,
      braker_c_channel_qty:
        data.brakerCChannelQty != null ? Number(data.brakerCChannelQty) : undefined,
      canopy_qty: data.canopyQty != null ? Number(data.canopyQty) : undefined,
      base_qty: data.baseQty != null ? Number(data.baseQty) : undefined,
      stand_qty: data.standQty != null ? Number(data.standQty) : undefined,
      remarks: String(data.remarks ?? "").trim() || "",
      notes: String(data.remarks ?? "").trim() || "",
      ...(attachmentsForPatch?.length ? { attachments: attachmentsForPatch } : {}),
    };
  }
  if (stageKey === "design_preparation") {
    return buildDesignStagePatchPayload(
      data as Parameters<typeof buildDesignStagePatchPayload>[0],
      attachmentsForPatch,
    );
  }
  return {
    remarks: String(data.remarks ?? "").trim() || "",
    notes: String(data.remarks ?? "").trim() || "",
    ...(attachmentsForPatch?.length ? { attachments: attachmentsForPatch } : {}),
  };
}

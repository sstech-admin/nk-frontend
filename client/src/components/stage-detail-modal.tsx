"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { Order } from "@shared/schema";
import { StageImageUploader } from "@/components/stage-image-uploader";
import { useStageUploads } from "@/hooks/use-stage-uploads";
import type { StageAttachment } from "@/lib/stage-uploads";
import type { SheetSaveIntent } from "@/lib/order-stages";
import { resolveDesignFormValues } from "@/lib/design-stage-form";
import {
  DesignStageOrderFields,
  type DesignOrderFieldValues,
} from "@/components/design-stage-order-fields";

export type StageSaveOptions = { intent?: SheetSaveIntent };

export interface StageCompletionData {
  completedDate?: string;
  executedBy?: string;
  proofFileName?: string;
  proofPreviewUrl?: string;
  remarks?: string;
  recordedAt?: string;
  sheetQty?: string | number;
  statusOk?: boolean;
  fabricatorName?: string;
  deliveryDate?: string;
  teamMemberId?: string;
  qualityCheckPassed?: boolean;
  woNo?: string;
  partyName?: string;
  panelType?: string;
  quantity?: string | number;
  description?: string;
  parts?: string | number;
  customerWoNo?: string;
  powderCoatingType?: string;
  colorMountingPlate?: string;
  colorBaseStand?: string;
  rateType?: string;
  rate?: string;
  orderRemarks?: string;
  customerName?: string;
  dcNo?: string;
  poNo?: string;
  colorBody?: string;
  colorMp?: string;
  colorBase?: string;
  contractorName?: string;
  designerName?: string;
  weight?: string;
  doorQty?: string | number;
  coverQty?: string | number;
  mountingPlateQty?: string | number;
  baseStandQty?: string | number;
  coatingTypeId?: string;
  pcLocationId?: string;
  bodyColorCode?: string;
  vehicleNo?: string;
  powderCoatingTeamId?: string;
  color?: string;
  singleCoat?: boolean;
  doubleCoat?: boolean;
  pointLock?: boolean;
  threePointLock?: boolean;
  puGasketing?: boolean;
  pattiGasketing?: boolean;
  accessoriesOther?: string;
  bodySize?: string;
  glanPlateQty?: string | number;
  cChannelQty?: string | number;
  lPattaQty?: string | number;
  ghodiQty?: string | number;
  jChannelQty?: string | number;
  basbarCoverQty?: string | number;
  basbarAngleQty?: string | number;
  capacitorPattaQty?: string | number;
  brakerCChannelQty?: string | number;
  canopyQty?: string | number;
  baseQty?: string | number;
  standQty?: string | number;
  attachments?: StageAttachment[];
}

export type StageModalMode = "view" | "edit" | "complete";

interface StageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  stageKey: string;
  stageLabel: string;
  /** @deprecated Prefer `mode === "view"` */
  isCompleted?: boolean;
  mode?: StageModalMode;
  completionData?: StageCompletionData | null;
  isAuthorized?: boolean;
  /** For fabrication stage: options for team member dropdown */
  teamMemberOptions?: { value: string; label: string }[];
  /** For powder coating stage */
  coatingTypeOptions?: { value: string; label: string }[];
  pcLocationOptions?: { value: string; label: string }[];
  powderCoatingTeamOptions?: { value: string; label: string }[];
  /** True when `order.currentStage` matches this modal's stage (workflow PATCH without /edit). */
  isOrderCurrentStage?: boolean;
  onSave?: (data: {
    proofFileName?: string;
    proofPreviewUrl?: string;
    remarks?: string;
    sheetQty?: string | number;
    statusOk?: boolean;
    completionDate?: string;
    fabricatorName?: string;
    deliveryDate?: string;
    teamMemberId?: string;
    qualityCheckPassed?: boolean;
    woNo?: string;
    partyName?: string;
    panelType?: string;
    quantity?: string | number;
    description?: string;
    parts?: string | number;
    customerWoNo?: string;
    powderCoatingType?: string;
    colorMountingPlate?: string;
    colorBaseStand?: string;
    rateType?: string;
    rate?: string;
    orderRemarks?: string;
    customerName?: string;
    dcNo?: string;
    poNo?: string;
    colorBody?: string;
    colorMp?: string;
    colorBase?: string;
    contractorName?: string;
    designerName?: string;
    weight?: string;
    doorQty?: string | number;
    coverQty?: string | number;
    mountingPlateQty?: string | number;
    baseStandQty?: string | number;
    coatingTypeId?: string;
    pcLocationId?: string;
    bodyColorCode?: string;
    vehicleNo?: string;
    powderCoatingTeamId?: string;
    color?: string;
    singleCoat?: boolean;
    doubleCoat?: boolean;
    pointLock?: boolean;
    threePointLock?: boolean;
    puGasketing?: boolean;
    pattiGasketing?: boolean;
    accessoriesOther?: string;
    bodySize?: string;
    glanPlateQty?: string | number;
    cChannelQty?: string | number;
    lPattaQty?: string | number;
    ghodiQty?: string | number;
    jChannelQty?: string | number;
    basbarCoverQty?: string | number;
    basbarAngleQty?: string | number;
    capacitorPattaQty?: string | number;
    brakerCChannelQty?: string | number;
    canopyQty?: string | number;
    baseQty?: string | number;
    standQty?: string | number;
    attachments?: StageAttachment[];
  }, options?: StageSaveOptions) => void | Promise<boolean | void>;
}

function ModalField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

const isFabricationStage = (key: string) => key === "fabrication";
const isPowderCoatingStage = (key: string) => key === "powder_coating";
/** Last stage (dispatch_validation) uses the same modal content as powder coating. */
const isPowderCoatingOrDispatchStage = (key: string) => key === "powder_coating" || key === "dispatch_validation";
/** Combined Fabrication + Powder Coating modal (Stage 3 & 4 in one with separator). */
const isCombinedFabricationPowderCoating = (key: string) => key === "fabrication" || key === "powder_coating";

/** Combined Fabrication + Powder Coating: same neutral inputs as other stages; autofill = readOnly/disabled only (no tint). */
const combinedModalFieldClass = "h-9 text-sm";

/** Dispatch Validation: fields carried from order / fabrication — read-only + light blue fill. */
const dispatchAutofillInputClass =
  "bg-sky-50 border-sky-200/70 text-foreground dark:bg-sky-950/30 dark:border-sky-800 read-only:bg-sky-50";
const dispatchAutofillMutedSectionClass =
  "border-sky-200/40 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/15";

export function StageDetailModal({
  open,
  onOpenChange,
  order,
  stageKey,
  stageLabel,
  isCompleted: isCompletedLegacy,
  mode: modeProp,
  completionData,
  isAuthorized = true,
  teamMemberOptions = [],
  coatingTypeOptions = [],
  pcLocationOptions = [],
  powderCoatingTeamOptions = [],
  isOrderCurrentStage = false,
  onSave,
}: StageDetailModalProps) {
  const mode: StageModalMode =
    modeProp ?? (isCompletedLegacy ? "view" : "complete");
  const isViewMode = mode === "view";

  const [remarks, setRemarks] = React.useState(
    completionData?.remarks ?? ""
  );
  const [sheetQty, setSheetQty] = React.useState(
    completionData?.sheetQty != null
      ? String(completionData.sheetQty)
      : order.parts != null
        ? String(order.parts)
        : ""
  );
  const [statusOk, setStatusOk] = React.useState<boolean>(
    completionData?.statusOk ?? true
  );
  const uploader = useStageUploads({
    orderId: (order as { id?: string }).id,
    stageKey,
    initialAttachments: completionData?.attachments ?? [],
  });
  const [completionDateEditable, setCompletionDateEditable] = React.useState(
    completionData?.completedDate ?? new Date().toISOString().slice(0, 10)
  );
  const [fabricatorName, setFabricatorName] = React.useState(
    completionData?.fabricatorName ?? ""
  );
  const [deliveryDate, setDeliveryDate] = React.useState(
    completionData?.deliveryDate ?? ""
  );
  const [teamMemberId, setTeamMemberId] = React.useState(
    completionData?.teamMemberId ?? ""
  );
  const [qualityCheckPassed, setQualityCheckPassed] = React.useState<boolean>(
    completionData?.qualityCheckPassed ?? true
  );

  const [pcWoNo, setPcWoNo] = React.useState(completionData?.woNo ?? "");
  const [pcCustomerName, setPcCustomerName] = React.useState(completionData?.customerName ?? "");
  const [pcDcNo, setPcDcNo] = React.useState(completionData?.dcNo ?? "");
  const [pcPoNo, setPcPoNo] = React.useState(completionData?.poNo ?? "");
  const [pcColorBody, setPcColorBody] = React.useState(completionData?.colorBody ?? "");
  const [pcColorMp, setPcColorMp] = React.useState(completionData?.colorMp ?? "");
  const [pcColorBase, setPcColorBase] = React.useState(completionData?.colorBase ?? "");
  const [pcContractorName, setPcContractorName] = React.useState(completionData?.contractorName ?? "");
  const [pcDesignerName, setPcDesignerName] = React.useState(completionData?.designerName ?? "");
  const [pcWeight, setPcWeight] = React.useState(completionData?.weight ?? "");
  const [pcDoorQty, setPcDoorQty] = React.useState(completionData?.doorQty != null ? String(completionData.doorQty) : "");
  const [pcCoverQty, setPcCoverQty] = React.useState(completionData?.coverQty != null ? String(completionData.coverQty) : "");
  const [pcMountingPlateQty, setPcMountingPlateQty] = React.useState(completionData?.mountingPlateQty != null ? String(completionData.mountingPlateQty) : "");
  const [pcBaseStandQty, setPcBaseStandQty] = React.useState(completionData?.baseStandQty != null ? String(completionData.baseStandQty) : "");
  const [pcCoatingTypeId, setPcCoatingTypeId] = React.useState(completionData?.coatingTypeId ?? "");
  const [pcLocationId, setPcLocationId] = React.useState(completionData?.pcLocationId ?? "");
  const [pcBodyColorCode, setPcBodyColorCode] = React.useState(completionData?.bodyColorCode ?? "");
  const [pcVehicleNo, setPcVehicleNo] = React.useState(completionData?.vehicleNo ?? "");
  const [pcTeamId, setPcTeamId] = React.useState(completionData?.powderCoatingTeamId ?? "");
  const [pcColor, setPcColor] = React.useState(completionData?.color ?? "");
  const [pcSingleCoat, setPcSingleCoat] = React.useState(completionData?.singleCoat ?? true);
  const [pcDoubleCoat, setPcDoubleCoat] = React.useState(completionData?.doubleCoat ?? false);
  const [pcPointLock, setPcPointLock] = React.useState(completionData?.pointLock ?? false);
  const [pcThreePointLock, setPcThreePointLock] = React.useState(completionData?.threePointLock ?? false);
  const [pcPuGasketing, setPcPuGasketing] = React.useState(completionData?.puGasketing ?? false);
  const [pcPattiGasketing, setPcPattiGasketing] = React.useState(completionData?.pattiGasketing ?? false);
  const [pcAccessoriesOther, setPcAccessoriesOther] = React.useState(completionData?.accessoriesOther ?? "");
  const [pcBodySize, setPcBodySize] = React.useState(completionData?.bodySize ?? "");
  const [pcGlanPlateQty, setPcGlanPlateQty] = React.useState(completionData?.glanPlateQty != null ? String(completionData.glanPlateQty) : "");
  const [pcCChannelQty, setPcCChannelQty] = React.useState(completionData?.cChannelQty != null ? String(completionData.cChannelQty) : "");
  const [pcLPattaQty, setPcLPattaQty] = React.useState(completionData?.lPattaQty != null ? String(completionData.lPattaQty) : "");
  const [pcGhodiQty, setPcGhodiQty] = React.useState(completionData?.ghodiQty != null ? String(completionData.ghodiQty) : "");
  const [pcJChannelQty, setPcJChannelQty] = React.useState(completionData?.jChannelQty != null ? String(completionData.jChannelQty) : "");
  const [pcBasbarCoverQty, setPcBasbarCoverQty] = React.useState(completionData?.basbarCoverQty != null ? String(completionData.basbarCoverQty) : "");
  const [pcBasbarAngleQty, setPcBasbarAngleQty] = React.useState(completionData?.basbarAngleQty != null ? String(completionData.basbarAngleQty) : "");
  const [pcCapacitorPattaQty, setPcCapacitorPattaQty] = React.useState(completionData?.capacitorPattaQty != null ? String(completionData.capacitorPattaQty) : "");
  const [pcBrakerCChannelQty, setPcBrakerCChannelQty] = React.useState(completionData?.brakerCChannelQty != null ? String(completionData.brakerCChannelQty) : "");
  const [pcCanopyQty, setPcCanopyQty] = React.useState(completionData?.canopyQty != null ? String(completionData.canopyQty) : "");
  const [pcBaseQty, setPcBaseQty] = React.useState(completionData?.baseQty != null ? String(completionData.baseQty) : "");
  const [pcStandQty, setPcStandQty] = React.useState(completionData?.standQty != null ? String(completionData.standQty) : "");

  const [designFields, setDesignFields] = React.useState<DesignOrderFieldValues>(() => {
    const r = resolveDesignFormValues(completionData, order);
    return {
      partyName: r.partyName ?? "",
      designerName: r.designerName ?? "",
      panelType: r.panelType ?? "",
      poNo: r.poNo ?? "",
      quantity: r.quantity ?? 0,
      description: r.description ?? "",
      parts: r.parts ?? "",
      customerWoNo: r.customerWoNo ?? "",
      powderCoatingType: r.powderCoatingType ?? "single_coat",
      colorBody: r.colorBody ?? "",
      colorMountingPlate: r.colorMountingPlate ?? "",
      colorBaseStand: r.colorBaseStand ?? "",
      rateType: r.rateType ?? "including_acc",
      rate: r.rate ?? "",
      orderRemarks: r.orderRemarks ?? "",
      pointLock: r.pointLock ?? false,
      threePointLock: r.threePointLock ?? false,
      puGasketing: r.puGasketing ?? false,
      pattiGasketing: r.pattiGasketing ?? false,
      accessoriesOther: r.accessoriesOther ?? "",
    };
  });

  React.useEffect(() => {
    if (open) {
      setFieldErrors({});
      const accObj = (
        order as {
          accessoriesObj?: {
            pointLock?: boolean;
            threePointLock?: boolean;
            puGasketing?: boolean;
            pattiGasketing?: boolean;
            other?: string;
          };
        }
      ).accessoriesObj;
      const accArr = Array.isArray(order.accessories) ? order.accessories : [];

      setRemarks(completionData?.remarks ?? "");
      setSheetQty(
        completionData?.sheetQty != null
          ? String(completionData.sheetQty)
          : order.parts != null
            ? String(order.parts)
            : ""
      );
      setStatusOk(completionData?.statusOk ?? true);
      uploader.reset(completionData?.attachments ?? []);
      setCompletionDateEditable(
        completionData?.completedDate ?? new Date().toISOString().slice(0, 10)
      );
      setFabricatorName(completionData?.fabricatorName ?? "");
      setDeliveryDate(completionData?.deliveryDate ?? "");
      setTeamMemberId(completionData?.teamMemberId ?? "");
      setQualityCheckPassed(completionData?.qualityCheckPassed ?? true);
      setPcWoNo(completionData?.woNo ?? order.orderNo ?? "");
      setPcCustomerName(completionData?.customerName ?? order.partyName ?? "");
      setPcDcNo(completionData?.dcNo ?? "");
      setPcPoNo(completionData?.poNo ?? order.poNo ?? "");
      setPcColorBody(completionData?.colorBody ?? order.colorBody ?? "");
      setPcColorMp(completionData?.colorMp ?? order.colorMountingPlate ?? "");
      setPcColorBase(completionData?.colorBase ?? order.colorBaseStand ?? "");
      setPcContractorName(completionData?.contractorName ?? "");
      setPcDesignerName(completionData?.designerName ?? order.designerName ?? "");
      setPcWeight(completionData?.weight ?? "");
      setPcDoorQty(completionData?.doorQty != null ? String(completionData.doorQty) : "");
      setPcCoverQty(completionData?.coverQty != null ? String(completionData.coverQty) : "");
      setPcMountingPlateQty(completionData?.mountingPlateQty != null ? String(completionData.mountingPlateQty) : "");
      setPcBaseStandQty(completionData?.baseStandQty != null ? String(completionData.baseStandQty) : "");
      setPcCoatingTypeId(completionData?.coatingTypeId ?? "");
      setPcLocationId(completionData?.pcLocationId ?? "");
      setPcBodyColorCode(completionData?.bodyColorCode ?? order.colorBody ?? "");
      setPcVehicleNo(completionData?.vehicleNo ?? "");
      setPcTeamId(completionData?.powderCoatingTeamId ?? "");
      setPcColor(completionData?.color ?? "");
      setPcSingleCoat(completionData?.singleCoat ?? true);
      setPcDoubleCoat(completionData?.doubleCoat ?? false);
      setPcPointLock(
        completionData?.pointLock ?? accObj?.pointLock ?? accArr.includes("point_lock")
      );
      setPcThreePointLock(
        completionData?.threePointLock ?? accObj?.threePointLock ?? accArr.includes("3_point_lock")
      );
      setPcPuGasketing(
        completionData?.puGasketing ?? accObj?.puGasketing ?? accArr.includes("pu_gasketing")
      );
      setPcPattiGasketing(
        completionData?.pattiGasketing ?? accObj?.pattiGasketing ?? accArr.includes("patti_gasketing")
      );
      setPcAccessoriesOther(
        completionData?.accessoriesOther ?? accObj?.other ?? order.accessoriesOther ?? ""
      );
      setPcBodySize(completionData?.bodySize ?? order.description ?? "");
      setPcGlanPlateQty(completionData?.glanPlateQty != null ? String(completionData.glanPlateQty) : "");
      setPcCChannelQty(completionData?.cChannelQty != null ? String(completionData.cChannelQty) : "");
      setPcLPattaQty(completionData?.lPattaQty != null ? String(completionData.lPattaQty) : "");
      setPcGhodiQty(completionData?.ghodiQty != null ? String(completionData.ghodiQty) : "");
      setPcJChannelQty(completionData?.jChannelQty != null ? String(completionData.jChannelQty) : "");
      setPcBasbarCoverQty(completionData?.basbarCoverQty != null ? String(completionData.basbarCoverQty) : "");
      setPcBasbarAngleQty(completionData?.basbarAngleQty != null ? String(completionData.basbarAngleQty) : "");
      setPcCapacitorPattaQty(completionData?.capacitorPattaQty != null ? String(completionData.capacitorPattaQty) : "");
      setPcBrakerCChannelQty(completionData?.brakerCChannelQty != null ? String(completionData.brakerCChannelQty) : "");
      setPcCanopyQty(completionData?.canopyQty != null ? String(completionData.canopyQty) : "");
      setPcBaseQty(completionData?.baseQty != null ? String(completionData.baseQty) : "");
      setPcStandQty(completionData?.standQty != null ? String(completionData.standQty) : "");
      const resolved = resolveDesignFormValues(completionData, order);
      setDesignFields({
        partyName: resolved.partyName ?? "",
        designerName: resolved.designerName ?? "",
        panelType: resolved.panelType ?? "",
        poNo: resolved.poNo ?? "",
        quantity: resolved.quantity ?? 0,
        description: resolved.description ?? "",
        parts: resolved.parts ?? "",
        customerWoNo: resolved.customerWoNo ?? "",
        powderCoatingType: resolved.powderCoatingType ?? "single_coat",
        colorBody: resolved.colorBody ?? "",
        colorMountingPlate: resolved.colorMountingPlate ?? "",
        colorBaseStand: resolved.colorBaseStand ?? "",
        rateType: resolved.rateType ?? "including_acc",
        rate: resolved.rate ?? "",
        orderRemarks: resolved.orderRemarks ?? "",
        pointLock: resolved.pointLock ?? false,
        threePointLock: resolved.threePointLock ?? false,
        puGasketing: resolved.puGasketing ?? false,
        pattiGasketing: resolved.pattiGasketing ?? false,
        accessoriesOther: resolved.accessoriesOther ?? "",
      });
    }
  }, [open, completionData, order]);

  const executedBy = completionData?.executedBy ?? "System";
  const completedDate = completionData?.completedDate
    ? new Date(completionData.completedDate).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
  const recordedAt = completionData?.recordedAt
    ? new Date(completionData.recordedAt).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });

  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (stageKey === "sheet_processing") {
      if (sheetQty === "" || (Number(sheetQty) === 0 && sheetQty.trim() === ""))
        errors.sheetQty = "Sheet quantity is required";
      else if (Number(sheetQty) < 0) errors.sheetQty = "Sheet quantity cannot be negative";
    } else if (isFabricationStage(stageKey) || isCombinedFabricationPowderCoating(stageKey)) {
      if (!completionDateEditable?.trim()) errors.completionDate = "Completion date is required";
      if (!fabricatorName?.trim()) errors.fabricatorName = "Fabricator name is required";
      if (!deliveryDate?.trim()) errors.deliveryDate = "Delivery date is required";
      if (!teamMemberId || teamMemberId === "_none") errors.teamMember = "Team member is required";
      if (!remarks?.trim()) errors.remarks = "Remarks / notes are required";
    } else if (isPowderCoatingOrDispatchStage(stageKey)) {
      if (!completionDateEditable?.trim()) errors.completionDate = "Completion date is required";
      if (!pcWoNo?.trim()) errors.woNo = "WO No. is required";
      if (!pcCustomerName?.trim()) errors.customerName = "Customer name is required";
      if (!remarks?.trim()) errors.remarks = "Remarks / notes are required";
    } else if (stageKey === "design_preparation") {
      if (!designFields.partyName?.trim()) errors.partyName = "Party name is required";
      if (!designFields.designerName?.trim()) errors.designerName = "Designer name is required";
      if (!designFields.panelType?.trim()) errors.panelType = "Panel type is required";
      if (!designFields.description?.trim()) errors.description = "Description is required";
      if (!designFields.customerWoNo?.trim()) errors.customerWoNo = "Customer WO No is required";
      if (!designFields.quantity || Number(designFields.quantity) < 1) errors.quantity = "Quantity must be at least 1";
      if (designFields.parts === "" || designFields.parts == null) errors.parts = "Parts is required";
      if (!designFields.colorBody?.trim()) errors.colorBody = "Body color is required";
      if (!designFields.colorMountingPlate?.trim()) errors.colorMountingPlate = "Mounting plate color is required";
      if (!designFields.colorBaseStand?.trim()) errors.colorBaseStand = "Base/Stand color is required";
      if (!designFields.rate?.trim()) errors.rate = "Rate is required";
      if (!remarks?.trim()) errors.remarks = "Remarks / notes are required";
    } else {
      if (!remarks?.trim()) errors.remarks = "Remarks / notes are required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (saveIntent?: SheetSaveIntent) => {
    if (!validate()) return;
    // Guard: don't let a save race with in-flight uploads or skip failed files.
    if (uploader.status === "uploading") {
      setFieldErrors({ attachments: "Please wait for images to finish uploading." });
      return;
    }
    if (uploader.status === "has_errors") {
      setFieldErrors({
        attachments: "Retry or remove failed images before saving.",
      });
      return;
    }
    const data: Parameters<NonNullable<typeof onSave>>[0] = {
      proofFileName: completionData?.proofFileName,
      proofPreviewUrl: completionData?.proofPreviewUrl,
      remarks: remarks.trim() || undefined,
      sheetQty: sheetQty ? (Number(sheetQty) || sheetQty) : undefined,
      statusOk,
      attachments: uploader.attachments,
    };
    if (isFabricationStage(stageKey) || isCombinedFabricationPowderCoating(stageKey)) {
      data.completionDate = completionDateEditable || undefined;
      data.fabricatorName = fabricatorName.trim() || undefined;
      data.deliveryDate = deliveryDate || undefined;
      data.teamMemberId = teamMemberId || undefined;
      data.qualityCheckPassed = qualityCheckPassed;
    }
    if (isPowderCoatingOrDispatchStage(stageKey) || isCombinedFabricationPowderCoating(stageKey)) {
      data.completionDate = completionDateEditable || undefined;
      data.woNo = pcWoNo.trim() || undefined;
      data.customerName = pcCustomerName.trim() || undefined;
      data.dcNo = pcDcNo.trim() || undefined;
      data.poNo = pcPoNo.trim() || undefined;
      data.colorBody = pcColorBody.trim() || undefined;
      data.colorMp = pcColorMp.trim() || undefined;
      data.colorBase = pcColorBase.trim() || undefined;
      data.contractorName = pcContractorName.trim() || undefined;
      data.designerName = pcDesignerName.trim() || undefined;
      data.weight = pcWeight.trim() || undefined;
      data.doorQty = pcDoorQty ? (Number(pcDoorQty) || pcDoorQty) : undefined;
      data.coverQty = pcCoverQty ? (Number(pcCoverQty) || pcCoverQty) : undefined;
      data.mountingPlateQty = pcMountingPlateQty ? (Number(pcMountingPlateQty) || pcMountingPlateQty) : undefined;
      data.baseStandQty = pcBaseStandQty ? (Number(pcBaseStandQty) || pcBaseStandQty) : undefined;
      data.coatingTypeId = pcCoatingTypeId && pcCoatingTypeId !== "_none" ? pcCoatingTypeId : undefined;
      data.pcLocationId = pcLocationId && pcLocationId !== "_none" ? pcLocationId : undefined;
      data.bodyColorCode = pcBodyColorCode.trim() || undefined;
      data.vehicleNo = pcVehicleNo.trim() || undefined;
      data.powderCoatingTeamId = isCombinedFabricationPowderCoating(stageKey)
        ? undefined
        : pcTeamId && pcTeamId !== "_none"
          ? pcTeamId
          : undefined;
      data.color = pcColor.trim() || undefined;
      data.singleCoat = pcSingleCoat;
      data.doubleCoat = pcDoubleCoat;
      data.pointLock = pcPointLock;
      data.threePointLock = pcThreePointLock;
      data.puGasketing = pcPuGasketing;
      data.pattiGasketing = pcPattiGasketing;
      data.accessoriesOther = pcAccessoriesOther.trim() || undefined;
      data.bodySize = pcBodySize.trim() || undefined;
      data.glanPlateQty = pcGlanPlateQty ? (Number(pcGlanPlateQty) || pcGlanPlateQty) : undefined;
      data.cChannelQty = pcCChannelQty ? (Number(pcCChannelQty) || pcCChannelQty) : undefined;
      data.lPattaQty = pcLPattaQty ? (Number(pcLPattaQty) || pcLPattaQty) : undefined;
      data.ghodiQty = pcGhodiQty ? (Number(pcGhodiQty) || pcGhodiQty) : undefined;
      data.jChannelQty = pcJChannelQty ? (Number(pcJChannelQty) || pcJChannelQty) : undefined;
      data.basbarCoverQty = pcBasbarCoverQty ? (Number(pcBasbarCoverQty) || pcBasbarCoverQty) : undefined;
      data.basbarAngleQty = pcBasbarAngleQty ? (Number(pcBasbarAngleQty) || pcBasbarAngleQty) : undefined;
      data.capacitorPattaQty = pcCapacitorPattaQty ? (Number(pcCapacitorPattaQty) || pcCapacitorPattaQty) : undefined;
      data.brakerCChannelQty = pcBrakerCChannelQty ? (Number(pcBrakerCChannelQty) || pcBrakerCChannelQty) : undefined;
      data.canopyQty = pcCanopyQty ? (Number(pcCanopyQty) || pcCanopyQty) : undefined;
      data.baseQty = pcBaseQty ? (Number(pcBaseQty) || pcBaseQty) : undefined;
      data.standQty = pcStandQty ? (Number(pcStandQty) || pcStandQty) : undefined;
    }
    if (stageKey === "design_preparation") {
      data.partyName = designFields.partyName?.trim() || undefined;
      data.designerName = designFields.designerName?.trim() || undefined;
      data.panelType = designFields.panelType?.trim() || undefined;
      data.poNo = designFields.poNo?.trim() || undefined;
      data.quantity = designFields.quantity;
      data.description = designFields.description?.trim() || undefined;
      data.parts = designFields.parts;
      data.customerWoNo = designFields.customerWoNo?.trim() || undefined;
      data.powderCoatingType = designFields.powderCoatingType;
      data.colorBody = designFields.colorBody?.trim() || undefined;
      data.colorMountingPlate = designFields.colorMountingPlate?.trim() || undefined;
      data.colorBaseStand = designFields.colorBaseStand?.trim() || undefined;
      data.rateType = designFields.rateType;
      data.rate = designFields.rate?.trim() || undefined;
      data.orderRemarks = designFields.orderRemarks?.trim() || undefined;
      data.pointLock = designFields.pointLock;
      data.threePointLock = designFields.threePointLock;
      data.puGasketing = designFields.puGasketing;
      data.pattiGasketing = designFields.pattiGasketing;
      data.accessoriesOther = designFields.accessoriesOther?.trim() || undefined;
    }
    if (!onSave) return;
    setSaving(true);
    try {
      const options: StageSaveOptions | undefined =
        stageKey === "sheet_processing" && mode === "complete" && saveIntent
          ? { intent: saveIntent }
          : undefined;
      const shouldClose = await onSave(data, options);
      if (shouldClose !== false) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setRemarks(completionData?.remarks ?? "");
      setSheetQty(
        completionData?.sheetQty != null
          ? String(completionData.sheetQty)
          : order.parts != null
            ? String(order.parts)
            : ""
      );
      setStatusOk(completionData?.statusOk ?? true);
      uploader.reset(completionData?.attachments ?? []);
      setCompletionDateEditable(
        completionData?.completedDate ?? new Date().toISOString().slice(0, 10)
      );
      setFabricatorName(completionData?.fabricatorName ?? "");
      setDeliveryDate(completionData?.deliveryDate ?? "");
      setTeamMemberId(completionData?.teamMemberId ?? "");
      setQualityCheckPassed(completionData?.qualityCheckPassed ?? true);
      setPcWoNo(completionData?.woNo ?? order.orderNo ?? "");
      setPcCustomerName(completionData?.customerName ?? order.partyName ?? "");
      setPcDcNo(completionData?.dcNo ?? "");
      setPcPoNo(completionData?.poNo ?? order.poNo ?? "");
      setPcColorBody(completionData?.colorBody ?? "");
      setPcColorMp(completionData?.colorMp ?? "");
      setPcColorBase(completionData?.colorBase ?? "");
      setPcContractorName(completionData?.contractorName ?? "");
      setPcDesignerName(completionData?.designerName ?? "");
      setPcWeight(completionData?.weight ?? "");
      setPcDoorQty(completionData?.doorQty != null ? String(completionData.doorQty) : "");
      setPcCoverQty(completionData?.coverQty != null ? String(completionData.coverQty) : "");
      setPcMountingPlateQty(completionData?.mountingPlateQty != null ? String(completionData.mountingPlateQty) : "");
      setPcBaseStandQty(completionData?.baseStandQty != null ? String(completionData.baseStandQty) : "");
      setPcCoatingTypeId(completionData?.coatingTypeId ?? "");
      setPcLocationId(completionData?.pcLocationId ?? "");
      setPcBodyColorCode(completionData?.bodyColorCode ?? "");
      setPcVehicleNo(completionData?.vehicleNo ?? "");
      setPcTeamId(completionData?.powderCoatingTeamId ?? "");
      setPcColor(completionData?.color ?? "");
      setPcSingleCoat(completionData?.singleCoat ?? true);
      setPcDoubleCoat(completionData?.doubleCoat ?? false);
      setPcPointLock(completionData?.pointLock ?? false);
      setPcThreePointLock(completionData?.threePointLock ?? false);
      setPcPuGasketing(completionData?.puGasketing ?? false);
      setPcPattiGasketing(completionData?.pattiGasketing ?? false);
      setPcAccessoriesOther(completionData?.accessoriesOther ?? "");
      setPcBodySize(completionData?.bodySize ?? "");
      setPcGlanPlateQty(completionData?.glanPlateQty != null ? String(completionData.glanPlateQty) : "");
      setPcCChannelQty(completionData?.cChannelQty != null ? String(completionData.cChannelQty) : "");
      setPcLPattaQty(completionData?.lPattaQty != null ? String(completionData.lPattaQty) : "");
      setPcGhodiQty(completionData?.ghodiQty != null ? String(completionData.ghodiQty) : "");
      setPcJChannelQty(completionData?.jChannelQty != null ? String(completionData.jChannelQty) : "");
      setPcBasbarCoverQty(completionData?.basbarCoverQty != null ? String(completionData.basbarCoverQty) : "");
      setPcBasbarAngleQty(completionData?.basbarAngleQty != null ? String(completionData.basbarAngleQty) : "");
      setPcCapacitorPattaQty(completionData?.capacitorPattaQty != null ? String(completionData.capacitorPattaQty) : "");
      setPcBrakerCChannelQty(completionData?.brakerCChannelQty != null ? String(completionData.brakerCChannelQty) : "");
      setPcCanopyQty(completionData?.canopyQty != null ? String(completionData.canopyQty) : "");
      setPcBaseQty(completionData?.baseQty != null ? String(completionData.baseQty) : "");
      setPcStandQty(completionData?.standQty != null ? String(completionData.standQty) : "");
    }
    onOpenChange(open);
  };

  const showEditInputs = (mode === "edit" || mode === "complete") && isAuthorized;
  const showSheetDualActions =
    stageKey === "sheet_processing" && mode === "complete" && isOrderCurrentStage;
  const sheetHistoricalEdit =
    stageKey === "sheet_processing" && !isOrderCurrentStage && showEditInputs;
  const isDispatchStage = stageKey === "dispatch_validation";
  const pcDispatchQtyClass = cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass);
  const pcDispatchBodySizeClass = cn("h-9 text-sm max-w-[200px]", isDispatchStage && dispatchAutofillInputClass);

  return (
    <Dialog open={open} onOpenChange={handleClose as (open: boolean) => void}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] max-w-[min(520px,calc(100vw-2rem))] max-h-[90vh] p-0 gap-0 overflow-hidden bg-card border-card-border",
          "flex flex-col"
        )}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 p-4 sm:p-6 pb-4 pr-10 sm:pr-12 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            {isViewMode && (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
            )}
            <DialogTitle className="text-base font-semibold uppercase tracking-wide text-foreground truncate">
              {mode === "edit"
                ? `Edit: ${stageLabel}`
                : isCombinedFabricationPowderCoating(stageKey)
                  ? mode === "complete"
                    ? "Update Stage: FABRICATION"
                    : stageLabel
                  : isFabricationStage(stageKey) || isPowderCoatingOrDispatchStage(stageKey)
                    ? mode === "complete"
                      ? `Update Stage: ${stageLabel.toUpperCase()}`
                      : stageLabel
                    : `${stageLabel} ${isViewMode ? "Completed" : mode === "complete" ? "Update" : ""}`}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {mode === "edit"
              ? "Update saved details for this stage. Workflow will not advance."
              : isCombinedFabricationPowderCoating(stageKey)
                ? "Fabrication and Powder Coating"
                : isFabricationStage(stageKey) || isPowderCoatingOrDispatchStage(stageKey)
                  ? mode === "complete"
                    ? "Enter the details to complete this stage and move to the next step."
                    : "Stage details and collected data."
                  : "Stage details and collected data."}
          </DialogDescription>
        </DialogHeader>

        {!isViewMode && !isAuthorized && (
          <div className="shrink-0 mx-4 sm:mx-6 mb-3 rounded-md border border-orange-500/70 bg-orange-500/10 px-3 py-2">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Not allowed to change/update
            </p>
          </div>
        )}

        {sheetHistoricalEdit && (
          <div className="shrink-0 mx-4 sm:mx-6 mb-3 rounded-md border border-amber-500/70 bg-amber-500/10 px-3 py-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Historical edit — saves via PATCH …/edit. Setting QC to NOT OK returns the order to
              Sheet Processing and clears later stages.
            </p>
          </div>
        )}

        {Object.keys(fieldErrors).length > 0 && (
          <div className="shrink-0 mx-4 sm:mx-6 mb-3 rounded-md border border-destructive/70 bg-destructive/10 px-3 py-2">
            <p className="text-sm font-medium text-destructive mb-1">Please fix the following:</p>
            <ul className="text-sm text-destructive list-disc list-inside space-y-0.5">
              {Object.entries(fieldErrors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4 space-y-5">
          {isCombinedFabricationPowderCoating(stageKey) ? (
            /* Combined Fabrication + Powder Coating (Stage 3 & 4) */
            <>
              {/* Completion Date (to fill) */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Completion Date
                </Label>
                <DatePicker
                  value={completionDateEditable}
                  onChange={setCompletionDateEditable}
                  placeholder="Pick completion date"
                  triggerClassName={cn("h-9 text-sm w-full border rounded-md bg-background", combinedModalFieldClass)}
                />
              </div>

              {/* ——— FABRICATION ——— */}
              <div className="space-y-3 p-3 sm:p-4 rounded-lg border border-border/50">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border pb-2">
                  Stage 3 — Fabrication
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WO NO</Label>
                    <Input value={order.orderNo ?? ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Designer Name</Label>
                    <Input value={order.designerName ?? ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                    <Input value={order.date ? new Date(order.date).toLocaleDateString() : ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Party Name</Label>
                    <Input value={order.partyName ?? ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Panel Type</Label>
                    <Input value={order.panelType ?? ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Input value={order.description ?? ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parts (BH)</Label>
                    <Input type="number" value={order.parts ?? "0"} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Panel Qty</Label>
                    <Input type="number" value={order.quantity ?? 0} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fabricator Name</Label>
                    {showEditInputs ? (
                      <Input value={fabricatorName} onChange={(e) => setFabricatorName(e.target.value)} className={combinedModalFieldClass} placeholder="Fabricator name" />
                    ) : (
                      <Input value={completionData?.fabricatorName ?? ""} readOnly className={combinedModalFieldClass} />
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery Date Given by Fabricator</Label>
                    {showEditInputs ? (
                      <DatePicker value={deliveryDate} onChange={setDeliveryDate} placeholder="Pick date" triggerClassName={cn("h-9 text-sm w-full border rounded-md bg-background", combinedModalFieldClass)} />
                    ) : (
                      <Input value={completionData?.deliveryDate ? new Date(completionData.deliveryDate).toLocaleDateString() : ""} readOnly className={combinedModalFieldClass} />
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-2 flex items-center gap-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completed or Not</Label>
                    {showEditInputs ? (
                      <Checkbox checked={qualityCheckPassed} onCheckedChange={(v) => setQualityCheckPassed(v === true)} />
                    ) : (
                      <span className="text-sm">{(completionData?.qualityCheckPassed ?? true) ? "Yes" : "No"}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Images (multi-file, S3 via presigned PUT) */}
              <StageImageUploader uploader={uploader} readOnly={!showEditInputs} />

              {/* Team Member (to fill) */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Team Member</Label>
                {showEditInputs ? (
                  <Select value={teamMemberId} onValueChange={setTeamMemberId}>
                    <SelectTrigger className={combinedModalFieldClass}>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent className="z-[10002] bg-white">
                      {teamMemberOptions?.length ? teamMemberOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      )) : <SelectItem value="_none" disabled>No team members</SelectItem>}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium py-2">{teamMemberOptions?.find((o) => o.value === completionData?.teamMemberId)?.label ?? "—"}</p>
                )}
              </div>

              {/* ——— SEPARATOR ——— */}
              <div className="border-t-2 border-primary/30 py-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-primary text-center">
                  Challan for Powder Coating
                </h4>
                <p className="text-[11px] text-muted-foreground text-center mt-1">Stage 4 — Powder Coating</p>
              </div>

              {/* ——— POWDER COATING ——— */}
              <div className="space-y-3 p-3 sm:p-4 rounded-lg border border-border/50">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border pb-2">
                  Powder Coating Details
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WO.NO.</Label>
                    <Input value={pcWoNo || (order.orderNo ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Name</Label>
                    <Input value={pcCustomerName || (order.partyName ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">D.C. NO.</Label>
                    <Input value={pcDcNo} onChange={(e) => setPcDcNo(e.target.value)} className={combinedModalFieldClass} placeholder="D.C. No." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">P.O.NO.</Label>
                    <Input value={pcPoNo} onChange={(e) => setPcPoNo(e.target.value)} className={combinedModalFieldClass} placeholder="P.O. No." />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">COLOR</Label>
                    <Input value={pcColor} onChange={(e) => setPcColor(e.target.value)} className={combinedModalFieldClass} placeholder="Color" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body</Label>
                    <Input value={pcColorBody || (order.colorBody ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">M.P. (Mounting Plate)</Label>
                    <Input value={pcColorMp || (order.colorMountingPlate ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base (Color)</Label>
                    <Input value={pcColorBase || (order.colorBaseStand ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                </div>
                <div className="space-y-1.5 pt-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Panel Details</Label>
                  <Input value={order.description ?? order.panelType ?? ""} readOnly className={combinedModalFieldClass} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contractor Name</Label>
                    <Input value={pcContractorName || ""} readOnly className={combinedModalFieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Designer Name</Label>
                    <Input value={pcDesignerName || (order.designerName ?? "")} readOnly className={combinedModalFieldClass} />
                  </div>
                </div>
                <div className="pt-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Weight</Label>
                  <Input value={pcWeight} onChange={(e) => setPcWeight(e.target.value)} className={cn(combinedModalFieldClass, "max-w-[120px]")} placeholder="Weight" />
                </div>
                <div className="pt-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Powder Coating Type</Label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={pcSingleCoat} onCheckedChange={(v) => { setPcSingleCoat(v === true); setPcDoubleCoat(false); }} />
                      <span className="text-sm">Single Coat</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={pcDoubleCoat} onCheckedChange={(v) => { setPcDoubleCoat(v === true); setPcSingleCoat(false); }} />
                      <span className="text-sm">Double Coat</span>
                    </label>
                  </div>
                </div>
                <div className="pt-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Color Code of Panel</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px] text-muted-foreground">Body</Label><Input value={pcColorBody || (order.colorBody ?? "")} readOnly className={combinedModalFieldClass} /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Mounting Plate</Label><Input value={pcColorMp || (order.colorMountingPlate ?? "")} readOnly className={combinedModalFieldClass} /></div>
                    <div><Label className="text-[10px] text-muted-foreground">Base/Stand</Label><Input value={pcColorBase || (order.colorBaseStand ?? "")} readOnly className={combinedModalFieldClass} /></div>
                  </div>
                </div>
                <div className="pt-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Accessories</Label>
                  {(() => {
                    const accObj = (order as { accessoriesObj?: { pointLock?: boolean; threePointLock?: boolean; puGasketing?: boolean; pattiGasketing?: boolean; other?: string } }).accessoriesObj;
                    return (
                      <>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!(accObj?.pointLock ?? pcPointLock)} disabled />
                            <span className="text-sm">Point Lock</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!(accObj?.threePointLock ?? pcThreePointLock)} disabled />
                            <span className="text-sm">3 Point Lock</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!(accObj?.puGasketing ?? pcPuGasketing)} disabled />
                            <span className="text-sm">PU Gasketing</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!(accObj?.pattiGasketing ?? pcPattiGasketing)} disabled />
                            <span className="text-sm">Patti Gasketing</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Label className="text-[10px] text-muted-foreground">Any Other</Label>
                          <Input value={pcAccessoriesOther} onChange={(e) => setPcAccessoriesOther(e.target.value)} className={combinedModalFieldClass} placeholder="Other accessories" />
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body Size</Label>
                    <Input value={pcBodySize} onChange={(e) => setPcBodySize(e.target.value)} className={combinedModalFieldClass} placeholder="Body size" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicle No.</Label>
                    <Input value={pcVehicleNo} onChange={(e) => setPcVehicleNo(e.target.value)} className={combinedModalFieldClass} placeholder="Vehicle No." />
                  </div>
                </div>
                <div className="space-y-1.5 pt-2 max-w-md">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fabrication Location</Label>
                  <Select value={pcLocationId} onValueChange={setPcLocationId}>
                    <SelectTrigger className={combinedModalFieldClass}><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent className="z-[10002] bg-white">
                      <SelectItem value="_none">Select</SelectItem>
                      {pcLocationOptions?.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>) ?? null}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                  {[
                    { label: "Door", value: pcDoorQty, set: setPcDoorQty },
                    { label: "Cover", value: pcCoverQty, set: setPcCoverQty },
                    { label: "Glan Plate", value: pcGlanPlateQty, set: setPcGlanPlateQty },
                    { label: "Mounting Plate", value: pcMountingPlateQty, set: setPcMountingPlateQty },
                    { label: "C-Channel", value: pcCChannelQty, set: setPcCChannelQty },
                    { label: "L-Patta", value: pcLPattaQty, set: setPcLPattaQty },
                    { label: "Ghodi", value: pcGhodiQty, set: setPcGhodiQty },
                    { label: "J-Channel", value: pcJChannelQty, set: setPcJChannelQty },
                    { label: "Basbar Cover", value: pcBasbarCoverQty, set: setPcBasbarCoverQty },
                    { label: "Basbar Angle", value: pcBasbarAngleQty, set: setPcBasbarAngleQty },
                    { label: "Canopy", value: pcCanopyQty, set: setPcCanopyQty },
                    { label: "Base", value: pcBaseQty, set: setPcBaseQty },
                    { label: "Stand", value: pcStandQty, set: setPcStandQty },
                  ].map(({ label, value, set }) => (
                    <div key={label} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input type="number" value={value} onChange={(e) => set(e.target.value)} className={combinedModalFieldClass} placeholder="Qty" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks (to fill) */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
                {showEditInputs ? (
                  <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="min-h-[72px] resize-none text-sm" placeholder="Add remarks or notes…" />
                ) : (
                  <p className="text-sm text-muted-foreground italic rounded-md border border-border/50 bg-muted/20 px-3 py-2">&ldquo;{completionData?.remarks ?? "—"}&rdquo;</p>
                )}
              </div>
            </>
          ) : isPowderCoatingOrDispatchStage(stageKey) ? (
            /* Powder Coating stage layout */
            <>
              {/* Completion Date */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Completion Date
                </Label>
                <DatePicker
                  value={completionDateEditable}
                  onChange={setCompletionDateEditable}
                  placeholder="Pick completion date"
                  triggerClassName="h-9 text-sm w-full"
                />
              </div>

              {/* Upload Images (multi-file, S3 via presigned PUT) */}
              <StageImageUploader uploader={uploader} readOnly={!showEditInputs} />

              {/* Job Card Details (POWDER COATING) */}
              <div
                className={cn(
                  "space-y-3 p-3 sm:p-4 rounded-lg border border-border/50",
                  isDispatchStage ? dispatchAutofillMutedSectionClass : "bg-muted/50"
                )}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Job Card Details ({stageLabel.toUpperCase()})
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WO.NO.</Label>
                    <Input
                      value={pcWoNo}
                      onChange={(e) => setPcWoNo(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="WO Number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Name</Label>
                    <Input
                      value={pcCustomerName}
                      onChange={(e) => setPcCustomerName(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="Customer Name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">D.C. NO.</Label>
                    <Input value={pcDcNo} onChange={(e) => setPcDcNo(e.target.value)} className="h-9 text-sm" placeholder="D.C. No." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PO.NO.</Label>
                    <Input
                      value={pcPoNo}
                      onChange={(e) => setPcPoNo(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="PO No."
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Color</Label>
                    <Input
                      value={pcColor}
                      onChange={(e) => setPcColor(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="Color"
                    />
                  </div>
                </div>
              </div>

              {/* POWDER COATING TYPE */}
              <div
                className={cn(
                  "space-y-3 p-3 sm:p-4 rounded-lg border border-border/50",
                  isDispatchStage ? dispatchAutofillMutedSectionClass : "bg-muted/50"
                )}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Powder Coating Type
                </h4>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pc-single-coat"
                      checked={pcSingleCoat}
                      disabled={isDispatchStage}
                      onCheckedChange={(v) => setPcSingleCoat(v === true)}
                    />
                    <Label htmlFor="pc-single-coat" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                      Single Coat
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pc-double-coat"
                      checked={pcDoubleCoat}
                      disabled={isDispatchStage}
                      onCheckedChange={(v) => setPcDoubleCoat(v === true)}
                    />
                    <Label htmlFor="pc-double-coat" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                      Double Coat
                    </Label>
                  </div>
                </div>
              </div>

              {/* COLOR CODE OF PANEL */}
              <div
                className={cn(
                  "space-y-3 p-3 sm:p-4 rounded-lg border border-border/50",
                  isDispatchStage ? dispatchAutofillMutedSectionClass : "bg-muted/50"
                )}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Color Code of Panel
                </h4>
                <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body</Label>
                    <Input
                      value={pcColorBody}
                      onChange={(e) => setPcColorBody(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="e.g. RAL-7035"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mounting Plate</Label>
                    <Input
                      value={pcColorMp}
                      onChange={(e) => setPcColorMp(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="e.g. ORANGE"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base/Stand</Label>
                    <Input
                      value={pcColorBase}
                      onChange={(e) => setPcColorBase(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="e.g. BLACK"
                    />
                  </div>
                </div>
              </div>

              {/* ACCESSORIES */}
              <div
                className={cn(
                  "space-y-3 p-3 sm:p-4 rounded-lg border border-border/50",
                  isDispatchStage ? dispatchAutofillMutedSectionClass : "bg-muted/50"
                )}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Accessories
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pc-point-lock"
                        checked={pcPointLock}
                        disabled={isDispatchStage}
                        onCheckedChange={(v) => setPcPointLock(v === true)}
                      />
                      <Label htmlFor="pc-point-lock" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                        Point Lock
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pc-3-point-lock"
                        checked={pcThreePointLock}
                        disabled={isDispatchStage}
                        onCheckedChange={(v) => setPcThreePointLock(v === true)}
                      />
                      <Label htmlFor="pc-3-point-lock" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                        3 Point Lock
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pc-pu-gasketing"
                        checked={pcPuGasketing}
                        disabled={isDispatchStage}
                        onCheckedChange={(v) => setPcPuGasketing(v === true)}
                      />
                      <Label htmlFor="pc-pu-gasketing" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                        PU Gasketing
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pc-patti-gasketing"
                        checked={pcPattiGasketing}
                        disabled={isDispatchStage}
                        onCheckedChange={(v) => setPcPattiGasketing(v === true)}
                      />
                      <Label htmlFor="pc-patti-gasketing" className={cn("text-sm font-medium", isDispatchStage ? "cursor-default" : "cursor-pointer")}>
                        Patti Gasketing
                      </Label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Any Other</Label>
                    <Input
                      value={pcAccessoriesOther}
                      onChange={(e) => setPcAccessoriesOther(e.target.value)}
                      readOnly={isDispatchStage}
                      className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                      placeholder="Any other accessories"
                    />
                  </div>
                </div>
              </div>

              {/* Contractor Name & Designer Name */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contractor Name</Label>
                  <Input
                    value={pcContractorName}
                    onChange={(e) => setPcContractorName(e.target.value)}
                    readOnly={isDispatchStage}
                    className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                    placeholder="Contractor"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Designer Name</Label>
                  <Input
                    value={pcDesignerName}
                    onChange={(e) => setPcDesignerName(e.target.value)}
                    readOnly={isDispatchStage}
                    className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                    placeholder="Designer"
                  />
                </div>
              </div>

              {/* Weight */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weight</Label>
                <Input value={pcWeight} onChange={(e) => setPcWeight(e.target.value)} className="h-9 text-sm" placeholder="Weight" />
              </div>

              {/* MATERIAL QUANTITIES */}
              <div
                className={cn(
                  "space-y-3 p-3 sm:p-4 rounded-lg border border-border/50",
                  isDispatchStage ? dispatchAutofillMutedSectionClass : "bg-muted/50"
                )}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Material Quantities
                </h4>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body Size</Label>
                  <Input
                    value={pcBodySize}
                    onChange={(e) => setPcBodySize(e.target.value)}
                    readOnly={isDispatchStage}
                    className={pcDispatchBodySizeClass}
                    placeholder="Body size"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Door</Label>
                    <Input
                      type="number"
                      value={pcDoorQty}
                      onChange={(e) => setPcDoorQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cover</Label>
                    <Input
                      type="number"
                      value={pcCoverQty}
                      onChange={(e) => setPcCoverQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Glan Plate</Label>
                    <Input
                      type="number"
                      value={pcGlanPlateQty}
                      onChange={(e) => setPcGlanPlateQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mounting Plate</Label>
                    <Input
                      type="number"
                      value={pcMountingPlateQty}
                      onChange={(e) => setPcMountingPlateQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">C-Channel</Label>
                    <Input
                      type="number"
                      value={pcCChannelQty}
                      onChange={(e) => setPcCChannelQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">L-Patta</Label>
                    <Input
                      type="number"
                      value={pcLPattaQty}
                      onChange={(e) => setPcLPattaQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ghodi</Label>
                    <Input
                      type="number"
                      value={pcGhodiQty}
                      onChange={(e) => setPcGhodiQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">J-Channel</Label>
                    <Input
                      type="number"
                      value={pcJChannelQty}
                      onChange={(e) => setPcJChannelQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Basbar Cover</Label>
                    <Input
                      type="number"
                      value={pcBasbarCoverQty}
                      onChange={(e) => setPcBasbarCoverQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Basbar Angle</Label>
                    <Input
                      type="number"
                      value={pcBasbarAngleQty}
                      onChange={(e) => setPcBasbarAngleQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Capacitor Patta</Label>
                    <Input
                      type="number"
                      value={pcCapacitorPattaQty}
                      onChange={(e) => setPcCapacitorPattaQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Braker C Channel</Label>
                    <Input
                      type="number"
                      value={pcBrakerCChannelQty}
                      onChange={(e) => setPcBrakerCChannelQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canopy</Label>
                    <Input
                      type="number"
                      value={pcCanopyQty}
                      onChange={(e) => setPcCanopyQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base</Label>
                    <Input
                      type="number"
                      value={pcBaseQty}
                      onChange={(e) => setPcBaseQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stand</Label>
                    <Input
                      type="number"
                      value={pcStandQty}
                      onChange={(e) => setPcStandQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base/Stand</Label>
                    <Input
                      type="number"
                      value={pcBaseStandQty}
                      onChange={(e) => setPcBaseStandQty(e.target.value)}
                      readOnly={isDispatchStage}
                      className={pcDispatchQtyClass}
                      placeholder="Qty"
                    />
                  </div>
                </div>
              </div>

              {/* Coating Type & PC Location */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coating Type</Label>
                  <Select value={pcCoatingTypeId} onValueChange={setPcCoatingTypeId} disabled={isDispatchStage}>
                    <SelectTrigger className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10002] bg-white">
                      <SelectItem value="_none">Select</SelectItem>
                      {coatingTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PC Location</Label>
                  <Select value={pcLocationId} onValueChange={setPcLocationId} disabled={isDispatchStage}>
                    <SelectTrigger className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10002] bg-white">
                      <SelectItem value="_none">Select</SelectItem>
                      {pcLocationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Body Color Code & Vehicle No. */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body Color Code</Label>
                  <Input
                    value={pcBodyColorCode}
                    onChange={(e) => setPcBodyColorCode(e.target.value)}
                    readOnly={isDispatchStage}
                    className={cn("h-9 text-sm", isDispatchStage && dispatchAutofillInputClass)}
                    placeholder="e.g. RAL-7035"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicle No.</Label>
                  <Input value={pcVehicleNo} onChange={(e) => setPcVehicleNo(e.target.value)} className="h-9 text-sm" placeholder="Vehicle No." />
                </div>
              </div>

              {/* Powder Coating Team (hidden on Dispatch — data comes from Fabrication stage) */}
              {!isDispatchStage && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Powder Coating Team
                  </Label>
                  <Select value={pcTeamId} onValueChange={setPcTeamId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent className="z-[10002] bg-white">
                      {powderCoatingTeamOptions.length === 0 ? (
                        <SelectItem value="_none" disabled>No teams</SelectItem>
                      ) : (
                        powderCoatingTeamOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Remarks / Notes */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Remarks / Notes
                </Label>
                {showEditInputs ? (
                  <Textarea
                    placeholder="Enter any specific notes for this stage..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="min-h-[72px] resize-none text-sm"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                    &ldquo;{completionData?.remarks ?? "—"}&rdquo;
                  </p>
                )}
              </div>
            </>
          ) : stageKey === "design_preparation" ? (
            /* Design stage: show create order details (order as created) */
            <>
              {/* Completion Overview */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border/50">
                <ModalField label="Completion Date" value={completedDate} />
                <ModalField
                  label="Executed By"
                  value={
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 bg-primary text-primary-foreground">
                        <AvatarFallback className="text-xs">
                          {executedBy.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{executedBy}</span>
                    </div>
                  }
                />
              </div>

              {/* Order Details (Create Order details) */}
              <div className="space-y-3 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border/50">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-primary/30 pb-1.5">
                  Order Details
                </h4>
                <p className="text-xs text-muted-foreground">
                  {showEditInputs
                    ? "Edit order details saved with this design stage."
                    : "Details captured when the order was created (Design stage)."}
                </p>
                <DesignStageOrderFields
                  readOnly={!showEditInputs}
                  values={
                    showEditInputs
                      ? designFields
                      : resolveDesignFormValues(completionData, order)
                  }
                  onChange={(patch) => setDesignFields((prev) => ({ ...prev, ...patch }))}
                  fieldErrors={fieldErrors}
                  workOrderNo={order.orderNo ?? "—"}
                  orderDate={order.date}
                />
              </div>

              {/* Images / Attachments (multi-file, S3 via presigned PUT) */}
              <StageImageUploader
                uploader={uploader}
                readOnly={!showEditInputs}
                label="Images"
              />

              {/* Remarks / Notes */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Remarks / Notes
                </h4>
                {showEditInputs ? (
                  <Textarea
                    placeholder="Add remarks or notes for this stage..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="min-h-[72px] resize-none text-sm"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                    &ldquo;{completionData?.remarks ?? "—"}&rdquo;
                  </p>
                )}
                {fieldErrors.remarks && (
                  <p className="text-xs text-destructive">{fieldErrors.remarks}</p>
                )}
              </div>
            </>
          ) : (
            <>
          {/* Completion Overview */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border/50">
            <ModalField
              label="Completion Date"
              value={completedDate}
            />
            <ModalField
              label="Executed By"
              value={
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 bg-primary text-primary-foreground">
                    <AvatarFallback className="text-xs">
                      {executedBy.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{executedBy}</span>
                </div>
              }
            />
          </div>

          {/* Job Card Details - primary accent heading */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Job Card Details
            </h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
              <ModalField label="Designer" value={order.designerName ?? "-"} />
              <ModalField label="Party Name" value={order.partyName} />
              <ModalField
                label="Description"
                value={order.description ?? "-"}
                className="col-span-2"
              />
              <ModalField label="Panel Qty" value={order.quantity} />
            </div>

            {/* Current stage label, then Sheet Qty + Status on one line */}
            <div className="space-y-3 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current stage: <span className="text-foreground font-semibold normal-case">{stageLabel}</span>
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0 items-start">
                {showEditInputs ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sheet Qty
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={sheetQty}
                        onChange={(e) => setSheetQty(e.target.value)}
                        className="h-9 text-sm w-full max-w-[120px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </Label>
                      <RadioGroup
                        value={statusOk ? "ok" : "not_ok"}
                        onValueChange={(v) => setStatusOk(v === "ok")}
                        className="flex gap-4 h-9 items-center"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="ok" id="status-ok" />
                          <Label
                            htmlFor="status-ok"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Ok
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="not_ok" id="status-not-ok" />
                          <Label
                            htmlFor="status-not-ok"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Not ok
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                ) : (
                  <>
                    <ModalField
                      label="Sheet Qty"
                      value={completionData?.sheetQty ?? order.parts ?? "-"}
                    />
                    <ModalField
                      label="Status"
                      value={
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            (completionData?.statusOk ?? true)
                              ? "bg-primary/90 text-primary-foreground"
                              : "bg-destructive/90 text-destructive-foreground"
                          }`}
                        >
                          {completionData?.statusOk ?? true ? "OK" : "Not ok"}
                        </span>
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Images / Attachments (multi-file, S3 via presigned PUT) */}
          <StageImageUploader uploader={uploader} readOnly={!showEditInputs} />

          {/* Remarks / Notes */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Remarks / Notes
            </h4>
            {showEditInputs ? (
              <Textarea
                placeholder="Add remarks or notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="min-h-[72px] resize-none text-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground italic rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                &ldquo;{completionData?.remarks ?? "—"}&rdquo;
              </p>
            )}
          </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 flex flex-col gap-3 px-4 sm:px-6 py-4 border-t border-border bg-muted/20 sm:flex-col sm:space-x-0">
          <p className="text-xs text-muted-foreground w-full">
            Recorded by System • {recordedAt}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleClose(false)}
            >
              Close
            </Button>
            {showEditInputs && onSave && (
              showSheetDualActions ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleSave("save_progress")}
                    disabled={saving || uploader.status === "uploading" || uploader.status === "has_errors"}
                  >
                    {saving ? "Saving..." : uploader.status === "uploading" ? "Uploading..." : "Save progress"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => handleSave("complete")}
                    disabled={
                      saving ||
                      !statusOk ||
                      uploader.status === "uploading" ||
                      uploader.status === "has_errors"
                    }
                  >
                    {saving ? (
                      "Saving..."
                    ) : uploader.status === "uploading" ? (
                      "Uploading..."
                    ) : (
                      <>
                        <span className="sm:hidden">Complete</span>
                        <span className="hidden sm:inline">Complete &amp; continue</span>
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => handleSave()}
                  disabled={
                    saving ||
                    uploader.status === "uploading" ||
                    uploader.status === "has_errors" ||
                    (mode === "complete" &&
                      !isOrderCurrentStage &&
                      (isFabricationStage(stageKey) ||
                        isPowderCoatingOrDispatchStage(stageKey) ||
                        isCombinedFabricationPowderCoating(stageKey)))
                  }
                >
                  {(() => {
                    if (saving) return "Saving...";
                    if (uploader.status === "uploading") return "Uploading...";
                    if (mode === "edit" || sheetHistoricalEdit) return "Save changes";
                    if (
                      !isOrderCurrentStage &&
                      (isFabricationStage(stageKey) || isPowderCoatingOrDispatchStage(stageKey))
                    )
                      return "Save changes";
                    if (isCombinedFabricationPowderCoating(stageKey) || isFabricationStage(stageKey) || isPowderCoatingOrDispatchStage(stageKey))
                      return "Save & Next";
                    return "Save & Next";
                  })()}
                </Button>
              )
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StageDetailModal,
  type StageCompletionData,
  type StageModalMode,
} from "@/components/stage-detail-modal";
import { useAuth } from "@/lib/auth-context";
import type { Member } from "@shared/schema";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Eye,
  FileDown,
  FileText,
  Info,
  Pencil,
} from "lucide-react";
import type { Order } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  getOrderByIdPath,
  getOrderStageUpdatePath,
  getOrderStageEditPath,
  getTeamsQueryPath,
  getMembersQueryPath,
  getPowderCoatingsQueryPath,
  getUserByIdPath,
  USE_REAL_API,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getCompletionDataForStage } from "@/lib/stage-completion-merge";
import { exportStageCompletionPdf } from "@/lib/stage-pdf";
import { stripAttachmentForWrite, type StageAttachment } from "@/lib/stage-uploads";
import {
  qcFromStatusOk,
  statusOkFromStageData,
  isOrderOnSheetProcessingStage,
  type SheetSaveIntent,
} from "@/lib/order-stages";
import { enrichDesignStageDataFromApi, buildDesignStagePatchPayload } from "@/lib/design-stage-form";

function formatLabel(s: string | undefined | null): string {
  if (s == null || s === "") return "";
  return String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STAGE_KEY_TO_API: Record<string, string> = {
  design_preparation: "DESIGN_PREPARATION",
  sheet_processing: "SHEET_PROCESSING",
  fabrication: "FABRICATION",
  dispatch_validation: "DISPATCH_VALIDATION",
};

function timelineKeyToApiStageName(stageKey: string): string {
  return STAGE_KEY_TO_API[stageKey] ?? stageKey.toUpperCase().replace(/-/g, "_");
}

function parseApiErrorMessage(err: unknown): { status?: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.match(/^(\d+):\s*([\s\S]*)$/);
  if (!m) return { message: raw };
  const status = Number(m[1]);
  let message = m[2].trim();
  try {
    const j = JSON.parse(m[2]);
    message = (j.message as string) ?? (j.error as string) ?? message;
  } catch {
    // plain text body
  }
  return { status, message };
}

function applyOrderFromApiResponse(json: unknown): Order | null {
  const data = (json as { success?: boolean; data?: ApiOrderDetail })?.data;
  if (!data) return null;
  return normalizeOrderDetail(data);
}

/** API order detail shape (partial). Supports both backend response (_id, panelName, ...) and stored app shape (id, customerWoNo, ...). */
interface ApiOrderDetail {
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
  stages?: Array<{
    name?: string;
    stageStatus?: string;
    data?: Record<string, unknown>;
    startedAt?: string | null;
    completedAt?: string | null;
    remarks?: string;
  }>;
}

/** "snake_case" → "camelCase" (used to hydrate StageCompletionData from API stage.data). */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
}

/** Convert API stage name (e.g. "FABRICATION", "DISPATCH_VALIDATION") to the timeline key used on the client. */
function apiStageNameToKey(name: string | undefined | null): string | null {
  if (!name) return null;
  const norm = String(name).toLowerCase().replace(/\s+/g, "_");
  if (norm === "design_preparation") return "design_preparation";
  if (norm === "sheet_processing") return "sheet_processing";
  if (norm === "fabrication" || norm === "powder_coating") return "fabrication";
  if (norm === "dispatch_validation" || norm === "dispatch" || norm === "assembly_dispatch")
    return "dispatch_validation";
  return null;
}

/** Normalize a single stage.data object (snake_case from server) to the camelCase StageCompletionData shape. */
function normalizeStageData(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    out[snakeToCamel(k)] = v;
  }
  // Sheet processing QC: status or sheetStatus ("OK" | "NOT_OK", case-insensitive).
  const qcRaw = out.status ?? out.sheetStatus;
  if (out.statusOk === undefined && qcRaw != null && qcRaw !== "") {
    out.statusOk = statusOkFromStageData({ status: qcRaw });
  } else if (typeof out.status === "string" && out.statusOk === undefined) {
    out.statusOk = statusOkFromStageData(out as Record<string, unknown>);
  }
  enrichDesignStageDataFromApi(out);
  return out;
}

function normalizeOrderDetail(api: ApiOrderDetail): Order {
  const status = (api.status ?? "").toLowerCase().replace(/\s+/g, "_");
  const stage = (api.currentStage ?? api.stage ?? "").toLowerCase().replace(/\s+/g, "_");
  const rateTypeDisplay =
    api.rateType ??
    (api.pricing?.includingAccessories === true ? "Include Accessories" : api.pricing ? "Extra" : undefined);
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

  // Hydrate saved stage data so Fabrication / Dispatch Validation / Sheet Processing
  // modals (and PDFs) repopulate after a page reload. The backend stores each stage
  // under `stages[i].data` using snake_case; we convert it to the camelCase
  // StageCompletionData shape and key it by the timeline stage key.
  const stagesMap: Record<string, Record<string, unknown>> = {};
  const stagesStatus: Record<string, string> = {};
  if (Array.isArray(api.stages)) {
    for (const s of api.stages) {
      const key = apiStageNameToKey(s?.name);
      if (!key) continue;
      const normalized = normalizeStageData(s?.data);
      // Merge (FABRICATION stores a combined fabrication + powder-coating payload; keep both under "fabrication")
      stagesMap[key] = { ...(stagesMap[key] ?? {}), ...normalized };
      if (s?.stageStatus) stagesStatus[key] = String(s.stageStatus);
      if (s?.completedAt && !stagesMap[key].completedDate) {
        stagesMap[key].completedDate = String(s.completedAt).slice(0, 10);
      }
      if (s?.remarks && !stagesMap[key].remarks) stagesMap[key].remarks = s.remarks;
    }
  }

  return {
    id: api._id ?? api.id ?? "",
    orderNo: api.workOrderNumber ?? api.orderNo ?? api._id ?? api.id ?? "",
    partyName,
    status: status || "pending",
    stage: stage || "design_preparation",
    quantity: api.quantity ?? 0,
    date: api.orderDate ?? api.createdAt ?? api.date ?? new Date().toISOString(),
    panelType: api.panelType,
    description: api.descriptionSize ?? api.description,
    parts: api.partsCount != null ? String(api.partsCount) : api.parts,
    designerName: api.designerId?.name ?? api.preparedBy?.name ?? api.designerName,
    powderCoatingType: api.coatingType ?? api.powderCoatingType,
    rate: api.pricing?.ratePerKg != null ? String(api.pricing.ratePerKg) : api.rate,
    rateType: rateTypeDisplay,
    poNo: api.poNumber ?? api.poNo,
    remarks: api.remarks,
    customerWoNo: api.panelName ?? api.customerWoNo,
    colorBody: api.colorDetails?.body ?? api.colorBody,
    colorMountingPlate: api.colorDetails?.mountingPlate ?? api.colorMountingPlate,
    colorBaseStand: api.colorDetails?.baseStand ?? api.colorBaseStand,
    accessories: accessoriesArray.length > 0 ? accessoriesArray : Array.isArray(acc) ? acc : undefined,
    accessoriesOther: (typeof acc === "object" && !Array.isArray(acc) ? acc?.other : undefined) ?? api.accessoriesOther,
    accessoriesObj: typeof acc === "object" && !Array.isArray(acc) ? acc : undefined,
    stagesMap,
    stagesStatus,
  } as unknown as Order;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "completed":
      return "bg-primary text-primary-foreground";
    case "in_progress":
      return "bg-amber-500 text-white";
    case "on_hold":
      return "bg-orange-500 text-white";
    case "cancelled":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Production stages shown in timeline (Stage 3+4 are merged under Fabrication). */
const PRODUCTION_STAGES = [
  { key: "design_preparation", label: "Design" },
  { key: "sheet_processing", label: "Sheet Processing" },
  { key: "fabrication", label: "Fabrication" },
  { key: "dispatch_validation", label: "Dispatch Validation" },
];

/** Map order.stage (from API/store) to timeline stage key. */
function orderStageToTimelineKey(orderStage: string): string {
  const normalized = (orderStage ?? "").toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    design_preparation: "design_preparation",
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

function SpecField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">{value ?? "-"}</p>
    </div>
  );
}

function ColorTag({ label, colorName }: { label: string; colorName?: string | null }) {
  if (!colorName) return null;
  const colorLower = colorName.toLowerCase();
  const isCommon =
    colorLower === "orange" ||
    colorLower === "black" ||
    colorLower === "white" ||
    colorLower === "grey" ||
    colorLower === "gray" ||
    colorLower === "red" ||
    colorLower === "blue" ||
    colorLower === "green" ||
    colorLower === "silver" ||
    colorLower === "bronze" ||
    colorLower.startsWith("ral");
  const bgClass = isCommon
    ? colorLower === "orange"
      ? "bg-orange-500 text-white"
      : colorLower === "black"
        ? "bg-neutral-900 text-white"
        : colorLower === "white"
          ? "bg-neutral-200 text-neutral-800"
          : "bg-primary/90 text-primary-foreground"
    : "bg-primary/90 text-primary-foreground";
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0 border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${bgClass}`}
      >
        {colorName}
      </span>
    </div>
  );
}

function ProductionTimeline({
  orderStage,
  status,
  onViewStage,
  onEditStage,
  onUpdateStage,
  onExportPdf,
  canUpdateCurrentStage = true,
  canShowEdit,
}: {
  orderStage: string;
  status: string;
  onViewStage: (stageKey: string, stageLabel: string) => void;
  onEditStage: (stageKey: string, stageLabel: string) => void;
  onUpdateStage: (stageKey: string, stageLabel: string) => void;
  onExportPdf: (stageKey: string, stageLabel: string) => void;
  /** If false, show "You are not allowed to update" instead of Update button for current stage */
  canUpdateCurrentStage?: boolean;
  canShowEdit: (stageKey: string) => boolean;
}) {
  const currentStageKey = orderStageToTimelineKey(orderStage);
  const currentIdx = PRODUCTION_STAGES.findIndex((s) => s.key === currentStageKey);
  /** When order is completed, all stages including the last are done — no loader, show View */
  const effectiveCurrentIdx = status === "completed" ? PRODUCTION_STAGES.length : currentIdx;

  return (
    <div className="space-y-0">
      {PRODUCTION_STAGES.map((stage, i) => {
        const isCompleted = i < effectiveCurrentIdx;
        const isCurrent = i === effectiveCurrentIdx;
        const isFuture = i > effectiveCurrentIdx;
        const isLastStageAndOrderCompleted = status === "completed" && i === PRODUCTION_STAGES.length - 1;
        const isCancelled = status === "cancelled";

        let StageIcon = Circle;
        let iconColor = "text-muted-foreground/40";
        let lineColor = "bg-muted-foreground/15";
        let labelColor = "text-muted-foreground/60";

        if (isCancelled) {
          iconColor = "text-muted-foreground/30";
          labelColor = "text-muted-foreground/40";
        } else if (isCompleted) {
          StageIcon = CheckCircle2;
          iconColor = "text-primary";
          lineColor = "bg-primary";
          labelColor = "text-foreground";
        } else if (isCurrent) {
          StageIcon = status === "on_hold" ? Clock : Loader2;
          iconColor =
            status === "on_hold"
              ? "text-orange-500"
              : "text-primary";
          labelColor = "text-foreground font-semibold";
        }

        return (
          <div
            key={stage.key}
            className="flex gap-3"
            data-testid={`timeline-stage-${stage.key}`}
          >
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <StageIcon
                  className={`h-5 w-5 ${iconColor} ${isCurrent && status === "in_progress" ? "animate-spin" : ""}`}
                />
              </div>
              {i < PRODUCTION_STAGES.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-[24px] ${isCompleted ? lineColor : "bg-muted-foreground/15"}`}
                />
              )}
            </div>
            <div className="pb-6 pt-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm ${labelColor}`}>{isLastStageAndOrderCompleted ? "Order Completed" : stage.label}</span>
                {isCurrent && !isCancelled && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      status === "on_hold"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {status === "on_hold" ? "On Hold" : "In Progress"}
                  </span>
                )}
              </div>
              {isCompleted && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Completed
                </p>
              )}
              {isCurrent && !isCancelled && status !== "on_hold" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Currently processing...
                </p>
              )}
              {isFuture && !isCancelled && (
                <p className="text-xs text-muted-foreground/50 mt-0.5">
                  Waiting for previous stage...
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {isCompleted && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs w-fit"
                      onClick={() => onExportPdf(stage.key, stage.label)}
                    >
                      <FileDown className="h-3 w-3 mr-1" /> PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs w-fit"
                      onClick={() => onViewStage(stage.key, stage.label)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                    {canShowEdit(stage.key) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs w-fit"
                        onClick={() => onEditStage(stage.key, stage.label)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                  </>
                )}
                {isCurrent && !isCancelled && canShowEdit(stage.key) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs w-fit"
                    onClick={() => onEditStage(stage.key, stage.label)}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
                {isCurrent && !isCancelled && canUpdateCurrentStage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs w-fit"
                    onClick={() => onUpdateStage(stage.key, stage.label)}
                  >
                    Update
                  </Button>
                )}
                {isCurrent && !isCancelled && !canUpdateCurrentStage && (
                  <span className="inline-flex items-center rounded-md border border-amber-500/70 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    You are not allowed to update
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailsPage() {
  const [, params] = useRoute("/orders/:id");
  const [, navigate] = useLocation();
  const orderId = params?.id;
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<{
    key: string;
    label: string;
    mode: StageModalMode;
  } | null>(null);
  const [stageCompletionMap, setStageCompletionMap] = useState<
    Record<string, StageCompletionData>
  >({});

  const userId = (user as { _id?: string })._id ?? (user as { id?: string }).id;

  const { data: currentUserData } = useQuery({
    queryKey: ["user-by-id", userId],
    queryFn: async () => {
      if (!userId) return null;
      const path = getUserByIdPath(userId);
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        const raw = json?.data ?? json;
        return raw && typeof raw === "object" ? raw : null;
      }
      return (json?.data ?? json) ?? null;
    },
    enabled: !!userId && USE_REAL_API,
  });

  const allowedStages: string[] = (() => {
    if (USE_REAL_API) {
      const raw = currentUserData?.allowedStages ?? (currentUserData as { allowedStages?: string[] })?.allowedStages;
      if (Array.isArray(raw)) return raw;
      return [];
    }
    return Array.isArray(user?.allowedStages) ? user.allowedStages : [];
  })();

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order-detail", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) throw new Error("No order id");
      const path = getOrderByIdPath(orderId);
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message ?? "Failed to fetch order");
        return normalizeOrderDetail(json.data as ApiOrderDetail);
      }
      const raw = json?.data ?? json;
      if (raw && typeof raw === "object" && ("_id" in raw || "id" in raw))
        return normalizeOrderDetail(raw as ApiOrderDetail);
      return raw as Order;
    },
  });

  const { data: teamsData } = useQuery({
    queryKey: ["teams-for-lead"],
    queryFn: async () => {
      const path = USE_REAL_API ? getTeamsQueryPath({ isActive: true }) : "/api/teams";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        const raw = json?.data?.teams ?? json?.teams ?? json?.data ?? [];
        return Array.isArray(raw) ? raw : [];
      }
      return Array.isArray(json) ? json : json?.teams ?? [];
    },
    enabled: !!user,
  });

  const teamWhereCurrentUserIsLead = (() => {
    if (!user || !teamsData || !Array.isArray(teamsData)) return null;
    const userId = (user as { _id?: string })._id ?? (user as { id?: string }).id;
    const userName = user.name ?? user.email;
    return teamsData.find((t: { teamLead?: { _id?: string } | null; lead?: string; _id?: string; id?: string }) => {
      const leadId = t.teamLead?._id ?? (typeof t.lead === "string" && t.lead && !t.lead.includes("@") ? null : t.lead);
      const leadName = t.teamLead?.name ?? (typeof t.lead === "string" ? t.lead : null);
      return (userId && leadId === userId) || (userName && leadName === userName);
    }) as { _id?: string; id?: string } | undefined;
  })();

  const teamId = teamWhereCurrentUserIsLead?._id ?? teamWhereCurrentUserIsLead?.id ?? null;

  const { data: membersByTeamData } = useQuery({
    queryKey: ["members-by-team", teamId ?? "all"],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getMembersQueryPath({ teamId: teamId ?? undefined, isActive: true })
        : `/api/members${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        const raw = json?.data?.members ?? json?.members ?? json?.data ?? [];
        return Array.isArray(raw) ? raw : [];
      }
      return Array.isArray(json) ? json : [];
    },
    // If current user isn't a detected team lead, fall back to all active members
    // so Fabrication dropdown is not empty.
    enabled: !!user,
  });

  const membersArray: Member[] = (() => {
    if (!membersByTeamData) return [];
    return Array.isArray(membersByTeamData) ? membersByTeamData : [];
  })();
  const teamMemberOptions = membersArray.map((m: { id?: string; _id?: string; name?: string }) => ({
    value: m.id ?? m._id ?? "",
    label: m.name ?? "",
  })).filter((o) => o.value);

  const { data: powderCoatingsData } = useQuery({
    queryKey: ["powder-coatings-dropdown"],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getPowderCoatingsQueryPath({ limit: 200, isActive: true })
        : "/api/powder-coatings?limit=200";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        const raw = json?.data?.powderCoatings ?? json?.powderCoatings ?? [];
        return Array.isArray(raw) ? raw : [];
      }
      const raw = json?.data?.powderCoatings ?? json?.powderCoatings ?? json ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!user,
  });

  const coatingTypeOptions = (powderCoatingsData ?? []).map((p: { _id?: string; id?: string; partyName?: string; type?: string; name?: string }) => ({
    value: p._id ?? p.id ?? "",
    label: p.partyName ?? p.type ?? p.name ?? "",
  })).filter((o) => o.value);

  const powderCoatingTeamOptions = (teamsData ?? []).map((t: { _id?: string; id?: string; teamName?: string; name?: string }) => ({
    value: t._id ?? t.id ?? "",
    label: t.teamName ?? t.name ?? "",
  })).filter((o) => o.value);

  const pcLocationOptions = [
    { value: "nk", label: "NK" },
    { value: "ganesh_pc", label: "GANESH P.C." },
    { value: "pasific_pc", label: "PASIFIC P.C." },
    { value: "any_other", label: "ANY OTHER" },
  ];

  const isAdmin = user?.role === "ADMIN";

  const canEditStage = useCallback(
    (stageKey: string): boolean => {
      if (isAdmin) return true;
      const apiName = timelineKeyToApiStageName(stageKey);
      if (allowedStages.length === 0) return true;
      return allowedStages.some(
        (s) => String(s).toUpperCase().replace(/-/g, "_") === apiName,
      );
    },
    [isAdmin, allowedStages],
  );

  const getStageStatusForKey = useCallback((stageKey: string): string | undefined => {
    if (!order) return undefined;
    const map = (order as { stagesStatus?: Record<string, string> }).stagesStatus;
    return map?.[stageKey]?.toUpperCase();
  }, [order]);

  const canShowEditButton = useCallback(
    (stageKey: string): boolean => {
      if (!order || !canEditStage(stageKey)) return false;
      const status = getStageStatusForKey(stageKey);
      if (USE_REAL_API && status) {
        return status === "COMPLETED" || status === "IN_PROGRESS";
      }
      const idx = PRODUCTION_STAGES.findIndex((s) => s.key === stageKey);
      const currentIdx = PRODUCTION_STAGES.findIndex(
        (s) => s.key === orderStageToTimelineKey(order.stage),
      );
      const effectiveCurrent =
        order.status === "completed" ? PRODUCTION_STAGES.length : currentIdx;
      return idx <= effectiveCurrent;
    },
    [order, canEditStage, getStageStatusForKey],
  );

  const openViewStage = useCallback((stageKey: string, stageLabel: string) => {
    setSelectedStage({ key: stageKey, label: stageLabel, mode: "view" });
    setStageModalOpen(true);
  }, []);

  const openEditStage = useCallback((stageKey: string, stageLabel: string) => {
    setSelectedStage({ key: stageKey, label: stageLabel, mode: "edit" });
    setStageModalOpen(true);
  }, []);

  const openUpdateStage = useCallback((stageKey: string, stageLabel: string) => {
    setSelectedStage({ key: stageKey, label: stageLabel, mode: "complete" });
    setStageModalOpen(true);
  }, []);

  const handleStageSave = useCallback(
    (stageKey: string, saveMode: "edit" | "complete") =>
      async (
        data: {
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
      },
        options?: { intent?: SheetSaveIntent },
      ): Promise<boolean> => {
        if (!order?.id || !orderId) return true;
        const isEditSave = saveMode === "edit";
        const sheetIntent: SheetSaveIntent | undefined =
          stageKey === "sheet_processing" && !isEditSave
            ? options?.intent ?? "complete"
            : undefined;
        const stageNameForApi =
          stageKey === "fabrication" || stageKey === "powder_coating"
            ? "FABRICATION"
            : timelineKeyToApiStageName(stageKey);
        const attachmentsPayload = Array.isArray(data.attachments) ? data.attachments : undefined;
        // PATCH-safe copy: drop the transient `viewUrl` (presigned GET, regenerated
        // on every order GET). The original `attachmentsPayload` is kept for the
        // local UI state below so previews keep rendering optimistically.
        const attachmentsForPatch = attachmentsPayload?.map(stripAttachmentForWrite);
        let payload: Record<string, unknown>;
        if (stageKey === "sheet_processing") {
          const qcStatus = qcFromStatusOk(data.statusOk ?? false);
          payload = {
            sheet_qty: typeof data.sheetQty === "number" ? data.sheetQty : Number(data.sheetQty) || 0,
            status: qcStatus,
            remarks: data.remarks?.trim() || "",
            notes: data.remarks?.trim() || "",
            ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
          };
          if (!isEditSave && sheetIntent === "save_progress" && data.statusOk) {
            payload.advance = false;
          }
        } else if (stageKey === "fabrication") {
          payload = {
            completion_date: data.completionDate?.trim() || undefined,
            fabricator_name: data.fabricatorName?.trim() || undefined,
            delivery_date: data.deliveryDate?.trim() || undefined,
            team_member_id: data.teamMemberId && data.teamMemberId !== "_none" ? data.teamMemberId : undefined,
            quality_check_passed: data.qualityCheckPassed,
            remarks: data.remarks?.trim() || "",
            notes: data.remarks?.trim() || "",
            ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
          };
        } else if (stageKey === "powder_coating") {
          payload = {
            completion_date: data.completionDate?.trim() || undefined,
            wo_no: data.woNo?.trim() || undefined,
            customer_name: data.customerName?.trim() || undefined,
            dc_no: data.dcNo?.trim() || undefined,
            po_no: data.poNo?.trim() || undefined,
            color_body: data.colorBody?.trim() || undefined,
            color_mp: data.colorMp?.trim() || undefined,
            color_base: data.colorBase?.trim() || undefined,
            contractor_name: data.contractorName?.trim() || undefined,
            designer_name: data.designerName?.trim() || undefined,
            weight: data.weight?.trim() || undefined,
            door_qty: data.doorQty != null ? Number(data.doorQty) : undefined,
            cover_qty: data.coverQty != null ? Number(data.coverQty) : undefined,
            mounting_plate_qty: data.mountingPlateQty != null ? Number(data.mountingPlateQty) : undefined,
            base_stand_qty: data.baseStandQty != null ? Number(data.baseStandQty) : undefined,
            coating_type_id: data.coatingTypeId && data.coatingTypeId !== "_none" ? data.coatingTypeId : undefined,
            pc_location_id: data.pcLocationId && data.pcLocationId !== "_none" ? data.pcLocationId : undefined,
            body_color_code: data.bodyColorCode?.trim() || undefined,
            vehicle_no: data.vehicleNo?.trim() || undefined,
            powder_coating_team_id: data.powderCoatingTeamId && data.powderCoatingTeamId !== "_none" ? data.powderCoatingTeamId : undefined,
            color: data.color?.trim() || undefined,
            single_coat: data.singleCoat,
            double_coat: data.doubleCoat,
            point_lock: data.pointLock,
            three_point_lock: data.threePointLock,
            pu_gasketing: data.puGasketing,
            patti_gasketing: data.pattiGasketing,
            accessories_other: data.accessoriesOther?.trim() || undefined,
            body_size: data.bodySize?.trim() || undefined,
            glan_plate_qty: data.glanPlateQty != null ? Number(data.glanPlateQty) : undefined,
            c_channel_qty: data.cChannelQty != null ? Number(data.cChannelQty) : undefined,
            l_patta_qty: data.lPattaQty != null ? Number(data.lPattaQty) : undefined,
            ghodi_qty: data.ghodiQty != null ? Number(data.ghodiQty) : undefined,
            j_channel_qty: data.jChannelQty != null ? Number(data.jChannelQty) : undefined,
            basbar_cover_qty: data.basbarCoverQty != null ? Number(data.basbarCoverQty) : undefined,
            basbar_angle_qty: data.basbarAngleQty != null ? Number(data.basbarAngleQty) : undefined,
            capacitor_patta_qty: data.capacitorPattaQty != null ? Number(data.capacitorPattaQty) : undefined,
            braker_c_channel_qty: data.brakerCChannelQty != null ? Number(data.brakerCChannelQty) : undefined,
            canopy_qty: data.canopyQty != null ? Number(data.canopyQty) : undefined,
            base_qty: data.baseQty != null ? Number(data.baseQty) : undefined,
            stand_qty: data.standQty != null ? Number(data.standQty) : undefined,
            remarks: data.remarks?.trim() || "",
            notes: data.remarks?.trim() || "",
            ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
          };
        } else if (stageKey === "dispatch_validation") {
          payload = {
            completion_date: data.completionDate?.trim() || undefined,
            wo_no: data.woNo?.trim() || undefined,
            customer_name: data.customerName?.trim() || undefined,
            dc_no: data.dcNo?.trim() || undefined,
            po_no: data.poNo?.trim() || undefined,
            color_body: data.colorBody?.trim() || undefined,
            color_mp: data.colorMp?.trim() || undefined,
            color_base: data.colorBase?.trim() || undefined,
            contractor_name: data.contractorName?.trim() || undefined,
            designer_name: data.designerName?.trim() || undefined,
            weight: data.weight?.trim() || undefined,
            door_qty: data.doorQty != null ? Number(data.doorQty) : undefined,
            cover_qty: data.coverQty != null ? Number(data.coverQty) : undefined,
            mounting_plate_qty: data.mountingPlateQty != null ? Number(data.mountingPlateQty) : undefined,
            base_stand_qty: data.baseStandQty != null ? Number(data.baseStandQty) : undefined,
            coating_type_id: data.coatingTypeId && data.coatingTypeId !== "_none" ? data.coatingTypeId : undefined,
            pc_location_id: data.pcLocationId && data.pcLocationId !== "_none" ? data.pcLocationId : undefined,
            body_color_code: data.bodyColorCode?.trim() || undefined,
            vehicle_no: data.vehicleNo?.trim() || undefined,
            powder_coating_team_id: data.powderCoatingTeamId && data.powderCoatingTeamId !== "_none" ? data.powderCoatingTeamId : undefined,
            color: data.color?.trim() || undefined,
            single_coat: data.singleCoat,
            double_coat: data.doubleCoat,
            point_lock: data.pointLock,
            three_point_lock: data.threePointLock,
            pu_gasketing: data.puGasketing,
            patti_gasketing: data.pattiGasketing,
            accessories_other: data.accessoriesOther?.trim() || undefined,
            body_size: data.bodySize?.trim() || undefined,
            glan_plate_qty: data.glanPlateQty != null ? Number(data.glanPlateQty) : undefined,
            c_channel_qty: data.cChannelQty != null ? Number(data.cChannelQty) : undefined,
            l_patta_qty: data.lPattaQty != null ? Number(data.lPattaQty) : undefined,
            ghodi_qty: data.ghodiQty != null ? Number(data.ghodiQty) : undefined,
            j_channel_qty: data.jChannelQty != null ? Number(data.jChannelQty) : undefined,
            basbar_cover_qty: data.basbarCoverQty != null ? Number(data.basbarCoverQty) : undefined,
            basbar_angle_qty: data.basbarAngleQty != null ? Number(data.basbarAngleQty) : undefined,
            capacitor_patta_qty: data.capacitorPattaQty != null ? Number(data.capacitorPattaQty) : undefined,
            braker_c_channel_qty: data.brakerCChannelQty != null ? Number(data.brakerCChannelQty) : undefined,
            canopy_qty: data.canopyQty != null ? Number(data.canopyQty) : undefined,
            base_qty: data.baseQty != null ? Number(data.baseQty) : undefined,
            stand_qty: data.standQty != null ? Number(data.standQty) : undefined,
            remarks: data.remarks?.trim() || "",
            notes: data.remarks?.trim() || "",
            ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
          };
        } else if (stageKey === "design_preparation") {
          payload = buildDesignStagePatchPayload(
            {
              partyName: data.partyName,
              designerName: data.designerName,
              panelType: data.panelType,
              poNo: data.poNo,
              quantity: data.quantity,
              description: data.description,
              parts: data.parts,
              customerWoNo: data.customerWoNo,
              powderCoatingType: data.powderCoatingType,
              colorBody: data.colorBody,
              colorMountingPlate: data.colorMountingPlate,
              colorBaseStand: data.colorBaseStand,
              rateType: data.rateType,
              rate: data.rate,
              orderRemarks: data.orderRemarks,
              remarks: data.remarks,
              pointLock: data.pointLock,
              threePointLock: data.threePointLock,
              puGasketing: data.puGasketing,
              pattiGasketing: data.pattiGasketing,
              accessoriesOther: data.accessoriesOther,
            },
            attachmentsForPatch,
          );
        } else {
          payload = {
            remarks: data.remarks?.trim() || "",
            notes: data.remarks?.trim() || "",
            ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
          };
        }
        const stageLabelForError = PRODUCTION_STAGES.find((s) => s.key === stageKey)?.label ?? stageKey.replace(/_/g, " ");
        const isCombinedFabPc = stageKey === "fabrication" || stageKey === "powder_coating";
        const fabricationPayload: Record<string, unknown> = isCombinedFabPc
          ? {
              completion_date: data.completionDate?.trim() || undefined,
              fabricator_name: data.fabricatorName?.trim() || undefined,
              delivery_date: data.deliveryDate?.trim() || undefined,
              team_member_id: data.teamMemberId && data.teamMemberId !== "_none" ? data.teamMemberId : undefined,
              quality_check_passed: data.qualityCheckPassed,
              remarks: data.remarks?.trim() || "",
              notes: data.remarks?.trim() || "",
              // Proof from combined modal (also stored locally in stageCompletionMap)
              proof_file_name: data.proofFileName?.trim() || undefined,
              proof_preview_url: data.proofPreviewUrl || undefined,
            }
          : {};
        const powderCoatingPayload: Record<string, unknown> = isCombinedFabPc
          ? {
              completion_date: data.completionDate?.trim() || undefined,
              wo_no: data.woNo?.trim() || undefined,
              customer_name: data.customerName?.trim() || undefined,
              dc_no: data.dcNo?.trim() || undefined,
              po_no: data.poNo?.trim() || undefined,
              color_body: data.colorBody?.trim() || undefined,
              color_mp: data.colorMp?.trim() || undefined,
              color_base: data.colorBase?.trim() || undefined,
              contractor_name: data.contractorName?.trim() || undefined,
              designer_name: data.designerName?.trim() || undefined,
              weight: data.weight?.trim() || undefined,
              door_qty: data.doorQty != null ? Number(data.doorQty) : undefined,
              cover_qty: data.coverQty != null ? Number(data.coverQty) : undefined,
              mounting_plate_qty: data.mountingPlateQty != null ? Number(data.mountingPlateQty) : undefined,
              base_stand_qty: data.baseStandQty != null ? Number(data.baseStandQty) : undefined,
              coating_type_id: data.coatingTypeId && data.coatingTypeId !== "_none" ? data.coatingTypeId : undefined,
              pc_location_id: data.pcLocationId && data.pcLocationId !== "_none" ? data.pcLocationId : undefined,
              body_color_code: data.bodyColorCode?.trim() || undefined,
              vehicle_no: data.vehicleNo?.trim() || undefined,
              powder_coating_team_id: data.powderCoatingTeamId && data.powderCoatingTeamId !== "_none" ? data.powderCoatingTeamId : undefined,
              color: data.color?.trim() || undefined,
              single_coat: data.singleCoat,
              double_coat: data.doubleCoat,
              point_lock: data.pointLock,
              three_point_lock: data.threePointLock,
              pu_gasketing: data.puGasketing,
              patti_gasketing: data.pattiGasketing,
              accessories_other: data.accessoriesOther?.trim() || undefined,
              body_size: data.bodySize?.trim() || undefined,
              glan_plate_qty: data.glanPlateQty != null ? Number(data.glanPlateQty) : undefined,
              c_channel_qty: data.cChannelQty != null ? Number(data.cChannelQty) : undefined,
              l_patta_qty: data.lPattaQty != null ? Number(data.lPattaQty) : undefined,
              ghodi_qty: data.ghodiQty != null ? Number(data.ghodiQty) : undefined,
              j_channel_qty: data.jChannelQty != null ? Number(data.jChannelQty) : undefined,
              basbar_cover_qty: data.basbarCoverQty != null ? Number(data.basbarCoverQty) : undefined,
              basbar_angle_qty: data.basbarAngleQty != null ? Number(data.basbarAngleQty) : undefined,
              capacitor_patta_qty: data.capacitorPattaQty != null ? Number(data.capacitorPattaQty) : undefined,
              braker_c_channel_qty: data.brakerCChannelQty != null ? Number(data.brakerCChannelQty) : undefined,
              canopy_qty: data.canopyQty != null ? Number(data.canopyQty) : undefined,
              base_qty: data.baseQty != null ? Number(data.baseQty) : undefined,
              stand_qty: data.standQty != null ? Number(data.standQty) : undefined,
              remarks: data.remarks?.trim() || "",
              notes: data.remarks?.trim() || "",
            }
          : {};
        let keepModalOpen = false;
        if (USE_REAL_API) {
          const patchPath = (name: string) =>
            isEditSave
              ? getOrderStageEditPath(order.id, name)
              : getOrderStageUpdatePath(order.id, name);
          try {
            let json: unknown;
            if (isCombinedFabPc) {
              const mergedFabricationPayload = {
                ...fabricationPayload,
                ...powderCoatingPayload,
                ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
              };
              const res = await apiRequest("PATCH", patchPath("FABRICATION"), mergedFabricationPayload);
              json = await res.json();
            } else {
              const res = await apiRequest("PATCH", patchPath(stageNameForApi), payload);
              json = await res.json();
            }
            const updated = applyOrderFromApiResponse(json);
            if (updated) {
              queryClient.setQueryData(["order-detail", orderId], updated);
            } else {
              queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
            }
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            const successMessage = (json as { message?: string })?.message;
            const apiCurrentStage =
              (json as { data?: ApiOrderDetail })?.data?.currentStage ?? updated?.stage;
            const sheetSavedNotAdvanced =
              stageKey === "sheet_processing" &&
              !isEditSave &&
              isOrderOnSheetProcessingStage(apiCurrentStage);

            if (sheetSavedNotAdvanced) {
              keepModalOpen = true;
              toast({
                title: "Saved",
                description:
                  successMessage ??
                  "Sheet processing saved. Set status to OK and complete to continue.",
              });
            } else {
              toast({
                title: isEditSave ? "Stage updated" : "Stage completed",
                description: successMessage ?? "Changes saved successfully.",
              });
              setStageModalOpen(false);
            }
          } catch (err) {
            const { status, message } = parseApiErrorMessage(err);
            if (status === 403 || /not allowed/i.test(message)) {
              toast({
                title: "Not allowed",
                description: `You are not allowed to update ${stageLabelForError}.`,
                variant: "destructive",
              });
            } else if (status === 400 && /not yet available/i.test(message)) {
              toast({
                title: "Stage not available",
                description: message,
                variant: "destructive",
              });
            } else if (status === 400 && /already completed/i.test(message) && !isEditSave) {
              toast({
                title: "Use Edit",
                description: "This stage is already completed. Use Edit to change details.",
                variant: "destructive",
              });
            } else if (status === 400 && /previous stage/i.test(message)) {
              toast({
                title: "Complete previous stage first",
                description: message,
                variant: "destructive",
              });
            } else {
              toast({
                title: isEditSave ? "Save failed" : "Stage update failed",
                description: message || "Something went wrong",
                variant: "destructive",
              });
            }
            throw err;
          }
        }
        const sheetStaysInProgress =
          stageKey === "sheet_processing" &&
          !isEditSave &&
          (sheetIntent === "save_progress" || !data.statusOk);

        setStageCompletionMap((prev) => {
          const completionEntry = {
            ...(prev[stageKey] ?? {}),
          completedDate:
            data.completionDate ??
            (isEditSave || sheetStaysInProgress
              ? prev[stageKey]?.completedDate
              : undefined) ??
            (!isEditSave && !sheetStaysInProgress
              ? new Date().toISOString().slice(0, 10)
              : prev[stageKey]?.completedDate),
          executedBy: user?.name ?? user?.email ?? user?.username ?? "System",
          proofFileName: data.proofFileName,
          proofPreviewUrl: data.proofPreviewUrl,
          remarks: data.remarks,
          sheetQty: data.sheetQty,
          statusOk: data.statusOk,
          fabricatorName: data.fabricatorName,
          deliveryDate: data.deliveryDate,
          teamMemberId: data.teamMemberId && data.teamMemberId !== "_none" ? data.teamMemberId : undefined,
          qualityCheckPassed: data.qualityCheckPassed,
          woNo: data.woNo,
          partyName: data.partyName,
          panelType: data.panelType,
          quantity: data.quantity,
          description: data.description,
          parts: data.parts,
          customerWoNo: data.customerWoNo,
          powderCoatingType: data.powderCoatingType,
          colorMountingPlate: data.colorMountingPlate,
          colorBaseStand: data.colorBaseStand,
          rateType: data.rateType,
          rate: data.rate,
          orderRemarks: data.orderRemarks,
          customerName: data.customerName,
          dcNo: data.dcNo,
          poNo: data.poNo,
          colorBody: data.colorBody,
          colorMp: data.colorMp,
          colorBase: data.colorBase,
          contractorName: data.contractorName,
          designerName: data.designerName,
          weight: data.weight,
          doorQty: data.doorQty,
          coverQty: data.coverQty,
          mountingPlateQty: data.mountingPlateQty,
          baseStandQty: data.baseStandQty,
          coatingTypeId: data.coatingTypeId && data.coatingTypeId !== "_none" ? data.coatingTypeId : undefined,
          pcLocationId: data.pcLocationId && data.pcLocationId !== "_none" ? data.pcLocationId : undefined,
          bodyColorCode: data.bodyColorCode,
          vehicleNo: data.vehicleNo,
          powderCoatingTeamId: data.powderCoatingTeamId && data.powderCoatingTeamId !== "_none" ? data.powderCoatingTeamId : undefined,
          color: data.color,
          singleCoat: data.singleCoat,
          doubleCoat: data.doubleCoat,
          pointLock: data.pointLock,
          threePointLock: data.threePointLock,
          puGasketing: data.puGasketing,
          pattiGasketing: data.pattiGasketing,
          accessoriesOther: data.accessoriesOther,
          bodySize: data.bodySize,
          glanPlateQty: data.glanPlateQty,
          cChannelQty: data.cChannelQty,
          lPattaQty: data.lPattaQty,
          ghodiQty: data.ghodiQty,
          jChannelQty: data.jChannelQty,
          basbarCoverQty: data.basbarCoverQty,
          basbarAngleQty: data.basbarAngleQty,
          capacitorPattaQty: data.capacitorPattaQty,
          brakerCChannelQty: data.brakerCChannelQty,
          canopyQty: data.canopyQty,
          baseQty: data.baseQty,
          standQty: data.standQty,
          attachments: attachmentsPayload ?? (prev[stageKey]?.attachments ?? []),
          recordedAt: new Date().toISOString(),
          };
          const next = { ...prev, [stageKey]: completionEntry };
          if (isCombinedFabPc) {
            next.fabrication = completionEntry;
          }
          return next;
        });
        if (!USE_REAL_API) {
          if (sheetStaysInProgress) {
            keepModalOpen = true;
          } else {
            setStageModalOpen(false);
          }
        }
        return !keepModalOpen;
      },
    [order?.id, orderId, user?.name, user?.email, user?.username, toast]
  );

  const stageModalCompletionData = useMemo((): StageCompletionData | null => {
    if (!selectedStage || !order) return null;
    return getCompletionDataForStage(selectedStage.key, order, stageCompletionMap);
  }, [selectedStage, stageCompletionMap, order]);

  const handleExportPdf = useCallback(
    async (stageKey: string, stageLabel: string) => {
      if (!order) return;
      const completion = getCompletionDataForStage(stageKey, order, stageCompletionMap);
      const labels =
        stageKey === "fabrication" || stageKey === "dispatch_validation"
          ? {
              teamMember: completion?.teamMemberId
                ? teamMemberOptions.find(
                    (o: { value: string; label: string }) => o.value === completion.teamMemberId
                  )?.label
                : undefined,
              coatingType: completion?.coatingTypeId
                ? coatingTypeOptions.find(
                    (o: { value: string; label: string }) => o.value === completion.coatingTypeId
                  )?.label
                : undefined,
              pcLocation: completion?.pcLocationId
                ? pcLocationOptions.find(
                    (o: { value: string; label: string }) => o.value === completion.pcLocationId
                  )?.label
                : undefined,
              powderTeam: completion?.powderCoatingTeamId
                ? powderCoatingTeamOptions.find(
                    (o: { value: string; label: string }) => o.value === completion.powderCoatingTeamId
                  )?.label
                : undefined,
            }
          : undefined;
      try {
        await exportStageCompletionPdf({
          order,
          stageKey,
          stageLabel,
          completion,
          labels,
        });
        toast({
          title: "PDF downloaded",
          description: `${stageLabel} report saved to your device.`,
        });
      } catch {
        toast({
          title: "Could not create PDF",
          description: "Try again or use a different browser.",
          variant: "destructive",
        });
      }
    },
    [
      order,
      stageCompletionMap,
      teamMemberOptions,
      coatingTypeOptions,
      pcLocationOptions,
      powderCoatingTeamOptions,
      toast,
    ]
  );

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Order not found</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This order may have been deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/orders")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  const hasColors =
    order.colorBody || order.colorMountingPlate || order.colorBaseStand;

  return (
    <div
      className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6"
      data-testid="order-details-page"
    >
      {/* Header: back, order id, status, party name, current stage pill */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/orders")}
            data-testid="button-back-to-orders"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-sm font-medium text-muted-foreground"
                data-testid="text-order-no"
              >
                {order.orderNo}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${getStatusStyle(order.status)}`}
                data-testid="text-status-badge"
              >
                {formatLabel(order.status)}
              </span>
            </div>
            <h1
              className="text-xl sm:text-2xl font-bold mt-0.5 text-foreground"
              data-testid="text-party-name"
            >
              {order.partyName}
            </h1>
          </div>
        </div>

        <div
          className="flex flex-col items-start sm:items-end gap-1"
          data-testid="current-stage-badge"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {order.status === "completed" ? "Status" : "Current Stage"}
          </span>
          {order.status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Order Completed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
              {PRODUCTION_STAGES.find((s) => s.key === orderStageToTimelineKey(order.stage))?.label ?? formatLabel(order.stage)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Order Specifications + Production Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Order Specifications
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <SpecField
                  label="Product"
                  value={order.panelType ?? undefined}
                />
                <SpecField label="Quantity" value={order.quantity} />
                <SpecField
                  label="Description (Size)"
                  value={order.description ?? undefined}
                />
                <SpecField label="Parts (Bhag)" value={order.parts ?? undefined} />
                <SpecField
                  label="Designer"
                  value={order.designerName ?? undefined}
                />
                <SpecField
                  label="Date"
                  value={
                    order.date
                      ? new Date(order.date).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })
                      : undefined
                  }
                />
                <SpecField
                  label="Coating"
                  value={
                    order.powderCoatingType
                      ? formatLabel(order.powderCoatingType)
                      : undefined
                  }
                />
                <SpecField
                  label="Body Color"
                  value={order.colorBody ?? undefined}
                />
                <SpecField label="Rate" value={order.rate ?? undefined} />
                <SpecField
                  label="Customer WO No"
                  value={order.customerWoNo ?? undefined}
                />
                <SpecField label="P.O. No." value={order.poNo ?? undefined} />
                <SpecField
                  label="Rate Type"
                  value={
                    order.rateType
                      ? formatLabel(order.rateType)
                      : undefined
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Production Timeline
              </h3>
              <ProductionTimeline
                orderStage={order.stage}
                status={order.status}
                onViewStage={openViewStage}
                onEditStage={openEditStage}
                onUpdateStage={openUpdateStage}
                onExportPdf={handleExportPdf}
                canShowEdit={canShowEditButton}
                canUpdateCurrentStage={(() => {
                  const currentKey = orderStageToTimelineKey(order.stage);
                  return canEditStage(currentKey);
                })()}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column: Summary (color tags + remarks) + Files & Attachments */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Summary
              </h3>
              <div className="space-y-0">
                <ColorTag label="Mounting Plate" colorName={order.colorMountingPlate} />
                <ColorTag label="Base/Stand" colorName={order.colorBaseStand} />
                <ColorTag label="Body" colorName={order.colorBody} />
              </div>
              {!hasColors && (
                <p className="text-sm text-muted-foreground pt-1">
                  No color codes specified
                </p>
              )}
              {order.remarks && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Remarks
                  </p>
                  <p
                    className="text-sm text-muted-foreground leading-relaxed italic"
                    data-testid="text-remarks"
                  >
                    &ldquo;{order.remarks}&rdquo;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Files & Attachments
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border py-3 px-3 text-muted-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="text-sm">No files attached</span>
                  <Info className="h-3.5 w-3.5 shrink-0 ml-auto opacity-60" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {order && selectedStage && (
        <StageDetailModal
          open={stageModalOpen}
          onOpenChange={setStageModalOpen}
          order={order}
          stageKey={selectedStage.key}
          stageLabel={selectedStage.label}
          mode={selectedStage.mode}
          completionData={stageModalCompletionData}
          isAuthorized={
            selectedStage.mode === "view"
              ? true
              : canEditStage(selectedStage.key)
          }
          teamMemberOptions={selectedStage.key === "fabrication" || selectedStage.key === "powder_coating" ? teamMemberOptions : undefined}
          coatingTypeOptions={selectedStage.key === "powder_coating" || selectedStage.key === "dispatch_validation" ? coatingTypeOptions : undefined}
          pcLocationOptions={
            selectedStage.key === "fabrication" || selectedStage.key === "powder_coating" || selectedStage.key === "dispatch_validation"
              ? pcLocationOptions
              : undefined
          }
          powderCoatingTeamOptions={
            selectedStage.key === "powder_coating" ? powderCoatingTeamOptions : undefined
          }
          onSave={
            selectedStage.mode === "view"
              ? undefined
              : handleStageSave(
                  selectedStage.key,
                  selectedStage.mode === "edit" ? "edit" : "complete",
                )
          }
        />
      )}
    </div>
  );
}

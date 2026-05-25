import { useState, useCallback, useMemo, useRef } from "react";
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
  getTeamsQueryPath,
  getMembersQueryPath,
  getPowderCoatingsQueryPath,
  getUserByIdPath,
  USE_REAL_API,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  getCompletionDataForStage,
  getPanelCompletionDataForStage,
} from "@/lib/stage-completion-merge";
import {
  resolveOrderDetailCacheUpdate,
  normalizeOrderDetail,
  type ApiOrderDetail,
} from "@/lib/order-normalize";
import {
  isPanelBasedOrder,
  type OrderDetailExtended,
  type PanelRecord,
} from "@/lib/order-types";
import { parseApiErrorMessage, userFacingApiError } from "@/lib/api-errors";
import { savePanelBulkStage, savePanelStage } from "@/lib/panel-stage-save";
import { isPanelCurrentStage } from "@/lib/panel-workflow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelProductionTab } from "@/components/panel-production-tab";
import { DispatchTab } from "@/components/dispatch-tab";
import { exportStageCompletionPdf } from "@/lib/stage-pdf";
import { stripAttachmentForWrite, type StageAttachment } from "@/lib/stage-uploads";
import {
  qcFromStatusOk,
  isOrderOnSheetProcessingStage,
  type SheetSaveIntent,
} from "@/lib/order-stages";
import { buildDesignStagePatchPayload } from "@/lib/design-stage-form";
import {
  timelineKeyToApiStageName,
  orderStageToTimelineKey,
  resolveStagePatchPath,
  shouldConfirmSheetQcRegression,
  applySheetPayloadAdvanceRules,
  getTimelineStageUiState,
  stageKeysToClearAfterSheetRegression,
  isSheetRegressionResponse,
  isTimelineStageCurrent,
  sheetPatchUsesEditEndpoint,
  normalizeApiStageName,
  type TimelineStageKey,
} from "@/lib/order-workflow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatLabel(s: string | undefined | null): string {
  if (s == null || s === "") return "";
  return String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  order,
  onViewStage,
  onEditStage,
  onUpdateStage,
  onExportPdf,
  canUpdateCurrentStage = true,
  canShowEdit,
  stagesFilter,
}: {
  order: {
    stage: string;
    status: string;
    currentStageApi?: string;
    stagesStatus?: Record<string, string>;
  };
  onViewStage: (stageKey: string, stageLabel: string) => void;
  onEditStage: (stageKey: string, stageLabel: string) => void;
  onUpdateStage: (stageKey: string, stageLabel: string) => void;
  onExportPdf: (stageKey: string, stageLabel: string) => void;
  canUpdateCurrentStage?: boolean;
  canShowEdit: (stageKey: string) => boolean;
  stagesFilter?: (stageKey: string) => boolean;
}) {
  const status = order.status;
  const currentStageKey = orderStageToTimelineKey(order.stage);
  const visibleStages = stagesFilter
    ? PRODUCTION_STAGES.filter((s) => stagesFilter(s.key))
    : PRODUCTION_STAGES;

  return (
    <div className="space-y-0">
      {visibleStages.map((stage, i) => {
        const uiState = getTimelineStageUiState(stage.key as TimelineStageKey, order);
        const stageApiStatus = order.stagesStatus?.[stage.key]?.toUpperCase();
        const isCompleted = uiState === "completed";
        const isCurrent = uiState === "current";
        const isPending = uiState === "pending";
        const isLastStageAndOrderCompleted =
          status === "completed" && i === visibleStages.length - 1;
        const isCancelled = uiState === "cancelled";
        const wasCleared =
          isPending &&
          stageApiStatus === "PENDING" &&
          (stage.key === "fabrication" || stage.key === "dispatch_validation") &&
          currentStageKey === "sheet_processing";
        const prevCompleted =
          i > 0 &&
          getTimelineStageUiState(visibleStages[i - 1].key as TimelineStageKey, order) === "completed";

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
              {i < visibleStages.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-[24px] ${prevCompleted || isCompleted ? lineColor : "bg-muted-foreground/15"}`}
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
                    {status === "on_hold" ? "On Hold" : "Current step"}
                  </span>
                )}
                {stageApiStatus && !isCurrent && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase bg-muted text-muted-foreground">
                    {formatLabel(stageApiStatus.toLowerCase())}
                  </span>
                )}
              </div>
              {isCompleted && (
                <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
              )}
              {isCurrent && !isCancelled && status !== "on_hold" && (
                <p className="text-xs text-muted-foreground mt-0.5">Currently processing…</p>
              )}
              {wasCleared && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Cleared — complete Sheet Processing again to continue
                </p>
              )}
              {isPending && !isCancelled && !wasCleared && (
                <p className="text-xs text-muted-foreground/50 mt-0.5">
                  Waiting for previous stage…
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {(isCompleted || (isPending && canShowEdit(stage.key))) && (
                  <>
                    {isCompleted && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs w-fit"
                        onClick={() => onExportPdf(stage.key, stage.label)}
                      >
                        <FileDown className="h-3 w-3 mr-1" /> PDF
                      </Button>
                    )}
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
                    variant="default"
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
    panel?: PanelRecord;
    panels?: PanelRecord[];
  } | null>(null);
  const [detailTab, setDetailTab] = useState("order");
  const [panelSelectionReset, setPanelSelectionReset] = useState(0);
  const [stageCompletionMap, setStageCompletionMap] = useState<
    Record<string, StageCompletionData>
  >({});
  const [sheetRegressionOpen, setSheetRegressionOpen] = useState(false);
  const pendingSheetSaveRef = useRef<{
    stageKey: string;
    saveMode: "edit" | "complete";
    panel?: PanelRecord;
    panels?: PanelRecord[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    options?: { intent?: SheetSaveIntent };
  } | null>(null);

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
      const path = getOrderByIdPath(orderId, { includePanels: true });
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

  const openUpdateStage = useCallback(
    (stageKey: string, stageLabel: string) => {
      if (order && !isTimelineStageCurrent(order, stageKey)) {
        toast({
          title: "Not the current stage",
          description: `Use Edit to update ${stageLabel} after the order has moved on.`,
          variant: "destructive",
        });
        return;
      }
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "complete" });
      setStageModalOpen(true);
    },
    [order, toast],
  );

  const extendedOrder = order as (Order & OrderDetailExtended) | undefined;
  const isPanelOrder = extendedOrder ? isPanelBasedOrder(extendedOrder) : false;
  const orderPanels = extendedOrder?.panels ?? [];

  const openPanelViewStage = useCallback(
    (panel: PanelRecord, stageKey: string, stageLabel: string) => {
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "view", panel });
      setStageModalOpen(true);
    },
    [],
  );

  const openPanelEditStage = useCallback(
    (panel: PanelRecord, stageKey: string, stageLabel: string) => {
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "edit", panel });
      setStageModalOpen(true);
    },
    [],
  );

  const openPanelUpdateStage = useCallback(
    (panel: PanelRecord, stageKey: string, stageLabel: string) => {
      if (!isPanelCurrentStage(panel, stageKey)) {
        toast({
          title: "Not the current stage",
          description: `Use Edit to update ${stageLabel} for panel ${panel.panelNo}.`,
          variant: "destructive",
        });
        return;
      }
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "complete", panel });
      setStageModalOpen(true);
    },
    [toast],
  );

  const openPanelBulkEditStage = useCallback(
    (panels: PanelRecord[], stageKey: string, stageLabel: string) => {
      if (panels.length === 0) return;
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "edit", panels });
      setStageModalOpen(true);
    },
    [],
  );

  const openPanelBulkCompleteStage = useCallback(
    (panels: PanelRecord[], stageKey: string, stageLabel: string) => {
      if (panels.length === 0) return;
      const notAtStage = panels.filter((p) => !isPanelCurrentStage(p, stageKey));
      if (notAtStage.length > 0) {
        toast({
          title: "Cannot bulk complete",
          description: `All selected panels must be at ${stageLabel}. Panel ${notAtStage[0].panelNo} is not.`,
          variant: "destructive",
        });
        return;
      }
      setSelectedStage({ key: stageKey, label: stageLabel, mode: "complete", panels });
      setStageModalOpen(true);
    },
    [toast],
  );

  const handlePanelStageSave = useCallback(
    (panel: PanelRecord, stageKey: string, saveMode: "edit" | "complete") =>
      async (
        data: StageCompletionData,
        options?: { intent?: SheetSaveIntent; confirmedRegression?: boolean },
      ): Promise<boolean> => {
        if (!orderId) return true;
        try {
          const result = await savePanelStage({
            orderId,
            panel,
            stageKey,
            saveMode,
            data,
            options,
            onRegressionRequired: () => {
              pendingSheetSaveRef.current = { stageKey, saveMode, data, options, panel };
              setSheetRegressionOpen(true);
            },
          });
          if (!result.ok) return false;
          const mapKey = `${panel.id}:${stageKey}`;
          setStageCompletionMap((prev) => ({
            ...prev,
            [mapKey]: { ...prev[mapKey], ...data, recordedAt: new Date().toISOString() },
          }));
          if (!result.keepModalOpen) setStageModalOpen(false);
          if (result.message) {
            toast({ title: "Saved", description: result.message });
          }
          return !result.keepModalOpen;
        } catch (err) {
          toast({
            title: "Panel stage update failed",
            description: userFacingApiError(err),
            variant: "destructive",
          });
          return false;
        }
      },
    [orderId, toast],
  );

  const handlePanelBulkStageSave = useCallback(
    (panels: PanelRecord[], stageKey: string, saveMode: "edit" | "complete") =>
      async (
        data: StageCompletionData,
        options?: { intent?: SheetSaveIntent; confirmedRegression?: boolean },
      ): Promise<boolean> => {
        if (!orderId || panels.length === 0) return true;
        try {
          const result = await savePanelBulkStage({
            orderId,
            panels,
            stageKey,
            saveMode,
            data,
            options,
            onRegressionRequired: () => {
              pendingSheetSaveRef.current = { stageKey, saveMode, data, options, panels };
              setSheetRegressionOpen(true);
            },
          });
          if (!result.ok) return false;
          const recordedAt = new Date().toISOString();
          setStageCompletionMap((prev) => {
            const next = { ...prev };
            for (const panel of panels) {
              const mapKey = `${panel.id}:${stageKey}`;
              next[mapKey] = { ...next[mapKey], ...data, recordedAt };
            }
            return next;
          });
          setPanelSelectionReset((n) => n + 1);
          if (!result.keepModalOpen) {
            setStageModalOpen(false);
          }
          toast({
            title: "Saved",
            description:
              result.message ??
              `${result.updated ?? panels.length} panel(s) updated successfully`,
          });
          return !result.keepModalOpen;
        } catch (err) {
          toast({
            title: "Bulk panel update failed",
            description: userFacingApiError(err),
            variant: "destructive",
          });
          return false;
        }
      },
    [orderId, toast],
  );

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
        options?: { intent?: SheetSaveIntent; confirmedRegression?: boolean },
      ): Promise<boolean> => {
        if (!order?.id || !orderId) return true;

        if (
          shouldConfirmSheetQcRegression(stageKey, order, data.statusOk ?? true) &&
          !options?.confirmedRegression
        ) {
          pendingSheetSaveRef.current = { stageKey, saveMode, data, options };
          setSheetRegressionOpen(true);
          return false;
        }

        const isEditSave = saveMode === "edit";
        const sheetIntent: SheetSaveIntent | undefined =
          stageKey === "sheet_processing" && !isEditSave
            ? options?.intent ?? "complete"
            : undefined;
        const workflowOrder = order as Order & {
          currentStageApi?: string;
          stagesStatus?: Record<string, string>;
        };
        const previousCurrentApi = workflowOrder.currentStageApi ?? normalizeApiStageName(order.stage);
        const stageNameForApi =
          stageKey === "fabrication" || stageKey === "powder_coating"
            ? "FABRICATION"
            : timelineKeyToApiStageName(stageKey);
        const usesEditEndpoint =
          saveMode === "edit" ||
          (stageKey === "sheet_processing"
            ? sheetPatchUsesEditEndpoint(workflowOrder, saveMode)
            : !isTimelineStageCurrent(workflowOrder, stageKey));
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
          applySheetPayloadAdvanceRules(payload, {
            saveMode,
            usesEditEndpoint,
            sheetIntent,
            qcStatus,
          });
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
          const effectiveSaveMode = usesEditEndpoint ? "edit" : saveMode;
          const patchPath = (_name: string) => {
            const key = isCombinedFabPc ? "fabrication" : stageKey;
            return resolveStagePatchPath(order.id, key, workflowOrder, effectiveSaveMode);
          };
          try {
            let json: unknown;
            if (isCombinedFabPc) {
              if (!isTimelineStageCurrent(workflowOrder, "fabrication") && saveMode === "complete") {
                toast({
                  title: "Not the current stage",
                  description: "Complete Sheet Processing before updating Fabrication.",
                  variant: "destructive",
                });
                return false;
              }
              const mergedFabricationPayload = {
                ...fabricationPayload,
                ...powderCoatingPayload,
                ...(attachmentsForPatch ? { attachments: attachmentsForPatch } : {}),
              };
              const res = await apiRequest("PATCH", patchPath("FABRICATION"), mergedFabricationPayload);
              json = await res.json();
            } else {
              if (
                saveMode === "complete" &&
                !usesEditEndpoint &&
                !isTimelineStageCurrent(workflowOrder, stageKey)
              ) {
                toast({
                  title: "Not the current stage",
                  description: `Use Edit to change ${stageLabelForError} after the order has moved on.`,
                  variant: "destructive",
                });
                return false;
              }
              const res = await apiRequest("PATCH", patchPath(stageNameForApi), payload);
              json = await res.json();
            }
            const { order: updated, shouldSetCache } = resolveOrderDetailCacheUpdate(json);
            if (shouldSetCache && updated) {
              queryClient.setQueryData(["order-detail", orderId], updated);
            } else {
              await queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
            }
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            const successMessage = (json as { message?: string })?.message;
            const updatedWorkflow = updated as Order & { currentStageApi?: string };
            const apiCurrentStage =
              (json as { data?: ApiOrderDetail })?.data?.currentStage ??
              updatedWorkflow?.currentStageApi ??
              updated?.stage;
            const sheetSavedNotAdvanced =
              stageKey === "sheet_processing" &&
              !usesEditEndpoint &&
              !isEditSave &&
              isOrderOnSheetProcessingStage(apiCurrentStage);

            const didRegress = isSheetRegressionResponse(
              stageKey,
              data.statusOk ?? true,
              successMessage,
              updatedWorkflow ?? null,
              previousCurrentApi,
            );
            if (didRegress) {
              setStageCompletionMap((prev) => {
                const next = { ...prev };
                for (const k of stageKeysToClearAfterSheetRegression()) {
                  delete next[k];
                }
                return next;
              });
            }

            if (sheetSavedNotAdvanced) {
              keepModalOpen = true;
              toast({
                title: "Saved",
                description:
                  successMessage ??
                  "Sheet processing saved. Set status to OK and complete to continue.",
              });
            } else {
              const toastTitle = didRegress
                ? "Order returned to Sheet Processing"
                : isEditSave || usesEditEndpoint
                  ? "Stage updated"
                  : "Stage completed";
              toast({
                title: toastTitle,
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
                description: userFacingApiError(err),
                variant: "destructive",
              });
            }
            return false;
          }
        }
        const sheetStaysInProgress =
          stageKey === "sheet_processing" &&
          !usesEditEndpoint &&
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
    [order, orderId, user?.name, user?.email, user?.username, toast]
  );

  const stageModalCompletionData = useMemo((): StageCompletionData | null => {
    if (!selectedStage || !order) return null;
    const panelForData = selectedStage.panel ?? selectedStage.panels?.[0];
    if (panelForData) {
      return getPanelCompletionDataForStage(
        selectedStage.key,
        order,
        panelForData,
        stageCompletionMap,
      );
    }
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
      className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 min-w-0 overflow-x-hidden"
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
                <SpecField
                  label="Quantity"
                  value={
                    isPanelOrder && extendedOrder?.dispatchedQuantity != null
                      ? `${extendedOrder.dispatchedQuantity} / ${order.quantity} dispatched`
                      : order.quantity
                  }
                />
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

          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="order">Order &amp; Design</TabsTrigger>
              {isPanelOrder && (
                <>
                  <TabsTrigger value="panels">Panels</TabsTrigger>
                  <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value="order">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                    {isPanelOrder ? "Design (order level)" : "Production Timeline"}
                  </h3>
                  {isPanelOrder ? (
                    <ProductionTimeline
                      order={{
                        stage: order.stage,
                        status: order.status,
                        currentStageApi: extendedOrder?.currentStageApi,
                        stagesStatus: extendedOrder?.stagesStatus,
                      }}
                      onViewStage={openViewStage}
                      onEditStage={openEditStage}
                      onUpdateStage={openUpdateStage}
                      onExportPdf={handleExportPdf}
                      canShowEdit={canShowEditButton}
                      canUpdateCurrentStage={canEditStage("design_preparation")}
                      stagesFilter={(key) => key === "design_preparation"}
                    />
                  ) : (
                    <ProductionTimeline
                      order={{
                        stage: order.stage,
                        status: order.status,
                        currentStageApi: extendedOrder?.currentStageApi,
                        stagesStatus: extendedOrder?.stagesStatus,
                      }}
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {isPanelOrder && (
              <>
                <TabsContent value="panels">
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <PanelProductionTab
                        order={extendedOrder!}
                        panels={orderPanels}
                        panelSummary={extendedOrder?.panelSummary}
                        selectionResetKey={panelSelectionReset}
                        canEditStage={canEditStage}
                        onViewStage={openPanelViewStage}
                        onEditStage={openPanelEditStage}
                        onUpdateStage={openPanelUpdateStage}
                        onBulkEditStage={openPanelBulkEditStage}
                        onBulkCompleteStage={openPanelBulkCompleteStage}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="dispatches">
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <DispatchTab
                        orderId={orderId!}
                        panels={orderPanels}
                        poReferences={extendedOrder?.poReferences}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
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

      <AlertDialog open={sheetRegressionOpen} onOpenChange={setSheetRegressionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return order to Sheet Processing?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSheetSaveRef.current?.panels?.length
                ? `This will return ${pendingSheetSaveRef.current.panels.length} panel(s) to Sheet Processing and clear later stage data. Continue?`
                : pendingSheetSaveRef.current?.panel
                  ? "This will return the panel to Sheet Processing and clear later stage data. Continue?"
                  : "This will send the order back to Sheet Processing and clear Fabrication and Dispatch data. Continue?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingSheetSaveRef.current;
                setSheetRegressionOpen(false);
                if (!pending || !order) return;
                if (pending.panels?.length) {
                  void handlePanelBulkStageSave(
                    pending.panels,
                    pending.stageKey,
                    pending.saveMode,
                  )(pending.data, { ...pending.options, confirmedRegression: true });
                } else if (pending.panel) {
                  void handlePanelStageSave(
                    pending.panel,
                    pending.stageKey,
                    pending.saveMode,
                  )(pending.data, { ...pending.options, confirmedRegression: true });
                } else {
                  void handleStageSave(pending.stageKey, pending.saveMode)(pending.data, {
                    ...pending.options,
                    confirmedRegression: true,
                  });
                }
                pendingSheetSaveRef.current = null;
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {order && selectedStage && (
        <StageDetailModal
          open={stageModalOpen}
          onOpenChange={setStageModalOpen}
          order={order}
          stageKey={selectedStage.key}
          stageLabel={
            selectedStage.panels?.length
              ? `${selectedStage.label} — ${selectedStage.panels.length} panels`
              : selectedStage.panel
                ? `${selectedStage.label} — Panel ${selectedStage.panel.panelNo}`
                : selectedStage.label
          }
          mode={selectedStage.mode}
          isOrderCurrentStage={
            selectedStage.panels?.length
              ? selectedStage.panels.every((p) =>
                  isPanelCurrentStage(p, selectedStage.key),
                )
              : selectedStage.panel
                ? isPanelCurrentStage(selectedStage.panel, selectedStage.key)
                : isTimelineStageCurrent(order, selectedStage.key)
          }
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
              : selectedStage.panels?.length
                ? handlePanelBulkStageSave(
                    selectedStage.panels,
                    selectedStage.key,
                    selectedStage.mode === "edit" ? "edit" : "complete",
                  )
                : selectedStage.panel
                  ? handlePanelStageSave(
                      selectedStage.panel,
                      selectedStage.key,
                      selectedStage.mode === "edit" ? "edit" : "complete",
                    )
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

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Pencil } from "lucide-react";
import type { Order } from "@shared/schema";
import type { OrderDetailExtended, PanelRecord, PanelSummary } from "@/lib/order-types";
import { panelProductionStageToTimelineKey } from "@/lib/order-types";
import {
  isPanelCurrentStage,
  panelCanBulkCompleteAtStage,
  panelCanBulkEditAtStage,
  panelCanEditProduction,
  panelStatusLabel,
} from "@/lib/panel-workflow";
import { cn } from "@/lib/utils";

const PANEL_STAGES = [
  { key: "sheet_processing", label: "Sheet processing" },
  { key: "fabrication", label: "Fabrication" },
  { key: "dispatch_validation", label: "Dispatch validation" },
] as const;

type PanelStageKey = (typeof PANEL_STAGES)[number]["key"];

function formatLabelLocal(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PanelSummaryBar({ summary }: { summary?: PanelSummary }) {
  if (!summary || summary.total <= 0) return null;
  const items = [
    { label: "Total", value: summary.total },
    { label: "Dispatched", value: summary.dispatched },
    { label: "Ready", value: summary.readyToDispatch },
    { label: "In progress", value: summary.inProgress },
    { label: "On hold", value: summary.onHold },
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item) => (
        <Badge key={item.label} variant="secondary" className="text-xs font-medium px-2.5 py-1">
          {item.label}: {item.value}
        </Badge>
      ))}
    </div>
  );
}

function PanelRowActions({
  panel,
  currentKey,
  rowStageLabel,
  editable,
  canEditStage,
  onViewStage,
  onEditStage,
  onUpdateStage,
  layout,
}: {
  panel: PanelRecord;
  currentKey: string;
  rowStageLabel: string;
  editable: boolean;
  canEditStage: (stageKey: string) => boolean;
  onViewStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onEditStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onUpdateStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  layout: "card" | "table";
}) {
  const showEditActions = editable && canEditStage(currentKey);
  const showUpdate = showEditActions && isPanelCurrentStage(panel, currentKey);

  return (
    <div
      className={cn(
        layout === "card"
          ? "grid grid-cols-2 gap-2 w-full"
          : "flex flex-wrap justify-end gap-1.5",
      )}
    >
      <Button
        variant="outline"
        size="sm"
        className={cn("h-8 text-xs", layout === "card" && "w-full")}
        onClick={() => onViewStage(panel, currentKey, rowStageLabel)}
      >
        <Eye className="h-3 w-3 mr-1 shrink-0" /> View
      </Button>
      {showEditActions && (
        <>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs", layout === "card" && "w-full")}
            onClick={() => onEditStage(panel, currentKey, rowStageLabel)}
          >
            <Pencil className="h-3 w-3 mr-1 shrink-0" /> Edit
          </Button>
          {showUpdate && (
            <Button
              variant="default"
              size="sm"
              className={cn(
                "h-8 text-xs",
                layout === "card" ? "col-span-2 w-full" : "",
              )}
              onClick={() => onUpdateStage(panel, currentKey, rowStageLabel)}
            >
              Update
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PanelListItem({
  panel,
  checked,
  selectable,
  canEditStage,
  onToggle,
  onViewStage,
  onEditStage,
  onUpdateStage,
}: {
  panel: PanelRecord;
  checked: boolean;
  selectable: boolean;
  canEditStage: (stageKey: string) => boolean;
  onToggle: () => void;
  onViewStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onEditStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onUpdateStage: (panel: PanelRecord, stageKey: string, label: string) => void;
}) {
  const currentKey = panelProductionStageToTimelineKey(panel.currentStage);
  const editable = panelCanEditProduction(panel);
  const rowStageDef = PANEL_STAGES.find((s) => s.key === currentKey) ?? PANEL_STAGES[0];
  const stageLabel = formatLabelLocal(currentKey);

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-3"
      data-testid={`panel-row-${panel.panelNo}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          disabled={!selectable}
          onCheckedChange={onToggle}
          aria-label={`Select panel ${panel.panelNo}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-sm">Panel {panel.panelNo}</span>
          </div>
          <p className="text-xs text-muted-foreground break-all">
            {panel.serialLabel ?? "—"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase">
              {panelStatusLabel(String(panel.panelStatus))}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {stageLabel}
            </Badge>
          </div>
        </div>
      </div>
      <PanelRowActions
        panel={panel}
        currentKey={currentKey}
        rowStageLabel={rowStageDef.label}
        editable={editable}
        canEditStage={canEditStage}
        onViewStage={onViewStage}
        onEditStage={onEditStage}
        onUpdateStage={onUpdateStage}
        layout="card"
      />
    </div>
  );
}

export function PanelProductionTab({
  order: _order,
  panels,
  panelSummary,
  canEditStage,
  onViewStage,
  onEditStage,
  onUpdateStage,
  onBulkEditStage,
  onBulkCompleteStage,
  selectionResetKey = 0,
}: {
  order: Order & OrderDetailExtended;
  panels: PanelRecord[];
  panelSummary?: PanelSummary;
  selectionResetKey?: number;
  canEditStage: (stageKey: string) => boolean;
  onViewStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onEditStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onUpdateStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onBulkEditStage: (panels: PanelRecord[], stageKey: string, label: string) => void;
  onBulkCompleteStage: (panels: PanelRecord[], stageKey: string, label: string) => void;
}) {
  const [stageFilter, setStageFilter] = useState<PanelStageKey>("sheet_processing");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectionResetKey]);

  const stageDef = PANEL_STAGES.find((s) => s.key === stageFilter) ?? PANEL_STAGES[0];

  const completeEligible = useMemo(
    () => panels.filter((p) => panelCanBulkCompleteAtStage(p, stageFilter)),
    [panels, stageFilter],
  );

  const selectedPanels = useMemo(
    () => panels.filter((p) => selectedIds.includes(p.id)),
    [panels, selectedIds],
  );

  const canBulkComplete =
    selectedPanels.length > 0 &&
    selectedPanels.every((p) => panelCanBulkCompleteAtStage(p, stageFilter)) &&
    canEditStage(stageFilter);

  const canBulkEdit =
    selectedPanels.length > 0 &&
    selectedPanels.every((p) => panelCanBulkEditAtStage(p, stageFilter)) &&
    canEditStage(stageFilter);

  const togglePanel = (id: string, eligible: boolean) => {
    if (!eligible) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllCompleteEligible = () => {
    setSelectedIds(completeEligible.map((p) => p.id));
  };

  const clearSelection = () => setSelectedIds([]);

  if (!panels.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No panels loaded. Refresh the page or check the API includes panels for this order.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <PanelSummaryBar summary={panelSummary} />

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Bulk actions for</span>
          <Select
            value={stageFilter}
            onValueChange={(v) => {
              setStageFilter(v as PanelStageKey);
              setSelectedIds([]);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PANEL_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs w-full sm:w-auto"
            disabled={completeEligible.length === 0}
            onClick={selectAllCompleteEligible}
          >
            Select all at stage ({completeEligible.length})
          </Button>
          {selectedIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs w-full sm:w-auto"
              onClick={clearSelection}
            >
              Clear ({selectedIds.length})
            </Button>
          )}
        </div>

        {selectedIds.length > 0 && canEditStage(stageFilter) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs w-full sm:w-auto"
              disabled={!canBulkEdit}
              onClick={() => onBulkEditStage(selectedPanels, stageFilter, stageDef.label)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Bulk edit ({selectedIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 text-xs w-full sm:w-auto"
              disabled={!canBulkComplete}
              onClick={() => onBulkCompleteStage(selectedPanels, stageFilter, stageDef.label)}
            >
              Bulk complete ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* Mobile: stacked cards — no horizontal scroll */}
      <div className="md:hidden space-y-3">
        {panels.map((panel) => {
          const selectable =
            panelCanBulkEditAtStage(panel, stageFilter) ||
            panelCanBulkCompleteAtStage(panel, stageFilter);
          return (
            <PanelListItem
              key={panel.id}
              panel={panel}
              checked={selectedIds.includes(panel.id)}
              selectable={selectable}
              canEditStage={canEditStage}
              onToggle={() => togglePanel(panel.id, selectable)}
              onViewStage={onViewStage}
              onEditStage={onEditStage}
              onUpdateStage={onUpdateStage}
            />
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-16">#</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right min-w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {panels.map((panel) => {
              const currentKey = panelProductionStageToTimelineKey(panel.currentStage);
              const editable = panelCanEditProduction(panel);
              const rowStageDef = PANEL_STAGES.find((s) => s.key === currentKey) ?? PANEL_STAGES[0];
              const selectable =
                panelCanBulkEditAtStage(panel, stageFilter) ||
                panelCanBulkCompleteAtStage(panel, stageFilter);
              const checked = selectedIds.includes(panel.id);

              return (
                <TableRow key={panel.id} data-testid={`panel-row-${panel.panelNo}`}>
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      disabled={!selectable}
                      onCheckedChange={() => togglePanel(panel.id, selectable)}
                      aria-label={`Select panel ${panel.panelNo}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{panel.panelNo}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                    {panel.serialLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {panelStatusLabel(String(panel.panelStatus))}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatLabelLocal(panelProductionStageToTimelineKey(panel.currentStage))}
                  </TableCell>
                  <TableCell className="text-right">
                    <PanelRowActions
                      panel={panel}
                      currentKey={currentKey}
                      rowStageLabel={rowStageDef.label}
                      editable={editable}
                      canEditStage={canEditStage}
                      onViewStage={onViewStage}
                      onEditStage={onEditStage}
                      onUpdateStage={onUpdateStage}
                      layout="table"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Use the stage filter and checkboxes to bulk complete or edit many panels in one step. Order
        design is completed on the Order &amp; Design tab.
      </p>
    </div>
  );
}

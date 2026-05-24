import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  panelCanEditProduction,
  panelStatusLabel,
} from "@/lib/panel-workflow";

const PANEL_STAGES = [
  { key: "sheet_processing", label: "Sheet" },
  { key: "fabrication", label: "Fabrication" },
  { key: "dispatch_validation", label: "Dispatch validation" },
] as const;

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

export function PanelProductionTab({
  order,
  panels,
  panelSummary,
  canEditStage,
  onViewStage,
  onEditStage,
  onUpdateStage,
}: {
  order: Order & OrderDetailExtended;
  panels: PanelRecord[];
  panelSummary?: PanelSummary;
  canEditStage: (stageKey: string) => boolean;
  onViewStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onEditStage: (panel: PanelRecord, stageKey: string, label: string) => void;
  onUpdateStage: (panel: PanelRecord, stageKey: string, label: string) => void;
}) {
  if (!panels.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No panels loaded. Refresh the page or check the API includes panels for this order.
      </p>
    );
  }

  return (
    <div>
      <PanelSummaryBar summary={panelSummary} />
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {panels.map((panel) => {
              const currentKey = panelProductionStageToTimelineKey(panel.currentStage);
              const editable = panelCanEditProduction(panel);
              const stageDef = PANEL_STAGES.find((s) => s.key === currentKey) ?? PANEL_STAGES[0];
              return (
                <TableRow key={panel.id} data-testid={`panel-row-${panel.panelNo}`}>
                  <TableCell className="font-medium">{panel.panelNo}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {panel.serialLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {panelStatusLabel(String(panel.panelStatus))}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatLabelLocal(panelProductionStageToTimelineKey(panel.currentStage))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onViewStage(panel, currentKey, stageDef.label)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      {editable && canEditStage(currentKey) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onEditStage(panel, currentKey, stageDef.label)}
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          {isPanelCurrentStage(panel, currentKey) && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onUpdateStage(panel, currentKey, stageDef.label)}
                            >
                              Update
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Order design is completed on the Order &amp; Design tab. Sheet, fabrication, and dispatch
        validation are tracked per panel.
      </p>
    </div>
  );
}

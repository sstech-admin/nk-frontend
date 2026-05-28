import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getOrderDispatchesPath } from "@/lib/api";
import { normalizeDispatchList } from "@/lib/order-normalize";
import type { DispatchRecord, PanelRecord, PoReference } from "@/lib/order-types";
import { useToast } from "@/hooks/use-toast";

export function DispatchTab({
  orderId,
  panels,
  poReferences,
}: {
  orderId: string;
  panels: PanelRecord[];
  poReferences?: PoReference[];
}) {
  const { toast } = useToast();
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [poReference, setPoReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);

  const readyPanels = panels.filter(
    (p) => String(p.panelStatus).toUpperCase() === "READY_TO_DISPATCH",
  );

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ["order-dispatches", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const res = await apiRequest("GET", getOrderDispatchesPath(orderId));
      const json = await res.json();
      const raw = json?.data ?? json;
      return normalizeDispatchList(raw);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        vehicleNumber: vehicleNumber.trim(),
        poReference: poReference || undefined,
        remarks: remarks.trim() || undefined,
        panelIds: selectedPanelIds,
      };
      const res = await apiRequest("POST", getOrderDispatchesPath(orderId), body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-dispatches", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      setVehicleNumber("");
      setRemarks("");
      setSelectedPanelIds([]);
      toast({ title: "Dispatch recorded", description: "Panels marked as dispatched." });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create dispatch";
      toast({ title: "Dispatch failed", description: msg, variant: "destructive" });
    },
  });

  const togglePanel = (id: string) => {
    setSelectedPanelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4" /> Record dispatch
        </h4>
        <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Vehicle number</Label>
              <Input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="GJ-01-AB-1234"
              />
            </div>
            {poReferences && poReferences.length > 0 && (
              <div className="space-y-2">
                <Label>P.O. reference</Label>
                <Select value={poReference} onValueChange={setPoReference}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO" />
                  </SelectTrigger>
                  <SelectContent>
                    {poReferences.map((po, i) => (
                      <SelectItem key={`${po.poNumber}-${i}`} value={po.poNumber}>
                        {po.poNumber}
                        {po.quantity != null ? ` (qty ${po.quantity})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Panels ready to dispatch</Label>
              {readyPanels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No panels in READY_TO_DISPATCH status.
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {readyPanels.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPanelIds.includes(p.id)}
                        onCheckedChange={() => togglePanel(p.id)}
                      />
                      Panel {p.panelNo}
                      {p.serialLabel ? ` — ${p.serialLabel}` : ""}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
            <Button
              disabled={
                !vehicleNumber.trim() ||
                selectedPanelIds.length === 0 ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving…" : "Create dispatch"}
            </Button>
          </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3">Dispatch history</h4>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : dispatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dispatches yet.</p>
        ) : (
          <ul className="space-y-3">
            {dispatches.map((d: DispatchRecord) => (
              <li key={d.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{d.vehicleNumber ?? "—"}</span>
                  {d.createdAt && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(d.createdAt).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                {d.poReference && (
                  <p className="text-muted-foreground mt-1">PO: {d.poReference}</p>
                )}
                {d.panelNumbers?.length ? (
                  <p className="mt-1">Panels: {d.panelNumbers.join(", ")}</p>
                ) : d.panelIds?.length ? (
                  <p className="mt-1">{d.panelIds.length} panel(s)</p>
                ) : null}
                {d.remarks && <p className="mt-1 italic text-muted-foreground">{d.remarks}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

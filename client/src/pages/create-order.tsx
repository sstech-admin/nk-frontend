import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Check,
  Calendar,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { allocateWorkOrderNumber, getOrderStageUpdatePath, USE_REAL_API } from "@/lib/api";
import { SearchablePartySelect } from "@/components/searchable-party-select";
import { SearchableSelect } from "@/components/searchable-select";
import type { Party, Member } from "@shared/schema";

const ACCESSORIES = [
  { value: "point_lock", label: "Point Lock" },
  { value: "3_point_lock", label: "3 Point Lock" },
  { value: "pu_gasketing", label: "PU Gasketing" },
  { value: "patti_gasketing", label: "Patti Gasketing" },
];

const orderFormSchema = z.object({
  partyName: z.string().min(1, "Party name is required"),
  designerName: z.string().min(1, "Designer name is required"),
  panelType: z.string().min(1, "Panel type is required"),
  poNo: z.string().optional(),
  invoiceRef: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  description: z.string().min(1, "Description is required"),
  parts: z.coerce.number().min(0, "Parts is required"),
  customerWoNo: z.string().min(1, "Customer WO No is required"),
  powderCoatingType: z.string().min(1, "Powder coating type is required"),
  colorBody: z.string().min(1, "Body color is required"),
  colorMountingPlate: z.string().min(1, "Mounting plate color is required"),
  colorBaseStand: z.string().min(1, "Base/Stand color is required"),
  accessories: z.array(z.string()).default([]),
  accessoriesOther: z.string().optional(),
  rateType: z.string().min(1, "Rate type is required"),
  rate: z.string().min(1, "Rate is required"),
  remarks: z.string().optional(),
  stage: z.string().default("cutting"),
  status: z.string().default("in_progress"),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

function parseCreateOrderError(err: unknown): { status?: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.match(/^(\d+):\s*([\s\S]*)$/);
  if (!m) return { message: raw };
  const status = Number(m[1]);
  let message = m[2].trim();
  try {
    const j = JSON.parse(m[2]);
    message = (j.message as string) ?? message;
    if (Array.isArray(j.errors) && j.errors.length > 0) {
      message = j.errors.join("; ");
    }
  } catch {
    // plain text
  }
  return { status, message };
}

function RequiredLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {children}
      {optional ? (
        <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
      ) : (
        <span className="text-destructive ml-0.5">*</span>
      )}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function RadioOption({
  label,
  value,
  checked,
  onChange,
  name,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(value)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(value); }}
      className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors select-none outline-none ${
        checked
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-accent"
      }`}
      data-testid={`radio-${name}-${value}`}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          checked ? "border-emerald-500" : "border-muted-foreground/40"
        }`}
      >
        {checked && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
      </div>
      {label}
    </div>
  );
}

function CheckboxOption({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(!checked); }}
      className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors select-none outline-none ${
        checked
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-accent"
      }`}
      data-testid={testId}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          checked ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </div>
      {label}
    </div>
  );
}

export default function CreateOrderPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [workOrderNumber, setWorkOrderNumber] = useState<string | null>(null);
  const [woAllocating, setWoAllocating] = useState(true);
  const [woAllocateError, setWoAllocateError] = useState<string | null>(null);

  const allocateWo = useCallback(async () => {
    setWoAllocating(true);
    setWoAllocateError(null);
    try {
      const wo = await allocateWorkOrderNumber();
      setWorkOrderNumber(wo);
    } catch (e) {
      setWorkOrderNumber(null);
      setWoAllocateError(e instanceof Error ? e.message : "Could not generate work order number");
    } finally {
      setWoAllocating(false);
    }
  }, []);

  useEffect(() => {
    allocateWo();
  }, [allocateWo]);

  const { data: partiesData } = useQuery<unknown>({
    queryKey: ["/api/parties"],
  });

  const { data: membersData } = useQuery<Member[] | { members?: Member[]; users?: unknown[] }>({
    queryKey: ["/api/members"],
  });

  const membersRaw: unknown[] = (() => {
    if (!membersData) return [];
    if (Array.isArray(membersData)) return membersData;
    const data = (membersData as { data?: { members?: unknown[] }; members?: unknown[] }).data;
    const list = data?.members ?? (membersData as { members?: unknown[] }).members;
    return Array.isArray(list) ? list : [];
  })();

  type MemberRow = {
    _id?: string; id?: string; name?: string; role?: string; team?: string;
    teamId?: { _id?: string; teamName?: string };
    status?: string; isActive?: boolean;
  };
  const membersNormalized = (membersRaw as MemberRow[]).map((m) => ({
    id: m._id ?? m.id ?? "",
    name: m.name ?? "",
    role: m.role ?? "",
    team: m.team ?? m.teamId?.teamName ?? "",
    status: m.isActive === true ? "active" : m.isActive === false ? "inactive" : (m.status ?? "active"),
  })).filter((m) => m.id && m.name);

  const activeMembersFiltered = membersNormalized.filter((m) => m.status === "active");
  const activeMembers = activeMembersFiltered.length > 0 ? activeMembersFiltered : membersNormalized;

  const partiesRaw = Array.isArray(partiesData) ? partiesData : (partiesData as { data?: { parties?: unknown[] }; parties?: unknown[] })?.data?.parties ?? (partiesData as { parties?: unknown[] })?.parties ?? [];
  const partiesNormalized = (partiesRaw as Array<{ _id?: string; id?: string; partyName?: string; name?: string; status?: string; isActive?: boolean; gstNumber?: string; gstNo?: string }>).map((p) => ({
    id: p._id ?? p.id ?? "",
    name: p.partyName ?? p.name ?? "",
    status: p.isActive === true ? "active" : p.isActive === false ? "inactive" : (p.status ?? "active"),
    gstNo: p.gstNumber ?? p.gstNo ?? undefined,
  }));
  const activeParties = partiesNormalized.filter((p) => p.status === "active");

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      partyName: "",
      designerName: "",
      panelType: "",
      poNo: "",
      invoiceRef: "",
      quantity: 1,
      description: "",
      parts: undefined,
      customerWoNo: "",
      powderCoatingType: "single_coat",
      colorBody: "",
      colorMountingPlate: "",
      colorBaseStand: "",
      accessories: [],
      accessoriesOther: "",
      rateType: "including_acc",
      rate: "",
      remarks: "",
      stage: "cutting",
      status: "in_progress",
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, workOrderNumber: wo }: { data: OrderFormValues; workOrderNumber: string }) => {
      const partyId = activeParties.find((p) => p.name === data.partyName)?.id ?? "";
      const designerId = activeMembers.find((m) => m.name === data.designerName)?.id ?? "";
      const preparedBy = user?._id ?? "";

      const payload = {
        workOrderNumber: wo,
        partyId,
        designerId,
        preparedBy,
        panelType: data.panelType?.trim() ?? "",
        poNumber: data.poNo?.trim() ?? undefined,
        poReferences: data.poNo?.trim()
          ? [{ poNumber: data.poNo.trim() }]
          : undefined,
        invoiceRef: data.invoiceRef?.trim() || undefined,
        quantity: Number(data.quantity) || 0,
        descriptionSize: data.description?.trim() ?? "",
        partsCount: Number(data.parts) || 0,
        panelName: data.customerWoNo?.trim() ?? "",
        coatingType: data.powderCoatingType === "double_coat" ? "DOUBLE" : "SINGLE",
        colorDetails: {
          body: data.colorBody?.trim() ?? "",
          mountingPlate: data.colorMountingPlate?.trim() ?? "",
          baseStand: data.colorBaseStand?.trim() ?? "",
        },
        accessories: {
          pointLock: data.accessories?.includes("point_lock") ?? false,
          threePointLock: data.accessories?.includes("3_point_lock") ?? false,
          puGasketing: data.accessories?.includes("pu_gasketing") ?? false,
          pattiGasketing: data.accessories?.includes("patti_gasketing") ?? false,
          other: data.accessoriesOther?.trim() ?? "",
        },
        pricing: {
          ratePerKg: Number(data.rate) || parseFloat(String(data.rate).replace(/[^0-9.-]/g, "")) || 0,
          includingAccessories: data.rateType === "including_acc",
          extraCharges: data.rateType === "extra" ? (Number(data.rate) || parseFloat(String(data.rate).replace(/[^0-9.-]/g, "")) || 0) : 0,
        },
        remarks: data.remarks?.trim() ?? undefined,
      };

      const res = await apiRequest("POST", "/api/orders", payload);
      return res.json() as Promise<{
        success?: boolean;
        message?: string;
        data?: { _id?: string; workOrderNumber?: string };
        _id?: string;
        id?: string;
      }>;
    },
    onSuccess: async (json, variables) => {
      const orderId = json?.data?._id ?? json?._id ?? json?.id;
      if (orderId && USE_REAL_API) {
        try {
          await apiRequest("PATCH", getOrderStageUpdatePath(orderId, "DESIGN_PREPARATION"), {
            remarks: variables.data.remarks?.trim() || "Order created.",
            notes: "Initial design stage.",
          });
        } catch {
          // non-blocking; still redirect and show success
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      const woLabel = json?.data?.workOrderNumber ?? variables.workOrderNumber;
      toast({
        title: "Work order created successfully",
        description: woLabel ? `Work order ${woLabel}` : undefined,
      });
      navigate("/orders");
    },
    onError: (err: Error) => {
      const { status, message } = parseCreateOrderError(err);
      if (status === 409) {
        toast({
          title: "Work order number already used",
          description: "Close this form and open Create again to get a new number, or contact support.",
          variant: "destructive",
        });
        return;
      }
      if (status === 400 && /workOrderNumber|work-order-number\/next/i.test(message)) {
        toast({
          title: "Invalid work order number",
          description: message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Could not create order", description: message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    if (!workOrderNumber) {
      toast({
        title: "Work order number not ready",
        description: woAllocateError ?? "Generate a work order number before submitting.",
        variant: "destructive",
      });
      return;
    }
    form.handleSubmit(
      (data) => createMutation.mutate({ data, workOrderNumber }),
      () => {
        toast({ title: "Please fill all required fields", description: "Fields marked with * are required", variant: "destructive" });
      }
    )();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} data-testid="button-back-to-orders">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-create-order-title">New Work Order</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Fill in all the details below</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span data-testid="text-today-date">{today}</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel><RequiredLabel>WO. No.</RequiredLabel></FormLabel>
                  {woAllocating ? (
                    <Skeleton className="h-9 w-full" data-testid="skeleton-order-no" />
                  ) : woAllocateError ? (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">{woAllocateError}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => allocateWo()}>
                        Generate work order number
                      </Button>
                    </div>
                  ) : (
                    <Input
                      value={workOrderNumber ?? ""}
                      disabled
                      readOnly
                      className="bg-muted font-medium"
                      data-testid="input-order-no"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">Assigned automatically; cannot be edited.</p>
                </div>

                <FormField control={form.control} name="designerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Designer Name</RequiredLabel></FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={activeMembers.map((m) => ({
                          id: m.id,
                          label: m.name,
                          sublabel: m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) + " · " + m.team : m.team,
                        }))}
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select Designer"
                        searchPlaceholder="Search by name or role..."
                        noResultsText="No designers found"
                        testIdPrefix="designer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="partyName" render={({ field }) => (
                <FormItem>
                  <FormLabel><RequiredLabel>Party Name</RequiredLabel></FormLabel>
                  <FormControl>
                    <SearchablePartySelect
                      parties={activeParties}
                      value={field.value}
                      onChange={field.onChange}
                      onAddNew={() => navigate("/parties")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="panelType" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Panel Type</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HT Panel" {...field} data-testid="input-panel-type" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="invoiceRef" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice ref</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional invoice reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="poNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel optional>P.O. No.</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="-" {...field} data-testid="input-po-no" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Qty</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} data-testid="input-quantity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Description (Size)</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 3000x2000x550" {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="parts" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Parts (Bhag)</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="e.g. 3" {...field} value={field.value ?? ""} data-testid="input-parts" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="customerWoNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Customer WO No / Panel Name</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 3245" {...field} data-testid="input-customer-wo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <SectionHeader title="Powder Coating Type" />

              <FormField control={form.control} name="powderCoatingType" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-3">
                    <RadioOption
                      label="Single Coat"
                      value="single_coat"
                      checked={field.value === "single_coat"}
                      onChange={field.onChange}
                      name="coating-type"
                    />
                    <RadioOption
                      label="Double Coat"
                      value="double_coat"
                      checked={field.value === "double_coat"}
                      onChange={field.onChange}
                      name="coating-type"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <SectionHeader title="Color Code of Panel" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="colorBody" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Body</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. RAL-7035" {...field} data-testid="input-color-body" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="colorMountingPlate" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Mounting Plate</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Orange" {...field} data-testid="input-color-mounting" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="colorBaseStand" render={({ field }) => (
                  <FormItem>
                    <FormLabel><RequiredLabel>Base/Stand</RequiredLabel></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Black" {...field} data-testid="input-color-base" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <SectionHeader title="Accessories" />

              <FormField control={form.control} name="accessories" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-3">
                    {ACCESSORIES.map((acc) => (
                      <CheckboxOption
                        key={acc.value}
                        label={acc.label}
                        checked={field.value?.includes(acc.value) ?? false}
                        onChange={(checked) => {
                          const current = field.value ?? [];
                          if (checked) {
                            field.onChange([...current, acc.value]);
                          } else {
                            field.onChange(current.filter((v: string) => v !== acc.value));
                          }
                        }}
                        testId={`checkbox-${acc.value}`}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="accessoriesOther" render={({ field }) => (
                <FormItem>
                  <FormLabel><RequiredLabel optional>Any Other</RequiredLabel></FormLabel>
                  <FormControl>
                    <Input placeholder="-" {...field} data-testid="input-accessories-other" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <SectionHeader title="Rate" />

              <FormField control={form.control} name="rateType" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-3">
                    <RadioOption
                      label="Including Acc."
                      value="including_acc"
                      checked={field.value === "including_acc"}
                      onChange={field.onChange}
                      name="rate-type"
                    />
                    <RadioOption
                      label="Extra"
                      value="extra"
                      checked={field.value === "extra"}
                      onChange={field.onChange}
                      name="rate-type"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="rate" render={({ field }) => (
                <FormItem>
                  <FormLabel><RequiredLabel>Rate</RequiredLabel></FormLabel>
                  <FormControl>
                    <div className="rounded-lg bg-muted/30 border px-4 py-3">
                      <Input
                        placeholder="e.g. 122/- PER KGS"
                        className="border-0 bg-transparent text-center font-medium shadow-none focus-visible:ring-0 p-0"
                        {...field}
                        data-testid="input-rate"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <SectionHeader title="Remarks" />

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel><RequiredLabel optional>Remarks</RequiredLabel></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional remarks..."
                      className="min-h-[80px] resize-y"
                      {...field}
                      data-testid="input-remarks"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/orders")}
              data-testid="button-cancel"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || woAllocating || !workOrderNumber}
              className="min-w-[200px]"
              data-testid="button-submit-order"
            >
              <Check className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Generate Work Order"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

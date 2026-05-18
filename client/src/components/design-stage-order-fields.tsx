"use client";

import * as React from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DESIGN_ACCESSORIES } from "@/lib/design-stage-form";
import type { StageCompletionData } from "@/components/stage-detail-modal";

export type DesignOrderFieldValues = Pick<
  StageCompletionData,
  | "partyName"
  | "designerName"
  | "panelType"
  | "poNo"
  | "quantity"
  | "description"
  | "parts"
  | "customerWoNo"
  | "powderCoatingType"
  | "colorBody"
  | "colorMountingPlate"
  | "colorBaseStand"
  | "rateType"
  | "rate"
  | "orderRemarks"
  | "pointLock"
  | "threePointLock"
  | "puGasketing"
  | "pattiGasketing"
  | "accessoriesOther"
>;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {required ? <span className="text-destructive ml-0.5">*</span> : null}
    </Label>
  );
}

function ReadOnlyField({
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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-semibold text-foreground">{value ?? "—"}</div>
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
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") onChange(value);
      }}
      className={cn(
        "flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors select-none outline-none",
        checked
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-accent",
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          checked ? "border-emerald-500" : "border-muted-foreground/40",
        )}
      >
        {checked ? <div className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
      </div>
      {label}
    </div>
  );
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") onChange(!checked);
      }}
      className={cn(
        "flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors select-none outline-none",
        checked
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-accent",
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40",
        )}
      >
        {checked ? <Check className="h-3 w-3 text-white" /> : null}
      </div>
      {label}
    </div>
  );
}

function powderCoatingLabel(v?: string) {
  return v === "double_coat" ? "Double Coat" : v === "single_coat" ? "Single Coat" : v ?? "—";
}

function rateTypeLabel(v?: string) {
  return v === "including_acc" ? "Including Acc." : v === "extra" ? "Extra" : v ?? "—";
}

interface DesignStageOrderFieldsProps {
  readOnly: boolean;
  values: DesignOrderFieldValues;
  onChange: (patch: Partial<DesignOrderFieldValues>) => void;
  fieldErrors?: Record<string, string>;
  workOrderNo: string;
  orderDate?: string;
}

export function DesignStageOrderFields({
  readOnly,
  values,
  onChange,
  fieldErrors = {},
  workOrderNo,
  orderDate,
}: DesignStageOrderFieldsProps) {
  const dateLabel =
    orderDate != null && orderDate !== ""
      ? new Date(orderDate).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "—";

  if (readOnly) {
    const accessoryItems = [
      { label: "Point Lock", checked: !!values.pointLock },
      { label: "3 Point Lock", checked: !!values.threePointLock },
      { label: "PU Gasketing", checked: !!values.puGasketing },
      { label: "Patti Gasketing", checked: !!values.pattiGasketing },
    ];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
          <ReadOnlyField label="WO. No." value={workOrderNo} />
          <ReadOnlyField label="Date" value={dateLabel} />
          <ReadOnlyField label="Party Name" value={values.partyName} />
          <ReadOnlyField label="Designer Name" value={values.designerName} />
          <ReadOnlyField label="Panel Type" value={values.panelType} />
          <ReadOnlyField label="P.O. No." value={values.poNo || "—"} />
          <ReadOnlyField label="Quantity" value={values.quantity} />
          <ReadOnlyField label="Description (Size)" value={values.description} className="col-span-2" />
          <ReadOnlyField label="Parts (Bhag)" value={values.parts} />
          <ReadOnlyField label="Customer WO No." value={values.customerWoNo} />
          <ReadOnlyField label="Powder Coating Type" value={powderCoatingLabel(values.powderCoatingType)} />
          <ReadOnlyField label="Body Color" value={values.colorBody} />
          <ReadOnlyField label="Mounting Plate Color" value={values.colorMountingPlate} />
          <ReadOnlyField label="Base/Stand Color" value={values.colorBaseStand} />
          <ReadOnlyField label="Rate Type" value={rateTypeLabel(values.rateType)} />
          <ReadOnlyField label="Rate" value={values.rate} />
          <ReadOnlyField label="Order Remarks" value={values.orderRemarks || "—"} className="col-span-2" />
        </div>
        <div className="pt-2 border-t border-border/50 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Accessories</p>
          <div className="grid grid-cols-2 gap-2">
            {accessoryItems.map(({ label, checked }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                    checked ? "border-primary bg-primary" : "border-muted-foreground/50",
                  )}
                >
                  {checked ? <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" /> : null}
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Any Other: </span>
            <span className="text-foreground">{values.accessoriesOther?.trim() || "—"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel>WO. No.</FieldLabel>
          <Input value={workOrderNo} disabled readOnly className="h-9 text-sm bg-muted" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Date</FieldLabel>
          <Input value={dateLabel} disabled readOnly className="h-9 text-sm bg-muted" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Party Name</FieldLabel>
          <Input
            className="h-9 text-sm"
            value={values.partyName ?? ""}
            onChange={(e) => onChange({ partyName: e.target.value })}
          />
          {fieldErrors.partyName ? (
            <p className="text-xs text-destructive">{fieldErrors.partyName}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Designer Name</FieldLabel>
          <Input
            className="h-9 text-sm"
            value={values.designerName ?? ""}
            onChange={(e) => onChange({ designerName: e.target.value })}
          />
          {fieldErrors.designerName ? (
            <p className="text-xs text-destructive">{fieldErrors.designerName}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Panel Type</FieldLabel>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. HT Panel"
            value={values.panelType ?? ""}
            onChange={(e) => onChange({ panelType: e.target.value })}
          />
          {fieldErrors.panelType ? (
            <p className="text-xs text-destructive">{fieldErrors.panelType}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel>P.O. No.</FieldLabel>
          <Input
            className="h-9 text-sm"
            placeholder="-"
            value={values.poNo ?? ""}
            onChange={(e) => onChange({ poNo: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Qty</FieldLabel>
          <Input
            type="number"
            min={1}
            className="h-9 text-sm"
            value={values.quantity ?? ""}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          />
          {fieldErrors.quantity ? (
            <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
          ) : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel required>Description (Size)</FieldLabel>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. 3000x2000x550"
            value={values.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          {fieldErrors.description ? (
            <p className="text-xs text-destructive">{fieldErrors.description}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Parts (Bhag)</FieldLabel>
          <Input
            type="number"
            min={0}
            className="h-9 text-sm"
            value={values.parts != null ? String(values.parts) : ""}
            onChange={(e) => onChange({ parts: e.target.value })}
          />
          {fieldErrors.parts ? <p className="text-xs text-destructive">{fieldErrors.parts}</p> : null}
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Customer WO No / Panel Name</FieldLabel>
          <Input
            className="h-9 text-sm"
            value={values.customerWoNo ?? ""}
            onChange={(e) => onChange({ customerWoNo: e.target.value })}
          />
          {fieldErrors.customerWoNo ? (
            <p className="text-xs text-destructive">{fieldErrors.customerWoNo}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-primary/30 pb-1">
          Powder Coating Type
        </p>
        <div className="grid grid-cols-2 gap-3">
          <RadioOption
            label="Single Coat"
            value="single_coat"
            checked={values.powderCoatingType === "single_coat"}
            onChange={(v) => onChange({ powderCoatingType: v })}
            name="design-coating"
          />
          <RadioOption
            label="Double Coat"
            value="double_coat"
            checked={values.powderCoatingType === "double_coat"}
            onChange={(v) => onChange({ powderCoatingType: v })}
            name="design-coating"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-primary/30 pb-1">
          Color Code of Panel
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <FieldLabel required>Body</FieldLabel>
            <Input
              className="h-9 text-sm"
              value={values.colorBody ?? ""}
              onChange={(e) => onChange({ colorBody: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Mounting Plate</FieldLabel>
            <Input
              className="h-9 text-sm"
              value={values.colorMountingPlate ?? ""}
              onChange={(e) => onChange({ colorMountingPlate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Base/Stand</FieldLabel>
            <Input
              className="h-9 text-sm"
              value={values.colorBaseStand ?? ""}
              onChange={(e) => onChange({ colorBaseStand: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-primary/30 pb-1">
          Accessories
        </p>
        <div className="grid grid-cols-2 gap-3">
          {DESIGN_ACCESSORIES.map((acc) => {
            const keyMap = {
              point_lock: "pointLock",
              "3_point_lock": "threePointLock",
              pu_gasketing: "puGasketing",
              patti_gasketing: "pattiGasketing",
            } as const;
            const stateKey = keyMap[acc.value];
            const checked = !!values[stateKey];
            return (
              <CheckboxOption
                key={acc.value}
                label={acc.label}
                checked={checked}
                onChange={(c) => onChange({ [stateKey]: c })}
              />
            );
          })}
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Any Other</FieldLabel>
          <Input
            className="h-9 text-sm"
            placeholder="-"
            value={values.accessoriesOther ?? ""}
            onChange={(e) => onChange({ accessoriesOther: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-primary/30 pb-1">
          Rate
        </p>
        <div className="grid grid-cols-2 gap-3">
          <RadioOption
            label="Including Acc."
            value="including_acc"
            checked={values.rateType === "including_acc"}
            onChange={(v) => onChange({ rateType: v })}
            name="design-rate"
          />
          <RadioOption
            label="Extra"
            value="extra"
            checked={values.rateType === "extra"}
            onChange={(v) => onChange({ rateType: v })}
            name="design-rate"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Rate</FieldLabel>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. 122/- PER KGS"
            value={values.rate ?? ""}
            onChange={(e) => onChange({ rate: e.target.value })}
          />
          {fieldErrors.rate ? <p className="text-xs text-destructive">{fieldErrors.rate}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Order Remarks</FieldLabel>
        <Textarea
          placeholder="Remarks from order details..."
          value={values.orderRemarks ?? ""}
          onChange={(e) => onChange({ orderRemarks: e.target.value })}
          className="min-h-[72px] resize-none text-sm"
        />
      </div>
    </div>
  );
}

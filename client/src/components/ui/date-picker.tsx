"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Value is YYYY-MM-DD string; empty string means no date. */
export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Trigger class name (e.g. h-9 text-sm to match form inputs). */
  triggerClassName?: string;
}

function toDate(s: string): Date | undefined {
  if (!s || !s.trim()) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toYYYYMMDD(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
  disabled,
  triggerClassName,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = toDate(value);

  const handleSelect = React.useCallback(
    (d: Date | undefined) => {
      if (d) {
        onChange(toYYYYMMDD(d));
        setOpen(false);
      }
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className={cn(
            "justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            triggerClassName ?? "h-9 w-full"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-auto p-0 z-[10002] bg-white", className)}
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}

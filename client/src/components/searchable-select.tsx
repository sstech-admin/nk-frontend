import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, Plus } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Use 'id' when value is option.id (e.g. user _id); default 'label' */
  valueBy?: "id" | "label";
  onAddNew?: () => void;
  addNewLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  testIdPrefix?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  valueBy = "label",
  onAddNew,
  addNewLabel = "Add New",
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  noResultsText = "No results found",
  testIdPrefix = "searchable",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => (valueBy === "id" ? o.id === value : o.label === value));

  const filtered = options.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-white dark:bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[42px]"
        data-testid={`button-${testIdPrefix}-select`}
      >
        {selected ? (
          <div className="text-left">
            <span className="font-medium" data-testid={`text-selected-${testIdPrefix}`}>{selected.label}</span>
            {selected.sublabel && (
              <span className="block text-xs text-muted-foreground">{selected.sublabel}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-popover shadow-lg overflow-hidden" data-testid={`dropdown-${testIdPrefix}-list`}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-background pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                data-testid={`input-${testIdPrefix}-search`}
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {noResultsText}
              </div>
            ) : (
              filtered.map((option) => {
                const isSelected = valueBy === "id" ? option.id === value : option.label === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(valueBy === "id" ? option.id : option.label);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-800 ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500"
                        : "bg-white dark:bg-popover hover:bg-gray-50 dark:hover:bg-accent"
                    }`}
                    data-testid={`option-${testIdPrefix}-${option.id}`}
                  >
                    <div>
                      <span className={`font-semibold ${isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="block text-xs text-muted-foreground mt-0.5">{option.sublabel}</span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {onAddNew && (
            <div className="border-t p-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  onAddNew();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                data-testid={`button-add-new-${testIdPrefix}`}
              >
                <Plus className="h-4 w-4" />
                {addNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

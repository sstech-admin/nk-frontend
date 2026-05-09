import { cn } from "@/lib/utils";

interface FilterBadge {
  label: string;
  value: string;
  count?: number;
}

interface FilterBadgesProps {
  filters: FilterBadge[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
}

export function FilterBadges({ filters, activeFilter, onFilterChange }: FilterBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="filter-badges">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;
        return (
          <button
            key={filter.value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none border",
              isActive
                ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-600"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            )}
            onClick={() => onFilterChange(filter.value)}
            data-testid={`badge-filter-${filter.value}`}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className={cn("ml-0.5", isActive ? "opacity-80" : "opacity-60")}>
                ({filter.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface ListPaginationProps {
  /** Current page (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items across all pages */
  total: number;
  /** Number of items per page */
  pageSize: number;
  /** Called when page changes (1-based page number) */
  onPageChange: (page: number) => void;
  /** Optional label for summary, e.g. "orders" → "Showing 1–10 of 50 orders" */
  itemLabel?: string;
  /** Optional class for the wrapper */
  className?: string;
  /** Optional data-testid prefix for the controls */
  testIdPrefix?: string;
}

/**
 * Reusable pagination for list pages (orders, teams, members, parties).
 * Use with 1-based page numbers. Shows "Showing X–Y of Z [itemLabel]" and First/Prev/Next/Last.
 */
export function ListPagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
  itemLabel = "items",
  className = "",
  testIdPrefix = "list",
}: ListPaginationProps) {
  if (total === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const summary =
    total === 0
      ? `Showing 0 of 0 ${itemLabel}`
      : `Showing ${start}–${end} of ${total} ${itemLabel}`;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap ${className}`}>
      <p className="text-sm text-muted-foreground" data-testid={`${testIdPrefix}-pagination-summary`}>
        {summary}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPageChange(1)}
              disabled={currentPage <= 1}
              aria-label="First page"
              data-testid={`${testIdPrefix}-pagination-first`}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              data-testid={`${testIdPrefix}-pagination-prev`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 py-2 text-sm text-muted-foreground" data-testid={`${testIdPrefix}-pagination-page`}>
              Page {currentPage} of {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              data-testid={`${testIdPrefix}-pagination-next`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages}
              aria-label="Last page"
              data-testid={`${testIdPrefix}-pagination-last`}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

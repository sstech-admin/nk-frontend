import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBadges } from "@/components/filter-badges";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Phone, Mail, MapPin, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getPartiesQueryPath, getPartyByIdPath, USE_REAL_API } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";

/** Backend API party shape */
export interface ApiParty {
  _id: string;
  partyName: string;
  gstNumber?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiPartiesResponse {
  parties: ApiParty[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const partyFormSchema = z.object({
  partyName: z.string().min(1, "Party name is required"),
  gstNumber: z.string().optional(),
  contactNumber: z.string().min(1, "Contact number is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  address: z.string().optional(),
});

type PartyForm = z.infer<typeof partyFormSchema>;

function PartyCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

function PartyCard({
  party,
  onEdit,
  onDelete,
}: {
  party: ApiParty;
  onEdit: (party: ApiParty) => void;
  onDelete: (party: ApiParty) => void;
}) {
  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-party-${party._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-party-name-${party._id}`}>
              {party.partyName}
            </h3>
            {party.contactNumber && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{party.contactNumber}</span>
              </div>
            )}
            {party.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{party.email}</span>
              </div>
            )}
            {party.gstNumber && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{party.gstNumber}</span>
              </div>
            )}
            {party.address && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate line-clamp-2">{party.address}</span>
              </div>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              data-testid={`button-actions-${party._id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem onClick={() => onEdit(party)}>
              <Pencil className="mr-2 h-3 w-3" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(party)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            party.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${party.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          {party.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

export default function PartiesPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<ApiParty | null>(null);
  const [deleteConfirmParty, setDeleteConfirmParty] = useState<ApiParty | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const PARTIES_PAGE_SIZE = 10;

  useEffect(() => setPage(1), [activeFilter]);

  const { data: partiesData, isLoading } = useQuery<ApiPartiesResponse>({
    queryKey: ["parties-list", page, PARTIES_PAGE_SIZE, activeFilter],
    queryFn: async () => {
      const isActive = activeFilter === "all" ? undefined : activeFilter === "active";
      const path = USE_REAL_API
        ? getPartiesQueryPath({ page, limit: PARTIES_PAGE_SIZE, isActive })
        : "/api/parties";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch parties");
        return json.data as ApiPartiesResponse;
      }
      const raw = Array.isArray(json) ? json : json?.parties ?? json?.data?.parties ?? [];
      const all: ApiParty[] = raw.map((p: { id?: string; _id?: string; name?: string; partyName?: string; gstNo?: string; gstNumber?: string; contact?: string; contactNumber?: string; email?: string; address?: string; status?: string }) => ({
        _id: p._id ?? p.id ?? "",
        partyName: p.partyName ?? p.name ?? "",
        gstNumber: p.gstNumber ?? p.gstNo ?? null,
        contactNumber: p.contactNumber ?? p.contact ?? null,
        email: p.email ?? null,
        address: p.address ?? null,
        isActive: (p as { isActive?: boolean }).isActive ?? (p.status === "active"),
      }));
      const filtered =
        activeFilter === "all"
          ? all
          : activeFilter === "active"
            ? all.filter((p) => p.isActive)
            : all.filter((p) => !p.isActive);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / PARTIES_PAGE_SIZE));
      const start = (page - 1) * PARTIES_PAGE_SIZE;
      const parties = filtered.slice(start, start + PARTIES_PAGE_SIZE);
      return { parties, total, page, totalPages, limit: PARTIES_PAGE_SIZE };
    },
  });

  const parties = partiesData?.parties ?? [];

  const createMutation = useMutation({
    mutationFn: (data: PartyForm) =>
      apiRequest("POST", "/api/parties", {
        partyName: data.partyName,
        gstNumber: data.gstNumber || undefined,
        contactNumber: data.contactNumber,
        email: data.email || undefined,
        address: data.address || undefined,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Create failed");
      queryClient.invalidateQueries({ queryKey: ["parties-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      toast({ title: "Party created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ partyId, data }: { partyId: string; data: PartyForm }) =>
      apiRequest("PUT", getPartyByIdPath(partyId), {
        partyName: data.partyName,
        gstNumber: data.gstNumber || undefined,
        contactNumber: data.contactNumber,
        email: data.email || undefined,
        address: data.address || undefined,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["parties-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      setDialogOpen(false);
      setEditingParty(null);
      form.reset(defaultFormValues);
      toast({ title: "Party updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (partyId: string) => apiRequest("DELETE", getPartyByIdPath(partyId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      setDeleteConfirmParty(null);
      toast({ title: "Party deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const defaultFormValues: PartyForm = {
    partyName: "",
    gstNumber: "",
    contactNumber: "",
    email: "",
    address: "",
  };
  const form = useForm<PartyForm>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditingParty(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEdit = (party: ApiParty) => {
    setEditingParty(party);
    form.reset({
      partyName: party.partyName,
      gstNumber: party.gstNumber ?? "",
      contactNumber: party.contactNumber ?? "",
      email: party.email ?? "",
      address: party.address ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (d: PartyForm) => {
    if (editingParty) {
      updateMutation.mutate({ partyId: editingParty._id, data: d });
    } else {
      createMutation.mutate(d);
    }
  };

  const statusCounts = {
    all: parties.length,
    active: parties.filter((p) => p.isActive).length,
    inactive: parties.filter((p) => !p.isActive).length,
  };

  const filterBadges = [
    { label: "All", value: "all", count: statusCounts.all },
    { label: "Active", value: "active", count: statusCounts.active },
    { label: "Inactive", value: "inactive", count: statusCounts.inactive },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-parties-title">
            Party Details
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage customers, suppliers, and vendors</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingParty(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-party" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Party
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingParty ? "Edit Party" : "Add New Party"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="partyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Party Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Company or party name" {...field} data-testid="input-party-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gstNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GST1234567890" {...field} data-testid="input-party-gst" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} data-testid="input-party-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-party-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Full address" {...field} data-testid="input-party-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-party"
                >
                  {editingParty ? (updateMutation.isPending ? "Updating..." : "Update Party") : (createMutation.isPending ? "Adding..." : "Add Party")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBadges filters={filterBadges} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PartyCardSkeleton key={i} />
          ))}
        </div>
      ) : parties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No parties found</h3>
          <p className="text-sm text-muted-foreground mt-1">Add your first party to get started</p>
          <Button className="mt-4" onClick={openCreate} data-testid="button-add-party-empty">
            <Plus className="mr-2 h-4 w-4" /> Add Party
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-parties">
          {parties.map((party) => (
            <PartyCard key={party._id} party={party} onEdit={openEdit} onDelete={setDeleteConfirmParty} />
          ))}
        </div>
      )}

      {!isLoading && parties.length > 0 && (
        <ListPagination
          currentPage={page}
          totalPages={partiesData?.totalPages ?? 1}
          total={partiesData?.total ?? parties.length}
          pageSize={PARTIES_PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="parties"
          testIdPrefix="parties"
        />
      )}

      <AlertDialog open={!!deleteConfirmParty} onOpenChange={(open) => !open && setDeleteConfirmParty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete party</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this party? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmParty && deleteMutation.mutate(deleteConfirmParty._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

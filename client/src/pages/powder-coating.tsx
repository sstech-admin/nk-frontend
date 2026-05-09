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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBadges } from "@/components/filter-badges";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Phone, Mail, MapPin, User, Palette } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  getPowderCoatingsQueryPath,
  getPowderCoatingByIdPath,
  updatePowderCoatingStatusPath,
  USE_REAL_API,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";

export interface ApiPowderCoating {
  _id: string;
  partyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiPowderCoatingsResponse {
  powderCoatings: ApiPowderCoating[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const powderCoatingFormSchema = z.object({
  partyName: z.string().min(1, "Party name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  address: z.string().optional(),
  type: z.enum(["INHOUSE", "THIRD_PARTY"]),
});

type PowderCoatingForm = z.infer<typeof powderCoatingFormSchema>;

function PowderCoatingCardSkeleton() {
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

function PowderCoatingCard({
  coating,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  coating: ApiPowderCoating;
  onEdit: (c: ApiPowderCoating) => void;
  onDelete: (c: ApiPowderCoating) => void;
  onToggleStatus: (c: ApiPowderCoating) => void;
}) {
  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-powder-coating-${coating._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
            <Palette className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-pc-name-${coating._id}`}>
              {coating.partyName}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{coating.contactPerson}</span>
            </div>
            {coating.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{coating.phone}</span>
              </div>
            )}
            {coating.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{coating.email}</span>
              </div>
            )}
            {coating.address && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate line-clamp-2">{coating.address}</span>
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
              data-testid={`button-actions-${coating._id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem onClick={() => onEdit(coating)}>
              <Pencil className="mr-2 h-3 w-3" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleStatus(coating)}>
              {coating.isActive ? "Mark Inactive" : "Mark Active"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(coating)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            coating.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${coating.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          {coating.isActive ? "Active" : "Inactive"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {coating.type === "INHOUSE" ? "In-house" : "Third party"}
        </span>
      </div>
    </div>
  );
}

export default function PowderCoatingPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoating, setEditingCoating] = useState<ApiPowderCoating | null>(null);
  const [deleteConfirmCoating, setDeleteConfirmCoating] = useState<ApiPowderCoating | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const PAGE_SIZE = 10;

  useEffect(() => setPage(1), [activeFilter, search]);

  const isActiveParam = activeFilter === "all" ? undefined : activeFilter === "active";

  const { data: listData, isLoading } = useQuery<ApiPowderCoatingsResponse>({
    queryKey: ["powder-coatings-list", page, PAGE_SIZE, activeFilter, search],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getPowderCoatingsQueryPath({ page, limit: PAGE_SIZE, search: search || undefined, isActive: isActiveParam })
        : `/api/powder-coatings?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}${activeFilter === "all" ? "" : `&isActive=${activeFilter === "active"}`}`;
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch powder coatings");
        return json.data as ApiPowderCoatingsResponse;
      }
      const data = json?.data ?? json;
      return {
        powderCoatings: data.powderCoatings ?? [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        totalPages: data.totalPages ?? 1,
        limit: data.limit ?? PAGE_SIZE,
      };
    },
  });

  const powderCoatings = listData?.powderCoatings ?? [];

  const createMutation = useMutation({
    mutationFn: (data: PowderCoatingForm) =>
      apiRequest("POST", "/api/powder-coatings", {
        partyName: data.partyName,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
        type: data.type,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Create failed");
      queryClient.invalidateQueries({ queryKey: ["powder-coatings-list"] });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      toast({ title: "Powder coating created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PowderCoatingForm }) =>
      apiRequest("PUT", getPowderCoatingByIdPath(id), {
        partyName: data.partyName,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
        type: data.type,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["powder-coatings-list"] });
      setDialogOpen(false);
      setEditingCoating(null);
      form.reset(defaultFormValues);
      toast({ title: "Powder coating updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", getPowderCoatingByIdPath(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["powder-coatings-list"] });
      setDeleteConfirmCoating(null);
      toast({ title: "Powder coating deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", updatePowderCoatingStatusPath(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["powder-coatings-list"] });
      toast({ title: "Powder coating status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const defaultFormValues: PowderCoatingForm = {
    partyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    type: "INHOUSE",
  };

  const form = useForm<PowderCoatingForm>({
    resolver: zodResolver(powderCoatingFormSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditingCoating(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEdit = (coating: ApiPowderCoating) => {
    setEditingCoating(coating);
    form.reset({
      partyName: coating.partyName,
      contactPerson: coating.contactPerson,
      phone: coating.phone,
      email: coating.email ?? "",
      address: coating.address ?? "",
      type: (coating.type === "THIRD_PARTY" ? "THIRD_PARTY" : "INHOUSE") as "INHOUSE" | "THIRD_PARTY",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (d: PowderCoatingForm) => {
    if (editingCoating) {
      updateMutation.mutate({ id: editingCoating._id, data: d });
    } else {
      createMutation.mutate(d);
    }
  };

  const statusCounts = {
    all: listData?.total ?? powderCoatings.length,
    active: powderCoatings.filter((p) => p.isActive).length,
    inactive: powderCoatings.filter((p) => !p.isActive).length,
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
          <h1 className="text-2xl font-bold" data-testid="text-coating-title">
            Powder Coating
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage powder coating plants (in-house and third party)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingCoating(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-coating" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Powder Coating
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCoating ? "Edit Powder Coating" : "Add Powder Coating"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="partyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Party / Plant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 3rd Party Plant 1" {...field} data-testid="input-party-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Manager Name" {...field} data-testid="input-contact-person" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="9999997799" {...field} data-testid="input-phone" />
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
                        <Input type="email" placeholder="plant@example.com" {...field} data-testid="input-email" />
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
                        <Textarea placeholder="Plant address" {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INHOUSE">In-house</SelectItem>
                          <SelectItem value="THIRD_PARTY">Third party</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-coating"
                >
                  {editingCoating
                    ? (updateMutation.isPending ? "Updating..." : "Update Powder Coating")
                    : (createMutation.isPending ? "Creating..." : "Create Powder Coating")}
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
            <PowderCoatingCardSkeleton key={i} />
          ))}
        </div>
      ) : powderCoatings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Palette className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No powder coatings found</h3>
          <p className="text-sm text-muted-foreground mt-1">Add your first powder coating plant to get started</p>
          <Button className="mt-4" onClick={openCreate} data-testid="button-add-coating-empty">
            <Plus className="mr-2 h-4 w-4" /> Add Powder Coating
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-powder-coatings">
          {powderCoatings.map((coating) => (
            <PowderCoatingCard
              key={coating._id}
              coating={coating}
              onEdit={openEdit}
              onDelete={setDeleteConfirmCoating}
              onToggleStatus={(c) => statusMutation.mutate(c._id)}
            />
          ))}
        </div>
      )}

      {!isLoading && (listData?.total ?? 0) > 0 && (
        <ListPagination
          currentPage={listData?.page ?? page}
          totalPages={listData?.totalPages ?? 1}
          total={listData?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="powder coatings"
          testIdPrefix="powder-coatings"
        />
      )}

      <AlertDialog open={!!deleteConfirmCoating} onOpenChange={(open) => !open && setDeleteConfirmCoating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete powder coating</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Powder Coating? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmCoating && deleteMutation.mutate(deleteConfirmCoating._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

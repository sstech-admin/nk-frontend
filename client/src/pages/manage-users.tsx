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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MoreHorizontal, Pencil, Trash2, UserCog, Mail, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getUsersQueryPath, getUserByIdPath, USE_REAL_API } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";

/** Fabrication and Powder Coating are merged; only Fabrication is assignable in allowed stages. */
export const ALLOWED_STAGES = [
  "DESIGN_PREPARATION",
  "SHEET_PROCESSING",
  "FABRICATION",
  "DISPATCH_VALIDATION",
] as const;

const STAGE_LABELS: Record<string, string> = {
  DESIGN_PREPARATION: "Design Preparation",
  SHEET_PROCESSING: "Sheet Processing",
  FABRICATION: "Fabrication",
  DISPATCH_VALIDATION: "Dispatch Validation",
};

export interface ApiManagerUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  allowedStages: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiUsersResponse {
  users: ApiManagerUser[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const managerUserFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]),
  allowedStages: z.array(z.string()),
});

type ManagerUserForm = z.infer<typeof managerUserFormSchema>;

function ManagerUserCardSkeleton() {
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

function ManagerUserCard({
  user,
  onEdit,
  onDelete,
}: {
  user: ApiManagerUser;
  onEdit: (u: ApiManagerUser) => void;
  onDelete: (u: ApiManagerUser) => void;
}) {
  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-manager-user-${user._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
            <UserCog className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-user-name-${user._id}`}>
              {user.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Shield className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.role}</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              data-testid={`button-actions-${user._id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Pencil className="mr-2 h-3 w-3" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(user)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 space-y-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          {user.isActive ? "Active" : "Inactive"}
        </span>
        {(user.allowedStages?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Allowed stages</p>
            <div className="flex flex-wrap gap-2">
              {user.allowedStages?.slice(0, 3).map((stage) => (
                <span
                  key={stage}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
                >
                  {STAGE_LABELS[stage] ?? stage}
                </span>
              ))}
              {user.allowedStages && user.allowedStages.length > 3 && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                  +{user.allowedStages.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManageUsersPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiManagerUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ApiManagerUser | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const PAGE_SIZE = 10;

  useEffect(() => setPage(1), [activeFilter]);

  const isActiveParam = activeFilter === "all" ? undefined : activeFilter === "active";

  const { data: listData, isLoading } = useQuery<ApiUsersResponse>({
    queryKey: ["manage-users-list", page, PAGE_SIZE, activeFilter],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getUsersQueryPath({ page, limit: PAGE_SIZE, isActive: isActiveParam, role: "EMPLOYEE" })
        : `/api/users?page=${page}&limit=${PAGE_SIZE}&role=EMPLOYEE${activeFilter === "all" ? "" : `&isActive=${activeFilter === "active"}`}`;
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch users");
        return json.data as ApiUsersResponse;
      }
      const data = json?.data ?? json;
      return {
        users: data.users ?? [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        totalPages: data.totalPages ?? 1,
        limit: data.limit ?? PAGE_SIZE,
      };
    },
  });

  const users = listData?.users ?? [];

  const createMutation = useMutation({
    mutationFn: (data: ManagerUserForm) =>
      apiRequest("POST", "/api/users", {
        name: data.name,
        email: data.email,
        password: data.password || undefined,
        role: data.role,
        allowedStages: data.allowedStages,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Create failed");
      queryClient.invalidateQueries({ queryKey: ["manage-users-list"] });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      toast({ title: "User created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, isActive }: { id: string; data: ManagerUserForm; isActive: boolean }) =>
      apiRequest("PUT", getUserByIdPath(id), {
        name: data.name,
        email: data.email,
        role: data.role,
        allowedStages: data.allowedStages,
        isActive,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["manage-users-list"] });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset(defaultFormValues);
      toast({ title: "User updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", getUserByIdPath(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage-users-list"] });
      setDeleteConfirmUser(null);
      toast({ title: "User deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const defaultFormValues: ManagerUserForm = {
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
    allowedStages: [],
  };

  const form = useForm<ManagerUserForm>({
    resolver: zodResolver(managerUserFormSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditingUser(null);
    form.reset({ ...defaultFormValues, password: "" });
    setDialogOpen(true);
  };

  const openEdit = (user: ApiManagerUser) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      password: "",
      role: (user.role === "ADMIN" ? "ADMIN" : "EMPLOYEE") as "EMPLOYEE" | "ADMIN",
      allowedStages: user.allowedStages ?? [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = (d: ManagerUserForm) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser._id, data: d, isActive: editingUser.isActive });
    } else {
      if (!d.password?.trim()) {
        toast({ title: "Password is required for new users", variant: "destructive" });
        return;
      }
      createMutation.mutate(d);
    }
  };

  const statusCounts = {
    all: listData?.total ?? users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
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
          <h1 className="text-2xl font-bold" data-testid="text-manage-users-title">
            Manage Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage employee users and their allowed stages</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingUser(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Designer 1" {...field} data-testid="input-user-name" />
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
                        <Input type="email" placeholder="designer1@gmail.com" {...field} data-testid="input-user-email" disabled={!!editingUser} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!editingUser && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} data-testid="input-user-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allowedStages"
                  render={() => (
                    <FormItem>
                      <FormLabel>Allowed stages</FormLabel>
                      <div className="grid gap-2 rounded-md border p-4">
                        {ALLOWED_STAGES.map((stage) => (
                          <FormField
                            key={stage}
                            control={form.control}
                            name="allowedStages"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(stage)}
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...(field.value || []), stage]
                                        : (field.value || []).filter((s) => s !== stage);
                                      field.onChange(next);
                                    }}
                                    data-testid={`checkbox-stage-${stage}`}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer flex-1">
                                  {STAGE_LABELS[stage] ?? stage}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-user"
                >
                  {editingUser
                    ? (updateMutation.isPending ? "Updating..." : "Update User")
                    : (createMutation.isPending ? "Creating..." : "Create User")}
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
            <ManagerUserCardSkeleton key={i} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <UserCog className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No users found</h3>
          <p className="text-sm text-muted-foreground mt-1">Add your first user to get started</p>
          <Button className="mt-4" onClick={openCreate} data-testid="button-add-user-empty">
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-manage-users">
          {users.map((user) => (
            <ManagerUserCard key={user._id} user={user} onEdit={openEdit} onDelete={setDeleteConfirmUser} />
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
          itemLabel="users"
          testIdPrefix="manage-users"
        />
      )}

      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this manager user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

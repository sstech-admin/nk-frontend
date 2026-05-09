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
import { Plus, MoreHorizontal, Pencil, Trash2, User, Mail, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/searchable-select";
import {
  getMembersQueryPath,
  getMemberByIdPath,
  getTeamsQueryPath,
  USE_REAL_API,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import type { ApiTeam } from "./teams";

/** Backend API member shape */
export interface ApiMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  teamId?: { _id: string; teamName: string } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiMembersResponse {
  members: ApiMember[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface ApiTeamsResponse {
  teams: ApiTeam[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const ROLE_OPTIONS = [
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
  { value: "ADMIN", label: "Admin" },
  { value: "EMPLOYEE", label: "Employee" },
];

const memberFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Valid email is required"),
  role: z.string().min(1, "Role is required"),
  teamId: z.string().min(1, "Team is required"),
});

type MemberForm = z.infer<typeof memberFormSchema>;

function MemberCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: ApiMember;
  onEdit: (member: ApiMember) => void;
  onDelete: (member: ApiMember) => void;
}) {
  const teamName = member.teamId?.teamName ?? "—";

  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-member-${member._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
              {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-member-name-${member._id}`}>
              {member.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">{teamName}</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              data-testid={`button-actions-${member._id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem onClick={() => onEdit(member)}>
              <Pencil className="mr-2 h-3 w-3" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(member)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
          {ROLE_OPTIONS.find((r) => r.value === member.role)?.label ?? member.role}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            member.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          {member.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ApiMember | null>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<ApiMember | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const MEMBERS_PAGE_SIZE = 10;

  useEffect(() => setPage(1), [activeFilter]);

  const { data: membersData, isLoading } = useQuery<ApiMembersResponse>({
    queryKey: ["members-list", page, MEMBERS_PAGE_SIZE, activeFilter],
    queryFn: async () => {
      const isActive = activeFilter === "all" ? undefined : activeFilter === "active";
      const path = USE_REAL_API
        ? getMembersQueryPath({ page, limit: MEMBERS_PAGE_SIZE, isActive })
        : "/api/members";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch members");
        return json.data as ApiMembersResponse;
      }
      const raw = Array.isArray(json) ? json : json?.members ?? json?.data?.members ?? [];
      const all: ApiMember[] = raw.map((m: { id?: string; _id?: string; name?: string; email?: string; role?: string; team?: string; status?: string; teamId?: { _id: string; teamName: string } }) => ({
        _id: m._id ?? m.id ?? "",
        name: m.name ?? "",
        email: m.email ?? "",
        role: (m.role ?? "").toUpperCase(),
        teamId: m.teamId ?? (m.team ? { _id: m.team, teamName: m.team } : null),
        isActive: (m as { isActive?: boolean }).isActive ?? (m.status === "active"),
      }));
      const filtered =
        activeFilter === "all"
          ? all
          : activeFilter === "active"
            ? all.filter((m) => m.isActive)
            : all.filter((m) => !m.isActive);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE));
      const start = (page - 1) * MEMBERS_PAGE_SIZE;
      const members = filtered.slice(start, start + MEMBERS_PAGE_SIZE);
      return { members, total, page, totalPages, limit: MEMBERS_PAGE_SIZE };
    },
  });

  const { data: teamsData } = useQuery<ApiTeamsResponse>({
    queryKey: ["teams-list", 1, 200, true],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getTeamsQueryPath({ page: 1, limit: 200, isActive: true })
        : "/api/teams";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch teams");
        return json.data as ApiTeamsResponse;
      }
      const raw = Array.isArray(json) ? json : json?.teams ?? [];
      const teams: ApiTeam[] = raw.map((t: { id?: string; _id?: string; name?: string; teamName?: string; lead?: string }) => ({
        _id: t._id ?? t.id ?? "",
        teamName: t.teamName ?? t.name ?? "",
        teamLead: null,
        isActive: true,
      }));
      return { teams, total: teams.length, page: 1, totalPages: 1, limit: 200 };
    },
    enabled: dialogOpen,
  });

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];

  const createMutation = useMutation({
    mutationFn: (data: MemberForm) =>
      apiRequest("POST", "/api/members", {
        name: data.name,
        email: data.email,
        role: data.role,
        teamId: data.teamId,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Create failed");
      queryClient.invalidateQueries({ queryKey: ["members-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      toast({ title: "Member created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: MemberForm }) =>
      apiRequest("PUT", getMemberByIdPath(memberId), {
        name: data.name,
        email: data.email,
        role: data.role,
        teamId: data.teamId,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["members-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      setEditingMember(null);
      form.reset(defaultFormValues);
      toast({ title: "Member updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", getMemberByIdPath(memberId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteConfirmMember(null);
      toast({ title: "Member deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const defaultFormValues: MemberForm = { name: "", email: "", role: "EDITOR", teamId: "" };
  const form = useForm<MemberForm>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditingMember(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEdit = (member: ApiMember) => {
    setEditingMember(member);
    form.reset({
      name: member.name,
      email: member.email,
      role: member.role,
      teamId: member.teamId?._id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (d: MemberForm) => {
    if (editingMember) {
      updateMutation.mutate({ memberId: editingMember._id, data: d });
    } else {
      createMutation.mutate(d);
    }
  };

  const statusCounts = {
    all: members.length,
    active: members.filter((m) => m.isActive).length,
    inactive: members.filter((m) => !m.isActive).length,
  };

  const filterBadges = [
    { label: "All", value: "all", count: statusCounts.all },
    { label: "Active", value: "active", count: statusCounts.active },
    { label: "Inactive", value: "inactive", count: statusCounts.inactive },
  ];

  const teamOptions = teams.map((t) => ({
    id: t._id,
    label: t.teamName,
    sublabel: "",
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-members-title">
            Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members and roles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingMember(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-member" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
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
                        <Input placeholder="Full name" {...field} data-testid="input-member-name" />
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
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-member-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-member-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={teamOptions}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          valueBy="id"
                          placeholder="Select team"
                          searchPlaceholder="Search teams..."
                          noResultsText="No teams found"
                          testIdPrefix="member-team"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-member"
                >
                  {editingMember ? (updateMutation.isPending ? "Updating..." : "Update Member") : (createMutation.isPending ? "Adding..." : "Add Member")}
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
            <MemberCardSkeleton key={i} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No members found</h3>
          <p className="text-sm text-muted-foreground mt-1">Add your first member to get started</p>
          <Button className="mt-4" onClick={openCreate} data-testid="button-add-member-empty">
            <Plus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-members">
          {members.map((member) => (
            <MemberCard key={member._id} member={member} onEdit={openEdit} onDelete={setDeleteConfirmMember} />
          ))}
        </div>
      )}

      {!isLoading && members.length > 0 && (
        <ListPagination
          currentPage={page}
          totalPages={membersData?.totalPages ?? 1}
          total={membersData?.total ?? members.length}
          pageSize={MEMBERS_PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="members"
          testIdPrefix="members"
        />
      )}

      <AlertDialog open={!!deleteConfirmMember} onOpenChange={(open) => !open && setDeleteConfirmMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this member? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmMember && deleteMutation.mutate(deleteConfirmMember._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

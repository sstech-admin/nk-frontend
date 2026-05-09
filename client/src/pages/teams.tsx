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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBadges } from "@/components/filter-badges";
import { Plus, MoreHorizontal, Pencil, Trash2, Users, User, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/searchable-select";
import {
  getTeamsQueryPath,
  getTeamByIdPath,
  getUsersQueryPath,
  USE_REAL_API,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";

/** Backend API team shape */
export interface ApiTeam {
  _id: string;
  teamName: string;
  teamLead?: { _id: string; name: string; email: string } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiTeamsResponse {
  teams: ApiTeam[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

/** Backend API user shape (for dropdown) */
interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
}

interface ApiUsersResponse {
  users: ApiUser[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const teamFormSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  teamLead: z.string().optional(),
});

type TeamForm = z.infer<typeof teamFormSchema>;

function TeamCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

function TeamCard({
  team,
  onEdit,
  onDelete,
}: {
  team: ApiTeam;
  onEdit: (team: ApiTeam) => void;
  onDelete: (team: ApiTeam) => void;
}) {
  const leadName = team.teamLead?.name ?? "—";
  const leadEmail = team.teamLead?.email ?? "";

  return (
    <div
      className="group relative rounded-xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
      data-testid={`card-team-${team._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-team-name-${team._id}`}>
              {team.teamName}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <User className="h-3 w-3" />
              <span className="truncate">{leadName}</span>
            </div>
            {leadEmail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{leadEmail}</span>
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
              data-testid={`button-actions-${team._id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-white text-foreground border border-border">
            <DropdownMenuItem onClick={() => onEdit(team)}>
              <Pencil className="mr-2 h-3 w-3" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(team)}>
              <Trash2 className="mr-2 h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            team.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${team.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          {team.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<ApiTeam | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const TEAMS_PAGE_SIZE = 10;

  useEffect(() => setPage(1), [activeFilter]);

  const { data: teamsData, isLoading } = useQuery<ApiTeamsResponse>({
    queryKey: ["teams-list", page, TEAMS_PAGE_SIZE, activeFilter],
    queryFn: async () => {
      const isActive = activeFilter === "all" ? undefined : activeFilter === "active";
      const path = USE_REAL_API
        ? getTeamsQueryPath({ page, limit: TEAMS_PAGE_SIZE, isActive })
        : "/api/teams";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch teams");
        return json.data as ApiTeamsResponse;
      }
      const raw = Array.isArray(json) ? json : json?.teams ?? [];
      const all: ApiTeam[] = raw.map((t: { id?: string; _id?: string; name?: string; teamName?: string; lead?: string; status?: string }) => ({
        _id: t._id ?? t.id ?? "",
        teamName: t.teamName ?? t.name ?? "",
        teamLead: t.lead ? { _id: t.lead, name: t.lead, email: "" } : null,
        isActive: (t as { isActive?: boolean }).isActive ?? t.status === "active",
      }));
      const filtered =
        activeFilter === "all"
          ? all
          : activeFilter === "active"
            ? all.filter((t) => t.isActive)
            : all.filter((t) => !t.isActive);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / TEAMS_PAGE_SIZE));
      const start = (page - 1) * TEAMS_PAGE_SIZE;
      const teams = filtered.slice(start, start + TEAMS_PAGE_SIZE);
      return { teams, total, page, totalPages, limit: TEAMS_PAGE_SIZE };
    },
  });

  const { data: usersData } = useQuery<ApiUsersResponse>({
    queryKey: ["users-list", "EMPLOYEE"],
    queryFn: async () => {
      const path = USE_REAL_API
        ? getUsersQueryPath({ page: 1, limit: 200, role: "EMPLOYEE", isActive: true })
        : "/api/users";
      const res = await apiRequest("GET", path);
      const json = await res.json();
      if (USE_REAL_API) {
        if (!json?.success || !json?.data) throw new Error(json?.message || "Failed to fetch users");
        return json.data as ApiUsersResponse;
      }
      const raw = json?.users ?? [];
      return {
        users: raw.map((u: { _id?: string; id?: string; name?: string; email?: string }) => ({
          _id: u._id ?? u.id ?? "",
          name: u.name ?? "",
          email: u.email ?? "",
        })),
        total: raw.length,
        page: 1,
        totalPages: 1,
        limit: 200,
      };
    },
    enabled: dialogOpen,
  });

  const teams = teamsData?.teams ?? [];
  const users = usersData?.users ?? [];

  const createMutation = useMutation({
    mutationFn: (data: TeamForm) =>
      apiRequest("POST", "/api/teams", {
        teamName: data.teamName,
        teamLead: data.teamLead || undefined,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Create failed");
      queryClient.invalidateQueries({ queryKey: ["teams-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      toast({ title: "Team created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: TeamForm }) =>
      apiRequest("PUT", getTeamByIdPath(teamId), {
        teamName: data.teamName,
        teamLead: data.teamLead || undefined,
      }),
    onSuccess: async (res) => {
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["teams-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      setEditingTeam(null);
      form.reset(defaultFormValues);
      toast({ title: "Team updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => apiRequest("DELETE", getTeamByIdPath(teamId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteConfirmTeam(null);
      toast({ title: "Team deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const defaultFormValues: TeamForm = { teamName: "", teamLead: "" };
  const form = useForm<TeamForm>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditingTeam(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEdit = (team: ApiTeam) => {
    setEditingTeam(team);
    form.reset({
      teamName: team.teamName,
      teamLead: team.teamLead?._id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (d: TeamForm) => {
    if (editingTeam) {
      updateMutation.mutate({ teamId: editingTeam._id, data: d });
    } else {
      createMutation.mutate(d);
    }
  };

  const statusCounts = {
    all: teams.length,
    active: teams.filter((t) => t.isActive).length,
    inactive: teams.filter((t) => !t.isActive).length,
  };

  const filterBadges = [
    { label: "All", value: "all", count: statusCounts.all },
    { label: "Active", value: "active", count: statusCounts.active },
    { label: "Inactive", value: "inactive", count: statusCounts.inactive },
  ];

  const userOptions = users.map((u) => ({
    id: u._id,
    label: u.name,
    sublabel: u.email,
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-teams-title">
            Teams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage teams and team leads</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingTeam(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-team" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Edit Team" : "Add New Team"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="teamName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Designer Team" {...field} data-testid="input-team-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamLead"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Lead</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={userOptions}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          valueBy="id"
                          placeholder="Select team lead"
                          searchPlaceholder="Search by name or email..."
                          noResultsText="No employees found"
                          testIdPrefix="team-lead"
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
                  data-testid="button-submit-team"
                >
                  {editingTeam ? (updateMutation.isPending ? "Updating..." : "Update Team") : (createMutation.isPending ? "Creating..." : "Create Team")}
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
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No teams found</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first team to get started</p>
          <Button className="mt-4" onClick={openCreate} data-testid="button-add-team-empty">
            <Plus className="mr-2 h-4 w-4" /> Add Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-teams">
          {teams.map((team) => (
            <TeamCard key={team._id} team={team} onEdit={openEdit} onDelete={setDeleteConfirmTeam} />
          ))}
        </div>
      )}

      {!isLoading && teams.length > 0 && (
        <ListPagination
          currentPage={page}
          totalPages={teamsData?.totalPages ?? 1}
          total={teamsData?.total ?? teams.length}
          pageSize={TEAMS_PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="teams"
          testIdPrefix="teams"
        />
      )}

      <AlertDialog open={!!deleteConfirmTeam} onOpenChange={(open) => !open && setDeleteConfirmTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmTeam && deleteMutation.mutate(deleteConfirmTeam._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

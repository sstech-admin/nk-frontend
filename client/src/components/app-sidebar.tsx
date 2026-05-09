import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  UsersRound,
  Paintbrush,
  Building2,
  LogOut,
  Settings,
  HelpCircle,
  UserCog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const generalItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Members", url: "/members", icon: Users },
  { title: "Teams", url: "/teams", icon: UsersRound },
  { title: "Powder Coating", url: "/powder-coating", icon: Paintbrush },
  { title: "Party Details", url: "/parties", icon: Building2 },
];

const accountItems = [
  { title: "Settings", url: "#", icon: Settings },
  { title: "Help", url: "#", icon: HelpCircle },
  { title: "Manage Users", url: "/manage-users", icon: UserCog },
];

/** Paths allowed for non-admin (e.g. EMPLOYEE). */
const EMPLOYEE_ALLOWED_PATHS = ["/dashboard", "/orders", "/orders/create"];
const EMPLOYEE_ALLOWED_PREFIX = "/orders/"; // /orders/:id

function isPathAllowedForEmployee(path: string): boolean {
  if (EMPLOYEE_ALLOWED_PATHS.includes(path)) return true;
  if (path.startsWith(EMPLOYEE_ALLOWED_PREFIX) && path.length > EMPLOYEE_ALLOWED_PREFIX.length) return true;
  return false;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const role = user?.role ?? "";
  const isAdmin = role === "ADMIN";
  const visibleGeneralItems = isAdmin ? generalItems : generalItems.filter((item) => isPathAllowedForEmployee(item.url));
  const visibleAccountItems = isAdmin ? accountItems : accountItems.filter((item) => item.url !== "/manage-users");

  return (
    <Sidebar>
      <SidebarHeader className="p-5 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white shadow-sm">
            <img
              src="/nk-logo.png"
              alt="NK Tech Craft"
              className=""
            />
          </div>
          <span className="text-base font-bold text-white tracking-tight">NK Tech Craft</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium mb-1">General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleGeneralItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/dashboard" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium mb-1">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleAccountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-testid={`link-sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import OrdersPage from "@/pages/orders";
import MembersPage from "@/pages/members";
import TeamsPage from "@/pages/teams";
import PowderCoatingPage from "@/pages/powder-coating";
import PartiesPage from "@/pages/parties";
import ManageUsersPage from "@/pages/manage-users";
import CreateOrderPage from "@/pages/create-order";
import OrderDetailsPage from "@/pages/order-details";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

const EMPLOYEE_ALLOWED_PATHS = ["/dashboard", "/orders", "/orders/create"];
const EMPLOYEE_ORDERS_PREFIX = "/orders/";

function isPathAllowedForEmployee(path: string): boolean {
  if (EMPLOYEE_ALLOWED_PATHS.includes(path)) return true;
  if (path.startsWith(EMPLOYEE_ORDERS_PREFIX) && path.length > EMPLOYEE_ORDERS_PREFIX.length) return true;
  return false;
}

function PrivateLayout() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const role = user?.role ?? "";
  const isAdmin = role === "ADMIN";
  const pathAllowed = isAdmin || isPathAllowedForEmployee(location);
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (!pathAllowed) {
    return <NotFound />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto bg-muted/30">
            <Switch>
              <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
              <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} />} />
              <Route path="/orders/create" component={() => <ProtectedRoute component={CreateOrderPage} />} />
              <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderDetailsPage} />} />
              <Route path="/members" component={() => <ProtectedRoute component={MembersPage} />} />
              <Route path="/teams" component={() => <ProtectedRoute component={TeamsPage} />} />
              <Route path="/powder-coating" component={() => <ProtectedRoute component={PowderCoatingPage} />} />
              <Route path="/parties" component={() => <ProtectedRoute component={PartiesPage} />} />
              <Route path="/manage-users" component={() => <ProtectedRoute component={ManageUsersPage} />} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <LoginPage />}
      </Route>
      <Route path="/">
        <Redirect to={isAuthenticated ? "/dashboard" : "/login"} />
      </Route>
      <Route>
        <PrivateLayout />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AppRouter />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

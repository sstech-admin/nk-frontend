/**
 * Mock API layer — handles /api/* routes using the in-memory store (no Express).
 */
import { store, getDashboardStats } from "./store";

// Mock list for powder-coatings (plants) - separate from store powder-coating jobs
let mockPowderCoatings: Array<{
  _id: string;
  partyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}> = [];
function nextId() {
  return `mock-pc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function nextUserId() {
  return `mock-user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function now() {
  return new Date().toISOString();
}

const ALLOWED_STAGES = ["DESIGN_PREPARATION", "SHEET_PROCESSING", "FABRICATION", "DISPATCH_VALIDATION"] as const;
type MockUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  allowedStages: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
let mockManagerUsers: MockUser[] = [];

export async function mockFetch(
  url: string,
  options?: { method?: string; body?: string; credentials?: string }
): Promise<Response> {
  const method = (options?.method ?? "GET").toUpperCase();
  const path = url.replace(/^\/*/, ""); // trim leading slashes

  const parseBody = () => {
    if (!options?.body) return null;
    try {
      return JSON.parse(options.body);
    } catch {
      return null;
    }
  };

  const [pathBase, queryString] = path.split("?");
  const searchParams = queryString ? new URLSearchParams(queryString) : null;

  try {
    // GET
    if (method === "GET") {
      if (pathBase === "api/dashboard/stats") {
        return jsonResponse(getDashboardStats());
      }
      if (pathBase === "api/orders") {
        return jsonResponse(store.getOrders());
      }
      const orderMatch = pathBase.match(/^api\/orders\/([^/]+)$/);
      if (orderMatch) {
        const order = store.getOrder(orderMatch[1]);
        if (!order) return new Response(JSON.stringify({ message: "Order not found" }), { status: 404 });
        return jsonResponse(order);
      }
      if (pathBase === "api/members") {
        const teamId = searchParams?.get("teamId");
        let members = store.getMembers();
        if (teamId) {
          const team = store.getTeams().find((t) => t.id === teamId);
          if (team) members = members.filter((m) => m.team === team.name);
        }
        return jsonResponse(members);
      }
      if (pathBase === "api/teams") return jsonResponse(store.getTeams());
      if (pathBase === "api/users") {
        const page = Math.max(1, parseInt(searchParams?.get("page") ?? "1", 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(searchParams?.get("limit") ?? "10", 10) || 10));
        const search = (searchParams?.get("search") ?? "").toLowerCase().trim();
        const isActiveParam = searchParams?.get("isActive");
        const roleParam = searchParams?.get("role");
        let list = [...mockManagerUsers];
        if (roleParam) list = list.filter((u) => u.role === roleParam);
        if (isActiveParam === "true") list = list.filter((u) => u.isActive);
        else if (isActiveParam === "false") list = list.filter((u) => !u.isActive);
        if (search) {
          list = list.filter(
            (u) =>
              u.name.toLowerCase().includes(search) ||
              u.email.toLowerCase().includes(search)
          );
        }
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const users = list.slice(start, start + limit);
        return jsonResponse({ total, page, totalPages, limit, users });
      }
      const userByIdMatch = pathBase.match(/^api\/users\/([^/]+)$/);
      if (userByIdMatch) {
        const user = mockManagerUsers.find((u) => u._id === userByIdMatch[1]);
        if (!user) return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
        return jsonResponse(user);
      }
      if (pathBase === "api/parties") return jsonResponse(store.getParties());
      if (pathBase === "api/powder-coating") return jsonResponse(store.getPowderCoating());
      if (pathBase === "api/powder-coatings") {
        const page = Math.max(1, parseInt(searchParams?.get("page") ?? "1", 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(searchParams?.get("limit") ?? "10", 10) || 10));
        const search = (searchParams?.get("search") ?? "").toLowerCase().trim();
        const isActiveParam = searchParams?.get("isActive");
        let list = [...mockPowderCoatings];
        if (isActiveParam === "true") list = list.filter((p) => p.isActive);
        else if (isActiveParam === "false") list = list.filter((p) => !p.isActive);
        if (search) {
          list = list.filter(
            (p) =>
              p.partyName.toLowerCase().includes(search) ||
              p.contactPerson.toLowerCase().includes(search) ||
              p.email.toLowerCase().includes(search) ||
              p.phone.includes(search) ||
              p.address.toLowerCase().includes(search)
          );
        }
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const powderCoatings = list.slice(start, start + limit);
        return jsonResponse({
          total,
          page,
          totalPages,
          limit,
          powderCoatings,
        });
      }
      const powderCoatingByIdMatch = pathBase.match(/^api\/powder-coatings\/([^/]+)$/);
      if (powderCoatingByIdMatch && !pathBase.endsWith("/status")) {
        const pc = mockPowderCoatings.find((p) => p._id === powderCoatingByIdMatch[1]);
        if (!pc) return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
        return jsonResponse(pc);
      }
    }

    // POST
    if (method === "POST") {
      const body = parseBody();
      if (pathBase === "api/orders" && body) {
        const order = store.createOrder(body);
        return jsonResponse(order, 201);
      }
      if (pathBase === "api/members" && body) {
        const teamName = body.teamId
          ? (store.getTeams().find((t) => t.id === body.teamId)?.name ?? body.teamId)
          : body.team ?? "";
        const member = store.createMember({
          name: body.name,
          email: body.email,
          role: (body.role ?? "operator").toLowerCase(),
          team: teamName,
          status: "active",
        });
        return jsonResponse(member, 201);
      }
      if (pathBase === "api/teams" && body) {
        const team = store.createTeam({
          name: body.teamName ?? body.name,
          lead: body.teamLead ?? body.lead ?? undefined,
          memberCount: 0,
          status: "active",
        });
        return jsonResponse(team, 201);
      }
      if (pathBase === "api/parties" && body) {
        const party = store.createParty({
          name: body.partyName ?? body.name,
          gstNo: body.gstNumber ?? body.gstNo ?? null,
          contact: body.contactNumber ?? body.contact ?? "",
          email: body.email ?? null,
          address: body.address ?? null,
          type: "customer",
          status: "active",
        });
        return jsonResponse(party, 201);
      }
      if (pathBase === "api/powder-coating" && body) {
        const job = store.createPowderCoating(body);
        return jsonResponse(job, 201);
      }
      if (pathBase === "api/powder-coatings" && body) {
        const id = nextId();
        const ts = now();
        const pc = {
          _id: id,
          partyName: body.partyName ?? "",
          contactPerson: body.contactPerson ?? "",
          phone: body.phone ?? "",
          email: body.email ?? "",
          address: body.address ?? "",
          type: body.type ?? "INHOUSE",
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        };
        mockPowderCoatings.push(pc);
        return jsonResponse(pc, 201);
      }
      if (pathBase === "api/users" && body) {
        const id = nextUserId();
        const ts = now();
        const allowedStages = Array.isArray(body.allowedStages) ? body.allowedStages : [];
        const user: MockUser = {
          _id: id,
          name: body.name ?? "",
          email: body.email ?? "",
          role: body.role ?? "EMPLOYEE",
          allowedStages: allowedStages.filter((s: string) => ALLOWED_STAGES.includes(s as any)),
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        };
        mockManagerUsers.push(user);
        return jsonResponse(user, 201);
      }
    }

    // PUT
    if (method === "PUT") {
      const body = parseBody();
      const teamsMatch = pathBase.match(/^api\/teams\/([^/]+)$/);
      if (teamsMatch && body) {
        const team = store.updateTeam(teamsMatch[1], {
          name: body.teamName ?? body.name,
          lead: body.teamLead ?? body.lead ?? undefined,
        });
        return jsonResponse(team);
      }
      const membersMatch = pathBase.match(/^api\/members\/([^/]+)$/);
      if (membersMatch && body) {
        const teamName = body.teamId
          ? (store.getTeams().find((t) => t.id === body.teamId)?.name ?? body.teamId)
          : body.team ?? undefined;
        const member = store.updateMember(membersMatch[1], {
          name: body.name,
          email: body.email,
          role: body.role ? String(body.role).toLowerCase() : undefined,
          team: teamName,
        });
        return jsonResponse(member);
      }
      const partiesMatchPut = pathBase.match(/^api\/parties\/([^/]+)$/);
      if (partiesMatchPut && body) {
        const party = store.updateParty(partiesMatchPut[1], {
          name: body.partyName ?? body.name,
          gstNo: body.gstNumber ?? body.gstNo ?? undefined,
          contact: body.contactNumber ?? body.contact ?? undefined,
          email: body.email ?? undefined,
          address: body.address ?? undefined,
        });
        return jsonResponse(party);
      }
      const powderCoatingPutMatch = pathBase.match(/^api\/powder-coatings\/([^/]+)$/);
      if (powderCoatingPutMatch && body) {
        const idx = mockPowderCoatings.findIndex((p) => p._id === powderCoatingPutMatch[1]);
        if (idx < 0) return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
        const ts = now();
        mockPowderCoatings[idx] = {
          ...mockPowderCoatings[idx],
          partyName: body.partyName ?? mockPowderCoatings[idx].partyName,
          contactPerson: body.contactPerson ?? mockPowderCoatings[idx].contactPerson,
          phone: body.phone ?? mockPowderCoatings[idx].phone,
          email: body.email ?? mockPowderCoatings[idx].email,
          address: body.address ?? mockPowderCoatings[idx].address,
          type: body.type ?? mockPowderCoatings[idx].type,
          updatedAt: ts,
        };
        return jsonResponse(mockPowderCoatings[idx]);
      }
      const userPutMatch = pathBase.match(/^api\/users\/([^/]+)$/);
      if (userPutMatch && body) {
        const idx = mockManagerUsers.findIndex((u) => u._id === userPutMatch[1]);
        if (idx < 0) return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
        const ts = now();
        const allowedStages = Array.isArray(body.allowedStages) ? body.allowedStages : mockManagerUsers[idx].allowedStages;
        mockManagerUsers[idx] = {
          ...mockManagerUsers[idx],
          name: body.name ?? mockManagerUsers[idx].name,
          email: body.email ?? mockManagerUsers[idx].email,
          role: body.role ?? mockManagerUsers[idx].role,
          allowedStages: allowedStages.filter((s: string) => ALLOWED_STAGES.includes(s as any)),
          isActive: body.isActive !== undefined ? !!body.isActive : mockManagerUsers[idx].isActive,
          updatedAt: ts,
        };
        return jsonResponse(mockManagerUsers[idx]);
      }
    }

    // PATCH
    if (method === "PATCH") {
      const pathMatch = pathBase.match(/^api\/powder-coatings\/([^/]+)\/status$/);
      if (pathMatch) {
        const idx = mockPowderCoatings.findIndex((p) => p._id === pathMatch[1]);
        if (idx < 0) return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
        mockPowderCoatings[idx] = {
          ...mockPowderCoatings[idx],
          isActive: !mockPowderCoatings[idx].isActive,
          updatedAt: now(),
        };
        return jsonResponse(mockPowderCoatings[idx]);
      }
    }

    // DELETE
    if (method === "DELETE") {
      const ordersMatch = pathBase.match(/^api\/orders\/([^/]+)$/);
      if (ordersMatch) {
        store.deleteOrder(ordersMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const membersMatch = pathBase.match(/^api\/members\/([^/]+)$/);
      if (membersMatch) {
        store.deleteMember(membersMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const teamsMatch = pathBase.match(/^api\/teams\/([^/]+)$/);
      if (teamsMatch) {
        store.deleteTeam(teamsMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const partiesMatch = pathBase.match(/^api\/parties\/([^/]+)$/);
      if (partiesMatch) {
        store.deleteParty(partiesMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const coatingMatch = pathBase.match(/^api\/powder-coating\/([^/]+)$/);
      if (coatingMatch) {
        store.deletePowderCoating(coatingMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const powderCoatingsDeleteMatch = pathBase.match(/^api\/powder-coatings\/([^/]+)$/);
      if (powderCoatingsDeleteMatch) {
        mockPowderCoatings = mockPowderCoatings.filter((p) => p._id !== powderCoatingsDeleteMatch[1]);
        return new Response(undefined, { status: 204 });
      }
      const userDeleteMatch = pathBase.match(/^api\/users\/([^/]+)$/);
      if (userDeleteMatch) {
        mockManagerUsers = mockManagerUsers.filter((u) => u._id !== userDeleteMatch[1]);
        return new Response(undefined, { status: 204 });
      }
    }
  } catch (err) {
    console.error("mockApi error:", err);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function isApiUrl(url: string): boolean {
  const path = url.replace(/^\/*/, "");
  return path.startsWith("api/") || path === "api";
}

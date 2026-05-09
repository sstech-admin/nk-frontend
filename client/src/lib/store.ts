/**
 * In-memory store with localStorage persistence (replaces Express + PostgreSQL).
 */
import type {
  Order,
  InsertOrder,
  Member,
  InsertMember,
  Team,
  InsertTeam,
  Party,
  InsertParty,
  PowderCoating,
  InsertPowderCoating,
} from "@shared/types";

const STORAGE_KEYS = {
  orders: "app_orders",
  members: "app_members",
  teams: "app_teams",
  parties: "app_parties",
  powderCoating: "app_powder_coating",
} as const;

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments where randomUUID isn't available (e.g. older Node/browsers)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function now() {
  return new Date().toISOString();
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  // Return a copy so we never mutate seed data
  return structuredClone(fallback);
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Seed data (same as original server seed)
const seedOrders: Order[] = [
  { id: uuid(), orderNo: "ORD-001", partyName: "Sharma Steel Works", quantity: 150, stage: "cutting", status: "in_progress", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-002", partyName: "Patel Industries", quantity: 300, stage: "welding", status: "in_progress", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-003", partyName: "Kumar Fabrication", quantity: 80, stage: "coating", status: "completed", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-004", partyName: "Gupta Engineering", quantity: 200, stage: "assembly", status: "completed", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-005", partyName: "Singh Metals", quantity: 50, stage: "quality_check", status: "on_hold", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-006", partyName: "Rajput Iron Works", quantity: 120, stage: "dispatch", status: "completed", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-007", partyName: "Verma Traders", quantity: 90, stage: "cutting", status: "in_progress", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-008", partyName: "Mehta Enterprises", quantity: 250, stage: "welding", status: "cancelled", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-009", partyName: "Jain Steel Corp", quantity: 175, stage: "coating", status: "in_progress", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
  { id: uuid(), orderNo: "ORD-010", partyName: "Agarwal Associates", quantity: 60, stage: "assembly", status: "completed", designerName: null, panelType: null, poNo: null, description: null, parts: null, customerWoNo: null, powderCoatingType: null, colorBody: null, colorMountingPlate: null, colorBaseStand: null, accessories: null, accessoriesOther: null, rateType: null, rate: null, remarks: null, date: now() },
];

const seedMembers: Member[] = [
  { id: uuid(), name: "Rajesh Kumar", email: "rajesh@company.com", role: "manager", team: "Production", status: "active", avatar: null },
  { id: uuid(), name: "Priya Sharma", email: "priya@company.com", role: "supervisor", team: "Quality", status: "active", avatar: null },
  { id: uuid(), name: "Amit Patel", email: "amit@company.com", role: "operator", team: "Production", status: "active", avatar: null },
  { id: uuid(), name: "Neha Gupta", email: "neha@company.com", role: "lead", team: "Coating", status: "active", avatar: null },
  { id: uuid(), name: "Vikram Singh", email: "vikram@company.com", role: "technician", team: "Assembly", status: "on_leave", avatar: null },
  { id: uuid(), name: "Sunita Verma", email: "sunita@company.com", role: "operator", team: "Dispatch", status: "active", avatar: null },
  { id: uuid(), name: "Arjun Mehta", email: "arjun@company.com", role: "supervisor", team: "Production", status: "inactive", avatar: null },
  { id: uuid(), name: "Kavita Jain", email: "kavita@company.com", role: "manager", team: "Quality", status: "active", avatar: null },
];

const seedTeams: Team[] = [
  { id: uuid(), name: "Production", description: "Main production line operations", memberCount: 12, status: "active", lead: "Admin" },
  { id: uuid(), name: "Quality", description: "Quality assurance and testing", memberCount: 6, status: "active", lead: "Priya Sharma" },
  { id: uuid(), name: "Coating", description: "Powder coating department", memberCount: 8, status: "active", lead: "Designer-1" },
  { id: uuid(), name: "Assembly", description: "Final assembly and integration", memberCount: 10, status: "active", lead: "Vikram Singh" },
  { id: uuid(), name: "Dispatch", description: "Shipping and logistics", memberCount: 5, status: "active", lead: "Sunita Verma" },
];

const seedParties: Party[] = [
  { id: uuid(), name: "Sharma Steel Works", gstNo: "24AABCS1234A1Z5", contact: "+91 98765 43210", email: "info@sharmasteel.com", address: "Industrial Area, Phase 2, Delhi", type: "customer", status: "active" },
  { id: uuid(), name: "Patel Industries", gstNo: "27AABCP5678B1Z3", contact: "+91 87654 32100", email: "orders@patelindustries.com", address: "MIDC, Pune", type: "customer", status: "active" },
  { id: uuid(), name: "Kumar Fabrication", gstNo: "09AABCK9012C1Z1", contact: "+91 76543 21000", email: "kumar.fab@gmail.com", address: "Sector 18, Noida", type: "customer", status: "active" },
  { id: uuid(), name: "Gupta Engineering", gstNo: "27AABCG3456D1Z7", contact: "+91 65432 10000", email: "gupta.eng@outlook.com", address: "Andheri East, Mumbai", type: "supplier", status: "active" },
  { id: uuid(), name: "Singh Metals", gstNo: "03AABCS7890E1Z9", contact: "+91 54321 00000", email: "singh.metals@yahoo.com", address: "Ludhiana, Punjab", type: "supplier", status: "inactive" },
  { id: uuid(), name: "Rajput Iron Works", gstNo: "08AABCR2345F1Z2", contact: "+91 43210 98765", email: "rajput.iron@gmail.com", address: "Jaipur, Rajasthan", type: "vendor", status: "active" },
];

const seedPowderCoating: PowderCoating[] = [
  { id: uuid(), jobNo: "PC-001", orderNo: "ORD-001", color: "white", quantity: 50, status: "in_progress", date: now() },
  { id: uuid(), jobNo: "PC-002", orderNo: "ORD-002", color: "black", quantity: 100, status: "pending", date: now() },
  { id: uuid(), jobNo: "PC-003", orderNo: "ORD-003", color: "silver", quantity: 80, status: "completed", date: now() },
  { id: uuid(), jobNo: "PC-004", orderNo: "ORD-004", color: "grey", quantity: 60, status: "completed", date: now() },
  { id: uuid(), jobNo: "PC-005", orderNo: "ORD-005", color: "blue", quantity: 30, status: "pending", date: now() },
  { id: uuid(), jobNo: "PC-006", orderNo: "ORD-007", color: "bronze", quantity: 45, status: "in_progress", date: now() },
  { id: uuid(), jobNo: "PC-007", orderNo: "ORD-009", color: "red", quantity: 75, status: "cancelled", date: now() },
];

function getOrders(): Order[] {
  const data = load<Order[]>(STORAGE_KEYS.orders, seedOrders);
  if (data.length === 0) return [...seedOrders];
  return data;
}

function getMembers(): Member[] {
  const data = load<Member[]>(STORAGE_KEYS.members, seedMembers);
  if (data.length === 0) return [...seedMembers];
  return data;
}

function getTeams(): Team[] {
  const data = load<Team[]>(STORAGE_KEYS.teams, seedTeams);
  if (data.length === 0) return [...seedTeams];
  return data;
}

function getParties(): Party[] {
  const data = load<Party[]>(STORAGE_KEYS.parties, seedParties);
  if (data.length === 0) return [...seedParties];
  return data;
}

function getPowderCoating(): PowderCoating[] {
  const data = load<PowderCoating[]>(STORAGE_KEYS.powderCoating, seedPowderCoating);
  if (data.length === 0) return [...seedPowderCoating];
  return data;
}

export const store = {
  getOrders,
  getOrder(id: string): Order | undefined {
    return getOrders().find((o) => o.id === id);
  },
  createOrder(data: InsertOrder): Order {
    const orders = getOrders();
    const order: Order = {
      id: uuid(),
      date: now(),
      designerName: null,
      panelType: null,
      poNo: null,
      description: null,
      parts: null,
      customerWoNo: null,
      powderCoatingType: "single_coat",
      colorBody: null,
      colorMountingPlate: null,
      colorBaseStand: null,
      accessories: null,
      accessoriesOther: null,
      rateType: "including_acc",
      rate: null,
      remarks: null,
      stage: "pending",
      status: "in_progress",
      ...data,
    };
    orders.push(order);
    save(STORAGE_KEYS.orders, orders);
    return order;
  },
  deleteOrder(id: string): void {
    const orders = getOrders().filter((o) => o.id !== id);
    save(STORAGE_KEYS.orders, orders);
  },

  getMembers,
  createMember(data: InsertMember): Member {
    const members = getMembers();
    const member: Member = {
      id: uuid(),
      status: "active",
      avatar: null,
      ...data,
    };
    members.push(member);
    save(STORAGE_KEYS.members, members);
    return member;
  },
  updateMember(id: string, data: Partial<{ name: string; email: string; role: string; team: string }>): Member {
    const members = getMembers();
    const i = members.findIndex((m) => m.id === id);
    if (i < 0) throw new Error("Member not found");
    const member = { ...members[i], ...data };
    members[i] = member;
    save(STORAGE_KEYS.members, members);
    return member;
  },
  deleteMember(id: string): void {
    const members = getMembers().filter((m) => m.id !== id);
    save(STORAGE_KEYS.members, members);
  },

  getTeams,
  createTeam(data: InsertTeam): Team {
    const teams = getTeams();
    const team: Team = {
      id: uuid(),
      memberCount: data.memberCount ?? 0,
      status: "active",
      description: null,
      lead: null,
      ...data,
    };
    teams.push(team);
    save(STORAGE_KEYS.teams, teams);
    return team;
  },
  updateTeam(id: string, data: Partial<{ name: string; lead: string | null }>): Team {
    const teams = getTeams();
    const i = teams.findIndex((t) => t.id === id);
    if (i < 0) throw new Error("Team not found");
    const team = { ...teams[i], ...data };
    teams[i] = team;
    save(STORAGE_KEYS.teams, teams);
    return team;
  },
  deleteTeam(id: string): void {
    const teams = getTeams().filter((t) => t.id !== id);
    save(STORAGE_KEYS.teams, teams);
  },

  getParties,
  createParty(data: InsertParty): Party {
    const parties = getParties();
    const party: Party = {
      id: uuid(),
      gstNo: null,
      email: null,
      address: null,
      type: "customer",
      status: "active",
      ...data,
    };
    parties.push(party);
    save(STORAGE_KEYS.parties, parties);
    return party;
  },
  updateParty(id: string, data: Partial<{ name: string; gstNo: string | null; contact: string; email: string | null; address: string | null }>): Party {
    const parties = getParties();
    const i = parties.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("Party not found");
    const party = { ...parties[i], ...data };
    parties[i] = party;
    save(STORAGE_KEYS.parties, parties);
    return party;
  },
  deleteParty(id: string): void {
    const parties = getParties().filter((p) => p.id !== id);
    save(STORAGE_KEYS.parties, parties);
  },

  getPowderCoating,
  createPowderCoating(data: InsertPowderCoating): PowderCoating {
    const list = getPowderCoating();
    const job: PowderCoating = {
      id: uuid(),
      date: now(),
      status: "pending",
      ...data,
    };
    list.push(job);
    save(STORAGE_KEYS.powderCoating, list);
    return job;
  },
  deletePowderCoating(id: string): void {
    const list = getPowderCoating().filter((p) => p.id !== id);
    save(STORAGE_KEYS.powderCoating, list);
  },
};

export function getDashboardStats() {
  const orders = getOrders();
  const teams = getTeams();
  return {
    totalOrders: orders.length,
    completed: orders.filter((o) => o.status === "completed").length,
    pending: orders.filter((o) => o.status === "in_progress" || o.status === "on_hold").length,
    teamsActive: teams.filter((t) => t.status === "active").length,
  };
}

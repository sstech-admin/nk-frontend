import { jsPDF } from "jspdf";
import type { Order } from "@shared/schema";
import type { StageCompletionData } from "@/components/stage-detail-modal";
import type { StageAttachment } from "@/lib/stage-uploads";

/* ---------------------------------------------------------------------------
 * Shared layout primitives for stage "Job Card" PDFs.
 * Header + footer + title + info bar + section headers are identical across
 * stages; only the per-stage body differs.
 * ------------------------------------------------------------------------- */

const LETTERHEAD = {
  company: "N. K. Techno Craft India Pvt. Ltd.",
  fabricationPlant:
    "Survey No. 129, Kastbhanjan 2, Bakrol Bujrang, Ahmedabad - 382 433",
  fabricationEmail: "nktechnocraft@gmail.com",
  powderPlantLine1:
    "Plot No. A/9/A-10, Swagat Industrial Estate, Vill. Bakrol Bujrang,",
  powderPlantLine2: "Tal Daskroi, Ahmedabad - 382 430.",
  powderEmail: "nktechnofab@yahoo.com",
};

const COLORS = {
  sectionFillStart: [91, 95, 199] as const, // #5b5fc7
  sectionFillEnd: [74, 111, 179] as const,  // #4a6fb3
  infoBar: [241, 243, 247] as const,        // #f1f3f7
  label: [120, 120, 125] as const,          // muted label
  value: [25, 25, 28] as const,
  hr: [220, 222, 228] as const,
  border: [220, 222, 228] as const,
  thanks: [110, 110, 115] as const,
};

const PAGE = {
  margin: 13,
  labelValueRowH: 6.2,
};

/* -------------------------- Logo preloading ------------------------------ */
/**
 * Preload the company logo once at module load so jsPDF can embed it
 * synchronously inside `drawHeader`. The image lives at
 * `client/public/nk-logo.png` → served by Vite at `/nk-logo.png`.
 * Falls back to the "NK" placeholder block if the image fails to load.
 */
const LOGO_URL = "/nk-logo.png";
let logoImg: HTMLImageElement | null = null;
if (typeof window !== "undefined" && typeof Image !== "undefined") {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    logoImg = img;
  };
  img.onerror = () => {
    logoImg = null;
  };
  img.src = LOGO_URL;
}

export interface StagePdfLabels {
  teamMember?: string;
  coatingType?: string;
  pcLocation?: string;
  powderTeam?: string;
}

export interface ExportStagePdfInput {
  order: Order;
  stageKey: string;
  stageLabel: string;
  completion: StageCompletionData | null;
  labels?: StagePdfLabels;
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ---------------------- Async image loading helpers ---------------------- */
/**
 * Fetches a remote image and returns a data URL + intrinsic size that jsPDF
 * can embed synchronously. WEBP/GIF are transparently re-encoded to PNG via
 * canvas because jsPDF's `addImage` only accepts JPEG/PNG.
 *
 * Returns `null` if the fetch fails (CORS, 403 expired presign, network, …) —
 * the caller is expected to skip that attachment gracefully.
 */
interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG" | "PNG";
  name: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("FileReader error"));
    fr.readAsDataURL(blob);
  });
}

function imageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image decode error"));
    img.src = src;
  });
}

async function reencodeToPng(blob: Blob): Promise<LoadedImage | null> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode"));
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: img.naturalWidth,
      height: img.naturalHeight,
      format: "PNG",
      name: "",
    };
  } catch {
    return null;
  }
}

async function loadAttachmentImage(
  attachment: StageAttachment
): Promise<LoadedImage | null> {
  const url = attachment.viewUrl ?? attachment.url;
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = (blob.type || attachment.contentType || "").toLowerCase();
    // jsPDF natively supports JPEG + PNG; re-encode anything else.
    if (mime.includes("jpeg") || mime.includes("jpg")) {
      const dataUrl = await blobToDataUrl(blob);
      const dims = await imageDimensions(dataUrl);
      return { dataUrl, ...dims, format: "JPEG", name: attachment.name };
    }
    if (mime.includes("png")) {
      const dataUrl = await blobToDataUrl(blob);
      const dims = await imageDimensions(dataUrl);
      return { dataUrl, ...dims, format: "PNG", name: attachment.name };
    }
    const reencoded = await reencodeToPng(blob);
    return reencoded ? { ...reencoded, name: attachment.name } : null;
  } catch {
    return null;
  }
}

/* ----------------------------- Page breaks ------------------------------- */
/**
 * Ensure at least `need` mm of vertical space remains on the current page.
 * If not, add a new page, redraw the header, and return the new starting Y.
 */
function ensurePage(doc: jsPDF, pageW: number, y: number, need: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = 14;
  if (y + need <= pageH - bottom) return y;
  doc.addPage();
  return drawHeader(doc, pageW);
}

/* ------------------------------ Header ----------------------------------- */

function drawHeader(doc: jsPDF, pageW: number): number {
  const m = PAGE.margin;
  let y = 12;

  // Company logo — preloaded on module init. Preserve aspect ratio, fit within
  // ~24 mm × 18 mm. Falls back to the rounded "NK" placeholder if the image
  // isn't ready yet (e.g. very first click before load completes).
  const boxW = 24;
  const boxH = 18;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
    let w = boxW;
    let h = w / ratio;
    if (h > boxH) {
      h = boxH;
      w = h * ratio;
    }
    try {
      doc.addImage(logoImg, "PNG", m, y + (boxH - h) / 2, w, h, undefined, "FAST");
    } catch {
      // If jsPDF can't embed for any reason, just skip the logo silently.
    }
  } else {
    doc.setFillColor(236, 240, 241);
    doc.roundedRect(m, y, 18, 18, 2.2, 2.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("NK", m + 4.5, y + 11.5);
  }

  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(LETTERHEAD.company, m + boxW + 4, y + 11);

  // Address block under header
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(50, 50, 55);

  // Fabrication plant
  doc.setFont("helvetica", "bold");
  doc.text("Fabrication Plant:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.fabricationPlant, m + 30, y);
  y += 4.4;
  doc.setFont("helvetica", "bold");
  doc.text("Email:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.fabricationEmail, m + 30, y);

  // Powder coating plant
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Powder Coating Plant:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.powderPlantLine1, m + 38, y);
  y += 4.4;
  doc.text(LETTERHEAD.powderPlantLine2, m + 38, y);
  y += 4.4;
  doc.setFont("helvetica", "bold");
  doc.text("Email:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.powderEmail, m + 30, y);
  y += 4;

  // Divider
  doc.setDrawColor(...COLORS.hr);
  doc.setLineWidth(0.3);
  doc.line(m, y, pageW - m, y);
  return y + 4;
}

/* -------------------------------- Title ---------------------------------- */

function drawTitle(doc: jsPDF, pageW: number, y: number, title = "JOB CARD"): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 22);
  const w = doc.getTextWidth(title);
  doc.text(title, (pageW - w) / 2, y + 6);
  return y + 10;
}

/* ----------------------------- Info bar ---------------------------------- */

function drawInfoBar(
  doc: jsPDF,
  pageW: number,
  y: number,
  items: { label: string; value: string }[]
): number {
  const m = PAGE.margin;
  const h = 11;
  doc.setFillColor(...COLORS.infoBar);
  doc.roundedRect(m, y, pageW - m * 2, h, 2, 2, "F");
  doc.setFontSize(9.5);
  const cellW = (pageW - m * 2) / items.length;
  items.forEach((it, i) => {
    const x = m + i * cellW + 4;
    const baseline = y + h / 2 + 1.5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 44);
    const labelWithColon = `${it.label}: `;
    doc.text(labelWithColon, x, baseline);
    const labelW = doc.getTextWidth(labelWithColon);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 76);
    doc.text(it.value, x + labelW, baseline);
  });
  return y + h + 4;
}

/* --------------------------- Section header ------------------------------ */

function drawSectionHeader(doc: jsPDF, pageW: number, y: number, title: string): number {
  const m = PAGE.margin;
  const h = 8.2;
  // Fake gradient: draw two overlapping bands left -> right.
  doc.setFillColor(...COLORS.sectionFillStart);
  doc.rect(m, y, (pageW - m * 2) * 0.55, h, "F");
  doc.setFillColor(...COLORS.sectionFillEnd);
  doc.rect(
    m + (pageW - m * 2) * 0.55,
    y,
    (pageW - m * 2) * 0.45,
    h,
    "F"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), m + 4, y + 5.8);
  return y + h;
}

/* ------------------------- 2-column grid (rows) -------------------------- */

interface KV {
  label: string;
  value: string;
}

function drawTwoColumnGrid(
  doc: jsPDF,
  pageW: number,
  y: number,
  left: KV[],
  right: KV[]
): number {
  const m = PAGE.margin;
  const totalW = pageW - m * 2;
  const colW = totalW / 2;
  const rowCount = Math.max(left.length, right.length);
  const padTop = 6;
  const padX = 8;
  const rowH = PAGE.labelValueRowH;
  const gridH = padTop + rowCount * rowH + 4;

  // Outer box (no top border — it sits flush against the section header)
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.rect(m, y, totalW, gridH);
  // Vertical column divider
  doc.line(m + colW, y, m + colW, y + gridH);

  const renderCol = (rows: KV[], x0: number) => {
    rows.forEach((row, i) => {
      const rowY = y + padTop + i * rowH;
      // Label (grey)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.label);
      doc.text(row.label, x0 + padX, rowY);
      // Value (right-aligned in column, bold)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.value);
      const maxValW = colW - padX * 2 - doc.getTextWidth(row.label) - 4;
      const valStr = row.value ?? "—";
      const lines = doc.splitTextToSize(valStr, Math.max(maxValW, 30));
      const first = Array.isArray(lines) ? lines[0] : valStr;
      const vw = doc.getTextWidth(first);
      doc.text(first, x0 + colW - padX - vw, rowY);
    });
  };

  renderCol(left, m);
  renderCol(right, m + colW);
  return y + gridH;
}

/* ----------------------- Accessories checkbox grid ----------------------- */

interface AccessoryItem {
  label: string;
  checked: boolean;
}

function drawCheckbox(doc: jsPDF, x: number, y: number, checked: boolean) {
  const size = 3.5;
  doc.setDrawColor(100, 100, 110);
  doc.setLineWidth(0.35);
  doc.rect(x, y - size + 0.5, size, size);
  if (checked) {
    doc.setDrawColor(40, 140, 70);
    doc.setLineWidth(0.8);
    // Tick: two strokes
    doc.line(x + 0.6, y - 1.2, x + 1.5, y - 0.1);
    doc.line(x + 1.5, y - 0.1, x + 3.1, y - 2.6);
    doc.setLineWidth(0.3);
  }
}

function drawAccessoriesGrid(
  doc: jsPDF,
  pageW: number,
  y: number,
  left: AccessoryItem[],
  right: AccessoryItem[]
): number {
  const m = PAGE.margin;
  const totalW = pageW - m * 2;
  const colW = totalW / 2;
  const rowCount = Math.max(left.length, right.length);
  const padTop = 6;
  const padX = 8;
  const rowH = 6.6;
  const gridH = padTop + rowCount * rowH + 4;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.rect(m, y, totalW, gridH);
  doc.line(m + colW, y, m + colW, y + gridH);

  const renderCol = (rows: AccessoryItem[], x0: number) => {
    rows.forEach((row, i) => {
      const rowY = y + padTop + i * rowH;
      drawCheckbox(doc, x0 + padX, rowY, row.checked);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 44);
      doc.text(row.label, x0 + padX + 6, rowY);
    });
  };

  renderCol(left, m);
  renderCol(right, m + colW);
  return y + gridH;
}

/* --------------------------- Footer (signature) -------------------------- */

function drawFooter(
  doc: jsPDF,
  pageW: number,
  y: number,
  remarks: string
): number {
  const m = PAGE.margin;
  const totalW = pageW - m * 2;
  const colW = totalW / 2;
  const h = 24;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.rect(m, y, totalW, h);
  doc.line(m + colW, y, m + colW, y + h);

  // Remarks
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 44);
  doc.text("Remarks:", m + 6, y + 7);
  doc.setFont("helvetica", "normal");
  const remarkLines = doc.splitTextToSize(remarks || "—", colW - 12);
  doc.text(remarkLines, m + 6, y + 13);

  // Signature
  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signatory", m + colW + 6, y + 7);
  doc.setDrawColor(60, 60, 65);
  doc.setLineWidth(0.3);
  const sigStart = m + colW + 6;
  const sigEnd = m + colW + colW - 10;
  doc.line(sigStart, y + h - 6, sigEnd, y + h - 6);
  return y + h;
}

function drawThanks(doc: jsPDF, pageW: number, y: number) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.thanks);
  const text = "Thank You For Your Business!";
  const w = doc.getTextWidth(text);
  doc.text(text, (pageW - w) / 2, y + 8);
}

/* ------------------------- Stage-specific bodies ------------------------- */

interface Accessories {
  pointLock: boolean;
  threePointLock: boolean;
  puGasketing: boolean;
  pattiGasketing: boolean;
  other?: string;
}

function resolveAccessories(order: Order, c: StageCompletionData | null): Accessories {
  const accObj = (order as { accessoriesObj?: Partial<Accessories> }).accessoriesObj;
  const arr = Array.isArray(order.accessories) ? order.accessories : [];
  const has = (k: string) => arr.includes(k);
  return {
    pointLock: c?.pointLock ?? accObj?.pointLock ?? has("point_lock"),
    threePointLock: c?.threePointLock ?? accObj?.threePointLock ?? has("3_point_lock"),
    puGasketing: c?.puGasketing ?? accObj?.puGasketing ?? has("pu_gasketing"),
    pattiGasketing: c?.pattiGasketing ?? accObj?.pattiGasketing ?? has("patti_gasketing"),
    other: c?.accessoriesOther ?? accObj?.other ?? order.accessoriesOther ?? undefined,
  };
}

/** Stage 1 — Design preparation */
function drawDesignStageBody(
  doc: jsPDF,
  pageW: number,
  y: number,
  order: Order,
  c: StageCompletionData | null
): number {
  // ORDER DETAILS
  y = drawSectionHeader(doc, pageW, y, "Order Details");
  const powderCoating = order.powderCoatingType
    ? String(order.powderCoatingType).replace(/_/g, " ")
    : "—";
  const left: KV[] = [
    { label: "Party Name", value: fmt(order.partyName) },
    { label: "Party Type", value: fmt(order.rateType) },
    { label: "Panel Type", value: fmt(order.panelType) },
    { label: "Quantity", value: fmt(order.quantity) },
    { label: "Parts (Bhag)", value: fmt(order.parts) },
  ];
  const right: KV[] = [
    { label: "Designer Name", value: fmt(order.designerName ?? c?.executedBy) },
    { label: "Powder Coating", value: powderCoating },
    { label: "Body Color", value: fmt(order.colorBody) },
    { label: "Mounting Plate", value: fmt(order.colorMountingPlate) },
    { label: "Base / Stand", value: fmt(order.colorBaseStand) },
  ];
  y = drawTwoColumnGrid(doc, pageW, y, left, right) + 4;

  // ACCESSORIES / REMARKS
  const acc = resolveAccessories(order, c);
  y = drawSectionHeader(doc, pageW, y, "Accessories / Remarks");
  y =
    drawAccessoriesGrid(
      doc,
      pageW,
      y,
      [
        { label: "Point Lock", checked: !!acc.pointLock },
        { label: "3 Point Lock", checked: !!acc.threePointLock },
      ],
      [
        { label: "PU Gasketing", checked: !!acc.puGasketing },
        { label: "Patti Gasketing", checked: !!acc.pattiGasketing },
      ]
    ) + 4;

  // FOOTER with remarks + signature
  const remarks = (c?.remarks ?? order.remarks ?? "").toString().trim();
  y = drawFooter(doc, pageW, y, remarks);
  return y + 6;
}

/* --------------------------- Attached images ----------------------------- */
/**
 * Render a grid of attached images below a section header. Images are laid
 * out in 2 columns, preserving aspect ratio and contained within each tile.
 * The caller is responsible for loading pixel data first (see
 * `loadAttachmentImage`) because jsPDF's `addImage` is synchronous.
 */
function drawAttachedImages(
  doc: jsPDF,
  pageW: number,
  y: number,
  images: LoadedImage[]
): number {
  if (images.length === 0) return y;
  const m = PAGE.margin;
  y = ensurePage(doc, pageW, y, 20);
  y = drawSectionHeader(doc, pageW, y, "Attached Images");

  const totalW = pageW - m * 2;
  const cols = 2;
  const gap = 3;
  const tileW = (totalW - gap * (cols - 1)) / cols;
  const tileH = 55; // fixed tile height for a uniform grid
  const padTop = 4;

  let row = 0;
  for (let i = 0; i < images.length; i += cols) {
    y = ensurePage(doc, pageW, y, padTop + tileH + 8);
    const rowY = y + padTop;
    for (let c = 0; c < cols; c++) {
      const img = images[i + c];
      if (!img) break;
      const x = m + c * (tileW + gap);
      // Tile border
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.3);
      doc.rect(x, rowY, tileW, tileH);
      // Contain image inside tile, preserving aspect ratio
      const innerPad = 2;
      const maxW = tileW - innerPad * 2;
      const maxH = tileH - innerPad * 2 - 6; // leave 6mm for caption
      const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
      let drawW = maxW;
      let drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      const ix = x + (tileW - drawW) / 2;
      const iy = rowY + innerPad + (maxH - drawH) / 2;
      try {
        doc.addImage(img.dataUrl, img.format, ix, iy, drawW, drawH, undefined, "FAST");
      } catch {
        // If embedding fails, leave the tile empty rather than aborting.
      }
      // Caption (truncated filename)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.label);
      const caption = doc.splitTextToSize(img.name || "image", tileW - 4)[0] ?? "";
      doc.text(caption, x + 2, rowY + tileH - 1.5);
    }
    y = rowY + tileH + 3;
    row++;
  }
  return y + 2;
}

/* --------------------- Stage 3 — Fabrication + PC ------------------------ */
/**
 * Body for the combined Fabrication + Powder Coating modal (Stage 3 & 4).
 * Mirrors every field visible in the modal — fabrication details, team
 * member, powder-coating challan, color codes, accessories, part counts —
 * plus any uploaded attachments (embedded as images when available).
 */
function drawFabricationStageBody(
  doc: jsPDF,
  pageW: number,
  y: number,
  order: Order,
  c: StageCompletionData | null,
  labels: StagePdfLabels | undefined,
  images: LoadedImage[]
): number {
  // FABRICATION DETAILS
  y = ensurePage(doc, pageW, y, 60);
  y = drawSectionHeader(doc, pageW, y, "Fabrication Details");
  const fabLeft: KV[] = [
    { label: "WO No", value: fmt(order.orderNo) },
    { label: "Date", value: fmtDate(order.date) },
    { label: "Panel Type", value: fmt(order.panelType) },
    { label: "Parts (BH)", value: fmt(order.parts) },
    { label: "Fabricator", value: fmt(c?.fabricatorName) },
    { label: "Completed", value: (c?.qualityCheckPassed ?? true) ? "Yes" : "No" },
  ];
  const fabRight: KV[] = [
    { label: "Designer", value: fmt(order.designerName ?? c?.executedBy) },
    { label: "Party Name", value: fmt(order.partyName) },
    { label: "Description", value: fmt(order.description) },
    { label: "Panel Qty", value: fmt(order.quantity) },
    { label: "Delivery Date", value: fmtDate(c?.deliveryDate) },
    { label: "Team Member", value: fmt(labels?.teamMember) },
  ];
  y = drawTwoColumnGrid(doc, pageW, y, fabLeft, fabRight) + 4;

  // Attached images (if any) go right after fabrication details — matches modal order.
  if (images.length > 0) {
    y = drawAttachedImages(doc, pageW, y, images) + 2;
  }

  // POWDER COATING — CHALLAN HEADER
  y = ensurePage(doc, pageW, y, 14);
  y = drawChallanBanner(doc, pageW, y);

  // POWDER COATING DETAILS
  y = ensurePage(doc, pageW, y, 70);
  y = drawSectionHeader(doc, pageW, y, "Powder Coating Details");
  const pcLeft: KV[] = [
    { label: "WO No", value: fmt(c?.woNo || order.orderNo) },
    { label: "D.C. No", value: fmt(c?.dcNo) },
    { label: "Color", value: fmt(c?.color) },
    { label: "Contractor", value: fmt(c?.contractorName) },
    { label: "Body Size", value: fmt(c?.bodySize) },
    { label: "Weight", value: fmt(c?.weight) },
  ];
  const pcRight: KV[] = [
    { label: "Customer", value: fmt(c?.customerName || order.partyName) },
    { label: "P.O. No", value: fmt(c?.poNo) },
    { label: "Panel Details", value: fmt(order.description || order.panelType) },
    { label: "Designer", value: fmt(c?.designerName || order.designerName) },
    { label: "Vehicle No", value: fmt(c?.vehicleNo) },
    { label: "PC Location", value: fmt(labels?.pcLocation) },
  ];
  y = drawTwoColumnGrid(doc, pageW, y, pcLeft, pcRight) + 4;

  // COLOR CODES (3 cells)
  y = ensurePage(doc, pageW, y, 22);
  y = drawSectionHeader(doc, pageW, y, "Color Code of Panel");
  y = drawThreeCellRow(doc, pageW, y, [
    { label: "Body", value: fmt(c?.colorBody || order.colorBody) },
    { label: "Mounting Plate", value: fmt(c?.colorMp || order.colorMountingPlate) },
    { label: "Base / Stand", value: fmt(c?.colorBase || order.colorBaseStand) },
  ]) + 4;

  // COATING TYPE
  y = ensurePage(doc, pageW, y, 22);
  y = drawSectionHeader(doc, pageW, y, "Powder Coating Type");
  y = drawAccessoriesGrid(
    doc,
    pageW,
    y,
    [{ label: "Single Coat", checked: !!c?.singleCoat }],
    [{ label: "Double Coat", checked: !!c?.doubleCoat }]
  ) + 4;

  // ACCESSORIES
  const acc = resolveAccessories(order, c);
  y = ensurePage(doc, pageW, y, 30);
  y = drawSectionHeader(doc, pageW, y, "Accessories");
  y = drawAccessoriesGrid(
    doc,
    pageW,
    y,
    [
      { label: "Point Lock", checked: !!acc.pointLock },
      { label: "PU Gasketing", checked: !!acc.puGasketing },
    ],
    [
      { label: "3 Point Lock", checked: !!acc.threePointLock },
      { label: "Patti Gasketing", checked: !!acc.pattiGasketing },
    ]
  );
  if (acc.other && String(acc.other).trim() !== "") {
    y = drawTwoColumnGrid(doc, pageW, y, [{ label: "Any Other", value: String(acc.other) }], []);
  }
  y += 4;

  // PART COUNTS
  const parts: KV[] = [
    { label: "Door", value: fmt(c?.doorQty) },
    { label: "Cover", value: fmt(c?.coverQty) },
    { label: "Glan Plate", value: fmt(c?.glanPlateQty) },
    { label: "Mounting Plate", value: fmt(c?.mountingPlateQty) },
    { label: "C-Channel", value: fmt(c?.cChannelQty) },
    { label: "L-Patta", value: fmt(c?.lPattaQty) },
    { label: "Ghodi", value: fmt(c?.ghodiQty) },
    { label: "J-Channel", value: fmt(c?.jChannelQty) },
    { label: "Basbar Cover", value: fmt(c?.basbarCoverQty) },
    { label: "Basbar Angle", value: fmt(c?.basbarAngleQty) },
    { label: "Canopy", value: fmt(c?.canopyQty) },
    { label: "Base", value: fmt(c?.baseQty) },
    { label: "Stand", value: fmt(c?.standQty) },
  ];
  const rowsEstimate = Math.ceil(parts.length / 4) * 10 + 14;
  y = ensurePage(doc, pageW, y, rowsEstimate);
  y = drawSectionHeader(doc, pageW, y, "Part Counts");
  y = drawPartCountsGrid(doc, pageW, y, parts) + 4;

  // FOOTER — remarks + signature
  y = ensurePage(doc, pageW, y, 32);
  const remarks = (c?.remarks ?? order.remarks ?? "").toString().trim();
  y = drawFooter(doc, pageW, y, remarks);
  return y + 6;
}

/* --------- Helpers specific to the Fabrication body (reusable) ----------- */

/** Centered "Challan for Powder Coating" banner (matches modal separator). */
function drawChallanBanner(doc: jsPDF, pageW: number, y: number): number {
  const m = PAGE.margin;
  const h = 11;
  doc.setDrawColor(...COLORS.sectionFillStart);
  doc.setLineWidth(0.5);
  doc.line(m, y, pageW - m, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.sectionFillStart);
  const title = "CHALLAN FOR POWDER COATING";
  const tw = doc.getTextWidth(title);
  doc.text(title, (pageW - tw) / 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.label);
  const sub = "Stage 4 — Powder Coating";
  const sw = doc.getTextWidth(sub);
  doc.text(sub, (pageW - sw) / 2, y + 10.5);
  return y + h + 2;
}

/** One row with three equal-width labeled cells (used for Body/MP/Base). */
function drawThreeCellRow(
  doc: jsPDF,
  pageW: number,
  y: number,
  cells: KV[]
): number {
  const m = PAGE.margin;
  const totalW = pageW - m * 2;
  const cellW = totalW / cells.length;
  const h = 14;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.rect(m, y, totalW, h);
  for (let i = 1; i < cells.length; i++) {
    doc.line(m + i * cellW, y, m + i * cellW, y + h);
  }
  cells.forEach((cell, i) => {
    const x = m + i * cellW + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.label);
    doc.text(cell.label, x, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.value);
    const maxW = cellW - 8;
    const valStr = cell.value ?? "—";
    const first = doc.splitTextToSize(valStr, maxW)[0] ?? valStr;
    doc.text(first, x, y + 11);
  });
  return y + h;
}

/* --------------------- Stage 5 — Dispatch Validation --------------------- */
/**
 * Body for the Dispatch Validation modal. Mirrors every field visible in the
 * modal — job card details, powder coating type, accessories, contractor +
 * designer, weight, full material quantities grid, coating / PC location,
 * body color code, vehicle no., and any attached images.
 *
 * Structurally very close to the fabrication body but with the dispatch-
 * specific field set (adds Capacitor Patta, Braker C Channel, Base/Stand,
 * Body Color Code, Coating Type, Vehicle No., …).
 */
function drawDispatchValidationBody(
  doc: jsPDF,
  pageW: number,
  y: number,
  order: Order,
  c: StageCompletionData | null,
  labels: StagePdfLabels | undefined,
  images: LoadedImage[]
): number {
  // JOB CARD DETAILS
  y = ensurePage(doc, pageW, y, 60);
  y = drawSectionHeader(doc, pageW, y, "Job Card Details (Dispatch Validation)");
  const jcLeft: KV[] = [
    { label: "WO No", value: fmt(c?.woNo || order.orderNo) },
    { label: "D.C. No", value: fmt(c?.dcNo) },
    { label: "Color", value: fmt(c?.color) },
    { label: "Contractor", value: fmt(c?.contractorName) },
    { label: "Weight", value: fmt(c?.weight) },
  ];
  const jcRight: KV[] = [
    { label: "Customer", value: fmt(c?.customerName || order.partyName) },
    { label: "P.O. No", value: fmt(c?.poNo) },
    { label: "Designer", value: fmt(c?.designerName || order.designerName) },
    { label: "Vehicle No", value: fmt(c?.vehicleNo) },
    { label: "Body Color Code", value: fmt(c?.bodyColorCode) },
  ];
  y = drawTwoColumnGrid(doc, pageW, y, jcLeft, jcRight) + 4;

  // Attachments sit near the top in the modal — mirror that here.
  if (images.length > 0) {
    y = drawAttachedImages(doc, pageW, y, images) + 2;
  }

  // COLOR CODES
  y = ensurePage(doc, pageW, y, 22);
  y = drawSectionHeader(doc, pageW, y, "Color Code of Panel");
  y = drawThreeCellRow(doc, pageW, y, [
    { label: "Body", value: fmt(c?.colorBody || order.colorBody) },
    { label: "Mounting Plate", value: fmt(c?.colorMp || order.colorMountingPlate) },
    { label: "Base / Stand", value: fmt(c?.colorBase || order.colorBaseStand) },
  ]) + 4;

  // COATING TYPE
  y = ensurePage(doc, pageW, y, 22);
  y = drawSectionHeader(doc, pageW, y, "Powder Coating Type");
  y = drawAccessoriesGrid(
    doc,
    pageW,
    y,
    [{ label: "Single Coat", checked: !!c?.singleCoat }],
    [{ label: "Double Coat", checked: !!c?.doubleCoat }]
  ) + 4;

  // ACCESSORIES
  const acc = resolveAccessories(order, c);
  y = ensurePage(doc, pageW, y, 30);
  y = drawSectionHeader(doc, pageW, y, "Accessories");
  y = drawAccessoriesGrid(
    doc,
    pageW,
    y,
    [
      { label: "Point Lock", checked: !!acc.pointLock },
      { label: "PU Gasketing", checked: !!acc.puGasketing },
    ],
    [
      { label: "3 Point Lock", checked: !!acc.threePointLock },
      { label: "Patti Gasketing", checked: !!acc.pattiGasketing },
    ]
  );
  if (acc.other && String(acc.other).trim() !== "") {
    y = drawTwoColumnGrid(doc, pageW, y, [{ label: "Any Other", value: String(acc.other) }], []);
  }
  y += 4;

  // MATERIAL QUANTITIES — Body Size header row + 16-item grid
  y = ensurePage(doc, pageW, y, 14);
  y = drawSectionHeader(doc, pageW, y, "Material Quantities");
  y = drawTwoColumnGrid(doc, pageW, y, [{ label: "Body Size", value: fmt(c?.bodySize) }], []) + 2;

  const parts: KV[] = [
    { label: "Door", value: fmt(c?.doorQty) },
    { label: "Cover", value: fmt(c?.coverQty) },
    { label: "Glan Plate", value: fmt(c?.glanPlateQty) },
    { label: "Mounting Plate", value: fmt(c?.mountingPlateQty) },
    { label: "C-Channel", value: fmt(c?.cChannelQty) },
    { label: "L-Patta", value: fmt(c?.lPattaQty) },
    { label: "Ghodi", value: fmt(c?.ghodiQty) },
    { label: "J-Channel", value: fmt(c?.jChannelQty) },
    { label: "Basbar Cover", value: fmt(c?.basbarCoverQty) },
    { label: "Basbar Angle", value: fmt(c?.basbarAngleQty) },
    { label: "Capacitor Patta", value: fmt(c?.capacitorPattaQty) },
    { label: "Braker C Channel", value: fmt(c?.brakerCChannelQty) },
    { label: "Canopy", value: fmt(c?.canopyQty) },
    { label: "Base", value: fmt(c?.baseQty) },
    { label: "Stand", value: fmt(c?.standQty) },
    { label: "Base / Stand", value: fmt(c?.baseStandQty) },
  ];
  const rowsEstimate = Math.ceil(parts.length / 4) * 11 + 6;
  y = ensurePage(doc, pageW, y, rowsEstimate);
  y = drawPartCountsGrid(doc, pageW, y, parts) + 4;

  // COATING TYPE / PC LOCATION + BODY COLOR CODE / VEHICLE NO.
  y = ensurePage(doc, pageW, y, 30);
  y = drawSectionHeader(doc, pageW, y, "Coating & Dispatch");
  y = drawTwoColumnGrid(
    doc,
    pageW,
    y,
    [
      { label: "Coating Type", value: fmt(labels?.coatingType) },
      { label: "Body Color Code", value: fmt(c?.bodyColorCode) },
    ],
    [
      { label: "PC Location", value: fmt(labels?.pcLocation) },
      { label: "Vehicle No.", value: fmt(c?.vehicleNo) },
    ]
  ) + 4;

  // FOOTER — remarks + signature
  y = ensurePage(doc, pageW, y, 32);
  const remarks = (c?.remarks ?? order.remarks ?? "").toString().trim();
  y = drawFooter(doc, pageW, y, remarks);
  return y + 6;
}

/** 4-column grid of labeled numeric counts (Door, Cover, …). */
function drawPartCountsGrid(
  doc: jsPDF,
  pageW: number,
  y: number,
  items: KV[]
): number {
  const m = PAGE.margin;
  const totalW = pageW - m * 2;
  const cols = 4;
  const cellW = totalW / cols;
  const rows = Math.ceil(items.length / cols);
  const rowH = 11;
  const gridH = rows * rowH;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.rect(m, y, totalW, gridH);
  for (let c = 1; c < cols; c++) {
    doc.line(m + c * cellW, y, m + c * cellW, y + gridH);
  }
  for (let r = 1; r < rows; r++) {
    doc.line(m, y + r * rowH, pageW - m, y + r * rowH);
  }
  items.forEach((it, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const x = m + c * cellW + 4;
    const yy = y + r * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.label);
    doc.text(it.label, x, yy + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.value);
    doc.text(String(it.value ?? "—"), x, yy + 9.5);
  });
  return y + gridH;
}

/** Fallback body for stages not yet redesigned. */
function drawGenericStageBody(
  doc: jsPDF,
  pageW: number,
  y: number,
  stageKey: string,
  stageLabel: string
): number {
  y = drawSectionHeader(doc, pageW, y, stageLabel);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 105);
  const msg = `A dedicated layout for "${stageLabel}" is coming soon. Only Stage 1 (Design) uses the new Job Card format for now.`;
  const m = PAGE.margin;
  const lines = doc.splitTextToSize(msg, pageW - m * 2 - 6);
  doc.text(lines, m + 3, y + 8);
  return y + 18 + lines.length * 4;
}

/* --------------------------------- Export -------------------------------- */

/**
 * Build and download the Job Card PDF for a stage.
 *
 * Asynchronous because stages that carry uploaded attachments (fabrication,
 * etc.) need to fetch the image bytes before handing them to jsPDF's
 * synchronous `addImage`. Stages without attachments resolve as fast as a
 * sync function.
 */
export async function exportStageCompletionPdf(
  input: ExportStagePdfInput
): Promise<void> {
  const { order, stageKey, stageLabel, completion, labels } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Preload any attachment images in parallel. Failed loads are filtered out
  // so the PDF still generates cleanly even if one presigned GET has expired.
  const attachments = completion?.attachments ?? [];
  const loadedImages: LoadedImage[] =
    attachments.length > 0
      ? (await Promise.all(attachments.map((a) => loadAttachmentImage(a)))).filter(
          (x): x is LoadedImage => x !== null
        )
      : [];

  // Header (logo + company + address + divider)
  let y = drawHeader(doc, pageW);

  // Centered Job Card title
  y = drawTitle(doc, pageW, y, "JOB CARD");

  // Info bar — shared across stages
  y = drawInfoBar(doc, pageW, y, [
    { label: "Job Card No", value: fmt(order.orderNo) },
    { label: "Completion Date", value: fmtDate(completion?.completedDate) },
    { label: "Executed By", value: fmt(completion?.executedBy ?? "System") },
  ]);

  // Stage-specific body
  if (stageKey === "design_preparation") {
    y = drawDesignStageBody(doc, pageW, y, order, completion ?? null);
  } else if (stageKey === "fabrication" || stageKey === "powder_coating") {
    // The combined Fabrication + Powder Coating modal owns both stageKeys;
    // either entry point produces the same consolidated Job Card.
    y = drawFabricationStageBody(
      doc,
      pageW,
      y,
      order,
      completion ?? null,
      labels,
      loadedImages
    );
  } else if (stageKey === "dispatch_validation") {
    y = drawDispatchValidationBody(
      doc,
      pageW,
      y,
      order,
      completion ?? null,
      labels,
      loadedImages
    );
  } else {
    y = drawGenericStageBody(doc, pageW, y, stageKey, stageLabel);
    // Still give these stages the standard footer + thanks so they look framed.
    y = drawFooter(doc, pageW, y, (completion?.remarks ?? "").toString().trim()) + 6;
  }

  // Thank-you line (ensure it fits on the current page)
  y = ensurePage(doc, pageW, y, 16);
  drawThanks(doc, pageW, y);

  const safe = String(order.orderNo || "order").replace(/[^\w.-]+/g, "_");
  doc.save(`NKTech_${stageKey}_${safe}.pdf`);
}

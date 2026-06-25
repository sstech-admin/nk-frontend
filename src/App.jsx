import React, { useEffect, useState, useCallback } from "react";
import { api, setToken, getToken, setOnUnauthorized } from "./api.js";
// Reference lists (BOM items, P.C. locations) come from the API (/api/meta), not static files.

/* ------------------------------------------------------------------ helpers */
const ALL_TABS = [
  ["dashboard", "Dashboard"], ["general", "General Info"],
  ["stage1", "Stage 01 · New Order"], ["stage2", "Stage 02 · Cutting/Bending"],
  ["stage3", "Stage 03 · Fabrication"], ["stage4", "Stage 04 · Dispatch to P.C."],
  ["stage5", "Stage 05 · Assembly & Dispatch"], ["reports", "Reports"], ["users", "Users"]
];
// Tabs each role may see
function tabsForUser(user) {
  if (!user) return [];
  if (user.role === "admin") return ALL_TABS;
  return ALL_TABS.filter(([id]) => id === "stage" + user.stage); // stage user: only their stage
}
const STATUS = { 2: ["Cutting", "st-cut"], 3: ["Fabrication", "st-fab"], 4: ["To P.C.", "st-pc"], 5: ["Assembly", "st-asm"], 6: ["Dispatched", "st-done"] };
const Badge = ({ stage }) => { const x = STATUS[stage] || ["New", "st-new"]; return <span className={"status " + x[1]}>{x[0]}</span>; };
const accLine = (o) => {
  const a = [];
  if (o.acc.point) a.push("POINT LOCK" + (o.acc.pointNote ? ` (${o.acc.pointNote})` : ""));
  if (o.acc.p3) a.push("3 POINT LOCK" + (o.acc.p3Note ? ` (${o.acc.p3Note})` : ""));
  if (o.acc.pu) a.push("PU GASKETING"); if (o.acc.patti) a.push("PATTI GASKETING");
  if (o.acc.other) a.push(o.acc.other);
  return a.join(", ") || "-";
};
// Split / box display helpers
const woNum = (o) => o.group || o.wo;                       // original WO number for display
const boxTag = (o) => (o.boxes > 1 ? ` · Box ${o.box}/${o.boxes}` : "");
const woTitle = (o) => `WO. NO. – ${woNum(o)}${boxTag(o)}`;

/* ---- stage timing / 3-day SLA (Stage 02 & 05) ---- */
const SLA_DAYS = 3;
const SLA_STAGES = [2, 5];
const stageEnteredAt = (o) => {
  const h = o.stageHistory;
  if (h && h.length) return new Date(h[h.length - 1].at);
  return o.updatedAt ? new Date(o.updatedAt) : (o.createdAt ? new Date(o.createdAt) : null);
};
const daysInCurrentStage = (o) => {
  const e = stageEnteredAt(o);
  return e ? Math.floor((Date.now() - e) / 86400000) : null;
};
const isOverdue = (o) => SLA_STAGES.includes(o.stage) && (daysInCurrentStage(o) ?? 0) > SLA_DAYS;

// client-side on-time/late for a completed (dispatched) order
const orderCompletion = (o) => o.stage === 6 ? new Date(o.dispatchedAt || o.updatedAt) : null;
const orderLateDays = (o) => {
  const c = orderCompletion(o); const ds = o.s3 && o.s3.deliveryDate;
  if (!c || !ds) return null;
  const d = new Date(ds + "T00:00:00"); if (isNaN(d)) return null;
  const cc = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((cc - dd) / 86400000);
};

/* collapsible section (collapsed by default) */
function Section({ id, label, color, count, openMap, setOpen, children }) {
  const open = !!openMap[id];
  return (
    <>
      <div className="sechead" onClick={() => setOpen(s => ({ ...s, [id]: !s[id] }))}>
        <span style={{ fontSize: 13, width: 14, color: "#5f6368" }}>{open ? "▼" : "▶"}</span>
        <span className="dot" style={{ background: color }} />
        {label} <span className="pill">{count}</span>
        <small className="hint" style={{ fontWeight: "normal" }}>{open ? "(click to hide)" : "(click to show)"}</small>
      </div>
      {open && <div className="sec-body">{children}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ split modal */
function splitEven(total, k) {
  const base = Math.floor(total / k);
  const arr = Array(k).fill(base);
  let rem = total - base * k;
  for (let i = 0; i < rem; i++) arr[i]++;
  return arr;
}
function SplitModal({ order, onClose, onDone }) {
  const total = order.qty;
  const [n, setN] = useState(2);
  // qtys are kept as strings so the user can freely type, clear, and edit each
  // box. We only parse to integers when validating / submitting.
  const [qtys, setQtys] = useState(() => splitEven(total, 2).map(String));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setCount = (k) => {
    k = Math.max(2, Math.min(total, parseInt(k, 10) || 2));
    setN(k); setQtys(splitEven(total, k).map(String));
  };
  const setQ = (i, v) => {
    // allow only digits (and empty) while typing — no coercion that fights the cursor
    if (!/^\d*$/.test(v)) return;
    setQtys(qs => qs.map((q, idx) => idx === i ? v : q));
  };
  const nums = qtys.map(q => parseInt(q, 10));
  const sum = nums.reduce((s, q) => s + (Number.isFinite(q) ? q : 0), 0);
  const valid = sum === total && nums.every(q => Number.isFinite(q) && q >= 1);
  const confirm = async () => {
    setErr(""); setBusy(true);
    try { await api.split(order.wo, nums); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="modal" onClick={e => { if (e.target.className === "modal") onClose(); }}>
      <div className="modal-inner" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <strong>Split WO {woNum(order)} — {total} panels</strong>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>Divide this order into boxes. Each box is made, tracked and delivered separately. All boxes start at the current stage.</p>
        <label>Number of boxes</label>
        <input type="number" min={2} max={total} value={n} onChange={e => setCount(e.target.value)} style={{ maxWidth: 130 }} />
        <div style={{ marginTop: 12 }}>
          {qtys.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 80, fontWeight: 500 }}>Box {i + 1}</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={q} onChange={e => setQ(i, e.target.value)} style={{ maxWidth: 120 }} />
              <span className="hint">panels</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontWeight: 600, color: valid ? "#1e8e3e" : "#d93025" }}>
          Total: {sum} / {total} {valid ? "✓" : `— must equal ${total}`}
        </div>
        {err && <div style={{ color: "#d93025", marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="act" style={{ marginLeft: 8 }} disabled={!valid || busy} onClick={confirm}>
            {busy ? "Splitting…" : `Split into ${n} boxes`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ challan */
function Challan({ o, type, patch, meta }) {
  const isPC = type === "pc";
  const edit = isPC ? o.stage === 4 : o.stage === 5;
  const s = isPC ? o.s4 : o.s5;
  const bomItems = (meta && meta.bomItems) || [];
  const pcLocations = (meta && meta.pcLocations) || [];
  const setBomItem = (i, v) => patch({ [`s4.bom.${i}.item`]: v });
  const setBomQty = (i, v) => patch({ [`s4.bom.${i}.qty`]: v });
  const setChk = (i, v) => patch({ [`s5.checks.${i}`]: v });

  const Inp = ({ path, val, type = "text" }) =>
    edit ? <input type={type} defaultValue={val || ""} onBlur={e => patch({ [path]: e.target.value })} />
         : <span>{val || "-"}</span>;

  const bomRows = o.s4.bom.map((b, i) => {
    const fixed = i < bomItems.length;
    const isBody = b.item === "BODY SIZE";   // row 1 — value auto-carried from the order size
    return (
      <tr key={i}>
        <td style={{ textAlign: "center" }}>{i + 1}</td>
        <td className={fixed ? "challan-blue" : ""}>
          {fixed ? b.item
            : <input defaultValue={b.item} placeholder="add material" onBlur={e => setBomItem(i, e.target.value)} />}
        </td>
        {isBody
          ? <td className="challan-blue"><b>{o.desc || "-"}</b></td>
          : <td className="challan-yellow">
              <input defaultValue={b.qty} style={{ width: 54 }} onBlur={e => setBomQty(i, e.target.value)} />
            </td>}
        {!isPC && <td style={{ textAlign: "center" }}>
          <input type="checkbox" checked={!!(o.s5.checks && o.s5.checks[i])} onChange={e => setChk(i, e.target.checked)} />
        </td>}
      </tr>
    );
  });

  const ck = (on, label) => <span><span style={{ fontSize: 18, verticalAlign: "middle" }}>{on ? "☑" : "☐"}</span> {label}</span>;

  /* right-hand info column */
  const info = isPC ? (
    <table style={{ height: "100%" }}>
      <tbody>
        <tr><td className="challan-yellow"><b>DATE:</b> <Inp path="s4.date" val={s.date} type="date" /></td>
            <td className="challan-yellow"><b>D.C. NO.:</b> <Inp path="s4.dcno" val={s.dcno || String(o.wo)} /></td></tr>
        <tr><td className="challan-blue"><b>WO NO.:</b> {woNum(o)}{boxTag(o)}</td><td className="challan-blue"><b>P.O. NO.:</b> {o.pono || "-"}</td></tr>
        <tr><td colSpan={2} className="challan-blue"><b>CUSTOMER NAME:</b> {o.party}</td></tr>
        <tr><td className="challan-blue"><b>GSTIN:</b> {o.gstNo || "-"}</td><td className="challan-blue"><b>GST:</b> {o.gstPct ?? 0}%</td></tr>
        <tr><td className="challan-blue"><b>PHONE:</b> {o.phone || "-"}</td><td className="challan-blue"><b>AREA:</b> {o.area || "-"}</td></tr>
        <tr><td className="challan-blue"><b>CONTRACTOR:</b> {o.s3.fabricator || "-"}</td><td className="challan-blue"><b>DESIGNER:</b> {o.designer}</td></tr>
        <tr><td colSpan={2} className="challan-yellow" style={{ textAlign: "center" }}><b>WEIGHT:</b> <Inp path="s4.weight" val={s.weight} type="number" /> {o.weightUnit || "KGS"}</td></tr>
        <tr className="head"><td colSpan={2}>COLOR CODE OF PANEL</td></tr>
        <tr><td className="challan-blue">BODY</td><td className="challan-blue">{o.cBody || "-"}</td></tr>
        <tr><td className="challan-blue">MOUNTING PLATE</td><td className="challan-blue">{o.cMP || "-"}</td></tr>
        <tr><td className="challan-blue">BASE / STAND</td><td className="challan-blue">{o.cBase || "-"}</td></tr>
        <tr className="head"><td colSpan={2}>POWDER COATING TYPE</td></tr>
        <tr><td colSpan={2} className="challan-blue">{ck(o.pcType === "Single Coat", "SINGLE COAT")} &nbsp;&nbsp;&nbsp; {ck(o.pcType === "Double Coat", "DOUBLE COAT")}</td></tr>
        <tr className="head"><td colSpan={2}>ACCESSORIES</td></tr>
        <tr><td colSpan={2} className="challan-blue">{ck(o.acc.point, "POINT LOCK")}{o.acc.pointNote ? ` (${o.acc.pointNote})` : ""} &nbsp; {ck(o.acc.p3, "3 POINT LOCK")}{o.acc.p3Note ? ` (${o.acc.p3Note})` : ""} &nbsp; {ck(o.acc.pu, "PU GASKETING")} &nbsp; {ck(o.acc.patti, "PATTI GASKETING")} &nbsp; ANY OTHER: {o.acc.other || "-"}</td></tr>
        <tr className="head"><td colSpan={2}>POWDER COATING LOCATION</td></tr>
        <tr><td colSpan={2} className="challan-yellow">{pcLocations.map(l => {
          const on = s.location === l;
          return <span key={l} style={{ marginRight: 14, cursor: edit ? "pointer" : "default", fontWeight: on ? "bold" : "normal" }}
            onClick={() => edit && patch({ "s4.location": l })}>
            <span style={{ fontSize: 18, verticalAlign: "middle" }}>{on ? "☑" : "☐"}</span> {l}</span>;
        })}</td></tr>
        <tr><td colSpan={2}><b>VEHICLE NO.:</b> <Inp path="s4.vehicle" val={s.vehicle} /></td></tr>
        <tr><td colSpan={2} className="challan-yellow"><b>REMARKS:</b> <Inp path="s4.remarks" val={s.remarks} /></td></tr>
      </tbody>
    </table>
  ) : (
    <table style={{ height: "100%" }}>
      <tbody>
        <tr><td className="challan-blue"><b>DATE:</b> {o.date}</td><td className="challan-blue"><b>D.C. NO.:</b> {o.wo}</td></tr>
        <tr><td className="challan-blue"><b>WO NO.:</b> {woNum(o)}{boxTag(o)}</td><td className="challan-blue"><b>P.O. NO.:</b> {o.pono || "-"}</td></tr>
        <tr><td colSpan={2} className="challan-blue"><b>CUSTOMER NAME:</b> {o.party}</td></tr>
        <tr><td className="challan-blue"><b>GSTIN:</b> {o.gstNo || "-"}</td><td className="challan-blue"><b>GST:</b> {o.gstPct ?? 0}%</td></tr>
        <tr><td className="challan-blue"><b>PHONE:</b> {o.phone || "-"}</td><td className="challan-blue"><b>AREA:</b> {o.area || "-"}</td></tr>
        <tr><td className="challan-blue"><b>CONTRACTOR:</b> {o.s3.fabricator || "-"}</td><td className="challan-blue"><b>DESIGNER:</b> {o.designer}</td></tr>
        <tr><td className="challan-yellow" style={{ textAlign: "center" }}><b>WEIGHT:</b> <Inp path="s5.weight" val={s.weight} type="number" /> {o.weightUnit || "KGS"}</td>
            <td className="challan-yellow"><b>GAADI NO.:</b> <Inp path="s5.gaadi" val={s.gaadi} /></td></tr>
        <tr className="head"><td colSpan={2}>COLOR CODE OF PANEL</td></tr>
        <tr><td className="challan-blue">BODY</td><td className="challan-blue">{o.cBody || "-"}</td></tr>
        <tr><td className="challan-blue">MOUNTING PLATE</td><td className="challan-blue">{o.cMP || "-"}</td></tr>
        <tr><td className="challan-blue">BASE / STAND</td><td className="challan-blue">{o.cBase || "-"}</td></tr>
        <tr className="head"><td colSpan={2}>ACCESSORIES</td></tr>
        <tr><td colSpan={2} className="challan-blue">{accLine(o)}</td></tr>
        <tr><td colSpan={2} className="challan-yellow"><b>ANY MATERIAL PENDING:</b> <Inp path="s5.pending" val={s.pending} /></td></tr>
        <tr><td colSpan={2} className="challan-yellow"><b>REMARKS:</b> <Inp path="s5.remarks" val={s.remarks} /></td></tr>
      </tbody>
    </table>
  );

  return (
    <div className="challan">
      <table><tbody>
        <tr className="head"><td>NK TECHNO CRAFT INDIA PVT. LTD.</td></tr>
        <tr className="head"><td>{isPC ? "CHALLAN FOR POWDER COATING" : "CHALLAN FOR DISPATCH"}</td></tr>
      </tbody></table>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: isPC ? "0 0 46%" : "0 0 50%", borderRight: "2px solid var(--line)" }}>
          <table style={{ height: "100%" }}><tbody>
            <tr className="head"><td colSpan={isPC ? 3 : 4}>PANEL DETAILS / B.O.M.</td></tr>
            <tr><th style={{ width: 30 }}>SR</th><th>MATERIAL DESCRIPTION</th><th style={{ width: 54 }}>QTY</th>{!isPC && <th style={{ width: 58 }}>CHECKED</th>}</tr>
            {bomRows}
          </tbody></table>
        </div>
        <div style={{ flex: 1 }}>{info}</div>
      </div>
      {!isPC && <div style={{ background: "var(--accent)", color: "#fff", textAlign: "center", padding: 8, fontWeight: 600 }}>OK</div>}
      {isPC && <table><tbody><tr><td style={{ fontSize: 11 }}>FILLED BY: IRFAN</td></tr></tbody></table>}
    </div>
  );
}

/* ------------------------------------------------------- admin edit order */
function EditOrderModal({ order, meta, onClose, onSaved }) {
  const [f, setF] = useState({
    date: order.date || "", designer: order.designer || "", party: order.party || "",
    panelType: order.panelType || "", pono: order.pono || "", qty: order.qty || 0,
    desc: order.desc || "", parts: order.parts || 0, custwo: order.custwo || "",
    pcType: order.pcType || "Single Coat", cBody: order.cBody || "", cMP: order.cMP || "",
    cBase: order.cBase || "", rate: order.rate || 0, remarks: order.remarks || "",
    gstNo: order.gstNo || "", gstPct: order.gstPct ?? 18, weightUnit: order.weightUnit || "KGS",
    phone: order.phone || "", area: order.area || ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = async () => {
    if (!f.party.trim()) { setErr("Party name is required"); return; }
    setBusy(true); setErr("");
    try {
      await api.patchOrder(order.wo, {
        date: f.date, designer: f.designer, party: f.party.trim(), panelType: f.panelType,
        pono: f.pono, qty: Number(f.qty) || 0, desc: f.desc, parts: Number(f.parts) || 0,
        custwo: f.custwo, pcType: f.pcType, cBody: f.cBody, cMP: f.cMP, cBase: f.cBase,
        rate: Number(f.rate) || 0, remarks: f.remarks,
        gstNo: f.gstNo, gstPct: Number(f.gstPct) || 0, weightUnit: f.weightUnit,
        phone: f.phone, area: f.area
      });
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const designers = (meta && meta.designers) || [];
  return (
    <div className="modal" onClick={e => { if (e.target.className === "modal") onClose(); }}>
      <div className="modal-inner" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <strong>Edit WO {woNum(order)}{boxTag(order)}</strong>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <div className="grid2">
          <div><label>Date</label><input type="date" value={f.date} onChange={e => set("date", e.target.value)} /></div>
          <div><label>Designer</label>
            <select value={f.designer} onChange={e => set("designer", e.target.value)}>
              <option value="">— select —</option>
              {designers.map(d => <option key={d}>{d}</option>)}
              {f.designer && !designers.includes(f.designer) && <option>{f.designer}</option>}
            </select></div>
          <div><label>Party Name *</label><input value={f.party} onChange={e => set("party", e.target.value)} /></div>
          <div><label>Panel Type</label><input value={f.panelType} onChange={e => set("panelType", e.target.value)} /></div>
          <div><label>Size (Description)</label><input value={f.desc} onChange={e => set("desc", e.target.value)} /></div>
          <div><label>Qty (panels)</label><input type="text" inputMode="numeric" value={f.qty} onChange={e => /^\d*$/.test(e.target.value) && set("qty", e.target.value)} /></div>
          <div><label>Parts (Bhag)</label><input type="text" inputMode="numeric" value={f.parts} onChange={e => /^\d*$/.test(e.target.value) && set("parts", e.target.value)} /></div>
          <div><label>P.O. No.</label><input value={f.pono} onChange={e => set("pono", e.target.value)} /></div>
          <div><label>Customer WO</label><input value={f.custwo} onChange={e => set("custwo", e.target.value)} /></div>
          <div><label>Powder Coating</label>
            <select value={f.pcType} onChange={e => set("pcType", e.target.value)}>
              <option>Single Coat</option><option>Double Coat</option>
            </select></div>
          <div><label>Body Colour</label><input value={f.cBody} onChange={e => set("cBody", e.target.value)} /></div>
          <div><label>Mounting Plate Colour</label><input value={f.cMP} onChange={e => set("cMP", e.target.value)} /></div>
          <div><label>Base Colour</label><input value={f.cBase} onChange={e => set("cBase", e.target.value)} /></div>
          <div><label>Rate</label><input type="text" inputMode="decimal" value={f.rate} onChange={e => set("rate", e.target.value)} /></div>
          <div><label>GST No. (GSTIN)</label><input value={f.gstNo} maxLength={15} onChange={e => set("gstNo", e.target.value.toUpperCase())} /></div>
          <div><label>GST %</label>
            <select value={f.gstPct} onChange={e => set("gstPct", e.target.value)}>
              {[0, 5, 12, 18, 28].map(p => <option key={p} value={p}>{p}%</option>)}
            </select></div>
          <div><label>Weight measured in</label>
            <select value={f.weightUnit} onChange={e => set("weightUnit", e.target.value)}>
              <option value="KGS">KGS</option><option value="Nos">Nos</option>
            </select></div>
          <div><label>Phone</label><input value={f.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div><label>Area</label><input value={f.area} onChange={e => set("area", e.target.value)} /></div>
        </div>
        <label>Remarks</label><input value={f.remarks} onChange={e => set("remarks", e.target.value)} />
        {err && <div style={{ color: "#d93025", marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="act" style={{ marginLeft: 8 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stages */
function Dashboard({ orders, isAdmin, meta, onEdit, onDelete }) {
  const total = orders.length;
  const c = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  orders.forEach(o => c[o.stage]++);
  const done6 = orders.filter(o => o.stage === 6);
  const kgs = done6.filter(o => (o.weightUnit || "KGS") !== "Nos").reduce((s, o) => s + (Number(o.s5.weight) || 0), 0);
  const nos = done6.filter(o => o.weightUnit === "Nos").reduce((s, o) => s + (Number(o.s5.weight) || 0), 0);
  return (
    <div className="view">
      <h2 className="title">Production Dashboard</h2>
      <div className="kpi">
        <div className="box"><div className="n">{total}</div><div className="l">Total Orders</div></div>
        <div className="box"><div className="n">{c[2] + c[3]}</div><div className="l">In Production</div></div>
        <div className="box"><div className="n">{c[4] + c[5]}</div><div className="l">Coating / Assembly</div></div>
        <div className="box"><div className="n" style={{ fontSize: 20 }}>{kgs.toLocaleString()} KGS{nos ? <> · {nos.toLocaleString()} Nos</> : ""}</div><div className="l">Dispatched</div></div>
      </div>
      <div className="card">
        <div className="toolbar"><strong>All Work Orders</strong><span className="pill">{total} orders</span></div>
        {total === 0 ? <div className="empty">No work orders yet. Use Stage 01 or load demo data.</div> :
          <table><thead><tr><th>WO</th><th>Date</th><th>Designer</th><th>Party</th><th>Panel</th><th>Size</th><th>Qty</th><th>Status</th>{isAdmin && <th>Order</th>}</tr></thead>
            <tbody>{orders.slice().reverse().map(o =>
              <tr key={o.wo}><td>{woNum(o)}{o.boxes > 1 ? ` ·B${o.box}/${o.boxes}` : ""}</td><td>{o.date}</td><td>{o.designer}</td><td>{o.party}</td><td>{o.panelType}</td><td>{o.desc}</td><td className="num">{o.qty}</td><td><Badge stage={o.stage} /></td>
                {isAdmin && <td style={{ whiteSpace: "nowrap" }}>
                  <button className="mini b-grey" style={{ marginRight: 6 }} onClick={() => onEdit(o)}>✎ Edit</button>
                  <button className="danger" onClick={() => onDelete(o)}>🗑 Delete</button>
                </td>}</tr>)}
            </tbody></table>}
      </div>
    </div>
  );
}

function General({ meta, orders, refresh }) {
  const [nd, setNd] = useState(""); const [nc, setNc] = useState(""); const [np, setNp] = useState("");
  const addD = async () => { if (!nd.trim()) return; try { await api.addDesigner(nd); setNd(""); refresh(); } catch (e) { alert(e.message); } };
  const addC = async () => { if (!nc.trim()) return; try { await api.addContractor(nc); setNc(""); refresh(); } catch (e) { alert(e.message); } };
  const addP = async () => { if (!np.trim()) return; try { await api.addPanelType(np); setNp(""); refresh(); } catch (e) { alert(e.message); } };
  const delD = async (n) => {
    const used = orders.filter(o => o.designer === n).length;
    if (!confirm(used ? `"${n}" is used on ${used} order(s). Remove from future dropdowns?` : `Delete designer "${n}"?`)) return;
    await api.delDesigner(n); refresh();
  };
  const delC = async (n) => {
    const used = orders.filter(o => o.s3 && o.s3.fabricator === n).length;
    if (!confirm(used ? `"${n}" is assigned on ${used} order(s). Remove from future dropdowns?` : `Delete contractor "${n}"?`)) return;
    await api.delContractor(n); refresh();
  };
  const delP = async (n) => {
    const used = orders.filter(o => (o.panelType || "").split(",").map(s => s.trim()).includes(n)).length;
    if (!confirm(used ? `"${n}" is used on ${used} order(s). Remove from future options?` : `Delete panel type "${n}"?`)) return;
    await api.delPanelType(n); refresh();
  };
  const panelTypes = meta.panelTypes || [];
  const parties = meta.parties || [];
  const [pf, setPf] = useState({ name: "", gstNo: "", gstPct: "18", phone: "", area: "" });
  const setP = (k, v) => setPf(s => ({ ...s, [k]: v }));
  const addParty = async () => {
    if (!pf.name.trim()) return alert("Party name is required.");
    try { await api.addParty({ ...pf, gstPct: Number(pf.gstPct) || 0 }); setPf({ name: "", gstNo: "", gstPct: "18", phone: "", area: "" }); refresh(); }
    catch (e) { alert(e.message); }
  };
  const delParty = async (n) => { if (confirm(`Delete party "${n}"?`)) { try { await api.delParty(n); refresh(); } catch (e) { alert(e.message); } } };
  return (
    <div className="view">
      <h2 className="title">General Information</h2>
      <div className="grid2">
        <div className="card">
          <div className="toolbar"><strong>Total Designers</strong><span className="pill">{meta.designers.length} designers</span></div>
          <table><thead><tr><th style={{ width: 40 }}>#</th><th>Designer</th><th style={{ width: 60 }}></th></tr></thead>
            <tbody>{meta.designers.map((d, i) =>
              <tr key={d}><td>{i + 1}</td><td>{d}</td><td style={{ textAlign: "center" }}><button className="danger" onClick={() => delD(d)}>Del</button></td></tr>)}
            </tbody></table>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input placeholder="New designer name" value={nd} onChange={e => setNd(e.target.value)} onKeyDown={e => e.key === "Enter" && addD()} />
            <button className="act" style={{ whiteSpace: "nowrap" }} onClick={addD}>＋ Add</button>
          </div>
        </div>
        <div className="card">
          <div className="toolbar"><strong>Total Contractor Teams</strong><span className="pill">{meta.contractors.length} teams</span></div>
          <table><thead><tr><th style={{ width: 40 }}>#</th><th>Contractor &amp; Team</th><th style={{ width: 60 }}></th></tr></thead>
            <tbody>{meta.contractors.map((c, i) =>
              <tr key={c}><td>{i + 1}</td><td>{c}</td><td style={{ textAlign: "center" }}><button className="danger" onClick={() => delC(c)}>Del</button></td></tr>)}
            </tbody></table>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input placeholder="New contractor & team" value={nc} onChange={e => setNc(e.target.value)} onKeyDown={e => e.key === "Enter" && addC()} />
            <button className="act" style={{ whiteSpace: "nowrap" }} onClick={addC}>＋ Add</button>
          </div>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="toolbar"><strong>Total Panel Types</strong><span className="pill">{panelTypes.length} types</span></div>
          <table><thead><tr><th style={{ width: 40 }}>#</th><th>Panel Type</th><th style={{ width: 60 }}></th></tr></thead>
            <tbody>{panelTypes.map((p, i) =>
              <tr key={p}><td>{i + 1}</td><td>{p}</td><td style={{ textAlign: "center" }}><button className="danger" onClick={() => delP(p)}>Del</button></td></tr>)}
            </tbody></table>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input placeholder="New panel type (e.g. HT PANEL)" value={np} onChange={e => setNp(e.target.value)} onKeyDown={e => e.key === "Enter" && addP()} />
            <button className="act" style={{ whiteSpace: "nowrap" }} onClick={addP}>＋ Add</button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>These appear as checkboxes on Stage 01 (an order can have several panel types).</div>
        </div>
        <div className="card">
          <div className="toolbar"><strong>Parties / Customers</strong><span className="pill">{parties.length}</span></div>
          <table className="stage-table"><thead><tr><th>Party</th><th>GSTIN</th><th>GST%</th><th>Phone</th><th>Area</th><th style={{ width: 50 }}></th></tr></thead>
            <tbody>{parties.map(p =>
              <tr key={p.name}>
                <td data-label="Party">{p.name}</td>
                <td data-label="GSTIN">{p.gstNo || "-"}</td>
                <td data-label="GST%">{(p.gstPct ?? 0)}%</td>
                <td data-label="Phone">{p.phone || "-"}</td>
                <td data-label="Area">{p.area || "-"}</td>
                <td data-label="" style={{ textAlign: "center" }}><button className="danger" onClick={() => delParty(p.name)}>Del</button></td>
              </tr>)}
            </tbody></table>
          <div className="grid2" style={{ gap: 8, marginTop: 8 }}>
            <div><label style={{ margin: "0 0 4px" }}>Party Name *</label><input value={pf.name} onChange={e => setP("name", e.target.value)} /></div>
            <div><label style={{ margin: "0 0 4px" }}>GST No. (GSTIN)</label><input value={pf.gstNo} maxLength={15} onChange={e => setP("gstNo", e.target.value.toUpperCase())} /></div>
            <div><label style={{ margin: "0 0 4px" }}>GST %</label>
              <select value={pf.gstPct} onChange={e => setP("gstPct", e.target.value)}>{[0, 5, 12, 18, 28].map(x => <option key={x} value={x}>{x}%</option>)}</select></div>
            <div><label style={{ margin: "0 0 4px" }}>Phone</label><input value={pf.phone} onChange={e => setP("phone", e.target.value)} /></div>
            <div><label style={{ margin: "0 0 4px" }}>Area</label><input value={pf.area} onChange={e => setP("area", e.target.value)} /></div>
            <div style={{ display: "flex", alignItems: "flex-end" }}><button className="act" style={{ width: "100%" }} onClick={addParty}>＋ Add Party</button></div>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>Selecting a party on Stage 01 auto-fills its GST, phone and area.</div>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10), designer: "", party: "", panelType: "",
  pono: "", qty: "", desc: "", parts: "", custwo: "", pcType: "Single Coat",
  cBody: "", cMP: "", cBase: "", acc: { point: false, p3: false, pu: false, patti: false, other: "", pointNote: "", p3Note: "" },
  rate: "", rIncl: true, rExtra: false, remarks: "",
  gstNo: "", gstPct: "18", weightUnit: "KGS", phone: "", area: ""
};
function StageOne({ meta, nextWO, onCreated }) {
  const [f, setF] = useState({ ...EMPTY_FORM, designer: meta.designers[0] || "" });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setAcc = (k, v) => setF(s => ({ ...s, acc: { ...s.acc, [k]: v } }));
  const parties = meta.parties || [];
  // selecting a party auto-fills GST, phone and area from the master record
  const pickParty = (name) => {
    const p = parties.find(x => x.name === name);
    setF(s => ({ ...s, party: name, gstNo: p ? p.gstNo : "", gstPct: p ? String(p.gstPct ?? 18) : s.gstPct, phone: p ? p.phone : "", area: p ? p.area : "" }));
  };
  const submit = async () => {
    if (!f.party.trim()) { alert("Party Name is required."); return; }
    try {
      const o = await api.createOrder(f);
      alert("Work Order " + o.wo + " created and sent to Stage 02.");
      setF({ ...EMPTY_FORM, designer: meta.designers[0] || "" });
      onCreated();
    } catch (e) { alert(e.message); }
  };
  return (
    <div className="view">
      <h2 className="title">Stage 01 — New Order</h2>
      <div className="handler">Prepared by Nishaar</div>
      <div className="card">
        <div className="grid2">
          <div>
            <label>WO No. <span className="auto-input" style={{ padding: "2px 8px", borderRadius: 6 }}>WO. NO. -- {nextWO}</span></label>
            <label>Date</label><input type="date" value={f.date} onChange={e => set("date", e.target.value)} />
            <label>Designer Name</label>
            <select value={f.designer} onChange={e => set("designer", e.target.value)}>{meta.designers.map(d => <option key={d}>{d}</option>)}</select>
            <label>Party Name</label>
            <select value={f.party} onChange={e => pickParty(e.target.value)}>
              <option value="">— select party —</option>
              {parties.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              {f.party && !parties.some(p => p.name === f.party) && <option value={f.party}>{f.party}</option>}
            </select>
            {parties.length === 0 && <div className="hint" style={{ margin: "4px 0 0" }}>No parties yet — add them in <b>General Info</b>.</div>}
            <label>Phone</label><input value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="auto-filled from party" />
            <label>Area</label><input value={f.area} onChange={e => set("area", e.target.value)} placeholder="auto-filled from party" />
            <label>Panel Type <small className="hint">(tick one or more)</small></label>
            {(() => {
              const types = meta.panelTypes || [];
              const sel = f.panelType ? f.panelType.split(",").map(s => s.trim()).filter(Boolean) : [];
              const toggle = (name, on) => {
                const arr = sel.filter(x => x !== name);
                if (on) arr.push(name);
                set("panelType", arr.join(", "));
              };
              if (!types.length) return <div className="hint" style={{ margin: "4px 0 10px" }}>No panel types yet — add them in <b>General Info</b>.</div>;
              return <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", margin: "4px 0 10px" }}>
                {types.map(t => <label key={t} className="chk" style={{ minWidth: 150 }}><input type="checkbox" checked={sel.includes(t)} onChange={e => toggle(t, e.target.checked)} /> {t}</label>)}
              </div>;
            })()}
            <label>P.O. No. (optional)</label><input value={f.pono} onChange={e => set("pono", e.target.value)} />
            <label>Qty</label><input type="number" value={f.qty} onChange={e => set("qty", e.target.value)} />
            <label>Description (size)</label><input value={f.desc} placeholder="3000X2000X550" onChange={e => set("desc", e.target.value)} />
            <label>Parts (Bhag)</label><input type="number" value={f.parts} onChange={e => set("parts", e.target.value)} />
            <label>Customer WO No. / Panel Name</label><input value={f.custwo} onChange={e => set("custwo", e.target.value)} />
          </div>
          <div>
            <fieldset><legend>Powder Coating Type</legend>
              <label className="chk"><input type="radio" name="pct" checked={f.pcType === "Single Coat"} onChange={() => set("pcType", "Single Coat")} /> Single Coat</label>
              <label className="chk"><input type="radio" name="pct" checked={f.pcType === "Double Coat"} onChange={() => set("pcType", "Double Coat")} /> Double Coat</label>
            </fieldset>
            <fieldset><legend>Color Code of Panel</legend>
              <label>Body</label><input value={f.cBody} placeholder="RAL-7035" onChange={e => set("cBody", e.target.value)} />
              <label>Mounting Plate</label><input value={f.cMP} placeholder="ORANGE / G.I." onChange={e => set("cMP", e.target.value)} />
              <label>Base / Stand</label><input value={f.cBase} placeholder="BLACK" onChange={e => set("cBase", e.target.value)} />
            </fieldset>
            <fieldset><legend>Accessories</legend>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label className="chk" style={{ minWidth: 130, margin: 0 }}><input type="checkbox" checked={f.acc.point} onChange={e => setAcc("point", e.target.checked)} /> Point Lock</label>
                <input value={f.acc.pointNote} placeholder="write here…" onChange={e => setAcc("pointNote", e.target.value)} style={{ flex: 1, margin: 0 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label className="chk" style={{ minWidth: 130, margin: 0 }}><input type="checkbox" checked={f.acc.p3} onChange={e => setAcc("p3", e.target.checked)} /> 3 Point Lock</label>
                <input value={f.acc.p3Note} placeholder="write here…" onChange={e => setAcc("p3Note", e.target.value)} style={{ flex: 1, margin: 0 }} />
              </div>
              <label className="chk"><input type="checkbox" checked={f.acc.pu} onChange={e => setAcc("pu", e.target.checked)} /> PU Gasketing</label>
              <label className="chk"><input type="checkbox" checked={f.acc.patti} onChange={e => setAcc("patti", e.target.checked)} /> Patti Gasketing</label>
              <label>Any Other</label><input value={f.acc.other} onChange={e => setAcc("other", e.target.value)} />
            </fieldset>
            <fieldset><legend>GST Details</legend>
              <label>GST No. (GSTIN)</label><input value={f.gstNo} placeholder="24ABCDE1234F1Z5" maxLength={15} onChange={e => set("gstNo", e.target.value.toUpperCase())} />
              <label>GST %</label>
              <select value={f.gstPct} onChange={e => set("gstPct", e.target.value)}>
                <option value="0">0% (Exempt)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </fieldset>
            <fieldset><legend>Rate &amp; Weight</legend>
              <label>Rate per {f.weightUnit === "Nos" ? "Unit" : "KGS"}</label><input type="number" value={f.rate} placeholder="125" onChange={e => set("rate", e.target.value)} />
              <label>Weight measured in</label>
              <div style={{ display: "flex", gap: 16, margin: "2px 0 8px" }}>
                <label className="chk"><input type="radio" name="wunit" checked={f.weightUnit === "KGS"} onChange={() => set("weightUnit", "KGS")} /> KGS</label>
                <label className="chk"><input type="radio" name="wunit" checked={f.weightUnit === "Nos"} onChange={() => set("weightUnit", "Nos")} /> Nos</label>
              </div>
              <label className="chk"><input type="checkbox" checked={f.rIncl} onChange={e => set("rIncl", e.target.checked)} /> Including Accessories</label>
              <label className="chk"><input type="checkbox" checked={f.rExtra} onChange={e => set("rExtra", e.target.checked)} /> Extra</label>
            </fieldset>
            <label>Remarks</label><textarea value={f.remarks} onChange={e => set("remarks", e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={() => setF({ ...EMPTY_FORM, designer: meta.designers[0] || "" })}>Reset</button>
          <button className="act" onClick={submit}>＋ Create Work Order → Stage 02</button>
        </div>
      </div>
    </div>
  );
}

/* read-only view of everything entered in Stage 01 — shown in every later stage */
function OrderInfo({ o }) {
  const rows = [
    ["Designer", o.designer], ["Party", o.party], ["Panel Type", o.panelType || "-"],
    ["Size", o.desc || "-"], ["Qty", o.qty], ["Parts (Bhag)", o.parts],
    ["P.O. No.", o.pono || "-"], ["Customer WO", o.custwo || "-"],
    ["Phone", o.phone || "-"], ["Area", o.area || "-"],
    ["Powder Coating", o.pcType], ["Body Colour", o.cBody || "-"],
    ["Mounting Plate", o.cMP || "-"], ["Base / Stand", o.cBase || "-"],
    ["Accessories", accLine(o)],
    ["Rate", `${o.rate || 0} / ${o.weightUnit === "Nos" ? "Unit" : "KGS"}${o.rIncl ? " · incl. acc." : ""}${o.rExtra ? " · extra" : ""}`],
    ["Weight in", o.weightUnit || "KGS"],
    ["GST No.", o.gstNo || "-"], ["GST %", (o.gstPct ?? 0) + "%"],
    ["Remarks", o.remarks || "-"]
  ];
  return (
    <div className="order-info">
      {rows.map(([k, v]) => <div key={k} className="oi-item"><span className="oi-k">{k}</span><span className="oi-v">{v}</span></div>)}
    </div>
  );
}

/* table-based stages 2 & 3 */
function TableStage({ title, handler, stageNo, orders, meta, patch, advance, openMap, setOpen, onSplit }) {
  const list = orders.filter(o => o.stage >= stageNo);
  const inc = list.filter(o => o.stage === stageNo);
  const done = list.filter(o => o.stage > stageNo);
  const okToggle = (o, which, checked) =>
    patch(o.wo, which === "ok" ? { [`s${stageNo}.ok`]: checked, [`s${stageNo}.notok`]: checked ? false : o[`s${stageNo}`].notok }
                              : { [`s${stageNo}.notok`]: checked, [`s${stageNo}.ok`]: checked ? false : o[`s${stageNo}`].ok });

  const colCount = stageNo === 3 ? 12 : 9;
  const row = (o) => {
    const s = o["s" + stageNo];
    const locked = o.stage > stageNo;
    const overdue = o.stage === stageNo && isOverdue(o);
    const infoKey = `info_${o.wo}`;
    const showInfo = !!openMap[infoKey];
    return (
      <React.Fragment key={o.wo}>
      <tr className={overdue ? "overdue-row" : ""}>
        <td data-label="WO No" style={{ whiteSpace: "nowrap" }}>WO. NO. – {woNum(o)}{boxTag(o)}{overdue && <span className="od-badge">⚠ {daysInCurrentStage(o)}d</span>}
          <button className="mini b-grey no-print" title="Show full order details" style={{ marginLeft: 6, padding: "1px 7px" }} onClick={() => setOpen(st => ({ ...st, [infoKey]: !st[infoKey] }))}>{showInfo ? "▾" : "ℹ"}</button>
        </td>
        <td data-label="Designer" className="auto-cell">{o.designer}</td>
        <td data-label="Date" className="auto-cell">{o.date}</td>
        <td data-label="Party" className="auto-cell">{o.party}</td>
        {stageNo === 3 && <td data-label="Panel Type" className="auto-cell">{o.panelType}</td>}
        <td data-label="Description" className="auto-cell">{o.desc}</td>
        {stageNo === 3 && <td data-label="Parts" className="auto-cell num">{o.parts}</td>}
        <td data-label="Panel Qty" className="auto-cell num">{o.qty}</td>
        {stageNo === 2 && <td data-label="Sheet Qty"><input defaultValue={s.sheetQty} style={{ width: 90 }} disabled={locked} onBlur={e => patch(o.wo, { "s2.sheetQty": e.target.value })} /></td>}
        {stageNo === 3 && <td data-label="Fabricator (Team)"><select defaultValue={s.fabricator} disabled={locked} onChange={e => patch(o.wo, { "s3.fabricator": e.target.value })}>
          <option value="">— select —</option>{meta.contractors.map(c => <option key={c}>{c}</option>)}</select></td>}
        {stageNo === 3 && <td data-label="Delivery Date"><input type="date" defaultValue={s.deliveryDate} style={{ width: 140 }} disabled={locked} onBlur={e => patch(o.wo, { "s3.deliveryDate": e.target.value })} /></td>}
        <td data-label="OK / Not-OK" style={{ whiteSpace: "nowrap" }}>
          <label className="chk" style={{ display: "inline-flex", marginRight: 10 }}><input type="checkbox" checked={!!s.ok} disabled={locked} onChange={e => okToggle(o, "ok", e.target.checked)} /> OK</label>
          <label className="chk" style={{ display: "inline-flex" }}><input type="checkbox" checked={!!s.notok} disabled={locked} onChange={e => okToggle(o, "notok", e.target.checked)} /> NOT OK</label>
        </td>
        <td data-label="Action" style={{ whiteSpace: "nowrap" }}>{o.stage === stageNo
          ? <>
              <button className="mini b-green" onClick={() => advance(o.wo, stageNo + 1)}>{stageNo === 2 ? "Send → Fabrication" : "Send → P.C."}</button>
              {o.qty > 1 && <button className="mini b-grey" style={{ marginLeft: 6 }} onClick={() => onSplit(o)}>✂ Split</button>}
            </>
          : <span className="status st-done">Done</span>}</td>
      </tr>
      {showInfo && <tr className="info-row"><td colSpan={colCount}><OrderInfo o={o} /></td></tr>}
      </React.Fragment>
    );
  };
  const head = (
    <thead><tr>
      <th>WO No</th><th>Designer</th><th>Date</th><th>Party</th>
      {stageNo === 3 && <th>Panel Type</th>}<th>Description</th>{stageNo === 3 && <th>Parts</th>}<th>Panel Qty</th>
      {stageNo === 2 ? <th>Sheet Qty <small className="hint">(opt)</small></th> : <th>Fabricator (Team)</th>}
      {stageNo === 3 && <th>Delivery Date</th>}
      <th>OK / Not-OK</th><th>Action</th>
    </tr></thead>
  );
  return (
    <div className="view">
      <h2 className="title">{title}</h2>
      <div className="handler">{handler}</div>
      {(!inc.length && !done.length) ? <div className="empty">No orders at this stage yet.</div> : <>
        <Section id={`s${stageNo}_inc`} label="⏳ Incomplete" color="#e08e0b" count={inc.length} openMap={openMap} setOpen={setOpen}>
          {inc.length ? <table className="stage-table">{head}<tbody>{inc.map(row)}</tbody></table> : <div className="empty">Nothing pending.</div>}
        </Section>
        <Section id={`s${stageNo}_done`} label="✔ Completed" color="#1e8e3e" count={done.length} openMap={openMap} setOpen={setOpen}>
          {done.length ? <table className="stage-table">{head}<tbody>{done.map(row)}</tbody></table> : <div className="empty">No completed orders.</div>}
        </Section>
      </>}
    </div>
  );
}

/* card-based stages 4 & 5 */
function CardStage({ which, orders, patch, advance, dispatch, openChallan, openMap, setOpen, meta, onSplit }) {
  const stageNo = which === 4 ? 4 : 5;
  const inc = orders.filter(o => o.stage === stageNo);
  const done = orders.filter(o => which === 4 ? o.stage > 4 : o.stage === 6);
  const okToggle = (o, w, checked) =>
    patch(o.wo, w === "ok" ? { "s5.ok": checked, "s5.notok": checked ? false : o.s5.notok }
                           : { "s5.notok": checked, "s5.ok": checked ? false : o.s5.ok });

  const incCard = (o) => {
    const cardId = `card_${o.wo}`;
    const cardOpen = !!openMap[cardId];
    const infoKey = `info_${o.wo}`;
    const infoOpen = !!openMap[infoKey];
    const toggle = () => setOpen(s => ({ ...s, [cardId]: !s[cardId] }));
    const toggleInfo = () => setOpen(s => ({ ...s, [infoKey]: !s[infoKey] }));
    const openBtn = (
      <button className="mini b-grey no-print" onClick={toggle}>
        {cardOpen ? "▾ Hide full challan" : "▸ Open full challan"}
      </button>
    );
    // compact one-line summary shown when collapsed
    const summary = (
      <div className="challan-blue" style={{ padding: "8px 10px", borderRadius: 6, fontSize: 12, marginBottom: cardOpen ? 12 : 0 }}>
        <b>{o.party}</b> &nbsp;·&nbsp; {o.panelType || "-"} &nbsp;·&nbsp; {o.desc || "-"} &nbsp;·&nbsp;
        <b>Qty {o.qty}</b> &nbsp;·&nbsp; Parts {o.parts}
        {which === 4 && o.s3.fabricator ? <> &nbsp;·&nbsp; {o.s3.fabricator}</> : null}
        {which === 5 ? <> &nbsp;·&nbsp; {o.s5.received ? "Received" : "Not received"}{o.s5.ok ? " · P.C. OK" : o.s5.notok ? " · P.C. NOT OK" : ""}</> : null}
      </div>
    );
    const overdue = isOverdue(o);
    return (
      <div className={overdue ? "card overdue-row" : "card"} key={o.wo}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <strong>{woTitle(o)} · {o.party}{overdue && <span className="od-badge">⚠ {daysInCurrentStage(o)}d in stage</span>}</strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="mini b-grey no-print" onClick={toggleInfo}>{infoOpen ? "▾ Hide details" : "ℹ Order details"}</button>
            {openBtn}
            <button className="mini b-blue no-print" onClick={() => openChallan(o, which === 4 ? "pc" : "dispatch")}>🖨 Print</button>
            {o.qty > 1 && <button className="mini b-grey no-print" onClick={() => onSplit(o)}>✂ Split</button>}
            {which === 4
              ? <button className="mini b-green no-print" onClick={() => advance(o.wo, 5)}>START → Assembly</button>
              : <button className="mini b-green no-print" onClick={() => dispatch(o.wo)}>OK → DISPATCH</button>}
          </div>
        </div>
        {summary}
        {infoOpen && <div style={{ margin: "10px 0" }}><OrderInfo o={o} /></div>}
        {cardOpen && (which === 4 ? (
          <>
            <table style={{ maxWidth: 430, margin: "0 0 14px" }}><tbody>
              <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>WO. NO. -- {woNum(o)}{boxTag(o)}</td></tr>
              <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>{o.s3.fabricator || o.designer}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600, width: 130 }}>PARTY NAME</td><td className="challan-blue">{o.party}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>PANEL TYPE</td><td className="challan-blue">{o.panelType}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>QTY</td><td className="challan-blue">{o.qty}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>DESCRIPTION</td><td className="challan-blue">{o.desc}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>PART (BHAG)</td><td className="challan-blue">{o.parts}</td></tr>
              <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600, padding: 8 }}>READY TO DISPATCH</td></tr>
            </tbody></table>
            <Challan o={o} type="pc" patch={(set) => patch(o.wo, set)} meta={meta} />
          </>
        ) : (
          <>
            <table style={{ maxWidth: 460, margin: "0 0 14px" }}><tbody>
              <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>WO. NO. -- {woNum(o)}{boxTag(o)}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600, width: 130 }}>PARTY NAME</td><td className="challan-blue">{o.party}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>PANEL TYPE</td><td className="challan-blue">{o.panelType}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>QTY</td><td className="challan-blue">{o.qty}</td></tr>
              <tr><td className="challan-blue" style={{ fontWeight: 600 }}>DESCRIPTION</td><td className="challan-blue">{o.desc}</td></tr>
              <tr><td colSpan={2} style={{ padding: 6 }}>
                <label className="chk" style={{ display: "inline-flex", marginRight: 14 }}><input type="checkbox" checked={!!o.s5.received} onChange={e => patch(o.wo, { "s5.received": e.target.checked })} /> RECEIVED</label>
                <label className="chk" style={{ display: "inline-flex", marginRight: 14 }}><input type="checkbox" checked={!!o.s5.ok} onChange={e => okToggle(o, "ok", e.target.checked)} /> P.C. OK</label>
                <label className="chk" style={{ display: "inline-flex" }}><input type="checkbox" checked={!!o.s5.notok} onChange={e => okToggle(o, "notok", e.target.checked)} /> P.C. NOT OK</label>
              </td></tr>
              <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600, padding: 8 }}>ASSEMBLY (READY TO DISPATCH)</td></tr>
            </tbody></table>
            <Challan o={o} type="dispatch" patch={(set) => patch(o.wo, set)} meta={meta} />
          </>
        ))}
      </div>
    );
  };

  const doneCard = (o) => (
    <div className="card" key={o.wo}>
      <div style={{ background: "var(--accent)", color: "#fff", textAlign: "center", padding: 6, fontWeight: 600, borderRadius: 4 }}>{woTitle(o)}</div>
      <table style={{ margin: "8px 0" }}><tbody>
        <tr><td className="auto-cell">Party</td><td className="auto-cell">{o.party}</td></tr>
        <tr><td className="auto-cell">Panel</td><td className="auto-cell">{o.panelType}</td></tr>
        {which === 4
          ? <><tr><td className="auto-cell">P.C. Location</td><td className="auto-cell">{o.s4.location || "-"}</td></tr>
              <tr><td className="auto-cell">Weight</td><td className="auto-cell">{o.s4.weight || "-"} {o.weightUnit || "KGS"}</td></tr></>
          : <><tr><td className="auto-cell">Final Weight</td><td className="auto-cell">{o.s5.weight || "-"} {o.weightUnit || "KGS"}</td></tr>
              <tr><td className="auto-cell">Gaadi No.</td><td className="auto-cell">{o.s5.gaadi || "-"}</td></tr></>}
      </tbody></table>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="mini b-blue" onClick={() => openChallan(o, which === 4 ? "pc" : "dispatch")}>📄 Challan</button>
        <span className="status st-done">{which === 4 ? "Dispatched to P.C." : "✔ DISPATCHED"}</span>
      </div>
    </div>
  );

  const titles = which === 4
    ? ["Stage 04 — Dispatch to Powder Coating", "Handled by Irfan"]
    : ["Stage 05 — Assembly & Dispatch", "Handled by Kalpesh Joshi"];
  return (
    <div className="view">
      <h2 className="title">{titles[0]}</h2>
      <div className="handler">{titles[1]}</div>
      {(!inc.length && !done.length) ? <div className="empty">No orders at this stage yet.</div> : <>
        <Section id={`s${stageNo}_inc`} label="⏳ Incomplete" color="#e08e0b" count={inc.length} openMap={openMap} setOpen={setOpen}>
          {inc.length ? inc.map(incCard) : <div className="empty">Nothing pending.</div>}
        </Section>
        <Section id={`s${stageNo}_done`} label="✔ Completed" color="#1e8e3e" count={done.length} openMap={openMap} setOpen={setOpen}>
          {done.length ? <div className="grid3">{done.map(doneCard)}</div> : <div className="empty">No completed orders.</div>}
        </Section>
      </>}
    </div>
  );
}

function monthRange(offset = 0) {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear(), m = d.getMonth();
  const p = (x) => String(x).padStart(2, "0");
  return { from: `${y}-${p(m + 1)}-01`, to: `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}` };
}

function Reports({ orders = [], meta = {} }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [q, setQ] = useState(""); // search term
  const [searchBy, setSearchBy] = useState("all"); // all | designer | operator | party | gst
  const load = useCallback(() => {
    setLoading(true);
    api.reports({ from, to }).then(setData).catch(e => alert(e.message)).finally(() => setLoading(false));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const preset = (which) => {
    if (which === "all") { setFrom(""); setTo(""); }
    else if (which === "thisMonth") { const r = monthRange(0); setFrom(r.from); setTo(r.to); }
    else if (which === "lastMonth") { const r = monthRange(-1); setFrom(r.from); setTo(r.to); }
    else if (which === "thisYear") { const y = new Date().getFullYear(); setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
  };

  const rangeLabel = from || to ? `${from || "start"}  →  ${to || "today"}` : "All time";
  const fileTag = from || to ? `${from || "start"}_to_${to || "today"}` : "all-time";

  const exportExcel = async () => {
    if (!data) return;
    let XLSX = window.XLSX;
    if (!XLSX) {
      try {
        XLSX = await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
          s.onload = () => resolve(window.XLSX);
          s.onerror = () => reject(new Error("load failed"));
          document.head.appendChild(s);
        });
      } catch { alert("Excel export needs an internet connection (it loads the SheetJS library). The PDF / Print export works offline."); return; }
    }
    if (!XLSX) { alert("Could not load the Excel library. Use PDF / Print instead."); return; }
    const c = data.company;
    const st = data.stageTiming || {};
    const wb = XLSX.utils.book_new();
    const aoa = (a) => XLSX.utils.aoa_to_sheet(a);
    const add = (a, name) => XLSX.utils.book_append_sheet(wb, aoa(a), name.slice(0, 31));

    // ---- when a search is active, export ONLY the filtered person/party/GST ----
    if (matched) {
      const cs = completedStats();
      add([
        ["NK TECHNO CRAFT INDIA PVT. LTD."],
        ["Filtered report — " + (searchBy === "all" ? "match" : searchBy) + ": " + q],
        ["Date range", rangeLabel],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Currently running", running.length, sumPanels(running) + " panels"],
        ["Completed", completed.length, sumPanels(completed) + " panels"],
        ["Total orders", matched.length, sumPanels(matched) + " panels"],
        [],
        ["Completed — on time", cs.onTime],
        ["Completed — late", cs.late],
        ["Completed — no delivery date", cs.noDate],
        ["On-time %", cs.withDate ? Math.round(cs.onTime / cs.withDate * 100) : "—"],
        ["Avg late days", cs.avgLate]
      ], "Summary");
      add([["WO", "Stage", "Party", "Designer", "Contractor", "Qty", "Days in stage"],
        ...running.slice().sort((a, b) => a.stage - b.stage).map(o => [woNum(o) + boxTag(o), (STAGE_NAMES[o.stage] || "Stage " + o.stage).replace(/Stage 0\d · /, ""), o.party, o.designer, (o.s3 && o.s3.fabricator) || "", o.qty, daysInCurrentStage(o)])], "In Progress");
      add([["WO", "Party", "Designer", "Contractor", "Qty", "Delivery", "Completed", "Status", "Late days"],
        ...completed.slice().sort((a, b) => a.wo - b.wo).map(o => { const ld = orderLateDays(o), cp = orderCompletion(o); return [woNum(o) + boxTag(o), o.party, o.designer, (o.s3 && o.s3.fabricator) || "", o.qty, (o.s3 && o.s3.deliveryDate) || "", cp ? cp.toISOString().slice(0, 10) : "", ld === null ? "No target" : ld > 0 ? "Late" : "On time", ld === null ? "" : Math.max(0, ld)]; })], "Completed");
      XLSX.writeFile(wb, `NK-Report_${(q || "search").replace(/[^\w]+/g, "-")}_${fileTag}.xlsx`);
      return;
    }
    add([
      ["NK TECHNO CRAFT INDIA PVT. LTD."],
      ["Production Report"],
      ["Date range", rangeLabel],
      ["Generated", new Date().toLocaleString()],
      [],
      ["COMPANY OVERVIEW"],
      ["Total orders", c.orders + coRunning.length],
      ["Total panels", c.panels + coRunningPanels],
      ["In progress (orders)", coRunning.length],
      ["In progress (panels)", coRunningPanels],
      ["  · Cutting (S2)", coRunningByStage[2] || 0],
      ["  · Fabrication (S3)", coRunningByStage[3] || 0],
      ["  · Dispatch to P.C. (S4)", coRunningByStage[4] || 0],
      ["  · Assembly (S5)", coRunningByStage[5] || 0],
      [],
      ["COMPLETED (DISPATCHED)"],
      ["Orders done", c.orders],
      ["Panels done", c.panels],
      ["On time", c.onTime],
      ["Late", c.late],
      ["No target date", c.noTarget],
      ["On-time %", c.onTimePct === null ? "—" : c.onTimePct],
      ["Avg late (days)", c.avgLateDays],
      ["Max late (days)", c.maxLateDays],
      ["Stage 02 over 3 days", c.s2Over3 ?? 0],
      ["Stage 05 over 3 days", c.s5Over3 ?? 0],
      ["Total dispatch (KGS)", c.totalKgs],
      ["Total dispatch (Nos)", c.totalNos ?? 0],
      [],
      ["AVG DAYS PER STAGE"],
      ["Stage 02 (Cutting)", st.avgS2 ?? "—"],
      ["Stage 03 (Fabrication)", st.avgS3 ?? "—"],
      ["Stage 04 (Dispatch P.C.)", st.avgS4 ?? "—"],
      ["Stage 05 (Assembly)", st.avgS5 ?? "—"],
      ["Total lead time", st.avgLead ?? "—"]
    ], "Summary");
    add([["Designer", "Orders", "Panels"], ...data.designerWork.map(r => [r.name, r.orders, r.panels])], "Designer Work");
    add([["Contractor", "Orders", "Panels"], ...data.contractorWork.map(r => [r.name, r.orders, r.panels])], "Contractor Work");
    const timing = (rows) => [["Name", "Orders", "On time", "Late", "On-time %", "Avg late days", "Max late days"],
      ...rows.map(r => [r.name, r.orders, r.onTime, r.late, r.onTimePct === null ? "—" : r.onTimePct, r.avgLateDays, r.maxLateDays])];
    add(timing(data.designerTiming), "Designer Timing");
    add(timing(data.contractorTiming), "Contractor Timing");
    add([["WO", "Box", "Designer", "Contractor", "Party", "Panels", "Delivery date", "Completed date", "Late days", "Status", "S2 days", "S5 days", "S2 >3d", "S5 >3d", "Lead days"],
      ...data.detail.map(d => [d.wo, d.box, d.designer, d.contractor, d.party, d.panels, d.deliveryDate, d.completedDate, d.lateDays, d.status, d.s2Days, d.s5Days, d.s2Late ? "YES" : "", d.s5Late ? "YES" : "", d.leadDays])], "Completed Orders");
    add([["WO", "Stage", "Party", "Designer", "Contractor", "Qty", "Days in stage", "Over 3 days?"],
      ...coRunning.slice().sort((a, b) => a.stage - b.stage).map(o => [woNum(o) + boxTag(o), (STAGE_NAMES[o.stage] || "Stage " + o.stage).replace(/Stage 0\d · /, ""), o.party, o.designer, (o.s3 && o.s3.fabricator) || "", o.qty, daysInCurrentStage(o), isOverdue(o) ? "YES" : ""])], "In Progress");
    XLSX.writeFile(wb, `NK-Report_${fileTag}.xlsx`);
  };

  const Tbl = ({ head, rows, aligns }) => rows.length
    ? <table><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((cl, j) => <td key={j} className={(aligns ? aligns[j] : (j ? "num" : ""))}>{cl}</td>)}</tr>)}</tbody></table>
    : <div className="empty">No completed work in this range.</div>;

  const pct = (v) => v === null ? "—" : v + "%";
  const c = data && data.company;
  const st = (data && data.stageTiming) || {};

  // merge "work done" + "on-time/late" into one row per person
  const mergePeople = (work, timing) => {
    const m = {};
    (work || []).forEach(w => { m[w.name] = { name: w.name, orders: w.orders, panels: w.panels, onTime: 0, late: 0, noTarget: 0, onTimePct: null, avgLateDays: 0 }; });
    (timing || []).forEach(t => { m[t.name] = { ...(m[t.name] || { name: t.name, orders: t.orders, panels: 0 }), onTime: t.onTime, late: t.late, noTarget: t.noTarget, onTimePct: t.onTimePct, avgLateDays: t.avgLateDays }; });
    return Object.values(m).sort((a, b) => b.panels - a.panels);
  };
  const designers = data ? mergePeople(data.designerWork, data.designerTiming) : [];
  const contractors = data ? mergePeople(data.contractorWork, data.contractorTiming) : [];
  const maxPanels = Math.max(1, ...designers.map(d => d.panels), ...contractors.map(d => d.panels));

  // ---- universal search across ALL orders (incomplete + completed) ----
  const nq = q.trim().toLowerCase();
  const fieldVal = (o, field) => {
    if (field === "designer") return o.designer || "";
    if (field === "operator") return (o.s3 && o.s3.fabricator) || "";
    if (field === "party") return o.party || "";
    if (field === "gst") return o.gstNo || "";
    return [o.designer, o.s3 && o.s3.fabricator, o.party, o.gstNo].filter(Boolean).join(" ");
  };
  // datalist suggestions — use the master lists (General Info) for designers &
  // contractors so EVERY name shows, even those with no orders yet; party & GST
  // are pulled from existing orders.
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  const ordParties = uniq(orders.map(o => o.party));
  const ordGst = uniq(orders.map(o => o.gstNo));
  const allDesigners = meta.designers || [];
  const allContractors = meta.contractors || [];
  const suggestions =
    searchBy === "designer" ? uniq(allDesigners) :
    searchBy === "operator" ? uniq(allContractors) :
    searchBy === "party" ? ordParties :
    searchBy === "gst" ? ordGst :
    uniq([...allDesigners, ...allContractors, ...ordParties, ...ordGst]);
  // date range applies to the search too: completed → dispatch date, running → order date
  const fromT = from ? new Date(from + "T00:00:00").getTime() : null;
  const toT = to ? new Date(to + "T23:59:59.999").getTime() : null;
  const repDate = (o) => o.stage === 6 ? orderCompletion(o) : (o.date ? new Date(o.date + "T12:00:00") : null);
  const inRange = (o) => {
    if (fromT == null && toT == null) return true;
    const d = repDate(o); if (!d || isNaN(d)) return false;
    const t = d.getTime();
    if (fromT != null && t < fromT) return false;
    if (toT != null && t > toT) return false;
    return true;
  };
  const matched = nq ? orders.filter(o => fieldVal(o, searchBy).toLowerCase().includes(nq) && inRange(o)) : null;
  const running = matched ? matched.filter(o => o.stage < 6) : [];
  const completed = matched ? matched.filter(o => o.stage === 6) : [];
  const sumPanels = (arr) => arr.reduce((s, o) => s + (o.qty || 0), 0);
  const completedStats = () => {
    let onTime = 0, late = 0, noDate = 0, totalLate = 0, maxLate = 0;
    completed.forEach(o => {
      const ld = orderLateDays(o);
      if (ld === null) noDate++;
      else if (ld > 0) { late++; totalLate += ld; if (ld > maxLate) maxLate = ld; }
      else onTime++;
    });
    return { onTime, late, noDate, avgLate: late ? Math.round(totalLate / late * 10) / 10 : 0, maxLate, withDate: onTime + late };
  };

  // COMPANY-wide in-progress (running) orders in the date range (by order date)
  const coRunning = orders.filter(o => o.stage >= 2 && o.stage < 6 && inRange(o));
  const coRunningPanels = sumPanels(coRunning);
  const coRunningByStage = { 2: 0, 3: 0, 4: 0, 5: 0 };
  coRunning.forEach(o => { coRunningByStage[o.stage] = (coRunningByStage[o.stage] || 0) + 1; });

  // a person panel: name, panel bar, and on-time/late split bar
  const PeopleCard = ({ title, who, people, unitNote }) => (
    <div className="card">
      <div className="rep-h">{title}</div>
      {people.length === 0 ? <div className="empty">No completed work in this range.</div> :
        people.map(p => {
          const done = p.onTime + p.late;
          const onPct = done ? Math.round(p.onTime / done * 100) : null;
          return (
            <div key={p.name} className="person">
              <div className="person-top">
                <span className="person-name">{p.name}</span>
                <span className="person-meta">{p.panels} panels · {p.orders} {p.orders === 1 ? "order" : "orders"}</span>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: (p.panels / maxPanels * 100) + "%" }} /></div>
              <div className="person-timing">
                {done > 0 ? <>
                  <div className="split" title={`${p.onTime} on time, ${p.late} late`}>
                    <div className="split-on" style={{ width: onPct + "%" }} />
                    <div className="split-late" style={{ width: (100 - onPct) + "%" }} />
                  </div>
                  <span className={"timing-tag " + (onPct === 100 ? "good" : onPct >= 70 ? "ok" : "bad")}>
                    {onPct}% on time
                  </span>
                  {p.late > 0 && <span className="late-note">{p.late} late · avg {p.avgLateDays}d</span>}
                </> : <span className="hint">No delivery date set — on-time not measured</span>}
              </div>
            </div>
          );
        })}
      <div className="hint" style={{ marginTop: 4 }}>{unitNote}</div>
    </div>
  );

  // stage speed bars
  const stageRows = [
    ["Stage 02 · Cutting", st.avgS2], ["Stage 03 · Fabrication", st.avgS3],
    ["Stage 04 · Dispatch to P.C.", st.avgS4], ["Stage 05 · Assembly", st.avgS5]
  ];
  const maxStage = Math.max(1, ...stageRows.map(r => r[1] || 0));

  return (
    <div className="view">
      <h2 className="title">Reports</h2>
      <div className="handler">Company work for the dates you pick: <b>completed</b> (dispatched) and <b>in&nbsp;progress</b>. “Late” means it shipped after the promised delivery date set in Stage&nbsp;03. Completed orders are dated by dispatch; in-progress by order date.</div>

      <div className="toolbar no-print" style={{ flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <label style={{ display: "inline" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: "auto", display: "inline-block", background: "#fff" }} />
          <label style={{ display: "inline" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: "auto", display: "inline-block", background: "#fff" }} />
          <button className="ghost" onClick={() => preset("thisMonth")}>This month</button>
          <button className="ghost" onClick={() => preset("lastMonth")}>Last month</button>
          <button className="ghost" onClick={() => preset("thisYear")}>This year</button>
          <button className="ghost" onClick={() => preset("all")}>All time</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="act" onClick={exportExcel}>⬇ Excel</button>
          <button className="ghost" onClick={() => { setShowDetail(true); setTimeout(() => window.print(), 150); }}>🖨 PDF / Print</button>
        </div>
      </div>

      <div className="toolbar no-print" style={{ gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <label style={{ display: "inline" }}>🔍 Search by</label>
          <select value={searchBy} onChange={e => setSearchBy(e.target.value)} style={{ width: "auto", display: "inline-block", background: "#fff" }}>
            <option value="all">Anything</option>
            <option value="designer">Designer</option>
            <option value="operator">Operator / Contractor</option>
            <option value="party">Party name</option>
            <option value="gst">GST No.</option>
          </select>
          <input list="rep-search" value={q} onChange={e => setQ(e.target.value)} placeholder={searchBy === "gst" ? "type GST no…" : searchBy === "party" ? "type party name…" : "type a name…"} style={{ width: 240, display: "inline-block", background: "#fff" }} />
          <datalist id="rep-search">{suggestions.map(n => <option key={n} value={n} />)}</datalist>
          {q && <button className="ghost" onClick={() => setQ("")}>✕ Clear</button>}
        </div>
      </div>

      <div className="rep-range">Showing: <b>{rangeLabel}</b>{nq ? <> · filtered to “<b>{q}</b>”</> : null}</div>

      {loading && <div className="empty">Loading…</div>}

      {/* focused search — running + completed for a designer / operator / party / GST */}
      {!loading && matched && (() => {
        if (!matched.length) return <div className="empty">No orders found for “{q}” in <b>{rangeLabel}</b>. Widen the dates (try “All time”), change the “Search by” field, or check the spelling.</div>;
        const cs = completedStats();
        const stShort = (o) => (STAGE_NAMES[o.stage] || "Stage " + o.stage).replace(/Stage 0\d · /, "");
        // show GSTIN when a single party/gst is in focus
        const gstSet = [...new Set(matched.map(o => o.gstNo).filter(Boolean))];
        return <>
          <div className="rep-hero">
            <div className="hero-item"><div className="hero-n" style={{ color: "#e08e0b" }}>{running.length}</div><div className="hero-l">Currently running</div><div className="hero-sub">{sumPanels(running)} panels in progress</div></div>
            <div className="hero-divider" />
            <div className="hero-item"><div className="hero-n" style={{ color: "#1e8e3e" }}>{completed.length}</div><div className="hero-l">Completed</div><div className="hero-sub">{sumPanels(completed)} panels dispatched</div></div>
            <div className="hero-divider" />
            <div className="hero-item"><div className="hero-n">{matched.length}</div><div className="hero-l">Total orders</div><div className="hero-sub">{sumPanels(matched)} panels total</div></div>
          </div>

          {(completed.length > 0 || gstSet.length > 0) && <div className="rep-sla good" style={{ background: "#f1eefb", border: "1px solid #d9d2f0", color: "#3a2f6b" }}>
            {gstSet.length === 1 && <><b>GSTIN:</b> {gstSet[0]} &nbsp;·&nbsp; </>}
            {completed.length > 0
              ? <><b>{cs.onTime}</b> on time · <b style={{ color: "#d93025" }}>{cs.late}</b> late{cs.noDate ? ` · ${cs.noDate} no date` : ""}{cs.withDate ? ` · ${Math.round(cs.onTime / cs.withDate * 100)}% on-time` : ""}{cs.late ? ` · avg ${cs.avgLate}d late` : ""}</>
              : "No completed orders yet."}
          </div>}

          <div className="card">
            <div className="rep-h">⏳ Currently running ({running.length})</div>
            {running.length ? <Tbl
              head={["WO", "Stage", "Party", "Designer", "Contractor", "Qty", "Days in stage"]}
              aligns={["", "", "", "", "", "num", "num"]}
              rows={running.slice().sort((a, b) => a.stage - b.stage).map(o => {
                const od = isOverdue(o), d = daysInCurrentStage(o);
                return [woNum(o) + boxTag(o), stShort(o), o.party, o.designer, (o.s3 && o.s3.fabricator) || "—", o.qty,
                  <span key="d" style={{ color: od ? "#d93025" : undefined, fontWeight: od ? 700 : 400 }}>{d == null ? "—" : d + "d"}{od ? " ⚠" : ""}</span>];
              })} /> : <div className="empty">Nothing in progress.</div>}
          </div>

          <div className="card">
            <div className="rep-h">✔ Completed ({completed.length})</div>
            {completed.length ? <Tbl
              head={["WO", "Party", "Designer", "Contractor", "Qty", "Delivery", "Completed", "Status"]}
              aligns={["", "", "", "", "num", "", "", ""]}
              rows={completed.slice().sort((a, b) => a.wo - b.wo).map(o => {
                const ld = orderLateDays(o), comp = orderCompletion(o);
                const status = ld === null ? "No target date" : ld > 0 ? `Late (${ld}d)` : "On time";
                const col = ld === null ? "var(--muted)" : ld > 0 ? "#d93025" : "#1e8e3e";
                return [woNum(o) + boxTag(o), o.party, o.designer, (o.s3 && o.s3.fabricator) || "—", o.qty, (o.s3 && o.s3.deliveryDate) || "—",
                  comp ? comp.toISOString().slice(0, 10) : "—",
                  <span key="s" style={{ color: col, fontWeight: 600 }}>{status}</span>];
              })} /> : <div className="empty">None completed yet.</div>}
          </div>
          <div className="hint">Respects the date filter above — running orders by their order date, completed orders by dispatch date. Clear the search to see the full company report.</div>
        </>;
      })()}

      {data && data.company && !loading && !matched && ((c.orders === 0 && coRunning.length === 0) ? (
        <div className="empty">No orders in this date range. Try “All time”, or pick a wider range.</div>
      ) : <>
        {/* Company at a glance — total / completed / in progress */}
        <div className="rep-hero">
          <div className="hero-item">
            <div className="hero-n">{c.orders + coRunning.length}</div>
            <div className="hero-l">Total orders</div>
            <div className="hero-sub">{c.panels + coRunningPanels} panels</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-item">
            <div className="hero-n" style={{ color: "#1e8e3e" }}>{c.orders}</div>
            <div className="hero-l">Completed</div>
            <div className="hero-sub">{c.panels} panels · {c.totalKgs.toLocaleString()} kg{c.totalNos ? ` · ${c.totalNos.toLocaleString()} nos` : ""} shipped</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-item">
            <div className="hero-n" style={{ color: "#e08e0b" }}>{coRunning.length}</div>
            <div className="hero-l">In progress</div>
            <div className="hero-sub">{coRunningPanels} panels still in the line</div>
          </div>
        </div>

        {/* completed on-time summary line */}
        <div className="rep-sla good" style={{ background: "#f1eefb", border: "1px solid #d9d2f0", color: "#3a2f6b" }}>
          <b>Completed work:</b> <span style={{ color: "#1e8e3e" }}>{c.onTime} on time</span> · <span style={{ color: "#d93025" }}>{c.late} late</span>{c.noTarget ? ` · ${c.noTarget} no date` : ""}{c.onTimePct !== null ? ` · ${c.onTimePct}% on-time` : ""}{c.late ? ` · avg ${c.avgLateDays}d late (worst ${c.maxLateDays}d)` : ""}
        </div>

        {/* In progress now */}
        <div className="card">
          <div className="rep-h">⏳ In progress now ({coRunning.length}) — {coRunningPanels} panels</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: coRunning.length ? 10 : 0 }}>
            {[[2, "Cutting/Bending"], [3, "Fabrication"], [4, "Dispatch to P.C."], [5, "Assembly"]].map(([s, lbl]) => (
              <span key={s} className="alert-chip" style={{ background: "#fff", borderColor: "#d9d2f0" }}>{lbl}: <b>{coRunningByStage[s] || 0}</b></span>
            ))}
          </div>
          {coRunning.length ? <Tbl
            head={["WO", "Stage", "Party", "Designer", "Contractor", "Qty", "Days in stage"]}
            aligns={["", "", "", "", "", "num", "num"]}
            rows={coRunning.slice().sort((a, b) => a.stage - b.stage || a.wo - b.wo).map(o => {
              const od = isOverdue(o), d = daysInCurrentStage(o);
              return [woNum(o) + boxTag(o), (STAGE_NAMES[o.stage] || "Stage " + o.stage).replace(/Stage 0\d · /, ""), o.party, o.designer, (o.s3 && o.s3.fabricator) || "—", o.qty,
                <span key="d" style={{ color: od ? "#d93025" : undefined, fontWeight: od ? 700 : 400 }}>{d == null ? "—" : d + "d"}{od ? " ⚠" : ""}</span>];
            })} /> : <div className="empty">Nothing in progress in this range.</div>}
        </div>

        {/* 3-day rule callout */}
        <div className={"rep-sla " + ((c.s2Over3 || c.s5Over3) ? "bad" : "good")}>
          {(c.s2Over3 || c.s5Over3) ? (
            <><b>⚠ The 3-day rule was broken.</b> Cutting (Stage 02) took over 3 days on <b>{c.s2Over3}</b> order{c.s2Over3 === 1 ? "" : "s"}, and Assembly (Stage 05) on <b>{c.s5Over3}</b> order{c.s5Over3 === 1 ? "" : "s"}. See the red rows in “All finished orders”.</>
          ) : (
            <><b>✓ The 3-day rule was respected.</b> No order spent more than 3 days in Cutting (Stage 02) or Assembly (Stage 05).</>
          )}
        </div>

        {/* By designer / by contractor */}
        <div className="grid2">
          <PeopleCard title="👤 By Designer" people={designers} unitNote="Bar = panels finished. Coloured strip = on-time (green) vs late (red)." />
          <PeopleCard title="🔧 By Contractor" people={contractors} unitNote="Bar = panels finished. Coloured strip = on-time (green) vs late (red)." />
        </div>

        {/* Stage speed */}
        <div className="card">
          <div className="rep-h">⏱ How long each stage holds the work (average days)</div>
          {stageRows.map(([label, v]) => (
            <div key={label} className="stage-row">
              <span className="stage-label">{label}</span>
              <div className="bar"><div className="bar-fill" style={{ width: ((v || 0) / maxStage * 100) + "%", background: (label.startsWith("Stage 02") || label.startsWith("Stage 05")) && v > st.slaDays ? "#d93025" : undefined }} /></div>
              <span className="stage-val">{v == null ? "—" : v + "d"}</span>
            </div>
          ))}
          <div className="hint" style={{ marginTop: 8 }}>Average time from first cut to dispatch: <b>{st.avgLead == null ? "—" : st.avgLead + " days"}</b>. Bars turn red if Stage 02 or 05 averaged more than {st.slaDays} days.</div>
        </div>

        {/* drill-down: all orders */}
        <div className="card">
          <div className="rep-h" style={{ cursor: "pointer", display: "flex", justifyContent: "space-between" }} onClick={() => setShowDetail(s => !s)}>
            <span>📋 All finished orders ({data.detail.length})</span>
            <span className="hint no-print">{showDetail ? "▾ hide" : "▸ show"}</span>
          </div>
          {showDetail && <Tbl
            head={["WO", "Box", "Designer", "Contractor", "Party", "Panels", "Delivery", "Completed", "Late days", "Status", "Cutting (S2)", "Assembly (S5)", "Total days"]}
            aligns={["", "", "", "", "", "num", "", "", "num", "", "num", "num", "num"]}
            rows={data.detail.map(d => [
              d.wo, d.box, d.designer, d.contractor, d.party, d.panels, d.deliveryDate || "—", d.completedDate,
              d.lateDays === "" ? "—" : d.lateDays,
              <span key="s" style={{ color: d.status === "Late" ? "#d93025" : d.status === "On time" ? "#1e8e3e" : "var(--muted)", fontWeight: 600 }}>{d.status}</span>,
              <span key="s2" style={{ color: d.s2Late ? "#d93025" : undefined, fontWeight: d.s2Late ? 700 : 400 }}>{d.s2Days === "" ? "—" : d.s2Days + "d"}</span>,
              <span key="s5" style={{ color: d.s5Late ? "#d93025" : undefined, fontWeight: d.s5Late ? 700 : 400 }}>{d.s5Days === "" ? "—" : d.s5Days + "d"}</span>,
              d.leadDays === "" ? "—" : d.leadDays + "d"
            ])} />}
        </div>
      </>)}
    </div>
  );
}

/* ------------------------------------------------------------------ login */
function Login({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await api.login(u.trim(), p); setToken(r.token); onLogin(r.user); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <form onSubmit={submit} className="card" style={{ width: 360, borderTop: "5px solid var(--accent)" }}>
        <h2 style={{ margin: "0 0 4px", fontWeight: 500 }}>NK Techno Craft</h2>
        <div className="sub" style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>Production Management — Sign in</div>
        <label>Username</label>
        <input value={u} onChange={e => setU(e.target.value)} autoFocus />
        <label>Password</label>
        <input type="password" value={p} onChange={e => setP(e.target.value)} />
        {err && <div style={{ color: "#d93025", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button className="act" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ users admin */
const STAGE_NAMES = { 1: "Stage 01 · New Order", 2: "Stage 02 · Cutting/Bending", 3: "Stage 03 · Fabrication", 4: "Stage 04 · Dispatch to P.C.", 5: "Stage 05 · Assembly & Dispatch" };
function UsersAdmin({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ username: "", password: "", role: "stage", stage: 1, displayName: "" });
  const [err, setErr] = useState("");
  const load = useCallback(() => api.users().then(setUsers).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const create = async () => {
    setErr("");
    try {
      await api.createUser({ ...f, stage: f.role === "stage" ? Number(f.stage) : null });
      setF({ username: "", password: "", role: "stage", stage: 1, displayName: "" });
      load();
    } catch (e) { setErr(e.message); }
  };
  const resetPw = async (u) => {
    const pw = prompt(`New password for "${u.username}" (min 4 chars):`);
    if (!pw) return;
    try { await api.updateUser(u.id, { password: pw }); alert("Password updated."); } catch (e) { alert(e.message); }
  };
  const del = async (u) => { if (confirm(`Delete user "${u.username}"?`)) { try { await api.delUser(u.id); load(); } catch (e) { alert(e.message); } } };
  return (
    <div className="view">
      <h2 className="title">User Logins</h2>
      <div className="handler">Admin only — create stage-wise logins. Each stage user can sign in and see only their own stage.</div>
      <div className="grid2">
        <div className="card">
          <div className="toolbar"><strong>Existing Users</strong><span className="pill">{users.length}</span></div>
          <table><thead><tr><th>Username</th><th>Role / Stage</th><th style={{ width: 130 }}></th></tr></thead>
            <tbody>{users.map(u =>
              <tr key={u.id}>
                <td>{u.username}{u.id === currentUser.id ? " (you)" : ""}</td>
                <td>{u.role === "admin" ? "Admin (full access)" : STAGE_NAMES[u.stage] || "Stage " + u.stage}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="mini b-grey" style={{ marginRight: 6 }} onClick={() => resetPw(u)}>Reset PW</button>
                  <button className="danger" onClick={() => del(u)}>Del</button>
                </td>
              </tr>)}
            </tbody></table>
        </div>
        <div className="card">
          <strong>Create New Login</strong>
          <label>Username</label><input value={f.username} onChange={e => set("username", e.target.value)} />
          <label>Password</label><input value={f.password} onChange={e => set("password", e.target.value)} placeholder="min 4 characters" />
          <label>Display Name (optional)</label><input value={f.displayName} onChange={e => set("displayName", e.target.value)} />
          <label>Role</label>
          <select value={f.role} onChange={e => set("role", e.target.value)}>
            <option value="stage">Stage user (single stage only)</option>
            <option value="admin">Admin (full access)</option>
          </select>
          {f.role === "stage" && <>
            <label>Stage</label>
            <select value={f.stage} onChange={e => set("stage", e.target.value)}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{STAGE_NAMES[n]}</option>)}
            </select>
          </>}
          {err && <div style={{ color: "#d93025", fontSize: 12, marginTop: 10 }}>{err}</div>}
          <div style={{ marginTop: 14, textAlign: "right" }}><button className="act" onClick={create}>＋ Create Login</button></div>
        </div>
      </div>
    </div>
  );
}

/* isolated clock — only this component re-renders each second */
function Clock() {
  const [now, setNow] = useState(new Date().toLocaleString());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{now}</>;
}

/* ------------------------------------------------------------------ root */
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState("dashboard");
  const [meta, setMeta] = useState({ designers: [], contractors: [], panelTypes: [], parties: [], bomItems: [], pcLocations: [], nextWO: 101 });
  const [orders, setOrders] = useState([]);
  const [openMap, setOpen] = useState({});
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [challan, setChallan] = useState(null); // {o, type}
  const [splitFor, setSplitFor] = useState(null); // order being split
  const [editOrder, setEditOrder] = useState(null); // order being edited (admin)

  const logout = useCallback(() => { setToken(null); setUser(null); setReady(false); }, []);

  // On load: if a token exists, validate it
  useEffect(() => {
    setOnUnauthorized(() => { setUser(null); });
    (async () => {
      if (getToken()) {
        try { const r = await api.me(); setUser(r.user); } catch { setToken(null); }
      }
      setAuthChecked(true);
    })();
  }, []);

  // When the user changes (login), set their landing tab
  useEffect(() => {
    if (user) setView(user.role === "admin" ? "dashboard" : "stage" + user.stage);
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const calls = [api.orders()];
      // meta is needed for admin + stage 1 (designer) + stage 3 (contractor)
      calls.push(api.meta().catch(() => ({ designers: [], contractors: [], panelTypes: [], parties: [], bomItems: [], pcLocations: [], nextWO: 101 })));
      const [o, m] = await Promise.all(calls);
      setOrders(o); setMeta(m); setErr(""); setReady(true);
    } catch (e) { setErr(e.message); setReady(true); }
  }, [user]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  const patch = async (wo, set) => {
    try { const updated = await api.patchOrder(wo, set); setOrders(os => os.map(o => o.wo === wo ? updated : o)); }
    catch (e) { alert(e.message); }
  };
  const advance = async (wo, to) => { try { const u = await api.advance(wo, to); setOrders(os => os.map(o => o.wo === wo ? u : o)); } catch (e) { alert(e.message); } };
  const dispatch = async (wo) => {
    const o = orders.find(x => x.wo === wo);
    if (o && (!o.s5.weight || Number(o.s5.weight) <= 0) && !confirm("No final weight entered — KGS report won't count this. Dispatch anyway?")) return;
    try { const u = await api.dispatch(wo); setOrders(os => os.map(x => x.wo === wo ? u : x)); alert("WO " + wo + " dispatched. ✔"); } catch (e) { alert(e.message); }
  };
  const removeOrder = async (o) => {
    if (!confirm(`Delete WO ${woNum(o)}${o.boxes > 1 ? ` · Box ${o.box}/${o.boxes}` : ""} (${o.party})? This cannot be undone.`)) return;
    try { await api.delOrder(o.wo); setOrders(os => os.filter(x => x.wo !== o.wo)); } catch (e) { alert(e.message); }
  };
  const seed = async () => { if (orders.length && !confirm("Load demo WO 101 & 102? This replaces current orders.")) return; await api.seed(); refresh(); };
  const wipe = async () => { if (confirm("Erase ALL work orders? (Designer/contractor lists are kept.)")) { await api.wipe(); refresh(); } };

  // re-sync the open challan modal's order object when orders change
  const challanOrder = challan ? orders.find(o => o.wo === challan.o.wo) : null;

  if (!authChecked) return <div className="empty" style={{ margin: 40 }}>Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  const tabs = tabsForUser(user);
  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? "Admin" : (STAGE_NAMES[user.stage] || "Stage " + user.stage);

  return (
    <>
      <header>
        <h1>NK TECHNO CRAFT INDIA PVT. LTD.</h1>
        <span className="sub">Production Management System · MERN</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }} className="sub">
          <Clock />
          <span className="pill">{user.displayName || user.username} · {roleLabel}</span>
          <button className="ghost no-print" style={{ padding: "5px 12px" }} onClick={logout}>Log out</button>
        </span>
      </header>
      <nav>
        {tabs.map(([id, label]) =>
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}
      </nav>
      <main>
        <div className="legend">
          <span><i className="swatch sw-y" /> <b>Yellow</b> = type here</span>
          <span><i className="swatch sw-b" /> <b>Grey</b> = auto-filled (don't edit)</span>
          <span><i className="swatch sw-g" /> <b>Purple</b> = button / action</span>
          {isAdmin && <>
            <button className="ghost no-print" style={{ marginLeft: "auto" }} onClick={seed}>Load demo data (WO 101 &amp; 102)</button>
            <button className="ghost no-print" onClick={wipe}>Clear all data</button>
          </>}
        </div>

        {(() => {
          const od = orders.filter(isOverdue);
          if (!od.length) return null;
          return (
            <div className="alert-banner no-print">
              <div className="alert-head">⚠ {od.length} order{od.length > 1 ? "s" : ""} stuck more than {SLA_DAYS} days {isAdmin ? "(Stage 02 / 05)" : "in your stage"} — needs attention</div>
              <div className="alert-list">
                {od.map(o => (
                  <span key={o.wo} className="alert-chip">
                    WO {woNum(o)}{boxTag(o)} · {(STAGE_NAMES[o.stage] || "Stage " + o.stage).replace(/ ·.*/, "")} · <b>{daysInCurrentStage(o)}d</b> · {o.party}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {err && <div className="empty" style={{ borderColor: "#f3c0bc", color: "#d93025" }}>
          API error: {err}. Make sure the backend is running on :4000 and MongoDB is up.</div>}
        {!ready ? <div className="empty">Loading…</div> : <>
          {view === "dashboard" && isAdmin && <Dashboard orders={orders} isAdmin={isAdmin} meta={meta} onEdit={setEditOrder} onDelete={removeOrder} />}
          {view === "general" && isAdmin && <General meta={meta} orders={orders} refresh={refresh} />}
          {view === "users" && isAdmin && <UsersAdmin currentUser={user} />}
          {view === "reports" && isAdmin && <Reports orders={orders} meta={meta} />}
          {view === "stage1" && <StageOne meta={meta} nextWO={meta.nextWO} onCreated={refresh} />}
          {view === "stage2" && <TableStage title="Stage 02 — Cutting & Bending" handler="Handled by Mukesh Sodha / Deepak Vacheta" stageNo={2} orders={orders} meta={meta} patch={patch} advance={advance} openMap={openMap} setOpen={setOpen} onSplit={setSplitFor} />}
          {view === "stage3" && <TableStage title="Stage 03 — Fabrication" handler="Handled by Irfan Belim" stageNo={3} orders={orders} meta={meta} patch={patch} advance={advance} openMap={openMap} setOpen={setOpen} onSplit={setSplitFor} />}
          {view === "stage4" && <CardStage which={4} orders={orders} patch={patch} advance={advance} openChallan={(o, type) => setChallan({ o, type })} openMap={openMap} setOpen={setOpen} meta={meta} onSplit={setSplitFor} />}
          {view === "stage5" && <CardStage which={5} orders={orders} patch={patch} advance={advance} dispatch={dispatch} openChallan={(o, type) => setChallan({ o, type })} openMap={openMap} setOpen={setOpen} meta={meta} onSplit={setSplitFor} />}
        </>}
      </main>

      {challanOrder && (
        <div className="modal" onClick={e => { if (e.target.className === "modal") setChallan(null); }}>
          <div className="modal-inner">
            <div className="modal-head no-print">
              <strong>{challan.type === "pc" ? "Challan for Powder Coating" : "Challan for Dispatch"} — WO {woNum(challanOrder)}{boxTag(challanOrder)}</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ghost" onClick={() => window.print()}>🖨 Print / Save PDF</button>
                <button className="ghost" onClick={() => setChallan(null)}>Close</button>
              </div>
            </div>
            <Challan o={challanOrder} type={challan.type} patch={(set) => patch(challanOrder.wo, set)} meta={meta} />
          </div>
        </div>
      )}

      {splitFor && (
        <SplitModal
          order={splitFor}
          onClose={() => setSplitFor(null)}
          onDone={() => { setSplitFor(null); refresh(); }}
        />
      )}

      {editOrder && (
        <EditOrderModal
          order={editOrder}
          meta={meta}
          onClose={() => setEditOrder(null)}
          onSaved={() => { setEditOrder(null); refresh(); }}
        />
      )}
    </>
  );
}

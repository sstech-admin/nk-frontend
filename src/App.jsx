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
  if (o.acc.point) a.push("POINT LOCK"); if (o.acc.p3) a.push("3 POINT LOCK");
  if (o.acc.pu) a.push("PU GASKETING"); if (o.acc.patti) a.push("PATTI GASKETING");
  if (o.acc.other) a.push(o.acc.other);
  return a.join(", ") || "-";
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
      {open && <div>{children}</div>}
    </>
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
        <tr><td className="challan-blue"><b>WO NO.:</b> {o.wo}</td><td className="challan-blue"><b>P.O. NO.:</b> {o.pono || "-"}</td></tr>
        <tr><td colSpan={2} className="challan-blue"><b>CUSTOMER NAME:</b> {o.party}</td></tr>
        <tr><td className="challan-blue"><b>CONTRACTOR:</b> {o.s3.fabricator || "-"}</td><td className="challan-blue"><b>DESIGNER:</b> {o.designer}</td></tr>
        <tr><td colSpan={2} className="challan-yellow" style={{ textAlign: "center" }}><b>WEIGHT:</b> <Inp path="s4.weight" val={s.weight} type="number" /> KGS</td></tr>
        <tr className="head"><td colSpan={2}>COLOR CODE OF PANEL</td></tr>
        <tr><td className="challan-blue">BODY</td><td className="challan-blue">{o.cBody || "-"}</td></tr>
        <tr><td className="challan-blue">MOUNTING PLATE</td><td className="challan-blue">{o.cMP || "-"}</td></tr>
        <tr><td className="challan-blue">BASE / STAND</td><td className="challan-blue">{o.cBase || "-"}</td></tr>
        <tr className="head"><td colSpan={2}>POWDER COATING TYPE</td></tr>
        <tr><td colSpan={2} className="challan-blue">{ck(o.pcType === "Single Coat", "SINGLE COAT")} &nbsp;&nbsp;&nbsp; {ck(o.pcType === "Double Coat", "DOUBLE COAT")}</td></tr>
        <tr className="head"><td colSpan={2}>ACCESSORIES</td></tr>
        <tr><td colSpan={2} className="challan-blue">{ck(o.acc.point, "POINT LOCK")} &nbsp; {ck(o.acc.p3, "3 POINT LOCK")} &nbsp; {ck(o.acc.pu, "PU GASKETING")} &nbsp; {ck(o.acc.patti, "PATTI GASKETING")} &nbsp; ANY OTHER: {o.acc.other || "-"}</td></tr>
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
        <tr><td className="challan-blue"><b>WO NO.:</b> {o.wo}</td><td className="challan-blue"><b>P.O. NO.:</b> {o.pono || "-"}</td></tr>
        <tr><td colSpan={2} className="challan-blue"><b>CUSTOMER NAME:</b> {o.party}</td></tr>
        <tr><td className="challan-blue"><b>CONTRACTOR:</b> {o.s3.fabricator || "-"}</td><td className="challan-blue"><b>DESIGNER:</b> {o.designer}</td></tr>
        <tr><td className="challan-yellow" style={{ textAlign: "center" }}><b>WEIGHT:</b> <Inp path="s5.weight" val={s.weight} type="number" /> KGS</td>
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

/* ------------------------------------------------------------------ stages */
function Dashboard({ orders }) {
  const total = orders.length;
  const c = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  orders.forEach(o => c[o.stage]++);
  const kgs = orders.filter(o => o.stage === 6).reduce((s, o) => s + (Number(o.s5.weight) || 0), 0);
  return (
    <div className="view">
      <h2 className="title">Production Dashboard</h2>
      <div className="kpi">
        <div className="box"><div className="n">{total}</div><div className="l">Total Orders</div></div>
        <div className="box"><div className="n">{c[2] + c[3]}</div><div className="l">In Production</div></div>
        <div className="box"><div className="n">{c[4] + c[5]}</div><div className="l">Coating / Assembly</div></div>
        <div className="box"><div className="n">{kgs.toLocaleString()}</div><div className="l">KGS Dispatched</div></div>
      </div>
      <div className="card">
        <div className="toolbar"><strong>All Work Orders</strong><span className="pill">{total} orders</span></div>
        {total === 0 ? <div className="empty">No work orders yet. Use Stage 01 or load demo data.</div> :
          <table><thead><tr><th>WO</th><th>Date</th><th>Designer</th><th>Party</th><th>Panel</th><th>Size</th><th>Qty</th><th>Status</th></tr></thead>
            <tbody>{orders.slice().reverse().map(o =>
              <tr key={o.wo}><td>{o.wo}</td><td>{o.date}</td><td>{o.designer}</td><td>{o.party}</td><td>{o.panelType}</td><td>{o.desc}</td><td className="num">{o.qty}</td><td><Badge stage={o.stage} /></td></tr>)}
            </tbody></table>}
      </div>
    </div>
  );
}

function General({ meta, orders, refresh }) {
  const [nd, setNd] = useState(""); const [nc, setNc] = useState("");
  const addD = async () => { if (!nd.trim()) return; try { await api.addDesigner(nd); setNd(""); refresh(); } catch (e) { alert(e.message); } };
  const addC = async () => { if (!nc.trim()) return; try { await api.addContractor(nc); setNc(""); refresh(); } catch (e) { alert(e.message); } };
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
    </div>
  );
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10), designer: "", party: "", panelType: "",
  pono: "", qty: "", desc: "", parts: "", custwo: "", pcType: "Single Coat",
  cBody: "", cMP: "", cBase: "", acc: { point: false, p3: false, pu: false, patti: false, other: "" },
  rate: "", rIncl: true, rExtra: false, remarks: ""
};
function StageOne({ meta, nextWO, onCreated }) {
  const [f, setF] = useState({ ...EMPTY_FORM, designer: meta.designers[0] || "" });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setAcc = (k, v) => setF(s => ({ ...s, acc: { ...s.acc, [k]: v } }));
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
            <label>Party Name</label><input value={f.party} onChange={e => set("party", e.target.value)} />
            <label>Panel Type</label><input value={f.panelType} placeholder="HT PANEL / ENCLOSURE BOX" onChange={e => set("panelType", e.target.value)} />
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
              <label className="chk"><input type="checkbox" checked={f.acc.point} onChange={e => setAcc("point", e.target.checked)} /> Point Lock</label>
              <label className="chk"><input type="checkbox" checked={f.acc.p3} onChange={e => setAcc("p3", e.target.checked)} /> 3 Point Lock</label>
              <label className="chk"><input type="checkbox" checked={f.acc.pu} onChange={e => setAcc("pu", e.target.checked)} /> PU Gasketing</label>
              <label className="chk"><input type="checkbox" checked={f.acc.patti} onChange={e => setAcc("patti", e.target.checked)} /> Patti Gasketing</label>
              <label>Any Other</label><input value={f.acc.other} onChange={e => setAcc("other", e.target.value)} />
            </fieldset>
            <fieldset><legend>Rate</legend>
              <label>Rate per KGS</label><input type="number" value={f.rate} placeholder="125" onChange={e => set("rate", e.target.value)} />
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

/* table-based stages 2 & 3 */
function TableStage({ title, handler, stageNo, orders, meta, patch, advance, openMap, setOpen }) {
  const list = orders.filter(o => o.stage >= stageNo);
  const inc = list.filter(o => o.stage === stageNo);
  const done = list.filter(o => o.stage > stageNo);
  const okToggle = (o, which, checked) =>
    patch(o.wo, which === "ok" ? { [`s${stageNo}.ok`]: checked, [`s${stageNo}.notok`]: checked ? false : o[`s${stageNo}`].notok }
                              : { [`s${stageNo}.notok`]: checked, [`s${stageNo}.ok`]: checked ? false : o[`s${stageNo}`].ok });

  const row = (o) => {
    const s = o["s" + stageNo];
    const locked = o.stage > stageNo;
    return (
      <tr key={o.wo}>
        <td>WO. NO. – {o.wo}</td>
        <td className="auto-cell">{o.designer}</td>
        <td className="auto-cell">{o.date}</td>
        <td className="auto-cell">{o.party}</td>
        {stageNo === 3 && <td className="auto-cell">{o.panelType}</td>}
        <td className="auto-cell">{o.desc}</td>
        {stageNo === 3 && <td className="auto-cell num">{o.parts}</td>}
        <td className="auto-cell num">{o.qty}</td>
        {stageNo === 2 && <td><input defaultValue={s.sheetQty} style={{ width: 90 }} disabled={locked} onBlur={e => patch(o.wo, { "s2.sheetQty": e.target.value })} /></td>}
        {stageNo === 3 && <td><select defaultValue={s.fabricator} disabled={locked} onChange={e => patch(o.wo, { "s3.fabricator": e.target.value })}>
          <option value="">— select —</option>{meta.contractors.map(c => <option key={c}>{c}</option>)}</select></td>}
        {stageNo === 3 && <td><input type="date" defaultValue={s.deliveryDate} style={{ width: 140 }} disabled={locked} onBlur={e => patch(o.wo, { "s3.deliveryDate": e.target.value })} /></td>}
        <td style={{ whiteSpace: "nowrap" }}>
          <label className="chk" style={{ display: "inline-flex", marginRight: 10 }}><input type="checkbox" checked={!!s.ok} disabled={locked} onChange={e => okToggle(o, "ok", e.target.checked)} /> OK</label>
          <label className="chk" style={{ display: "inline-flex" }}><input type="checkbox" checked={!!s.notok} disabled={locked} onChange={e => okToggle(o, "notok", e.target.checked)} /> NOT OK</label>
        </td>
        <td>{o.stage === stageNo
          ? <button className="mini b-green" onClick={() => advance(o.wo, stageNo + 1)}>{stageNo === 2 ? "Send → Fabrication" : "Send → P.C."}</button>
          : <span className="status st-done">Done</span>}</td>
      </tr>
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
          {inc.length ? <table>{head}<tbody>{inc.map(row)}</tbody></table> : <div className="empty">Nothing pending.</div>}
        </Section>
        <Section id={`s${stageNo}_done`} label="✔ Completed" color="#1e8e3e" count={done.length} openMap={openMap} setOpen={setOpen}>
          {done.length ? <table>{head}<tbody>{done.map(row)}</tbody></table> : <div className="empty">No completed orders.</div>}
        </Section>
      </>}
    </div>
  );
}

/* card-based stages 4 & 5 */
function CardStage({ which, orders, patch, advance, dispatch, openChallan, openMap, setOpen, meta }) {
  const stageNo = which === 4 ? 4 : 5;
  const inc = orders.filter(o => o.stage === stageNo);
  const done = orders.filter(o => which === 4 ? o.stage > 4 : o.stage === 6);
  const okToggle = (o, w, checked) =>
    patch(o.wo, w === "ok" ? { "s5.ok": checked, "s5.notok": checked ? false : o.s5.notok }
                           : { "s5.notok": checked, "s5.ok": checked ? false : o.s5.ok });

  const incCard = (o) => which === 4 ? (
    <div className="card" key={o.wo}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <strong>WO. NO. – {o.wo} · {o.party}</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="mini b-blue no-print" onClick={() => openChallan(o, "pc")}>🖨 Print</button>
          <button className="mini b-green no-print" onClick={() => advance(o.wo, 5)}>START → Assembly</button>
        </div>
      </div>
      <table style={{ maxWidth: 430, marginBottom: 14 }}><tbody>
        <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>WO. NO. -- {o.wo}</td></tr>
        <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>{o.s3.fabricator || o.designer}</td></tr>
        <tr><td className="challan-blue" style={{ fontWeight: 600, width: 130 }}>PARTY NAME</td><td className="challan-blue">{o.party}</td></tr>
        <tr><td className="challan-blue" style={{ fontWeight: 600 }}>PANEL TYPE</td><td className="challan-blue">{o.panelType}</td></tr>
        <tr><td className="challan-blue" style={{ fontWeight: 600 }}>QTY</td><td className="challan-blue">{o.qty}</td></tr>
        <tr><td className="challan-blue" style={{ fontWeight: 600 }}>DESCRIPTION</td><td className="challan-blue">{o.desc}</td></tr>
        <tr><td className="challan-blue" style={{ fontWeight: 600 }}>PART (BHAG)</td><td className="challan-blue">{o.parts}</td></tr>
        <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600, padding: 8 }}>READY TO DISPATCH</td></tr>
      </tbody></table>
      <Challan o={o} type="pc" patch={(set) => patch(o.wo, set)} meta={meta} />
    </div>
  ) : (
    <div className="card" key={o.wo}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <strong>WO. NO. – {o.wo} · {o.party}</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="mini b-blue no-print" onClick={() => openChallan(o, "dispatch")}>🖨 Print</button>
          <button className="mini b-green no-print" onClick={() => dispatch(o.wo)}>OK → DISPATCH</button>
        </div>
      </div>
      <table style={{ maxWidth: 460, marginBottom: 14 }}><tbody>
        <tr><td colSpan={2} style={{ background: "var(--accent)", color: "#fff", textAlign: "center", fontWeight: 600 }}>WO. NO. -- {o.wo}</td></tr>
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
    </div>
  );

  const doneCard = (o) => (
    <div className="card" key={o.wo}>
      <div style={{ background: "var(--accent)", color: "#fff", textAlign: "center", padding: 6, fontWeight: 600, borderRadius: 4 }}>WO. NO. – {o.wo}</div>
      <table style={{ margin: "8px 0" }}><tbody>
        <tr><td className="auto-cell">Party</td><td className="auto-cell">{o.party}</td></tr>
        <tr><td className="auto-cell">Panel</td><td className="auto-cell">{o.panelType}</td></tr>
        {which === 4
          ? <><tr><td className="auto-cell">P.C. Location</td><td className="auto-cell">{o.s4.location || "-"}</td></tr>
              <tr><td className="auto-cell">Weight</td><td className="auto-cell">{o.s4.weight || "-"} KGS</td></tr></>
          : <><tr><td className="auto-cell">Final Weight</td><td className="auto-cell">{o.s5.weight || "-"} KGS</td></tr>
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

function Reports() {
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const load = useCallback(() => api.reports(month).then(setData).catch(e => alert(e.message)), [month]);
  useEffect(() => { load(); }, [load]);
  const Tbl = ({ head, rows }) => rows.length
    ? <table><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "num" : ""}>{c}</td>)}</tr>)}</tbody></table>
    : <div className="empty">No data.</div>;
  return (
    <div className="view">
      <h2 className="title">Monthly Reports</h2>
      <div className="toolbar">
        <div><label style={{ display: "inline" }}>Month filter </label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: "auto", display: "inline-block", background: "#fff" }} />
          <button className="ghost" style={{ marginLeft: 8 }} onClick={() => setMonth("")}>All time</button></div>
        <button className="ghost no-print" onClick={() => window.print()}>🖨 Print / PDF</button>
      </div>
      {data && <>
        <div className="grid2">
          <div className="card"><strong>1 · Designer-wise Work</strong>
            <Tbl head={["Designer", "Orders", "Total Qty"]} rows={data.designerWise.map(r => [r.name, r.orders, r.qty])} /></div>
          <div className="card"><strong>2 · Fabricator (Team-wise) Work</strong>
            <Tbl head={["Fabricator Team", "Orders", "Total Qty"]} rows={data.fabricatorWise.map(r => [r.name, r.orders, r.qty])} /></div>
        </div>
        <div className="grid2">
          <div className="card"><strong>3 · Powder Coating Contractor Work</strong>
            <Tbl head={["P.C. Location", "Orders", "KGS"]} rows={data.powderCoating.map(r => [r.name, r.orders, r.kgs.toLocaleString()])} /></div>
          <div className="card"><strong>4 · Total Dispatch in KGS</strong>
            <Tbl head={["WO", "Party", "KGS"]} rows={data.dispatch.rows.map(r => [r.wo, r.party, r.kgs.toLocaleString()])} />
            <div style={{ textAlign: "right", fontWeight: 600, marginTop: 8 }}>TOTAL DISPATCH: {data.dispatch.totalKgs.toLocaleString()} KGS</div></div>
        </div>
      </>}
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
  const [meta, setMeta] = useState({ designers: [], contractors: [], bomItems: [], pcLocations: [], nextWO: 101 });
  const [orders, setOrders] = useState([]);
  const [openMap, setOpen] = useState({});
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [challan, setChallan] = useState(null); // {o, type}

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
      calls.push(api.meta().catch(() => ({ designers: [], contractors: [], bomItems: [], pcLocations: [], nextWO: 101 })));
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
          <span><i className="swatch sw-y" /> Manual entry</span>
          <span><i className="swatch sw-b" /> Auto (carried forward)</span>
          <span><i className="swatch sw-g" /> Action</span>
          {isAdmin && <>
            <button className="ghost no-print" style={{ marginLeft: "auto" }} onClick={seed}>Load demo data (WO 101 &amp; 102)</button>
            <button className="ghost no-print" onClick={wipe}>Clear all data</button>
          </>}
        </div>

        {err && <div className="empty" style={{ borderColor: "#f3c0bc", color: "#d93025" }}>
          API error: {err}. Make sure the backend is running on :4000 and MongoDB is up.</div>}
        {!ready ? <div className="empty">Loading…</div> : <>
          {view === "dashboard" && isAdmin && <Dashboard orders={orders} />}
          {view === "general" && isAdmin && <General meta={meta} orders={orders} refresh={refresh} />}
          {view === "users" && isAdmin && <UsersAdmin currentUser={user} />}
          {view === "reports" && isAdmin && <Reports />}
          {view === "stage1" && <StageOne meta={meta} nextWO={meta.nextWO} onCreated={refresh} />}
          {view === "stage2" && <TableStage title="Stage 02 — Cutting & Bending" handler="Handled by Mukesh Sodha / Deepak Vacheta" stageNo={2} orders={orders} meta={meta} patch={patch} advance={advance} openMap={openMap} setOpen={setOpen} />}
          {view === "stage3" && <TableStage title="Stage 03 — Fabrication" handler="Handled by Irfan Belim" stageNo={3} orders={orders} meta={meta} patch={patch} advance={advance} openMap={openMap} setOpen={setOpen} />}
          {view === "stage4" && <CardStage which={4} orders={orders} patch={patch} advance={advance} openChallan={(o, type) => setChallan({ o, type })} openMap={openMap} setOpen={setOpen} meta={meta} />}
          {view === "stage5" && <CardStage which={5} orders={orders} patch={patch} advance={advance} dispatch={dispatch} openChallan={(o, type) => setChallan({ o, type })} openMap={openMap} setOpen={setOpen} meta={meta} />}
        </>}
      </main>

      {challanOrder && (
        <div className="modal" onClick={e => { if (e.target.className === "modal") setChallan(null); }}>
          <div className="modal-inner">
            <div className="modal-head no-print">
              <strong>{challan.type === "pc" ? "Challan for Powder Coating" : "Challan for Dispatch"} — WO {challanOrder.wo}</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ghost" onClick={() => window.print()}>🖨 Print / Save PDF</button>
                <button className="ghost" onClick={() => setChallan(null)}>Close</button>
              </div>
            </div>
            <Challan o={challanOrder} type={challan.type} patch={(set) => patch(challanOrder.wo, set)} meta={meta} />
          </div>
        </div>
      )}
    </>
  );
}

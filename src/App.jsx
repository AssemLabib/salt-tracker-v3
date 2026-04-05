import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";

/* Load Google Fonts via DOM */
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

/* Supabase */
const SB = "https://rsmxetekqhxucunfcasn.supabase.co";
const SK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbXhldGVrcWh4dWN1bmZjYXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzc3ODksImV4cCI6MjA5MDYxMzc4OX0.LCLZoTWMUvx-OVBQBMYOkCOGoZ_aYyRc6Y59WRKmj34";
const H = { apikey: SK, Authorization: "Bearer " + SK, "Content-Type": "application/json", Prefer: "return=representation" };
async function sbf(p, o = {}) {
  const r = await fetch(SB + "/rest/v1/" + p, { ...o, headers: { ...H, ...o.headers } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

/* Constants */
const COLORS = ["#2563eb","#7c3aed","#0891b2","#059669","#d97706","#dc2626","#db2777","#ea580c","#4f46e5","#0d9488"];
const DEFAULT_SECTIONS = [
  { id: "authorities", name: "Authorities" },
  { id: "legal", name: "Legal" },
  { id: "design", name: "Design & Consultants" },
  { id: "sales", name: "Sales & Marketing" },
  { id: "construction", name: "Construction" },
  { id: "banking", name: "Banking & Finance" },
];
const TEAM = [
  { id: "CS", name: "Carson Bolt", ini: "CB", color: "#2563eb" },
  { id: "SS", name: "Shannon Sharp", ini: "SS", color: "#7c3aed" },
  { id: "AL", name: "Assem Labib", ini: "AL", color: "#0891b2" },
];
const STAGES = [
  { id: "not-started", label: "Not Started", color: "#94a3b8", bg: "#f1f5f9" },
  { id: "in-progress", label: "In Progress", color: "#2563eb", bg: "#eff6ff" },
  { id: "awaiting-response", label: "Awaiting Response", color: "#d97706", bg: "#fffbeb" },
  { id: "completed", label: "Completed", color: "#059669", bg: "#ecfdf5" },
  { id: "on-hold", label: "On Hold", color: "#dc2626", bg: "#fef2f2" },
];
const PRIS = [
  { id: "high", label: "High", color: "#dc2626", bg: "#fef2f2" },
  { id: "medium", label: "Medium", color: "#d97706", bg: "#fffbeb" },
  { id: "low", label: "Low", color: "#94a3b8", bg: "#f1f5f9" },
];

const gS = id => STAGES.find(s => s.id === id) || STAGES[0];
const gP = id => PRIS.find(p => p.id === id) || PRIS[2];
const gM = id => TEAM.find(m => m.id === id);
/* Normalize assignee(s) - supports both old single string and new array format */
function getAssignees(task) {
  if (Array.isArray(task.assignees)) return task.assignees;
  if (task.assignee) return [task.assignee];
  return [];
}
function hasAssignee(task, mid) {
  return getAssignees(task).indexOf(mid) >= 0;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pCol = function(id, prjMap) {
  if (prjMap && prjMap[id] && prjMap[id].data && prjMap[id].data.color) return prjMap[id].data.color;
  return COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
};

const gSecName = function(sid, sec) {
  if (sec && sec.name && sec.name !== sid) return sec.name;
  var found = DEFAULT_SECTIONS.find(function(s) { return s.id === sid; });
  return found ? found.name : sid;
};

function fD(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((dt - now) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff <= 6) return "In " + diff + "d";
  if (diff < 0 && diff >= -6) return Math.abs(diff) + "d ago";
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const isOD = (d, st) => {
  return d && st !== "completed" && new Date(d + "T00:00:00") < new Date(new Date().toDateString());
};

function getAll(prj) {
  const t = [];
  Object.entries(prj).forEach(([pid, p]) => {
    if (!p || !p.data || !p.data.sections) return;
    Object.entries(p.data.sections).forEach(([sid, sec]) => {
      (sec.tasks || []).forEach(tk => {
        t.push(Object.assign({}, tk, {
          projectId: pid,
          sectionId: sid,
          sectionName: sec.name || sid,
          projectName: (p.data && p.data.name) || pid,
          projectType: (p.data && p.data.type) || "live"
        }));
      });
    });
  });
  return t;
}

function srt(tasks, by) {
  var po = { high: 0, medium: 1, low: 2 };
  var so = { "in-progress": 0, "awaiting-response": 1, "not-started": 2, "on-hold": 3, completed: 4 };
  return tasks.slice().sort(function(a, b) {
    if (by === "due") {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    var pd = (po[a.priority] || 2) - (po[b.priority] || 2);
    if (pd !== 0) return pd;
    return (so[a.stage] || 4) - (so[b.stage] || 4);
  });
}

/* Mock Data */
function makeMock() {
  var now = new Date();
  function d(off) {
    var dt = new Date(now);
    dt.setDate(dt.getDate() + off);
    return dt.toISOString().split("T")[0];
  }
  function t(n, s, p, w, dd) {
    return { id: uid(), name: n, stage: s, priority: p, assignee: w, dueDate: dd !== null ? d(dd) : null, consultant: null, createdAt: now.toISOString() };
  }
  function ms(n, dd, done) {
    return { id: uid(), name: n, dueDate: d(dd), completed: done };
  }
  function con(tp, n, co, ph, em) {
    return { id: uid(), type: tp, name: n, company: co, phone: ph, email: em, comments: [] };
  }
  function mp(id, nm, type, color, milestones, secs) {
    return { id: id, data: { name: nm, type: type, color: color, milestones: milestones, sections: secs }, updated_at: now.toISOString() };
  }
  function defSecs(tasks, consultants) {
    var s = {};
    DEFAULT_SECTIONS.forEach(function(sec) {
      s[sec.id] = { name: sec.name, tasks: (tasks && tasks[sec.id]) || [], consultants: (consultants && consultants[sec.id]) || [] };
    });
    return s;
  }

  return {
    "35-37-nundah-street": mp("35-37-nundah-street", "35-37 Nundah Street", "live", "#2563eb",
      [ms("DA Approval", -5, true), ms("Construction Start", 30, false), ms("Practical Completion", 180, false)],
      defSecs(
        { authorities: [t("DA Submission to Council","in-progress","high","AL",2), t("Infrastructure charges review","awaiting-response","high","CS",-1), t("Traffic study approval","completed","medium","SS",-5)],
          legal: [t("Contract review with solicitor","in-progress","high","AL",3), t("Easement documentation","not-started","medium","CS",7)],
          design: [t("Architectural plans rev 3","in-progress","high","SS",1), t("Structural engineering review","awaiting-response","medium","AL",4)],
          sales: [t("Marketing brochure design","not-started","medium","SS",10)],
          construction: [t("Builder tender process","in-progress","high","CS",5), t("Site prep quote","awaiting-response","medium","AL",8)],
          banking: [t("Finance pre-approval","completed","high","AL",-10), t("Valuation report","in-progress","high","CS",0)]
        },
        { authorities: [con("Town Planner","John Smith","Urban Planning Co","0412 345 678","john@urbanplan.com.au")],
          legal: [con("Solicitor","Sarah Wilson","Wilson Partners","0423 456 789","sarah@wilsonlaw.com.au")],
          design: [con("Architect","Mike Chen","Chen Architects","0434 567 890","mike@chenarch.com.au")],
          banking: [con("Valuer","David Brown","ValuPro","0456 789 012","david@valupro.com.au")]
        }
      )
    ),
    "41-nundah-street": mp("41-nundah-street", "41 Nundah Street", "live", "#7c3aed",
      [ms("DA Lodgement", 5, false), ms("Presales Target", 60, false)],
      defSecs({ authorities: [t("Pre-lodgement meeting","completed","high","AL",-7), t("DA amendments","in-progress","high","CS",3)], legal: [t("Title search","completed","medium","SS",-14)], design: [t("Interior design concepts","in-progress","medium","SS",6)], construction: [t("Demolition permit","awaiting-response","high","CS",-2)], banking: [t("Construction loan","in-progress","high","AL",4)] })
    ),
    "17-grubb-street": mp("17-grubb-street", "17 Grubb Street", "live", "#0891b2",
      [ms("Settlement", 45, false)],
      defSecs({ authorities: [t("Bushfire assessment","completed","high","CS",-20), t("Council clearance","on-hold","medium","AL",15)], legal: [t("Covenant review","in-progress","medium","SS",5)], design: [t("Soil testing","completed","high","AL",-8)], sales: [t("Agent appointment","not-started","low","SS",20)], banking: [t("Refinance application","awaiting-response","high","AL",1)] })
    ),
    "19-thomas-street": mp("19-thomas-street", "19 Thomas Street", "live", "#059669", [],
      defSecs({ authorities: [t("Building approval","awaiting-response","high","AL",-3)], design: [t("Facade design","in-progress","medium","SS",7)], sales: [t("OTP sales campaign","not-started","high","CS",12)], construction: [t("Foundation inspection","completed","high","CS",-6)], banking: [t("Draw-down #2","in-progress","high","AL",0)] })
    ),
    "6-bon-accord-street": mp("6-bon-accord-street", "6 Bon Accord Street", "acquisition", "#d97706", [],
      defSecs({ authorities: [t("Zoning check","in-progress","high","AL",10)], legal: [t("Due diligence","in-progress","high","SS",5)], banking: [t("Feasibility model","in-progress","medium","CS",3)] })
    ),
    "11a-nundah-street": mp("11a-nundah-street", "11A Nundah Street", "acquisition", "#dc2626", [],
      defSecs({ authorities: [t("Preliminary assessment","not-started","medium","CS",18)], design: [t("Town planner","in-progress","high","AL",2)] })
    ),
    "__business": mp("__business", "Business Action Items", "business", "#4f46e5", [], {
      general: { name: "General", tasks: [
        t("Quarterly tax review","in-progress","high","AL",5),
        t("Insurance renewal","not-started","medium","CS",14),
        t("Team performance reviews","not-started","high","AL",10),
        t("Update company website","awaiting-response","low","SS",20)
      ], consultants: [] }
    })
  };
}

/* Context */
var Ctx = createContext(null);

function useData() {
  var ref = useState({});
  var prj = ref[0], setPrj = ref[1];
  var ref2 = useState(true);
  var loading = ref2[0], setLoading = ref2[1];
  var ref3 = useState([]);
  var toasts = ref3[0], setToasts = ref3[1];
  var ref4 = useState(false);
  var isMock = ref4[0], setIsMock = ref4[1];

  var toast = useCallback(function(m, tp) {
    var id = Date.now();
    setToasts(function(p) { return p.concat([{ id: id, m: m, tp: tp || "ok" }]); });
    setTimeout(function() { setToasts(function(p) { return p.filter(function(t) { return t.id !== id; }); }); }, 3000);
  }, []);

  var load = useCallback(async function() {
    try {
      var data = await sbf("projects?select=*");
      var map = {};
      (data || []).forEach(function(r) {
        map[r.id] = { id: r.id, data: typeof r.data === "string" ? JSON.parse(r.data) : r.data, updated_at: r.updated_at };
      });
      setPrj(map);
      setIsMock(false);
    } catch(e) {
      setPrj(makeMock());
      setIsMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function() { load(); }, [load]);
  useEffect(function() { if (isMock) return; var i = setInterval(load, 15000); return function() { clearInterval(i); }; }, [load, isMock]);

  var upd = useCallback(async function(pid, nd) {
    setPrj(function(p) {
      var n = Object.assign({}, p);
      n[pid] = Object.assign({}, p[pid], { id: pid, data: nd, updated_at: new Date().toISOString() });
      return n;
    });
    if (!isMock) {
      try {
        await fetch(SB + "/rest/v1/projects?on_conflict=id", { method: "POST", headers: Object.assign({}, H, { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ id: pid, data: nd, updated_at: new Date().toISOString() }) });
      } catch(e) { load(); }
    }
  }, [load, isMock]);

  var addProj = useCallback(async function(name, type, color, details) {
    var pid = slug(name);
    if (prj[pid]) throw new Error("Already exists");
    var es = {};
    DEFAULT_SECTIONS.forEach(function(s) { es[s.id] = { name: s.name, tasks: [], consultants: [] }; });
    var nd = { name: name, type: type || "live", color: color || null, lots: (details && details.lots) || "", grv: (details && details.grv) || "", address: (details && details.address) || "", description: (details && details.description) || "", milestones: [], sections: es };
    setPrj(function(p) { var n = Object.assign({}, p); n[pid] = { id: pid, data: nd, updated_at: new Date().toISOString() }; return n; });
    if (!isMock) try { await fetch(SB + "/rest/v1/projects?on_conflict=id", { method: "POST", headers: Object.assign({}, H, { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ id: pid, data: nd, updated_at: new Date().toISOString() }) }); } catch(e) { load(); }
    return pid;
  }, [prj, load, isMock]);

  var delProj = useCallback(async function(pid) {
    setPrj(function(p) { var n = Object.assign({}, p); delete n[pid]; return n; });
    if (!isMock) try { await fetch(SB + "/rest/v1/projects?id=eq." + pid, { method: "DELETE", headers: H }); } catch(e) { load(); }
  }, [load, isMock]);

  var addTask = useCallback(async function(pid, sid, task) {
    var p = prj[pid]; if (!p) return;
    var d = JSON.parse(JSON.stringify(p.data));
    if (!d.sections[sid]) d.sections[sid] = { name: sid, tasks: [], consultants: [] };
    d.sections[sid].tasks.push(task);
    await upd(pid, d);
  }, [prj, upd]);

  var updTask = useCallback(async function(pid, sid, tid, u) {
    var p = prj[pid]; if (!p) return;
    var d = JSON.parse(JSON.stringify(p.data));
    var ts = d.sections && d.sections[sid] && d.sections[sid].tasks;
    if (!ts) return;
    var i = ts.findIndex(function(t) { return t.id === tid; });
    if (i >= 0) { ts[i] = Object.assign({}, ts[i], u); await upd(pid, d); }
  }, [prj, upd]);

  var delTask = useCallback(async function(pid, sid, tid) {
    var p = prj[pid]; if (!p) return;
    var d = JSON.parse(JSON.stringify(p.data));
    if (d.sections && d.sections[sid] && d.sections[sid].tasks) {
      d.sections[sid].tasks = d.sections[sid].tasks.filter(function(t) { return t.id !== tid; });
    }
    await upd(pid, d);
  }, [prj, upd]);

  return { prj: prj, loading: loading, toasts: toasts, toast: toast, isMock: isMock, load: load, upd: upd, addProj: addProj, delProj: delProj, addTask: addTask, updTask: updTask, delTask: delTask };
}

/* Styles */
var fontDi = "'DM Serif Display', Georgia, serif";
var fontBo = "'Outfit', -apple-system, sans-serif";
var S = {
  bg: "#f8f9fb", card: "#ffffff", input: "#f4f5f7", overlay: "#f0f1f4",
  brd: "#e2e5ea", brdL: "#eceef2", brdH: "#d0d3d9",
  t1: "#1a1f2e", t2: "#5a6278", t3: "#8b92a5", inv: "#ffffff",
  blue: "#2563eb", blueL: "#3b82f6",
  ok: "#059669", warn: "#d97706", err: "#dc2626", info: "#2563eb",
  okBg: "#ecfdf5", warnBg: "#fffbeb", errBg: "#fef2f2", infoBg: "#eff6ff", neutBg: "#f1f5f9",
  shadow: "0 1px 3px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 24px rgba(0,0,0,0.12)",
};

var sCard = { background: S.card, border: "1px solid " + S.brdL, borderRadius: 12, boxShadow: S.shadow };
var sBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: fontBo };
var sBP = Object.assign({}, sBtn, { background: S.blue, color: S.inv });
var sBS = Object.assign({}, sBtn, { background: S.card, color: S.t1, border: "1px solid " + S.brd });
var sBG = Object.assign({}, sBtn, { background: "none", color: S.t2, minHeight: 32, padding: "4px 8px", fontSize: 12 });
var sBD = Object.assign({}, sBtn, { background: S.errBg, color: S.err, minHeight: 32, padding: "4px 8px", fontSize: 12 });
var sInput = { width: "100%", minHeight: 44, padding: "10px 12px", background: S.input, border: "1px solid " + S.brd, borderRadius: 8, color: S.t1, fontSize: 15, outline: "none", fontFamily: fontBo };
var lblS = { display: "block", fontSize: 11, fontWeight: 600, color: S.t3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 };

function badge(bg, fg) {
  return { display: "inline-flex", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: bg, color: fg, whiteSpace: "nowrap", lineHeight: "1.6" };
}

/* Icons */
function Ic(props) {
  var s = props.s || 20;
  var rest = Object.assign({}, props);
  delete rest.s;
  delete rest.children;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {props.children}
    </svg>
  );
}

function IHome(p) { return <Ic {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Ic>; }
function ICal(p) { return <Ic {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Ic>; }
function IFolder(p) { return <Ic {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></Ic>; }
function IPlus(p) { return <Ic {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ic>; }
function IX(p) { return <Ic {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Ic>; }
function IChevD(p) { return <Ic {...p}><polyline points="6 9 12 15 18 9" /></Ic>; }
function IChevL(p) { return <Ic {...p}><polyline points="15 18 9 12 15 6" /></Ic>; }
function ICheck(p) { return <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>; }
function ITrash(p) { return <Ic {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Ic>; }
function IAlert(p) { return <Ic {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Ic>; }
function IFile(p) { return <Ic {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></Ic>; }
function IMsg(p) { return <Ic {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Ic>; }
function IUser(p) { return <Ic {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></Ic>; }
function IFlag(p) { return <Ic {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></Ic>; }
function IEdit(p) { return <Ic {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Ic>; }
function IChevU(p) { return <Ic {...p}><polyline points="18 15 12 9 6 15" /></Ic>; }
function IMenu(p) { return <Ic {...p}><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></Ic>; }

/* Shared Components */
function Toasts(props) {
  if (!props.items.length) return null;
  return (
    <div style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {props.items.map(function(t) {
        return (
          <div key={t.id} style={Object.assign({}, sCard, { padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" })}>
            {t.tp === "ok" ? <ICheck s={14} style={{ color: S.ok }} /> : <IAlert s={14} style={{ color: S.err }} />}
            <span style={{ color: S.t1 }}>{t.m}</span>
          </div>
        );
      })}
    </div>
  );
}

function Modal(props) {
  if (!props.open) return null;
  return (
    <div onClick={function(e) { if (e.target === e.currentTarget) props.onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{ width: "100%", maxWidth: 520, maxHeight: "92vh", background: S.card, borderRadius: "16px 16px 0 0", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: S.brdH }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 12px" }}>
          <h2 style={{ fontFamily: fontDi, fontSize: 20, fontWeight: 400, color: S.t1 }}>{props.title}</h2>
          <button onClick={props.onClose} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: S.t3, background: "none", border: "none", cursor: "pointer" }}><IX s={18} /></button>
        </div>
        <div style={{ padding: "0 16px 16px" }}>{props.children}</div>
        {props.footer && <div style={{ padding: "12px 16px", borderTop: "1px solid " + S.brdL, display: "flex", gap: 8 }}>{props.footer}</div>}
      </div>
    </div>
  );
}

function FTab(props) {
  return (
    <button onClick={props.onClick} style={{ flexShrink: 0, minHeight: 32, padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500, color: props.active ? S.inv : S.t2, background: props.active ? S.blue : S.card, border: "1px solid " + (props.active ? S.blue : S.brdL), cursor: "pointer", whiteSpace: "nowrap", fontFamily: fontBo, boxShadow: props.active ? "none" : S.shadow }}>
      {props.label}
      {props.count !== undefined && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 16, height: 16, borderRadius: 99, fontSize: 10, fontWeight: 700, marginLeft: 4, padding: "0 4px", background: props.active ? "rgba(255,255,255,.25)" : S.input }}>
          {props.count}
        </span>
      )}
    </button>
  );
}

function TaskCard(props) {
  var task = props.task;
  var ctx = useContext(Ctx);
  var updTask = ctx.updTask, delTask = ctx.delTask, toast = ctx.toast;
  var delRef = useState(false);
  var showDel = delRef[0], setShowDel = delRef[1];
  var ref = useRef(null);
  var sx = useRef(0), dx = useRef(0), sw = useRef(false);
  var st = gS(task.stage), pr = gP(task.priority);
  var assignees = getAssignees(task);
  var late = isOD(task.dueDate, task.stage), done = task.stage === "completed";
  /* Resolve consultant if present */
  var conObj = null;
  if (task.consultant && task.projectId && ctx.prj[task.projectId]) {
    var pd = ctx.prj[task.projectId];
    var sec = pd.data && pd.data.sections && pd.data.sections[task.sectionId];
    if (sec && sec.consultants) {
      conObj = sec.consultants.find(function(c) { return c.id === task.consultant; }) || null;
    }
  }

  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 64, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: S.ok, color: "white" }}><ICheck s={14} /></div>
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 64, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: S.err, color: "white" }}><ITrash s={14} /></div>
      <div ref={ref}
        onClick={function() { if (!sw.current && props.onEdit) props.onEdit(task); }}
        onTouchStart={function(e) { sx.current = e.touches[0].clientX; dx.current = 0; sw.current = false; }}
        onTouchMove={function(e) {
          var d = e.touches[0].clientX - sx.current;
          if (Math.abs(d) > 10) { sw.current = true; dx.current = d; if (ref.current) { ref.current.style.transform = "translateX(" + Math.max(-90, Math.min(90, d)) + "px)"; ref.current.style.transition = "none"; } }
        }}
        onTouchEnd={async function() {
          if (ref.current) { ref.current.style.transform = ""; ref.current.style.transition = "transform .3s"; }
          if (sw.current && dx.current > 70) { try { await updTask(task.projectId, task.sectionId, task.id, { stage: done ? "in-progress" : "completed" }); toast(done ? "Reopened" : "Completed"); } catch(e) { toast("Failed", "err"); } }
          if (sw.current && dx.current < -70) setShowDel(true);
          sw.current = false;
        }}
        style={Object.assign({}, sCard, { padding: "10px 12px", cursor: "pointer", opacity: done ? 0.5 : 1, willChange: "transform", position: "relative", borderLeft: "3px solid " + pr.color })}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500, lineHeight: "1.4", flex: 1, textDecoration: done ? "line-through" : "none", color: done ? S.t3 : S.t1 }}>{task.name || "Untitled"}</span>
          <div style={{ display: "flex", flexShrink: 0 }}>
            {assignees.map(function(aid, i) {
              var mem = gM(aid);
              if (!mem) return null;
              return <div key={aid} style={{ width: 22, height: 22, borderRadius: "50%", background: mem.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", marginLeft: i > 0 ? -6 : 0, border: "2px solid white", position: "relative", zIndex: assignees.length - i }} title={mem.name}>{mem.ini}</div>;
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {props.showProj && task.projectName && (function() { var pc = pCol(task.projectId, ctx.prj); return <span style={{ fontSize: 10, color: S.t1, padding: "1px 6px 1px 4px", background: S.input, borderRadius: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: pc, flexShrink: 0 }} />{task.projectName}</span>; })()}
          {conObj && conObj.type && <span style={{ fontSize: 10, color: S.blue, padding: "1px 6px", background: S.infoBg, borderRadius: 4, fontWeight: 500 }}>{conObj.type}{conObj.name ? " \u2022 " + conObj.name : ""}</span>}
          <span style={badge(pr.bg, pr.color)}>{pr.label}</span>
          <span style={badge(st.bg, st.color)}>{st.label}</span>
          {task.dueDate && <span style={{ fontSize: 11, color: late ? S.err : S.t3, fontWeight: late ? 600 : 400 }}>{late ? "\u26A0 " : ""}{fD(task.dueDate)}</span>}
        </div>
      </div>
      {showDel && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.8)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 10 }}>
          <button style={Object.assign({}, sBD, { color: "white", background: S.err })} onClick={async function() { try { await delTask(task.projectId, task.sectionId, task.id); toast("Deleted"); } catch(e) { toast("Failed", "err"); } setShowDel(false); }}><ITrash s={13} /> Delete</button>
          <button style={Object.assign({}, sBG, { color: "white" })} onClick={function() { setShowDel(false); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* Add Task Modal */
function AddTaskM(props) {
  var ctx = useContext(Ctx);
  var savRef = useState(false);
  var sav = savRef[0], setSav = savRef[1];
  var iRef = useRef(null);
  var fRef = useState({ n: "", cat: "", p: "", s: "", assignees: [], pr: "medium", d: "", con: "" });
  var f = fRef[0], sF = fRef[1];

  useEffect(function() {
    if (props.open) {
      /* Determine initial category from defP */
      var initCat = "";
      var initP = props.defP || "";
      if (initP === "__business") { initCat = "business"; }
      else if (initP && ctx.prj[initP]) {
        var tp = ctx.prj[initP].data && ctx.prj[initP].data.type;
        initCat = tp === "acquisition" ? "acquisition" : "live";
      }
      sF(function(x) { return Object.assign({}, x, { n: "", cat: initCat || x.cat || "", p: initP || "", s: props.defS || x.s || "", assignees: [], pr: "medium", d: "", con: "" }); });
      setTimeout(function() { if (iRef.current) iRef.current.focus(); }, 300);
    }
  }, [props.open, props.defP, props.defS]);

  if (!props.open) return null;

  /* Build project lists by category */
  var liveProjects = Object.entries(ctx.prj).filter(function(e) { return e[0] !== "__business" && ((e[1].data && e[1].data.type) || "live") === "live"; }).map(function(e) { return { id: e[0], name: (e[1].data && e[1].data.name) || e[0] }; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  var acqProjects = Object.entries(ctx.prj).filter(function(e) { return e[0] !== "__business" && (e[1].data && e[1].data.type) === "acquisition"; }).map(function(e) { return { id: e[0], name: (e[1].data && e[1].data.name) || e[0] }; }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  var projectOptions = [];
  if (f.cat === "live") projectOptions = liveProjects;
  else if (f.cat === "acquisition") projectOptions = acqProjects;
  else if (f.cat === "business") projectOptions = [{ id: "__business", name: "Business Action Items" }];

  var selProj = ctx.prj[f.p];
  var secs = (selProj && selProj.data && selProj.data.sections) ? Object.entries(selProj.data.sections).map(function(e) { return { id: e[0], name: e[1].name || e[0] }; }) : [];
  var consultants = (selProj && selProj.data && selProj.data.sections && selProj.data.sections[f.s] && selProj.data.sections[f.s].consultants) || [];

  function toggleAssignee(mid) {
    sF(function(x) {
      var cur = x.assignees || [];
      var idx = cur.indexOf(mid);
      var next = idx >= 0 ? cur.filter(function(id) { return id !== mid; }) : cur.concat([mid]);
      return Object.assign({}, x, { assignees: next });
    });
  }

  var sub = async function() {
    if (!f.n.trim() || !f.p || !f.s) return;
    setSav(true);
    try {
      await ctx.addTask(f.p, f.s, { id: uid(), name: f.n.trim(), assignees: f.assignees.length > 0 ? f.assignees : [], assignee: f.assignees.length === 1 ? f.assignees[0] : null, priority: f.pr, dueDate: f.d || null, consultant: f.con || null, stage: "not-started", createdAt: new Date().toISOString() });
      ctx.toast("Task created");
      props.onClose();
    } catch(e) { ctx.toast("Failed", "err"); }
    finally { setSav(false); }
  };

  var canSubmit = f.n.trim() && f.p && f.s;
  var assigneeChk = { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, fontSize: 13 };

  /* Auto-select project and section for business */
  function onCatChange(newCat) {
    if (newCat === "business") {
      /* Auto-create business project if it doesnt exist */
      var biz = ctx.prj["__business"];
      if (!biz) {
        var bizSections = { general: { name: "General", tasks: [], consultants: [] } };
        var bizData = { name: "Business Action Items", type: "business", color: "#4f46e5", milestones: [], sections: bizSections };
        ctx.upd("__business", bizData);
        sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "__business", s: "general", con: "" }); });
      } else {
        var firstSec = "";
        if (biz.data && biz.data.sections) {
          var keys = Object.keys(biz.data.sections);
          if (keys.length > 0) firstSec = keys[0];
        }
        sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "__business", s: firstSec, con: "" }); });
      }
    } else {
      sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "", s: "", con: "" }); });
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title="New Task"
      footer={
        <>
          <button style={Object.assign({}, sBS, { flex: 1 })} onClick={props.onClose}>Cancel</button>
          <button style={Object.assign({}, sBP, { flex: 2, opacity: canSubmit ? 1 : 0.4 })} onClick={sub} disabled={sav || !canSubmit}>{sav ? "Creating..." : "Create Task"}</button>
        </>
      }>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Task Description</label><input ref={iRef} style={sInput} placeholder="What needs to be done?" value={f.n} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { n: e.target.value }); }); }} onKeyDown={function(e) { if (e.key === "Enter") sub(); }} /></div>

      {/* Category selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={lblS}>Category</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "live", label: "Live Project" }, { id: "acquisition", label: "Acquisition" }, { id: "business", label: "Business" }].map(function(cat) {
            var isActive = f.cat === cat.id;
            return (
              <button key={cat.id} onClick={function() { onCatChange(cat.id); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "1px solid " + (isActive ? S.blue : S.brd), background: isActive ? S.infoBg : S.input, color: isActive ? S.blue : S.t2, cursor: "pointer", fontFamily: fontBo, transition: "all .15s" }}>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project dropdown - hidden for business since auto-selected */}
      {f.cat && f.cat !== "business" && projectOptions.length > 0 && (
        <div style={{ marginBottom: 12 }}><label style={lblS}>Project</label><select style={sInput} value={f.p} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { p: e.target.value, s: "", con: "" }); }); }}><option value="">Select project...</option>{projectOptions.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}</select></div>
      )}
      {f.cat === "business" && <div style={{ marginBottom: 12, padding: "8px 12px", background: S.infoBg, borderRadius: 8, fontSize: 12, color: S.blue }}>Adding to Business Action Items</div>}

      {secs.length > 0 && f.cat !== "business" && <div style={{ marginBottom: 12 }}><label style={lblS}>Section</label><select style={sInput} value={f.s} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { s: e.target.value, con: "" }); }); }}><option value="">Select section...</option>{secs.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}</select></div>}
      {consultants.length > 0 && <div style={{ marginBottom: 12 }}><label style={lblS}>Consultant</label><select style={sInput} value={f.con} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { con: e.target.value }); }); }}><option value="">None</option>{consultants.map(function(c) { return <option key={c.id} value={c.id}>{(c.type ? c.type + ": " : "") + c.name + (c.company ? " (" + c.company + ")" : "")}</option>; })}</select></div>}
      <div style={{ marginBottom: 12 }}>
        <label style={lblS}>Assignees</label>
        <div style={Object.assign({}, sCard, { padding: 4 })}>
          {TEAM.map(function(m) {
            var isOn = (f.assignees || []).indexOf(m.id) >= 0;
            return (
              <div key={m.id} onClick={function() { toggleAssignee(m.id); }} style={Object.assign({}, assigneeChk, { background: isOn ? S.infoBg : "transparent" })}>
                <input type="checkbox" checked={isOn} readOnly style={{ width: 16, height: 16, accentColor: S.blue, cursor: "pointer" }} />
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white" }}>{m.ini}</div>
                <span style={{ color: S.t1 }}>{m.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Priority</label><select style={sInput} value={f.pr} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { pr: e.target.value }); }); }}>{PRIS.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}</select></div>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Due Date</label><input style={sInput} type="date" value={f.d} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { d: e.target.value }); }); }} /></div>
    </Modal>
  );
}

/* Edit Task Modal */
function EditTaskM(props) {
  var ctx = useContext(Ctx);
  var savRef = useState(false);
  var sav = savRef[0], setSav = savRef[1];
  var fRef = useState({});
  var f = fRef[0], sF = fRef[1];

  useEffect(function() {
    if (props.task && props.open) {
      var t = props.task;
      /* Determine category from project type */
      var cat = "live";
      if (t.projectId === "__business") cat = "business";
      else if (ctx.prj[t.projectId] && ctx.prj[t.projectId].data && ctx.prj[t.projectId].data.type === "acquisition") cat = "acquisition";
      sF({ n: t.name || "", cat: cat, p: t.projectId || "", s: t.sectionId || "", assignees: getAssignees(t), pr: t.priority || "medium", d: t.dueDate || "", st: t.stage || "not-started", con: t.consultant || "" });
    }
  }, [props.task, props.open]);

  if (!props.open || !props.task) return null;
  var task = props.task;

  /* Build project lists by category */
  var liveProjects = Object.entries(ctx.prj).filter(function(e) { return e[0] !== "__business" && ((e[1].data && e[1].data.type) || "live") === "live"; }).map(function(e) { return { id: e[0], name: (e[1].data && e[1].data.name) || e[0] }; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  var acqProjects = Object.entries(ctx.prj).filter(function(e) { return e[0] !== "__business" && (e[1].data && e[1].data.type) === "acquisition"; }).map(function(e) { return { id: e[0], name: (e[1].data && e[1].data.name) || e[0] }; }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  var projectOptions = [];
  if (f.cat === "live") projectOptions = liveProjects;
  else if (f.cat === "acquisition") projectOptions = acqProjects;
  else if (f.cat === "business") projectOptions = [{ id: "__business", name: "Business Action Items" }];

  var selProj = ctx.prj[f.p];
  var secs = (selProj && selProj.data && selProj.data.sections) ? Object.entries(selProj.data.sections).map(function(e) { return { id: e[0], name: e[1].name || e[0] }; }) : [];
  var consultants = (selProj && selProj.data && selProj.data.sections && selProj.data.sections[f.s] && selProj.data.sections[f.s].consultants) || [];

  function toggleAssignee(mid) {
    sF(function(x) {
      var cur = x.assignees || [];
      var idx = cur.indexOf(mid);
      var next = idx >= 0 ? cur.filter(function(id) { return id !== mid; }) : cur.concat([mid]);
      return Object.assign({}, x, { assignees: next });
    });
  }

  function onCatChange(newCat) {
    if (newCat === "business") {
      var biz = ctx.prj["__business"];
      if (!biz) {
        var bizSections = { general: { name: "General", tasks: [], consultants: [] } };
        var bizData = { name: "Business Action Items", type: "business", color: "#4f46e5", milestones: [], sections: bizSections };
        ctx.upd("__business", bizData);
        sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "__business", s: "general", con: "" }); });
      } else {
        var firstSec = "";
        if (biz.data && biz.data.sections) { var keys = Object.keys(biz.data.sections); if (keys.length > 0) firstSec = keys[0]; }
        sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "__business", s: firstSec, con: "" }); });
      }
    } else {
      sF(function(x) { return Object.assign({}, x, { cat: newCat, p: "", s: "", con: "" }); });
    }
  }

  var assigneeChk = { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, fontSize: 13 };

  var save = async function() {
    if (!f.n || !f.n.trim() || !f.p || !f.s) return;
    setSav(true);
    try {
      var moved = f.p !== task.projectId || f.s !== task.sectionId;
      if (moved) {
        /* Delete from old location, add to new */
        await ctx.delTask(task.projectId, task.sectionId, task.id);
        await ctx.addTask(f.p, f.s, { id: task.id, name: f.n.trim(), assignees: f.assignees || [], assignee: (f.assignees && f.assignees.length === 1) ? f.assignees[0] : null, priority: f.pr, dueDate: f.d || null, stage: f.st, consultant: f.con || null, createdAt: task.createdAt || new Date().toISOString() });
        ctx.toast("Task moved & updated");
      } else {
        await ctx.updTask(task.projectId, task.sectionId, task.id, { name: f.n.trim(), assignees: f.assignees || [], assignee: (f.assignees && f.assignees.length === 1) ? f.assignees[0] : null, priority: f.pr, dueDate: f.d || null, stage: f.st, consultant: f.con || null });
        ctx.toast("Updated");
      }
      props.onClose();
    } catch(e) { ctx.toast("Failed", "err"); }
    finally { setSav(false); }
  };

  var canSave = f.n && f.n.trim() && f.p && f.s;

  return (
    <Modal open={props.open} onClose={props.onClose} title="Edit Task"
      footer={
        <>
          <button style={sBD} onClick={async function() { try { await ctx.delTask(task.projectId, task.sectionId, task.id); ctx.toast("Deleted"); props.onClose(); } catch(e) { ctx.toast("Failed", "err"); } }}><ITrash s={14} /></button>
          <div style={{ flex: 1 }} />
          <button style={sBS} onClick={props.onClose}>Cancel</button>
          <button style={Object.assign({}, sBP, { opacity: canSave ? 1 : 0.4 })} onClick={save} disabled={sav || !canSave}>{sav ? "..." : "Save"}</button>
        </>
      }>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Task Description</label><input style={sInput} value={f.n || ""} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { n: e.target.value }); }); }} /></div>

      <div style={{ marginBottom: 12 }}><label style={lblS}>Status</label><select style={sInput} value={f.st || ""} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { st: e.target.value }); }); }}>{STAGES.map(function(s) { return <option key={s.id} value={s.id}>{s.label}</option>; })}</select></div>

      {/* Category */}
      <div style={{ marginBottom: 12 }}>
        <label style={lblS}>Category</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "live", label: "Live Project" }, { id: "acquisition", label: "Acquisition" }, { id: "business", label: "Business" }].map(function(cat) {
            var isActive = f.cat === cat.id;
            return (
              <button key={cat.id} onClick={function() { onCatChange(cat.id); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "1px solid " + (isActive ? S.blue : S.brd), background: isActive ? S.infoBg : S.input, color: isActive ? S.blue : S.t2, cursor: "pointer", fontFamily: fontBo, transition: "all .15s" }}>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project */}
      {f.cat && f.cat !== "business" && projectOptions.length > 0 && (
        <div style={{ marginBottom: 12 }}><label style={lblS}>Project</label><select style={sInput} value={f.p} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { p: e.target.value, s: "", con: "" }); }); }}><option value="">Select project...</option>{projectOptions.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}</select></div>
      )}
      {f.cat === "business" && <div style={{ marginBottom: 12, padding: "8px 12px", background: S.infoBg, borderRadius: 8, fontSize: 12, color: S.blue }}>Business Action Items</div>}

      {/* Section */}
      {secs.length > 0 && f.cat !== "business" && <div style={{ marginBottom: 12 }}><label style={lblS}>Section</label><select style={sInput} value={f.s} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { s: e.target.value, con: "" }); }); }}><option value="">Select section...</option>{secs.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}</select></div>}

      {/* Consultant */}
      {consultants.length > 0 && <div style={{ marginBottom: 12 }}><label style={lblS}>Consultant</label><select style={sInput} value={f.con || ""} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { con: e.target.value }); }); }}><option value="">None</option>{consultants.map(function(c) { return <option key={c.id} value={c.id}>{(c.type ? c.type + ": " : "") + c.name + (c.company ? " (" + c.company + ")" : "")}</option>; })}</select></div>}

      {/* Assignees */}
      <div style={{ marginBottom: 12 }}>
        <label style={lblS}>Assignees</label>
        <div style={Object.assign({}, sCard, { padding: 4 })}>
          {TEAM.map(function(m) {
            var isOn = (f.assignees || []).indexOf(m.id) >= 0;
            return (
              <div key={m.id} onClick={function() { toggleAssignee(m.id); }} style={Object.assign({}, assigneeChk, { background: isOn ? S.infoBg : "transparent" })}>
                <input type="checkbox" checked={isOn} readOnly style={{ width: 16, height: 16, accentColor: S.blue, cursor: "pointer" }} />
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white" }}>{m.ini}</div>
                <span style={{ color: S.t1 }}>{m.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority */}
      <div style={{ marginBottom: 12 }}><label style={lblS}>Priority</label><select style={sInput} value={f.pr || ""} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { pr: e.target.value }); }); }}>{PRIS.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}</select></div>

      {/* Due Date */}
      <div style={{ marginBottom: 12 }}><label style={lblS}>Due Date</label><input style={sInput} type="date" value={f.d || ""} onChange={function(e) { sF(function(x) { return Object.assign({}, x, { d: e.target.value }); }); }} /></div>
    </Modal>
  );
}

/* Download Icon */
function IDownload(p) { return <Ic {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Ic>; }

/* Export Modal */
function ExportModal(props) {
  var ctx = useContext(Ctx);
  var prj = ctx.prj;
  var projList = useMemo(function() {
    return Object.entries(prj).filter(function(e) { return e[0] !== "__business"; }).map(function(e) {
      return { id: e[0], name: (e[1].data && e[1].data.name) || e[0], type: (e[1].data && e[1].data.type) || "live" };
    }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [prj]);

  var staffRef = useState({}); var staff = staffRef[0], setStaff = staffRef[1];
  var projsRef = useState({}); var selProjs = projsRef[0], setSelProjs = projsRef[1];
  var stagesRef = useState({}); var selStages = stagesRef[0], setSelStages = stagesRef[1];
  var prisRef = useState({}); var selPris = prisRef[0], setSelPris = prisRef[1];
  var optRef = useState({ milestones: true, consultants: true, unassigned: true, bizItems: true }); var opts = optRef[0], setOpts = optRef[1];

  useEffect(function() {
    if (props.open) {
      var s = {}; TEAM.forEach(function(m) { s[m.id] = true; }); setStaff(s);
      var p = {}; projList.forEach(function(pr) { p[pr.id] = true; }); setSelProjs(p);
      var st = {}; STAGES.forEach(function(sg) { st[sg.id] = true; }); setSelStages(st);
      var pr = {}; PRIS.forEach(function(pi) { pr[pi.id] = true; }); setSelPris(pr);
      setOpts({ milestones: true, consultants: true, unassigned: true, bizItems: true });
    }
  }, [props.open, projList]);

  if (!props.open) return null;

  function toggleAll(setter, items, keyFn) {
    setter(function(prev) {
      var allOn = items.every(function(it) { return prev[keyFn(it)]; });
      var next = {}; items.forEach(function(it) { next[keyFn(it)] = !allOn; }); return next;
    });
  }

  function doExport() {
    var stageIds = {}; STAGES.filter(function(s) { return selStages[s.id]; }).forEach(function(s) { stageIds[s.id] = true; });
    var priIds = {}; PRIS.filter(function(p) { return selPris[p.id]; }).forEach(function(p) { priIds[p.id] = true; });
    var staffIds = {}; TEAM.filter(function(m) { return staff[m.id]; }).forEach(function(m) { staffIds[m.id] = true; });
    var dateStr = new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    var totalTasks = 0;
    var h = [];
    h.push("<!DOCTYPE html><html><head><meta charset='utf-8'><title>SALT Report</title>");
    h.push("<link href='https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700&display=swap' rel='stylesheet'>");
    h.push("<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Outfit',sans-serif;color:#1a1f2e;background:#fff;padding:40px;max-width:900px;margin:0 auto}");
    h.push(".hdr{display:flex;align-items:center;gap:16px;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #2563eb}");
    h.push(".hdr-logo{width:40px;height:40px;background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-family:'DM Serif Display',serif;font-size:18px}");
    h.push(".hdr-txt{font-family:'DM Serif Display',serif;font-size:24px}.hdr-sub{font-size:12px;color:#8b92a5}");
    h.push(".proj{margin-bottom:28px;page-break-inside:avoid}.proj-title{font-family:'DM Serif Display',serif;font-size:18px;padding:8px 0 4px;border-left:4px solid var(--pc,#2563eb);padding-left:12px;margin-bottom:12px}");
    h.push(".sec{margin:12px 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#5a6278;border-bottom:1px solid #eceef2;padding-bottom:4px}");
    h.push(".task{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;border-bottom:1px solid #f4f5f7}.task:last-child{border:none}");
    h.push(".chk{width:12px;height:12px;border:2px solid #d0d3d9;border-radius:3px;flex-shrink:0}.chk-d{background:#059669;border-color:#059669}");
    h.push(".badge{display:inline-block;padding:1px 6px;border-radius:99px;font-size:9px;font-weight:500;margin-left:4px}");
    h.push(".b-h{background:#fef2f2;color:#dc2626}.b-m{background:#fffbeb;color:#d97706}.b-l{background:#f1f5f9;color:#94a3b8}");
    h.push(".b-ip{background:#eff6ff;color:#2563eb}.b-ar{background:#fffbeb;color:#d97706}.b-ns{background:#f1f5f9;color:#94a3b8}.b-done{background:#ecfdf5;color:#059669}.b-oh{background:#fef2f2;color:#dc2626}");
    h.push(".con{font-size:11px;color:#2563eb;padding:2px 0;margin-left:20px}");
    h.push(".ms{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px}");
    h.push(".due{font-size:11px;color:#8b92a5;margin-left:auto;white-space:nowrap}");
    h.push(".footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e5ea;font-size:10px;color:#8b92a5;display:flex;justify-content:space-between}");
    h.push("@media print{body{padding:20px}.proj{page-break-inside:avoid}}</style></head><body>");
    h.push("<div class='hdr'><div class='hdr-logo'>S</div><div><div class='hdr-txt'>SALT Project Report</div><div class='hdr-sub'>" + dateStr + "</div></div></div>");

    projList.filter(function(p) { return selProjs[p.id]; }).forEach(function(proj) {
      var p = prj[proj.id]; if (!p || !p.data) return;
      var pc = pCol(proj.id, prj);
      h.push("<div class='proj' style='--pc:" + pc + "'><div class='proj-title'>" + (p.data.name || proj.id) + "</div>");
      if (opts.milestones && p.data.milestones && p.data.milestones.length) {
        h.push("<div class='sec'>Key Milestones & Hurdles</div>");
        p.data.milestones.forEach(function(m) { h.push("<div class='ms'><div class='chk " + (m.completed ? "chk-d" : "") + "'></div><span style='" + (m.completed ? "text-decoration:line-through;color:#8b92a5" : "") + "'>" + m.name + "</span>" + (m.dueDate ? "<span class='due'>" + fD(m.dueDate) + "</span>" : "") + "</div>"); });
      }
      Object.entries(p.data.sections || {}).forEach(function(e) {
        var sid = e[0], sec = e[1];
        var secTasks = (sec.tasks || []).filter(function(t) {
          if (!stageIds[t.stage]) return false; if (!priIds[t.priority]) return false;
          var ta = getAssignees(t);
          if (ta.length > 0 && !ta.some(function(a) { return staffIds[a]; })) return false;
          if (ta.length === 0 && !opts.unassigned) return false; return true;
        });
        if (secTasks.length === 0 && !(opts.consultants && sec.consultants && sec.consultants.length)) return;
        h.push("<div class='sec'>" + gSecName(sid, sec) + "</div>");
        if (opts.consultants && sec.consultants && sec.consultants.length) {
          sec.consultants.forEach(function(c) { h.push("<div class='con'>" + (c.type || "") + ": " + c.name + (c.company ? " (" + c.company + ")" : "") + "</div>"); });
        }
        secTasks.forEach(function(t) {
          totalTasks++;
          var stCls = t.stage === "in-progress" ? "b-ip" : t.stage === "awaiting-response" ? "b-ar" : t.stage === "completed" ? "b-done" : t.stage === "on-hold" ? "b-oh" : "b-ns";
          var prCls = t.priority === "high" ? "b-h" : t.priority === "medium" ? "b-m" : "b-l";
          var memNames = getAssignees(t).map(function(a) { var m = gM(a); return m ? m.name.split(" ")[0] : a; }).join(", ");
          h.push("<div class='task'><div class='chk " + (t.stage === "completed" ? "chk-d" : "") + "'></div><span style='flex:1'>" + (t.name || "Untitled") + "</span><span class='badge " + stCls + "'>" + gS(t.stage).label + "</span><span class='badge " + prCls + "'>" + gP(t.priority).label + "</span>" + (memNames ? "<span style='font-size:11px;color:#5a6278'>" + memNames + "</span>" : "") + (t.dueDate ? "<span class='due'>" + fD(t.dueDate) + "</span>" : "") + "</div>");
        });
      });
      h.push("</div>");
    });
    if (opts.bizItems && prj["__business"]) {
      h.push("<div class='proj'><div class='proj-title'>Business Action Items</div>");
      Object.entries(prj["__business"].data.sections || {}).forEach(function(e) {
        (e[1].tasks || []).filter(function(t) { var ta = getAssignees(t); return stageIds[t.stage] && priIds[t.priority] && (ta.length === 0 || ta.some(function(a) { return staffIds[a]; })); }).forEach(function(t) {
          totalTasks++;
          h.push("<div class='task'><div class='chk " + (t.stage === "completed" ? "chk-d" : "") + "'></div><span style='flex:1'>" + t.name + "</span><span class='due'>" + (t.dueDate ? fD(t.dueDate) : "") + "</span></div>");
        });
      });
      h.push("</div>");
    }
    h.push("<div class='footer'><span>SALT Property Development - " + totalTasks + " tasks</span><span>" + dateStr + "</span></div>");
    h.push("</body></html>");
    var blob = new Blob([h.join("")], { type: "text/html" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "SALT-Report-" + new Date().toISOString().split("T")[0] + ".html"; a.click();
    ctx.toast("Report downloaded"); props.onClose();
  }

  var cr = { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13, color: S.t1 };
  var cb = { width: 17, height: 17, accentColor: S.blue, cursor: "pointer" };
  var secLbl = Object.assign({}, lblS, { marginBottom: 8, marginTop: 14, borderTop: "1px solid " + S.brdL, paddingTop: 12 });

  return (
    <Modal open={props.open} onClose={props.onClose} title="Export Report"
      footer={<>
        <button style={Object.assign({}, sBS, { flex: 1 })} onClick={props.onClose}>Cancel</button>
        <button style={Object.assign({}, sBP, { flex: 2 })} onClick={doExport}><IDownload s={14} /> Download</button>
      </>}>
      <p style={{ fontSize: 12, color: S.t3, marginBottom: 4 }}>Choose what to include in your report.</p>

      <label style={secLbl}>Staff Members</label>
      <div onClick={function() { toggleAll(setStaff, TEAM, function(m) { return m.id; }); }} style={Object.assign({}, cr, { fontWeight: 600, color: S.t2, fontSize: 12 })}><input type="checkbox" checked={TEAM.every(function(m) { return staff[m.id]; })} readOnly style={cb} /><span>Select All</span></div>
      {TEAM.map(function(m) { return <div key={m.id} onClick={function() { setStaff(function(p) { var n = Object.assign({}, p); n[m.id] = !p[m.id]; return n; }); }} style={cr}><input type="checkbox" checked={!!staff[m.id]} readOnly style={cb} /><div style={{ width: 18, height: 18, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white" }}>{m.ini}</div><span>{m.name}</span></div>; })}

      <label style={secLbl}>Projects</label>
      <div onClick={function() { toggleAll(setSelProjs, projList, function(p) { return p.id; }); }} style={Object.assign({}, cr, { fontWeight: 600, color: S.t2, fontSize: 12 })}><input type="checkbox" checked={projList.every(function(p) { return selProjs[p.id]; })} readOnly style={cb} /><span>Select All</span></div>
      {projList.map(function(p) { return <div key={p.id} onClick={function() { setSelProjs(function(prev) { var n = Object.assign({}, prev); n[p.id] = !prev[p.id]; return n; }); }} style={cr}><input type="checkbox" checked={!!selProjs[p.id]} readOnly style={cb} /><div style={{ width: 7, height: 7, borderRadius: "50%", background: pCol(p.id, prj) }} /><span style={{ flex: 1 }}>{p.name}</span><span style={{ fontSize: 10, color: S.t3 }}>{p.type}</span></div>; })}

      <label style={secLbl}>Status</label>
      <div onClick={function() { toggleAll(setSelStages, STAGES, function(s) { return s.id; }); }} style={Object.assign({}, cr, { fontWeight: 600, color: S.t2, fontSize: 12 })}><input type="checkbox" checked={STAGES.every(function(s) { return selStages[s.id]; })} readOnly style={cb} /><span>Select All</span></div>
      {STAGES.map(function(s) { return <div key={s.id} onClick={function() { setSelStages(function(prev) { var n = Object.assign({}, prev); n[s.id] = !prev[s.id]; return n; }); }} style={cr}><input type="checkbox" checked={!!selStages[s.id]} readOnly style={cb} /><div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} /><span>{s.label}</span></div>; })}

      <label style={secLbl}>Priority</label>
      <div onClick={function() { toggleAll(setSelPris, PRIS, function(p) { return p.id; }); }} style={Object.assign({}, cr, { fontWeight: 600, color: S.t2, fontSize: 12 })}><input type="checkbox" checked={PRIS.every(function(p) { return selPris[p.id]; })} readOnly style={cb} /><span>Select All</span></div>
      {PRIS.map(function(p) { return <div key={p.id} onClick={function() { setSelPris(function(prev) { var n = Object.assign({}, prev); n[p.id] = !prev[p.id]; return n; }); }} style={cr}><input type="checkbox" checked={!!selPris[p.id]} readOnly style={cb} /><div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} /><span>{p.label}</span></div>; })}

      <label style={secLbl}>Additional</label>
      {[{ k: "milestones", l: "Key Milestones & Hurdles" }, { k: "consultants", l: "Consultant Details" }, { k: "unassigned", l: "Unassigned Tasks" }, { k: "bizItems", l: "Business Action Items" }].map(function(o) {
        return <div key={o.k} onClick={function() { setOpts(function(prev) { var n = Object.assign({}, prev); n[o.k] = !prev[o.k]; return n; }); }} style={cr}><input type="checkbox" checked={!!opts[o.k]} readOnly style={cb} /><span>{o.l}</span></div>;
      })}
    </Modal>
  );
}

/* Dashboard */
function Dash() {
  var ctx = useContext(Ctx);
  var prj = ctx.prj, loading = ctx.loading, isMock = ctx.isMock;
  var addRef = useState(false); var showAdd = addRef[0], setShowAdd = addRef[1];
  var editRef = useState(null); var editing = editRef[0], setEditing = editRef[1];
  var filtRef = useState("all"); var filter = filtRef[0], setFilter = filtRef[1];
  var persRef = useState(null); var personFilter = persRef[0], setPersonFilter = persRef[1];
  var expRef = useState(false); var showExport = expRef[0], setShowExport = expRef[1];

  var at = useMemo(function() { return getAll(prj); }, [prj]);
  var stats = useMemo(function() {
    var s = { total: at.length, done: 0, ip: 0, ar: 0, od: 0 };
    at.forEach(function(t) { if (t.stage === "completed") s.done++; if (t.stage === "in-progress") s.ip++; if (t.stage === "awaiting-response") s.ar++; if (isOD(t.dueDate, t.stage)) s.od++; });
    return s;
  }, [at]);

  var filtered = useMemo(function() {
    var f = at;
    if (personFilter) f = f.filter(function(t) { return hasAssignee(t, personFilter); });
    switch (filter) {
      case "od": f = f.filter(function(t) { return isOD(t.dueDate, t.stage); }); break;
      case "ip": f = f.filter(function(t) { return t.stage === "in-progress"; }); break;
      case "ar": f = f.filter(function(t) { return t.stage === "awaiting-response"; }); break;
      case "done": f = f.filter(function(t) { return t.stage === "completed"; }); break;
      default: f = f.filter(function(t) { return t.stage !== "completed"; });
    }
    return srt(f);
  }, [at, filter, personFilter]);

  var ts = useMemo(function() {
    return TEAM.map(function(m) {
      var mt = at.filter(function(t) { return hasAssignee(t, m.id) && t.stage !== "completed"; });
      return Object.assign({}, m, { n: mt.length, od: mt.filter(function(t) { return isOD(t.dueDate, t.stage); }).length });
    });
  }, [at]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div style={{ width: 28, height: 28, border: "3px solid " + S.brdL, borderTopColor: S.blue, borderRadius: "50%", animation: "saltSpin .8s linear infinite" }} /></div>;

  return (
    <div>
      {isMock && <div style={{ padding: "8px 12px", background: S.infoBg, border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 14, fontSize: 12, color: S.blue }}>Preview mode</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: fontDi, fontSize: 26, fontWeight: 400, color: S.t1 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: S.t3, marginTop: 2 }}>{stats.total} tasks across {Object.keys(prj).length} projects</p>
        </div>
        <button onClick={function() { setShowExport(true); }} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: S.t3, background: "none", border: "1px solid " + S.brdL, cursor: "pointer", marginTop: 2 }} title="Export Report"><IDownload s={16} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 20 }}>
        {[{ k: "od", v: stats.od, l: "Overdue", fg: S.err }, { k: "ip", v: stats.ip, l: "In Progress", fg: S.info }, { k: "ar", v: stats.ar, l: "Awaiting", fg: S.warn }, { k: "done", v: stats.done, l: "Completed", fg: S.ok }].map(function(s) {
          return (
            <div key={s.k} onClick={function() { setFilter(function(f) { return f === s.k ? "all" : s.k; }); }} style={Object.assign({}, sCard, { padding: 14, cursor: "pointer", borderLeft: filter === s.k ? "3px solid " + s.fg : "3px solid transparent" })}>
              <div style={{ fontFamily: fontDi, fontSize: 26, lineHeight: 1, color: s.fg }}>{s.v}</div>
              <div style={{ fontSize: 11, color: S.t3, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500, marginTop: 2 }}>{s.l}</div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontFamily: fontDi, fontSize: 16, color: S.t1, marginBottom: 8 }}>Team</h2>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 20 }}>
        {ts.map(function(m) {
          return (
            <div key={m.id} onClick={function() { setPersonFilter(function(p) { return p === m.id ? null : m.id; }); }}
              style={Object.assign({}, sCard, { flex: "0 0 auto", minWidth: 110, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", borderBottom: personFilter === m.id ? "2px solid " + m.color : "2px solid transparent" })}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>{m.ini}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: S.t1 }}>{m.name.split(" ")[0]}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                <span style={{ color: S.t2 }}>{m.n}</span>
                {m.od > 0 && <span style={{ color: S.err }}>{m.od} late</span>}
              </div>
            </div>
          );
        })}
      </div>

      {personFilter && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: S.t2 }}>Filtered: <strong style={{ color: S.t1 }}>{(gM(personFilter) || {}).name}</strong></span>
          <button style={sBG} onClick={function() { setPersonFilter(null); }}>Clear</button>
        </div>
      )}

      {/* Upcoming Deadlines */}
      {(function() {
        var upcoming = at.filter(function(t) { return t.dueDate && t.stage !== "completed"; }).sort(function(a, b) { return new Date(a.dueDate) - new Date(b.dueDate); }).slice(0, 5);
        if (upcoming.length === 0) return null;
        return (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: fontDi, fontSize: 16, color: S.t1, marginBottom: 8 }}>Upcoming Deadlines</h2>
            {upcoming.map(function(t) {
              var late = isOD(t.dueDate, t.stage);
              var pc = pCol(t.projectId, ctx.prj);
              return (
                <div key={t.projectId + t.id} onClick={function() { setEditing(t); }} style={Object.assign({}, sCard, { padding: "8px 12px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderLeft: "3px solid " + (late ? S.err : pc) })}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: S.t1 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: S.t3 }}>{t.projectName}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: late ? S.err : S.t2 }}>{late ? "\u26A0 " : ""}{fD(t.dueDate)}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: S.t3 }}>
          <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>{filter === "od" ? "\u2705" : "\u{1F4CB}"}</div>
          <div style={{ fontFamily: fontDi, fontSize: 17, color: S.t2 }}>{filter === "od" ? "Nothing overdue" : "No tasks"}</div>
        </div>
      ) : filtered.slice(0, 80).map(function(t) {
        return <TaskCard key={t.projectId + t.sectionId + t.id} task={t} showProj={true} onEdit={setEditing} />;
      })}

      <button onClick={function() { setShowAdd(true); }} style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom,0px) + 14px)", right: 14, width: 52, height: 52, borderRadius: "50%", background: S.blue, color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: S.shadowLg, zIndex: 100, border: "none", cursor: "pointer" }}><IPlus s={22} /></button>
      <AddTaskM open={showAdd} onClose={function() { setShowAdd(false); }} />
      <EditTaskM task={editing} open={!!editing} onClose={function() { setEditing(null); }} />
      <ExportModal open={showExport} onClose={function() { setShowExport(false); }} />
    </div>
  );
}

/* This Week */
function Week() {
  var ctx = useContext(Ctx);
  var prj = ctx.prj, loading = ctx.loading, isMock = ctx.isMock;
  var addRef = useState(false); var showAdd = addRef[0], setShowAdd = addRef[1];
  var editRef = useState(null); var editing = editRef[0], setEditing = editRef[1];
  var viewRef = useState("day"); var view = viewRef[0], setView = viewRef[1];
  var persRef = useState(null); var personFilter = persRef[0], setPersonFilter = persRef[1];

  var at = useMemo(function() { return getAll(prj); }, [prj]);
  var days = useMemo(function() {
    var now = new Date(), mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + 1);
    mon.setHours(0, 0, 0, 0);
    var nm = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return Array.from({ length: 7 }, function(_, i) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      return { nm: nm[i], dt: d.toISOString().split("T")[0], today: d.toDateString() === now.toDateString(), past: d < new Date(now.toDateString()) };
    });
  }, []);

  var base = useMemo(function() { var f = at; if (personFilter) f = f.filter(function(t) { return hasAssignee(t, personFilter); }); return f; }, [at, personFilter]);
  var wt = useMemo(function() { return base.filter(function(t) { return t.dueDate && t.dueDate >= days[0].dt && t.dueDate <= days[6].dt; }); }, [base, days]);
  var od = useMemo(function() { return srt(base.filter(function(t) { return isOD(t.dueDate, t.stage); }), "due"); }, [base]);
  var byDay = useMemo(function() { var m = {}; days.forEach(function(d) { m[d.dt] = srt(wt.filter(function(t) { return t.dueDate === d.dt; })); }); return m; }, [wt, days]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div style={{ width: 28, height: 28, border: "3px solid " + S.brdL, borderTopColor: S.blue, borderRadius: "50%", animation: "saltSpin .8s linear infinite" }} /></div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: fontDi, fontSize: 26, fontWeight: 400, color: S.t1 }}>This Week</h1>
        <p style={{ fontSize: 13, color: S.t3, marginTop: 2 }}>{wt.length} due &middot; {od.length} overdue</p>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: S.t3, fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>Staff:</span>
        <FTab active={!personFilter} label="All" onClick={function() { setPersonFilter(null); }} />
        {TEAM.map(function(m) { return <FTab key={m.id} active={personFilter === m.id} label={m.name.split(" ")[0]} onClick={function() { setPersonFilter(function(p) { return p === m.id ? null : m.id; }); }} />; })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <FTab active={view === "day"} label="By Day" onClick={function() { setView("day"); }} />
        <FTab active={view === "all"} label="All" count={wt.length} onClick={function() { setView("all"); }} />
      </div>

      {od.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IAlert s={14} style={{ color: S.err }} />
            <span style={{ fontFamily: fontDi, fontSize: 14, color: S.err }}>Overdue</span>
            <span style={badge(S.errBg, S.err)}>{od.length}</span>
          </div>
          {od.map(function(t) { return <TaskCard key={t.projectId + t.sectionId + t.id} task={t} showProj={true} onEdit={setEditing} />; })}
        </div>
      )}

      {view === "day" ? days.map(function(day) {
        var dt = byDay[day.dt] || [];
        return (
          <div key={day.dt} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "4px 0" }}>
              <span style={{ fontFamily: fontDi, fontSize: 14, color: day.today ? S.blue : day.past ? S.t3 : S.t1 }}>{day.nm}</span>
              {day.today && <span style={badge(S.infoBg, S.blue)}>Today</span>}
              <span style={{ fontSize: 11, color: S.t3 }}>{new Date(day.dt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
            </div>
            {dt.length === 0 ? <div style={Object.assign({}, sCard, { padding: "8px 12px", textAlign: "center", color: S.t3, fontSize: 12, opacity: day.past ? 0.5 : 0.7 })}>No tasks due</div>
              : dt.map(function(t) { return <TaskCard key={t.projectId + t.sectionId + t.id} task={t} showProj={true} onEdit={setEditing} />; })}
          </div>
        );
      }) : (wt.length === 0 ? <div style={{ textAlign: "center", padding: 48, color: S.t3 }}>No tasks this week</div>
        : srt(wt, "due").map(function(t) { return <TaskCard key={t.projectId + t.sectionId + t.id} task={t} showProj={true} onEdit={setEditing} />; }))}

      <button onClick={function() { setShowAdd(true); }} style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom,0px) + 14px)", right: 14, width: 52, height: 52, borderRadius: "50%", background: S.blue, color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: S.shadowLg, zIndex: 100, border: "none", cursor: "pointer" }}><IPlus s={22} /></button>
      <AddTaskM open={showAdd} onClose={function() { setShowAdd(false); }} />
      <EditTaskM task={editing} open={!!editing} onClose={function() { setEditing(null); }} />
    </div>
  );
}

/* All Projects */
/* Add Project Modal with color picker */
function AddProjModal(props) {
  var ctx = useContext(Ctx);
  var nmRef = useState(""); var nm = nmRef[0], setNm = nmRef[1];
  var tpRef = useState("live"); var tp = tpRef[0], setTp = tpRef[1];
  var clrRef = useState(COLORS[0]); var clr = clrRef[0], setClr = clrRef[1];
  var lotsRef = useState(""); var lots = lotsRef[0], setLots = lotsRef[1];
  var grvRef = useState(""); var grv = grvRef[0], setGrv = grvRef[1];
  var addrRef = useState(""); var addr = addrRef[0], setAddr = addrRef[1];
  var descRef = useState(""); var desc = descRef[0], setDesc = descRef[1];
  var savRef = useState(false); var sav = savRef[0], setSav = savRef[1];
  var iRef = useRef(null);

  useEffect(function() {
    if (props.open) {
      setNm(""); setLots(""); setGrv(""); setAddr(""); setDesc("");
      setTp(props.defType || "live");
      setClr(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setTimeout(function() { if (iRef.current) iRef.current.focus(); }, 300);
    }
  }, [props.open, props.defType]);

  if (!props.open) return null;

  var sub = function() {
    if (!nm.trim()) return;
    setSav(true);
    ctx.addProj(nm.trim(), tp, clr, { lots: lots, grv: grv, address: addr, description: desc }).then(function() { ctx.toast("Created"); props.onClose(); }).catch(function(e) { ctx.toast(e.message || "Failed", "err"); }).finally(function() { setSav(false); });
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="New Project"
      footer={<><button style={Object.assign({}, sBS, { flex: 1 })} onClick={props.onClose}>Cancel</button><button style={Object.assign({}, sBP, { flex: 2, opacity: nm.trim() ? 1 : 0.4 })} onClick={sub} disabled={sav || !nm.trim()}>{sav ? "Creating..." : "Create"}</button></>}>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Project Name</label><input ref={iRef} style={sInput} placeholder="e.g. 123 Main Street" value={nm} onChange={function(e) { setNm(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") sub(); }} /></div>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Address</label><input style={sInput} placeholder="Full street address" value={addr} onChange={function(e) { setAddr(e.target.value); }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ marginBottom: 12 }}><label style={lblS}>Number of Lots</label><input style={sInput} placeholder="e.g. 12" value={lots} onChange={function(e) { setLots(e.target.value); }} /></div>
        <div style={{ marginBottom: 12 }}><label style={lblS}>GRV</label><input style={sInput} placeholder="e.g. $4.2M" value={grv} onChange={function(e) { setGrv(e.target.value); }} /></div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Description</label><textarea style={Object.assign({}, sInput, { minHeight: 60, resize: "vertical" })} placeholder="Brief project description..." value={desc} onChange={function(e) { setDesc(e.target.value); }} /></div>
      <div style={{ marginBottom: 12 }}><label style={lblS}>Type</label><select style={sInput} value={tp} onChange={function(e) { setTp(e.target.value); }}><option value="live">Live Project</option><option value="acquisition">Acquisition</option></select></div>
      <div style={{ marginBottom: 12 }}>
        <label style={lblS}>Project Colour</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COLORS.map(function(cc) {
            var sel = clr === cc;
            return <button key={cc} onClick={function() { setClr(cc); }} style={{ width: 32, height: 32, borderRadius: "50%", background: cc, border: sel ? "2px solid " + S.t1 : "2px solid transparent", boxShadow: sel ? "0 0 0 2px " + cc + "40" : "none", cursor: "pointer", transition: "all .15s" }} />;
          })}
        </div>
      </div>
    </Modal>
  );
}

function Projects(props) {
  var ctx = useContext(Ctx);
  var prj = ctx.prj, loading = ctx.loading, isMock = ctx.isMock;
  var apRef = useState(false); var showAP = apRef[0], setShowAP = apRef[1];
  var tabRef = useState("live"); var tab = tabRef[0], setTab = tabRef[1];
  var editRef = useState(null); var editing = editRef[0], setEditing = editRef[1];
  var addRef = useState(false); var showBizAdd = addRef[0], setShowBizAdd = addRef[1];
  var searchRef = useState(""); var search = searchRef[0], setSearch = searchRef[1];

  var cards = useMemo(function() {
    return Object.entries(prj).filter(function(e) { return e[0] !== "__business"; }).map(function(e) {
      var id = e[0], p = e[1];
      var tasks = [];
      if (p && p.data && p.data.sections) Object.entries(p.data.sections).forEach(function(se) { (se[1].tasks || []).forEach(function(tk) { tasks.push(tk); }); });
      return { id: id, name: (p.data && p.data.name) || id, type: (p.data && p.data.type) || "live", color: pCol(id, prj), total: tasks.length, ip: tasks.filter(function(t) { return t.stage === "in-progress"; }).length, done: tasks.filter(function(t) { return t.stage === "completed"; }).length, od: tasks.filter(function(t) { return isOD(t.dueDate, t.stage); }).length };
    }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [prj]);

  var bizProj = prj["__business"];
  var bizTasks = useMemo(function() {
    if (!bizProj || !bizProj.data || !bizProj.data.sections) return [];
    var t = [];
    Object.entries(bizProj.data.sections).forEach(function(e) { (e[1].tasks || []).forEach(function(tk) { t.push(Object.assign({}, tk, { projectId: "__business", sectionId: e[0], projectName: "Business" })); }); });
    return t;
  }, [bizProj]);

  var live = cards.filter(function(c) { return c.type === "live" && (!search || c.name.toLowerCase().indexOf(search.toLowerCase()) >= 0); });
  var acq = cards.filter(function(c) { return c.type === "acquisition" && (!search || c.name.toLowerCase().indexOf(search.toLowerCase()) >= 0); });

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div style={{ width: 28, height: 28, border: "3px solid " + S.brdL, borderTopColor: S.blue, borderRadius: "50%", animation: "saltSpin .8s linear infinite" }} /></div>;

  function ProjCard(cardProps) {
    var p = cardProps.p;
    var pct = p.total > 0 ? Math.round(p.done / p.total * 100) : 0;
    return (
      <div style={Object.assign({}, sCard, { padding: 14, cursor: "pointer", position: "relative" })} onClick={function() { props.onNav(p.id); }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.color, borderRadius: "12px 12px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: fontDi, fontSize: 15, color: S.t1 }}>{p.name}</div>
          <button style={Object.assign({}, sBG, { opacity: 0.3, padding: "2px 4px", minHeight: 24 })} onClick={function(e) { e.stopPropagation(); ctx.delProj(p.id).then(function() { ctx.toast("Deleted"); }).catch(function() { ctx.toast("Failed", "err"); }); }}><ITrash s={12} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, textAlign: "center" }}>
          <div><div style={{ fontSize: 16, fontWeight: 600, color: S.t1 }}>{p.total}</div><div style={{ fontSize: 10, color: S.t3, textTransform: "uppercase" }}>Total</div></div>
          <div><div style={{ fontSize: 16, fontWeight: 600, color: S.info }}>{p.ip}</div><div style={{ fontSize: 10, color: S.t3, textTransform: "uppercase" }}>Active</div></div>
          {p.od > 0 && <div><div style={{ fontSize: 16, fontWeight: 600, color: S.err }}>{p.od}</div><div style={{ fontSize: 10, color: S.err, textTransform: "uppercase" }}>Overdue</div></div>}
          <div><div style={{ fontSize: 16, fontWeight: 600, color: S.ok }}>{p.done}</div><div style={{ fontSize: 10, color: S.t3, textTransform: "uppercase" }}>Done</div></div>
          {p.od > 0 && <div><div style={{ fontSize: 16, fontWeight: 600, color: S.err }}>{p.od}</div><div style={{ fontSize: 10, color: S.err, textTransform: "uppercase" }}>Overdue</div></div>}
        </div>
        <div style={{ width: "100%", height: 3, background: S.input, borderRadius: 99, overflow: "hidden", marginTop: 10 }}><div style={{ height: "100%", borderRadius: 99, background: S.ok, width: pct + "%" }} /></div>
      </div>
    );
  }

  return (
    <div>
      {isMock && <div style={{ padding: "8px 12px", background: S.infoBg, border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 14, fontSize: 12, color: S.blue }}>Preview mode</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontFamily: fontDi, fontSize: 26, fontWeight: 400, color: S.t1 }}>Projects</h1>
        <button style={Object.assign({}, sBP, { minHeight: 40 })} onClick={function() { setShowAP(true); }}><IPlus s={14} /> New Project</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input style={Object.assign({}, sInput, { minHeight: 38, fontSize: 13 })} placeholder="Search projects..." value={search} onChange={function(e) { setSearch(e.target.value); }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <FTab active={tab === "live"} label="Live Projects" count={live.length} onClick={function() { setTab("live"); }} />
        <FTab active={tab === "acq"} label="Acquisitions" count={acq.length} onClick={function() { setTab("acq"); }} />
        <FTab active={tab === "biz"} label="Business" onClick={function() { setTab("biz"); }} />
      </div>

      {tab === "live" && (live.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: S.t3 }}>No live projects</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>{live.map(function(p) { return <ProjCard key={p.id} p={p} />; })}</div>)}
      {tab === "acq" && (acq.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: S.t3 }}>No acquisitions</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>{acq.map(function(p) { return <ProjCard key={p.id} p={p} />; })}</div>)}
      {tab === "biz" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontFamily: fontDi, fontSize: 17, color: S.t1 }}>Business Action Items</h2>
            <button style={sBG} onClick={function() { setShowBizAdd(true); }}><IPlus s={14} /> Add</button>
          </div>
          {bizTasks.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: S.t3 }}>No action items</div>
            : srt(bizTasks).map(function(t) { return <TaskCard key={t.id} task={t} onEdit={setEditing} />; })}
          <AddTaskM open={showBizAdd} onClose={function() { setShowBizAdd(false); }} defP="__business" defS="general" />
          <EditTaskM task={editing} open={!!editing} onClose={function() { setEditing(null); }} />
        </div>
      )}

      <AddProjModal open={showAP} onClose={function() { setShowAP(false); }} defType={tab === "acq" ? "acquisition" : "live"} />
    </div>
  );
}

/* Project Detail */
function ProjDetail(props) {
  var ctx = useContext(Ctx);
  var pid = props.pid;
  var pd = ctx.prj[pid];
  var loading = ctx.loading, isMock = ctx.isMock;

  var expRef = useState(new Set()); var exp = expRef[0], setExp = expRef[1];
  var addRef = useState(false); var showAdd = addRef[0], setShowAdd = addRef[1];
  var secRef = useState(null); var addSec = secRef[0], setAddSec = secRef[1];
  var editRef = useState(null); var editing = editRef[0], setEditing = editRef[1];
  var sfRef = useState("all"); var sf = sfRef[0], setSf = sfRef[1];
  var addSecRef = useState(false); var showAddSec = addSecRef[0], setShowAddSec = addSecRef[1];
  var msRef = useState(false); var showAddMs = msRef[0], setShowAddMs = msRef[1];
  var editMsRef = useState(null); var editMs = editMsRef[0], setEditMs = editMsRef[1];
  var conRef = useState(null); var showAddCon = conRef[0], setShowAddCon = conRef[1];

  useEffect(function() { if (pd && pd.data && pd.data.sections) setExp(new Set(Object.keys(pd.data.sections))); }, [pid]);

  var pt = useMemo(function() {
    if (!pd || !pd.data || !pd.data.sections) return [];
    var t = [];
    Object.entries(pd.data.sections).forEach(function(e) { (e[1].tasks || []).forEach(function(tk) { t.push(Object.assign({}, tk, { projectId: pid, sectionId: e[0], projectName: (pd.data && pd.data.name) || pid })); }); });
    return t;
  }, [pd, pid]);

  var stats = useMemo(function() {
    var s = { total: 0, ip: 0, ar: 0, od: 0, done: 0 };
    pt.forEach(function(t) { s.total++; if (t.stage === "in-progress") s.ip++; if (t.stage === "awaiting-response") s.ar++; if (t.stage === "completed") s.done++; if (isOD(t.dueDate, t.stage)) s.od++; });
    return s;
  }, [pt]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div style={{ width: 28, height: 28, border: "3px solid " + S.brdL, borderTopColor: S.blue, borderRadius: "50%", animation: "saltSpin .8s linear infinite" }} /></div>;
  if (!pd) return <div style={{ textAlign: "center", padding: 48 }}><div style={{ fontFamily: fontDi, fontSize: 17, color: S.t2 }}>Not found</div><button style={Object.assign({}, sBP, { marginTop: 16 })} onClick={props.onBack}>Back</button></div>;

  var milestones = (pd.data && pd.data.milestones) || [];

  function addSection() {
    var el = document.getElementById("new-sec-name");
    if (!el || !el.value.trim()) return;
    var d = JSON.parse(JSON.stringify(pd.data));
    var sid = slug(el.value);
    d.sections[sid] = { name: el.value.trim(), tasks: [], consultants: [] };
    ctx.upd(pid, d);
    setExp(function(p) { return new Set([...p, sid]); });
    setShowAddSec(false);
    ctx.toast("Section added");
  }

  function delSection(sid) {
    if (!pd) return;
    var d = JSON.parse(JSON.stringify(pd.data));
    delete d.sections[sid];
    ctx.upd(pid, d);
    ctx.toast("Removed");
  }

  function getSectionOrder() {
    if (pd.data && pd.data.sectionOrder && Array.isArray(pd.data.sectionOrder)) return pd.data.sectionOrder;
    var entries = Object.keys((pd.data && pd.data.sections) || {});
    var orderMap = {}; DEFAULT_SECTIONS.forEach(function(s, i) { orderMap[s.id] = i; });
    entries.sort(function(a, b) { return (orderMap[a] !== undefined ? orderMap[a] : 99) - (orderMap[b] !== undefined ? orderMap[b] : 99); });
    return entries;
  }

  function moveSection(sid, direction) {
    var order = getSectionOrder();
    var idx = order.indexOf(sid);
    if (idx < 0) return;
    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    var newOrder = order.slice();
    newOrder.splice(idx, 1);
    newOrder.splice(newIdx, 0, sid);
    var d = JSON.parse(JSON.stringify(pd.data));
    d.sectionOrder = newOrder;
    ctx.upd(pid, d);
  }

  function addMilestone() {
    var nEl = document.getElementById("ms-name");
    var dEl = document.getElementById("ms-date");
    if (!nEl || !nEl.value.trim()) return;
    var d = JSON.parse(JSON.stringify(pd.data));
    if (!d.milestones) d.milestones = [];
    d.milestones.push({ id: uid(), name: nEl.value.trim(), dueDate: (dEl && dEl.value) || null, completed: false });
    ctx.upd(pid, d);
    setShowAddMs(false);
    ctx.toast("Milestone added");
  }

  function toggleMs(msId) {
    var d = JSON.parse(JSON.stringify(pd.data));
    var m = (d.milestones || []).find(function(x) { return x.id === msId; });
    if (m) { m.completed = !m.completed; ctx.upd(pid, d); }
  }

  function deleteMs(msId) {
    var d = JSON.parse(JSON.stringify(pd.data));
    d.milestones = (d.milestones || []).filter(function(x) { return x.id !== msId; });
    ctx.upd(pid, d);
    ctx.toast("Milestone deleted");
  }

  function updateMs(msId, updates) {
    var d = JSON.parse(JSON.stringify(pd.data));
    var m = (d.milestones || []).find(function(x) { return x.id === msId; });
    if (m) { Object.assign(m, updates); ctx.upd(pid, d); ctx.toast("Milestone updated"); }
    setEditMs(null);
  }

  function addConsultant() {
    var tEl = document.getElementById("con-type");
    var nEl = document.getElementById("con-name");
    var cEl = document.getElementById("con-company");
    var pEl = document.getElementById("con-phone");
    var eEl = document.getElementById("con-email");
    if (!nEl || !nEl.value.trim()) return;
    var d = JSON.parse(JSON.stringify(pd.data));
    if (!d.sections[showAddCon].consultants) d.sections[showAddCon].consultants = [];
    d.sections[showAddCon].consultants.push({ id: uid(), type: (tEl && tEl.value.trim()) || "", name: nEl.value.trim(), company: (cEl && cEl.value) || "", phone: (pEl && pEl.value) || "", email: (eEl && eEl.value) || "", comments: [] });
    ctx.upd(pid, d);
    setShowAddCon(null);
    ctx.toast("Consultant added");
  }

  function addComment(sid, conId, text) {
    var d = JSON.parse(JSON.stringify(pd.data));
    var con = (d.sections[sid].consultants || []).find(function(c) { return c.id === conId; });
    if (con) {
      if (!con.comments) con.comments = [];
      con.comments.push({ id: uid(), text: text, date: new Date().toISOString(), by: "AL" });
      ctx.upd(pid, d);
      ctx.toast("Comment added");
    }
  }

  function editComment(sid, conId, commentId, newText) {
    var d = JSON.parse(JSON.stringify(pd.data));
    var con = (d.sections[sid].consultants || []).find(function(c) { return c.id === conId; });
    if (con && con.comments) {
      var cm = con.comments.find(function(c) { return c.id === commentId; });
      if (cm) { cm.text = newText; cm.edited = true; ctx.upd(pid, d); ctx.toast("Comment updated"); }
    }
  }

  function deleteComment(sid, conId, commentId) {
    var d = JSON.parse(JSON.stringify(pd.data));
    var con = (d.sections[sid].consultants || []).find(function(c) { return c.id === conId; });
    if (con && con.comments) {
      con.comments = con.comments.filter(function(c) { return c.id !== commentId; });
      ctx.upd(pid, d);
      ctx.toast("Comment deleted");
    }
  }

  function exportReport() {
    var projName = (pd.data && pd.data.name) || pid;
    var projColor = pCol(pid, ctx.prj);
    var dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    var html = [];
    html.push("<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + projName + " - Report</title>");
    html.push("<link href='https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700&display=swap' rel='stylesheet'>");
    html.push("<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Outfit',sans-serif;color:#1a1f2e;background:#fff;padding:40px;max-width:800px;margin:0 auto}");
    html.push(".header{border-left:4px solid " + projColor + ";padding-left:16px;margin-bottom:32px}.title{font-family:'DM Serif Display',serif;font-size:28px;margin-bottom:4px}.sub{color:#8b92a5;font-size:13px}");
    html.push(".info{display:flex;gap:20px;margin-bottom:24px;flex-wrap:wrap}.info-item{font-size:12px;color:#5a6278}.info-item strong{color:#1a1f2e}");
    html.push(".section{margin-bottom:24px}.sec-title{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#5a6278;padding:8px 0;border-bottom:2px solid #e2e5ea;margin-bottom:12px}");
    html.push(".milestone{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px}.ms-check{width:14px;height:14px;border:2px solid #d0d3d9;border-radius:3px;flex-shrink:0}.ms-done{background:#059669;border-color:#059669}");
    html.push(".con{padding:8px 12px;background:#eff6ff;border-radius:6px;margin-bottom:6px;font-size:12px;border-left:2px solid #2563eb}.con-type{font-weight:600;color:#2563eb}");
    html.push(".task{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f4f5f7;font-size:13px}.task:last-child{border-bottom:none}");
    html.push(".badge{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:500;margin-right:4px}");
    html.push(".b-ip{background:#eff6ff;color:#2563eb}.b-ar{background:#fffbeb;color:#d97706}.b-ns{background:#f1f5f9;color:#94a3b8}.b-done{background:#ecfdf5;color:#059669}.b-oh{background:#fef2f2;color:#dc2626}");
    html.push(".b-high{background:#fef2f2;color:#dc2626}.b-med{background:#fffbeb;color:#d97706}.b-low{background:#f1f5f9;color:#94a3b8}");
    html.push(".footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e5ea;font-size:11px;color:#8b92a5;display:flex;justify-content:space-between}");
    html.push("@media print{body{padding:20px}}</style></head><body>");
    html.push("<div class='header'><div class='title'>" + projName + "</div><div class='sub'>Project Report - " + dateStr + "</div></div>");
    
    // Project info
    if (pd.data.address || pd.data.lots || pd.data.grv) {
      html.push("<div class='info'>");
      if (pd.data.address) html.push("<div class='info-item'>Address: <strong>" + pd.data.address + "</strong></div>");
      if (pd.data.lots) html.push("<div class='info-item'>Lots: <strong>" + pd.data.lots + "</strong></div>");
      if (pd.data.grv) html.push("<div class='info-item'>GRV: <strong>" + pd.data.grv + "</strong></div>");
      html.push("</div>");
    }
    
    // Stats summary
    html.push("<div class='info'><div class='info-item'>Total Tasks: <strong>" + stats.total + "</strong></div><div class='info-item'>Active: <strong>" + stats.ip + "</strong></div><div class='info-item'>Overdue: <strong style=\"color:#dc2626\">" + stats.od + "</strong></div><div class='info-item'>Completed: <strong>" + stats.done + "</strong></div></div>");
    
    // Milestones
    if (milestones.length) {
      html.push("<div class='section'><div class='sec-title'>Key Milestones & Hurdles</div>");
      milestones.forEach(function(m) {
        html.push("<div class='milestone'><div class='ms-check " + (m.completed ? "ms-done" : "") + "'></div><span style='" + (m.completed ? "text-decoration:line-through;color:#8b92a5" : "") + "'>" + m.name + "</span>" + (m.dueDate ? "<span style='margin-left:auto;font-size:11px;color:#8b92a5'>" + fD(m.dueDate) + "</span>" : "") + "</div>");
      });
      html.push("</div>");
    }
    
    // Sections
    var secOrder = {}; DEFAULT_SECTIONS.forEach(function(s, i) { secOrder[s.id] = i; });
    var sortedSecs = Object.entries(pd.data.sections || {}).sort(function(a, b) { return (secOrder[a[0]] || 99) - (secOrder[b[0]] || 99); });
    
    sortedSecs.forEach(function(e) {
      var sid = e[0], sec = e[1];
      var tasks = sec.tasks || [];
      if (tasks.length === 0 && (!sec.consultants || sec.consultants.length === 0)) return;
      html.push("<div class='section'><div class='sec-title'>" + gSecName(sid, sec) + " (" + tasks.length + " tasks)</div>");
      
      if (sec.consultants && sec.consultants.length) {
        sec.consultants.forEach(function(c) {
          html.push("<div class='con'><span class='con-type'>" + (c.type || "Consultant") + "</span> - " + c.name + (c.company ? " (" + c.company + ")" : "") + (c.phone ? " | " + c.phone : "") + "</div>");
        });
      }
      
      tasks.forEach(function(t) {
        var st = gS(t.stage), pr = gP(t.priority);
        var stClass = t.stage === "in-progress" ? "b-ip" : t.stage === "awaiting-response" ? "b-ar" : t.stage === "completed" ? "b-done" : t.stage === "on-hold" ? "b-oh" : "b-ns";
        var prClass = t.priority === "high" ? "b-high" : t.priority === "medium" ? "b-med" : "b-low";
        var memNames = getAssignees(t).map(function(a) { var m = gM(a); return m ? m.name : a; }).join(", ") || "Unassigned";
        html.push("<div class='task'><div style='flex:1'><div>" + (t.name || "Untitled") + "</div><div style='margin-top:2px'><span class='badge " + stClass + "'>" + st.label + "</span><span class='badge " + prClass + "'>" + pr.label + "</span><span style='font-size:11px;color:#8b92a5'>" + memNames + "</span></div></div>" + (t.dueDate ? "<div style='font-size:11px;color:" + (isOD(t.dueDate, t.stage) ? "#dc2626;font-weight:600" : "#8b92a5") + ";white-space:nowrap'>" + fD(t.dueDate) + "</div>" : "") + "</div>");
      });
      html.push("</div>");
    });
    
    html.push("<div class='footer'><span>SALT Property Development</span><span>" + dateStr + "</span></div>");
    html.push("</body></html>");
    
    var blob = new Blob([html.join("")], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ((pd.data && pd.data.name) || "project") + "-report.html";
    a.click();
  }

  return (
    <div>
      {isMock && <div style={{ padding: "8px 12px", background: S.infoBg, border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 14, fontSize: 12, color: S.blue }}>Preview</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <button style={sBG} onClick={props.onBack}><IChevL s={14} /> Projects</button>
        <button style={sBG} onClick={exportReport}><IFile s={14} /> Export</button>
      </div>
      <h1 style={{ fontFamily: fontDi, fontSize: 24, fontWeight: 400, color: S.t1, borderLeft: "3px solid " + pCol(pid, ctx.prj), paddingLeft: 10, marginBottom: 6 }}>{(pd.data && pd.data.name) || pid}</h1>

      {/* Project Details */}
      {(pd.data.address || pd.data.lots || pd.data.grv || pd.data.description) && (
        <div style={{ marginBottom: 16, paddingLeft: 13 }}>
          {pd.data.address && <div style={{ fontSize: 12, color: S.t2, marginBottom: 2 }}>{pd.data.address}</div>}
          <div style={{ display: "flex", gap: 12, marginBottom: pd.data.description ? 4 : 0 }}>
            {pd.data.lots && <span style={{ fontSize: 11, color: S.t3 }}>Lots: <strong style={{ color: S.t1 }}>{pd.data.lots}</strong></span>}
            {pd.data.grv && <span style={{ fontSize: 11, color: S.t3 }}>GRV: <strong style={{ color: S.t1 }}>{pd.data.grv}</strong></span>}
          </div>
          {pd.data.description && <div style={{ fontSize: 12, color: S.t3, fontStyle: "italic" }}>{pd.data.description}</div>}
        </div>
      )}

      {/* Project Details */}
      {(pd.data.address || pd.data.lots || pd.data.grv || pd.data.description) && (
        <div style={Object.assign({}, sCard, { padding: 14, marginBottom: 16 })}>
          {pd.data.address && <div style={{ fontSize: 13, color: S.t2, marginBottom: 4 }}>{pd.data.address}</div>}
          {(pd.data.lots || pd.data.grv) && (
            <div style={{ display: "flex", gap: 16, marginBottom: pd.data.description ? 8 : 0 }}>
              {pd.data.lots && <div><span style={{ fontSize: 10, color: S.t3, textTransform: "uppercase" }}>Lots: </span><span style={{ fontSize: 13, fontWeight: 600, color: S.t1 }}>{pd.data.lots}</span></div>}
              {pd.data.grv && <div><span style={{ fontSize: 10, color: S.t3, textTransform: "uppercase" }}>GRV: </span><span style={{ fontSize: 13, fontWeight: 600, color: S.t1 }}>{pd.data.grv}</span></div>}
            </div>
          )}
          {pd.data.description && <div style={{ fontSize: 12, color: S.t2, lineHeight: 1.5 }}>{pd.data.description}</div>}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16 }}>
        {[{ l: "Total", v: stats.total, fg: S.t1 }, { l: "Active", v: stats.ip, fg: S.info }, { l: "Awaiting", v: stats.ar, fg: S.warn }, { l: "Overdue", v: stats.od, fg: S.err }, { l: "Done", v: stats.done, fg: S.ok }].map(function(s) {
          return <div key={s.l} style={Object.assign({}, sCard, { flex: "0 0 auto", textAlign: "center", padding: "6px 12px", minWidth: 60 })}><div style={{ fontSize: 17, fontWeight: 600, color: s.fg, lineHeight: 1 }}>{s.v}</div><div style={{ fontSize: 9, color: S.t3, marginTop: 2, textTransform: "uppercase" }}>{s.l}</div></div>;
        })}
      </div>

      {/* Milestones */}
      <div style={Object.assign({}, sCard, { padding: 14, marginBottom: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: milestones.length ? 8 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><IFlag s={14} style={{ color: S.blue }} /><span style={{ fontFamily: fontDi, fontSize: 15, color: S.t1 }}>Key Milestones & Hurdles</span></div>
          <button style={sBG} onClick={function() { setShowAddMs(true); }}><IPlus s={12} /> Add</button>
        </div>
        {milestones.map(function(m) {
          return <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid " + S.brdL }}>
            <input type="checkbox" checked={m.completed} onChange={function() { toggleMs(m.id); }} style={{ width: 18, height: 18, accentColor: S.blue }} />
            <span style={{ flex: 1, fontSize: 13, color: m.completed ? S.t3 : S.t1, textDecoration: m.completed ? "line-through" : "none" }}>{m.name}</span>
            {m.dueDate && <span style={{ fontSize: 11, color: isOD(m.dueDate, m.completed ? "completed" : "") ? S.err : S.t3 }}>{fD(m.dueDate)}</span>}
            <button onClick={function() { setEditMs(m); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: S.t3, display: "flex", opacity: 0.4 }}><IEdit s={11} /></button>
            <button onClick={function() { deleteMs(m.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: S.t3, display: "flex", opacity: 0.4 }}><ITrash s={11} /></button>
          </div>;
        })}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
        {[{ id: "all", l: "All" }].concat(STAGES.map(function(s) { return { id: s.id, l: s.id === "awaiting-response" ? "Awaiting" : s.label }; })).map(function(f) {
          return <FTab key={f.id} active={sf === f.id} label={f.l} onClick={function() { setSf(f.id); }} />;
        })}
      </div>

      {/* Sections - sorted by custom order */}
      {(function() {
        var order = getSectionOrder();
        var sections = (pd.data && pd.data.sections) || {};
        /* Include any sections not in the order array */
        Object.keys(sections).forEach(function(sid) { if (order.indexOf(sid) < 0) order.push(sid); });
        return order.filter(function(sid) { return sections[sid]; }).map(function(sid, idx, arr) {
          var sec = sections[sid];
          return { sid: sid, sec: sec, idx: idx, total: arr.length };
        });
      })().map(function(item) {
        var sid = item.sid, sec = item.sec;
        var tasks = (sec.tasks || []).map(function(t) { return Object.assign({}, t, { projectId: pid, sectionId: sid, projectName: (pd.data && pd.data.name) || pid }); });
        if (sf !== "all") tasks = tasks.filter(function(t) { return t.stage === sf; });
        var sorted = srt(tasks);
        var open = exp.has(sid);
        var consultants = sec.consultants || [];

        return (
          <div key={sid} style={{ marginBottom: 12 }}>
            <div onClick={function() { setExp(function(p) { var n = new Set(p); if (n.has(sid)) n.delete(sid); else n.add(sid); return n; }); }}
              style={Object.assign({}, sCard, { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer", minHeight: 44 })}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, opacity: 0.35 }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: S.t3, lineHeight: 0, display: item.idx === 0 ? "none" : "block" }} onClick={function(ev) { ev.stopPropagation(); moveSection(sid, -1); }}><IChevU s={12} /></button>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: S.t3, lineHeight: 0, display: item.idx === item.total - 1 ? "none" : "block" }} onClick={function(ev) { ev.stopPropagation(); moveSection(sid, 1); }}><IChevD s={12} /></button>
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: S.t1 }}>{gSecName(sid, sec)}</span>
              <span style={{ fontSize: 11, color: S.t3, background: S.input, padding: "1px 7px", borderRadius: 99 }}>{(sec.tasks || []).length}</span>
              <button style={Object.assign({}, sBG, { padding: "2px 4px", minHeight: 24, opacity: 0.4 })} onClick={function(ev) { ev.stopPropagation(); delSection(sid); }}><ITrash s={12} /></button>
              <IChevD s={14} style={{ color: S.t3, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
            </div>
            {open && (
              <div style={{ paddingTop: 6 }}>
                {/* Tasks grouped by consultant */}
                {consultants.map(function(con) {
                  var conTasks = sorted.filter(function(t) { return t.consultant === con.id; });
                  return (
                    <ConsultantSection key={con.id} con={con} tasks={conTasks} sid={sid} addComment={addComment} editComment={editComment} deleteComment={deleteComment} onEditTask={setEditing} onAddTask={function() { setAddSec(sid); setShowAdd(true); }} />
                  );
                })}

                {/* Unassigned tasks (no consultant) */}
                {(function() {
                  var unassigned = sorted.filter(function(t) { return !t.consultant || !consultants.find(function(c) { return c.id === t.consultant; }); });
                  if (unassigned.length === 0 && consultants.length > 0) return null;
                  return (
                    <div style={{ marginBottom: 8 }}>
                      {consultants.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 4px", marginTop: 4 }}>
                          <div style={{ width: 3, height: 16, borderRadius: 2, background: S.t3 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: S.t3 }}>Unassigned to Consultant</span>
                          <span style={{ fontSize: 10, color: S.t3, background: S.input, padding: "0 6px", borderRadius: 99 }}>{unassigned.length}</span>
                        </div>
                      )}
                      {unassigned.length === 0 ? <div style={{ padding: 10, textAlign: "center", color: S.t3, fontSize: 12 }}>{sf !== "all" ? "No matching" : "No tasks"}</div>
                        : unassigned.map(function(t) { return <TaskCard key={t.id} task={t} onEdit={setEditing} />; })}
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button style={Object.assign({}, sBG, { fontSize: 11, flex: 1 })} onClick={function() { setShowAddCon(sid); }}><IUser s={12} /> Add Consultant</button>
                  <button style={Object.assign({}, sBG, { fontSize: 11, flex: 1, color: S.t3 })} onClick={function() { setAddSec(sid); setShowAdd(true); }}><IPlus s={12} /> Add Task</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button style={Object.assign({}, sBS, { width: "100%", marginTop: 8, marginBottom: 16 })} onClick={function() { setShowAddSec(true); }}><IPlus s={14} /> Add Section</button>

      <button onClick={function() { setAddSec(null); setShowAdd(true); }} style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom,0px) + 14px)", right: 14, width: 52, height: 52, borderRadius: "50%", background: S.blue, color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: S.shadowLg, zIndex: 100, border: "none", cursor: "pointer" }}><IPlus s={22} /></button>

      <AddTaskM open={showAdd} onClose={function() { setShowAdd(false); setAddSec(null); }} defP={pid} defS={addSec} />
      <EditTaskM task={editing} open={!!editing} onClose={function() { setEditing(null); }} />

      <Modal open={showAddSec} onClose={function() { setShowAddSec(false); }} title="Add Section"
        footer={<><button style={Object.assign({}, sBS, { flex: 1 })} onClick={function() { setShowAddSec(false); }}>Cancel</button><button style={Object.assign({}, sBP, { flex: 2 })} onClick={addSection}>Add</button></>}>
        <div style={{ marginBottom: 12 }}><label style={lblS}>Section Name</label><input id="new-sec-name" style={sInput} placeholder="e.g. Insurance" /></div>
      </Modal>

      <Modal open={showAddMs} onClose={function() { setShowAddMs(false); }} title="Add Milestone"
        footer={<><button style={Object.assign({}, sBS, { flex: 1 })} onClick={function() { setShowAddMs(false); }}>Cancel</button><button style={Object.assign({}, sBP, { flex: 2 })} onClick={addMilestone}>Add</button></>}>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Milestone</label><input id="ms-name" style={sInput} placeholder="e.g. DA Approval" /></div>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Target Date</label><input id="ms-date" style={sInput} type="date" /></div>
      </Modal>

      {editMs && <EditMsModal ms={editMs} onClose={function() { setEditMs(null); }} onSave={updateMs} onDelete={deleteMs} />}

      <Modal open={!!showAddCon} onClose={function() { setShowAddCon(null); }} title="Add Consultant"
        footer={<><button style={Object.assign({}, sBS, { flex: 1 })} onClick={function() { setShowAddCon(null); }}>Cancel</button><button style={Object.assign({}, sBP, { flex: 2 })} onClick={addConsultant}>Add</button></>}>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Type of Consultant</label><input id="con-type" style={sInput} placeholder="e.g. Town Planner, Solicitor, Architect" /></div>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Name</label><input id="con-name" style={sInput} placeholder="Full name" /></div>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Company</label><input id="con-company" style={sInput} placeholder="Company name" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ marginBottom: 10 }}><label style={lblS}>Phone</label><input id="con-phone" style={sInput} placeholder="04XX XXX XXX" /></div>
          <div style={{ marginBottom: 10 }}><label style={lblS}>Email</label><input id="con-email" style={sInput} placeholder="email@company.com" /></div>
        </div>
      </Modal>
    </div>
  );
}

/* Edit Milestone Modal */
function EditMsModal(props) {
  var nmRef = useState(props.ms.name || ""); var nm = nmRef[0], setNm = nmRef[1];
  var dtRef = useState(props.ms.dueDate || ""); var dt = dtRef[0], setDt = dtRef[1];
  return (
    <Modal open={true} onClose={props.onClose} title="Edit Milestone"
      footer={
        <>
          <button style={sBD} onClick={function() { props.onDelete(props.ms.id); props.onClose(); }}><ITrash s={14} /></button>
          <div style={{ flex: 1 }} />
          <button style={sBS} onClick={props.onClose}>Cancel</button>
          <button style={sBP} onClick={function() { props.onSave(props.ms.id, { name: nm.trim(), dueDate: dt || null }); }}>Save</button>
        </>
      }>
      <div style={{ marginBottom: 10 }}><label style={lblS}>Milestone</label><input style={sInput} value={nm} onChange={function(e) { setNm(e.target.value); }} /></div>
      <div style={{ marginBottom: 10 }}><label style={lblS}>Target Date</label><input style={sInput} type="date" value={dt} onChange={function(e) { setDt(e.target.value); }} /></div>
    </Modal>
  );
}

/* Editable Comment Item */
function CommentItem(props) {
  var c = props.c;
  var editingRef = useState(false); var isEditing = editingRef[0], setIsEditing = editingRef[1];
  var textRef = useState(c.text); var editText = textRef[0], setEditText = textRef[1];
  var inputRef = useRef(null);

  useEffect(function() {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  function startEdit() {
    setEditText(c.text);
    setIsEditing(true);
  }

  function saveEdit() {
    if (editText.trim() && editText.trim() !== c.text) {
      props.editComment(props.sid, props.conId, c.id, editText.trim());
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    setEditText(c.text);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div style={{ marginBottom: 3 }}>
        <input ref={inputRef} style={Object.assign({}, sInput, { minHeight: 30, fontSize: 12, marginBottom: 4 })} value={editText} onChange={function(e) { setEditText(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} />
        <div style={{ display: "flex", gap: 4 }}>
          <button style={Object.assign({}, sBP, { minHeight: 26, padding: "2px 10px", fontSize: 11 })} onClick={saveEdit}>Save</button>
          <button style={Object.assign({}, sBG, { minHeight: 26, padding: "2px 8px", fontSize: 11 })} onClick={cancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 8px", background: S.input, borderRadius: 6, marginBottom: 3, fontSize: 12, position: "relative" }}>
      <div style={{ flex: 1 }}>
        <span style={{ color: S.t1 }}>{c.text}</span>
        <span style={{ color: S.t3, fontSize: 10, marginLeft: 6 }}>
          {new Date(c.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          {c.edited && <span style={{ fontStyle: "italic", marginLeft: 3 }}>(edited)</span>}
        </span>
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0, opacity: 0.4 }}>
        <button onClick={startEdit} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: S.t3, display: "flex", alignItems: "center" }} title="Edit">
          <IEdit s={11} />
        </button>
        <button onClick={function() { props.deleteComment(props.sid, props.conId, c.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: S.t3, display: "flex", alignItems: "center" }} title="Delete">
          <ITrash s={11} />
        </button>
      </div>
    </div>
  );
}

/* Consultant Section - consultant as header with nested tasks */
function ConsultantSection(props) {
  var con = props.con, tasks = props.tasks || [];
  var detailRef = useState(false); var showDetail = detailRef[0], setShowDetail = detailRef[1];
  var commentRef = useState(""); var comment = commentRef[0], setComment = commentRef[1];

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Consultant Header */}
      <div style={Object.assign({}, sCard, { padding: 0, marginBottom: 2, borderLeft: "3px solid " + S.blue, overflow: "visible" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: S.infoBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IUser s={14} style={{ color: S.blue }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: S.t1 }}>{con.type || "Consultant"}</div>
            <div style={{ fontSize: 11, color: S.t3 }}>{con.name}{con.company ? " \u2022 " + con.company : ""}</div>
          </div>
          <span style={{ fontSize: 10, color: S.t3, background: S.input, padding: "1px 7px", borderRadius: 99, flexShrink: 0 }}>{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
          <button onClick={function(e) { e.stopPropagation(); setShowDetail(function(d) { return !d; }); }} style={Object.assign({}, sBG, { padding: "4px", minHeight: 28, opacity: 0.6 })} title="Contact & Comments">
            <IMsg s={13} />
          </button>
        </div>

        {/* Expandable contact + comments */}
        {showDetail && (
          <div style={{ padding: "0 12px 10px", borderTop: "1px solid " + S.brdL }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 0 6px" }}>
              {con.phone && <span style={{ fontSize: 12, color: S.t2 }}>{con.phone}</span>}
              {con.email && <span style={{ fontSize: 12, color: S.blue }}>{con.email}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <IMsg s={11} style={{ color: S.t3 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: S.t3, textTransform: "uppercase" }}>Comments</span>
            </div>
            {(con.comments || []).map(function(c) {
              return <CommentItem key={c.id} c={c} sid={props.sid} conId={con.id} editComment={props.editComment} deleteComment={props.deleteComment} />;
            })}
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <input style={Object.assign({}, sInput, { minHeight: 30, fontSize: 12 })} placeholder="Add comment..." value={comment} onChange={function(e) { setComment(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && comment.trim()) { props.addComment(props.sid, con.id, comment); setComment(""); } }} />
              <button style={Object.assign({}, sBP, { minHeight: 30, padding: "4px 10px", fontSize: 11 })} onClick={function() { if (comment.trim()) { props.addComment(props.sid, con.id, comment); setComment(""); } }}>Post</button>
            </div>
          </div>
        )}
      </div>

      {/* Tasks nested under this consultant */}
      <div style={{ paddingLeft: 14, borderLeft: "2px solid " + S.brdL, marginLeft: 14 }}>
        {tasks.length === 0 ? (
          <div style={{ padding: "8px 10px", color: S.t3, fontSize: 12, fontStyle: "italic" }}>No tasks assigned</div>
        ) : tasks.map(function(t) {
          return <TaskCard key={t.id} task={t} onEdit={props.onEditTask} />;
        })}
      </div>
    </div>
  );
}

/* ROOT */
export default function App() {
  var data = useData();
  var pageRef = useState("dash"); var page = pageRef[0], setPage = pageRef[1];
  var selRef = useState(null); var selP = selRef[0], setSelP = selRef[1];

  function go(p) { setPage(p); }
  function goP(id) { setSelP(id); setPage("pd"); }
  function isA(p) { return p === "proj" ? (page === "proj" || page === "pd") : page === p; }

  var NAV = [{ id: "dash", l: "Dashboard", I: IHome }, { id: "week", l: "This Week", I: ICal }, { id: "proj", l: "Projects", I: IFolder }];

  var content;
  switch (page) {
    case "week": content = <Week />; break;
    case "proj": content = <Projects onNav={goP} />; break;
    case "pd": content = <ProjDetail pid={selP} onBack={function() { go("proj"); }} />; break;
    default: content = <Dash />;
  }

  return (
    <Ctx.Provider value={data}>
      <style dangerouslySetInnerHTML={{ __html: [
        "@keyframes saltFI{from{opacity:0}to{opacity:1}}",
        "@keyframes saltSU{from{transform:translateY(100%)}to{transform:translateY(0)}}",
        "@keyframes saltSD{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}",
        "@keyframes saltSpin{to{transform:rotate(360deg)}}",
        "*{box-sizing:border-box;margin:0;padding:0}",
        "body{font-family:'Outfit',-apple-system,sans-serif}",
        "::-webkit-scrollbar{width:5px;height:5px}",
        "::-webkit-scrollbar-thumb{background:#d0d3d9;border-radius:99px}",
        "@media(min-width:768px){.salt-sb{display:flex!important}.salt-mn{margin-left:220px!important;padding:28px!important;padding-bottom:28px!important}.salt-bn{display:none!important}}"
      ].join("\n") }} />

      <div style={{ background: "#f4f5f7", minHeight: "100vh", color: S.t1, fontFamily: fontBo, display: "flex", flexDirection: "column" }}>
        <aside className="salt-sb" style={{ display: "none", position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "white", borderRight: "1px solid " + S.brdL, zIndex: 100, padding: 16, flexDirection: "column", boxShadow: "1px 0 8px rgba(0,0,0,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, marginBottom: 28, cursor: "pointer" }} onClick={function() { go("dash"); }}>
            <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 21V3h18v18H3z" stroke="white" strokeWidth="2" fill="none"/><path d="M7 17V7h4l3 5-3 5H7z" fill="white" opacity="0.9"/><path d="M14 7h3v10h-3" stroke="white" strokeWidth="2" fill="none"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: fontDi, fontSize: 17, letterSpacing: ".12em", color: S.t1, lineHeight: 1 }}>SALT</div>
              <div style={{ fontSize: 8, color: S.t3, letterSpacing: ".06em", textTransform: "uppercase", marginTop: 1 }}>Property Development</div>
            </div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {NAV.map(function(n) { return <button key={n.id} onClick={function() { go(n.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: isA(n.id) ? S.blue : S.t2, background: isA(n.id) ? S.infoBg : "none", border: "none", cursor: "pointer", fontFamily: fontBo }}><n.I s={16} /><span>{n.l}</span></button>; })}
          </nav>
          <div style={{ padding: 8, borderTop: "1px solid " + S.brdL, fontSize: 11, color: S.t3 }}>SALT Property Dev</div>
        </aside>

        <main className="salt-mn" style={{ flex: 1, padding: 14, paddingBottom: "calc(72px + env(safe-area-inset-bottom,0px) + 20px)", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          {content}
        </main>

        <nav className="salt-bn" style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "calc(60px + env(safe-area-inset-bottom,0px))", paddingBottom: "env(safe-area-inset-bottom,0px)", background: "white", borderTop: "1px solid " + S.brdL, display: "flex", zIndex: 150, boxShadow: "0 -1px 8px rgba(0,0,0,.04)" }}>
          {NAV.map(function(n) {
            return <button key={n.id} onClick={function() { go(n.id); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: isA(n.id) ? S.blue : S.t3, fontSize: 10, fontWeight: 500, minHeight: 44, background: "none", border: "none", cursor: "pointer", fontFamily: fontBo, position: "relative" }}>
              {isA(n.id) && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, background: S.blue, borderRadius: "0 0 2px 2px" }} />}
              <n.I s={20} /><span>{n.l}</span>
            </button>;
          })}
        </nav>

        <Toasts items={data.toasts} />
      </div>
    </Ctx.Provider>
  );
}

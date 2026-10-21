import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// ---------- design tokens (same as the original design) ----------
const C = {
  bg: "#F6F2EA", sidebar: "#EFE8DC", sidebarBorder: "#E0D6C6", border: "#E4DBCE",
  card: "#FFFDF9", panelCard: "#FBF7F0", ink: "#241E19", inkSoft: "#3A302A",
  muted: "#6B5D52", mutedLight: "#8A7A6B", placeholder: "#A99B8C", hairline: "#EEE7DC",
  terracotta: "#A65A3A", terracottaTintBg: "#F4EBDA", terracottaTintBorder: "#E7D9BE",
  sage: "#4E6047", sageBg: "#E6EBE1", clay: "#8A452A", clayBg: "#F6E3DA", clayBorder: "#EFD1C3",
  gold: "#8A6A1F", goldBg: "#F6EDD3", goldBorder: "#EDDFB8",
};
const SERIF = "Newsreader, Georgia, serif";
const SANS = "Karla, Helvetica, sans-serif";

const todayISO = () => new Date().toISOString().slice(0, 10);
const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: "long" });
const todayLong = () => new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

const KIND_LABEL = { family: "Family unit", couple: "Couple", individual: "Individual" };
function kindBadgeStyle(kind) {
  if (kind === "individual") return { color: C.clay, background: C.clayBg, border: `1px solid ${C.clayBorder}` };
  return { color: C.sage, background: C.sageBg, border: "1px solid #D7E3D1" };
}

function Badge({ children, style }) {
  return <span style={{ fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", fontWeight: 700, padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap", ...style }}>{children}</span>;
}

function Btn({ children, onClick, variant = "ghost", style, disabled, type = "button" }) {
  const base = { padding: "9px 15px", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", borderRadius: 7, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit" };
  const variants = {
    primary: { color: "#FFFDF9", background: C.terracotta, border: "none" },
    ghost: { color: C.inkSoft, background: C.card, border: "1px solid #DFD5C6" },
    dark: { color: "#FBF7F0", background: C.inkSoft, border: `1px solid ${C.inkSoft}` },
    tint: { color: C.inkSoft, background: C.terracottaTintBg, border: `1px solid ${C.terracottaTintBorder}` },
    danger: { color: "#9A3B2A", background: "#FBF0EC", border: "1px solid #EFCFC2" },
  };
  return <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedLight, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", fontSize: 14, background: C.card, border: "1px solid #DFD5C6", borderRadius: 7, color: C.ink, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,30,25,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", zIndex: 50, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, width: "100%", maxWidth: wide ? 640 : 460, padding: "26px 26px 22px", boxShadow: "0 20px 50px rgba(40,30,20,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.mutedLight }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDelete({ label, onConfirm }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button onClick={() => setArmed(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: C.mutedLight }}>Delete</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}?</span>
      <button onClick={onConfirm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#9A3B2A" }}>Yes</button>
      <button onClick={() => setArmed(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: C.mutedLight }}>Cancel</button>
    </span>
  );
}

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Karla:wght@300;400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    input, textarea, select { font-family: inherit; }
    ::placeholder { color: ${C.placeholder}; }
    button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.terracotta}; outline-offset: 1px; }
  `}</style>
);

// ============================================================
// Login screen — email code (magic link), no passwords
// ============================================================
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send the sign-in link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: SANS, color: C.ink, padding: 20 }}>
      <GlobalStyle />
      <div style={{ width: "100%", maxWidth: 380, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "34px 30px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, marginBottom: 4 }}>The Thriving Families</div>
        <div style={{ fontSize: 12.5, color: C.mutedLight, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 26 }}>Practice Record</div>

        {sent ? (
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.muted }}>
            Check <strong style={{ color: C.ink }}>{email}</strong> for a sign-in link. Click it to open your practice record.
          </div>
        ) : (
          <form onSubmit={handleSend}>
            <Field label="Your email">
              <input type="email" required style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourpractice.org" />
            </Field>
            {error && <div style={{ fontSize: 13, color: "#9A3B2A", marginBottom: 14 }}>{error}</div>}
            <Btn type="submit" variant="primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Sending…" : "Send sign-in link"}
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main app
// ============================================================
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [screen, setScreen] = useState("today");
  const [households, setHouseholds] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [packets, setPackets] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showNewPacket, setShowNewPacket] = useState(false);
  const [showNewReferral, setShowNewReferral] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [referralContacts, setReferralContacts] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [assessmentReports, setAssessmentReports] = useState([]);
  const [assessmentRequests, setAssessmentRequests] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programSessions, setProgramSessions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [homeworkItems, setHomeworkItems] = useState([]);
  const [openTab, setOpenTab] = useState(null);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState("All");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  // Coming back from the assessment: open that family's record directly.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hid = qs.get("household");
    if (hid) {
      setSelectedHouseholdId(hid);
      setOpenTab(qs.get("tab") === "patterns" ? "Patterns & cycles" : null);
      setScreen("family");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadAll() {
    setLoadingData(true);
    setError("");
    try {
      const { data: hh, error: hhErr } = await supabase
        .from("household")
        .select("*, household_member(role, person(*))")
        .order("created_at", { ascending: false });
      if (hhErr) throw hhErr;

      const { data: sess, error: sessErr } = await supabase
        .from("session")
        .select("*, household(name, kind), session_note!session_note_session_id_fkey(id, signed_at)")
        .order("starts_at", { ascending: true });
      if (sessErr) throw sessErr;

      const { data: tmpl, error: tmplErr } = await supabase
        .from("document_template")
        .select("*")
        .order("gates_packet", { ascending: false });
      if (tmplErr) throw tmplErr;

      const { data: pkts, error: pktErr } = await supabase
        .from("intake_packet")
        .select("*, household(name), intake_document(*, document_template(*), person(full_name))")
        .order("sent_at", { ascending: false });
      if (pktErr) throw pktErr;

      setHouseholds(hh || []);
      setSessions(sess || []);
      setTemplates(tmpl || []);
      setPackets(pkts || []);

      const { data: contacts, error: cErr } = await supabase.from("referral_contact").select("*").order("name");
      if (cErr) throw cErr;

      const { data: refs, error: rErr } = await supabase
        .from("referral")
        .select("*, household(name), person(full_name), referral_contact(name)")
        .order("flagged_on", { ascending: false });
      if (rErr) throw rErr;

      const { data: invs, error: iErr } = await supabase
        .from("invoice")
        .select("*, household(name)")
        .order("issued_on", { ascending: false });
      if (iErr) throw iErr;

      const { data: reports, error: repErr } = await supabase
        .from("assessment_report")
        .select("*")
        .order("created_at", { ascending: false });
      if (repErr) throw repErr;

      const { data: reqs, error: reqErr } = await supabase
        .from("assessment_request")
        .select("id, household_id, person_id, sent_at, opened_at, submitted_at, expires_at, last_step")
        .order("sent_at", { ascending: false });
      if (reqErr) throw reqErr;
      setAssessmentRequests(reqs || []);

      await refreshPrograms();

      setReferralContacts(contacts || []);
      setReferrals(refs || []);
      setInvoices(invs || []);
      setAssessmentReports(reports || []);
    } catch (e) {
      setError(e.message || "Couldn't load your records.");
    } finally {
      setLoadingData(false);
    }
  }

  // Quiet refresh of programs, enrolments and homework (does not blank the screen).
  async function refreshPrograms() {
    const [p, ps, en, hw, ss] = await Promise.all([
      supabase.from("program").select("*").order("sort_order"),
      supabase.from("program_session").select("*").order("session_number"),
      supabase.from("program_enrollment").select("*").order("started_on", { ascending: false }),
      supabase.from("homework").select("*").order("assigned_on", { ascending: false }),
      supabase.from("session").select("*, household(name, kind), session_note!session_note_session_id_fkey(id, signed_at)").order("starts_at", { ascending: true }),
    ]);
    if (p.data) setPrograms(p.data);
    if (ps.data) setProgramSessions(ps.data);
    if (en.data) setEnrollments(en.data);
    if (hw.data) setHomeworkItems(hw.data);
    if (ss.data) setSessions(ss.data);
  }

  // Quiet refresh: reloads only the link list, without blanking the screen.
  async function refreshRequests() {
    const { data } = await supabase
      .from("assessment_request")
      .select("id, household_id, person_id, sent_at, opened_at, submitted_at, expires_at, last_step")
      .order("sent_at", { ascending: false });
    if (data) setAssessmentRequests(data);
  }

  async function createHousehold({ name, kind, memberNames }) {
    try {
      const { data: hh, error: hhErr } = await supabase
        .from("household")
        .insert({ name, kind, opened_on: todayISO() })
        .select()
        .single();
      if (hhErr) throw hhErr;

      for (let i = 0; i < memberNames.length; i++) {
        const { data: person, error: pErr } = await supabase
          .from("person")
          .insert({ full_name: memberNames[i], is_client: true })
          .select()
          .single();
        if (pErr) throw pErr;
        const { error: hmErr } = await supabase
          .from("household_member")
          .insert({ household_id: hh.id, person_id: person.id, sort_order: i });
        if (hmErr) throw hmErr;
      }
      await loadAll();
      return hh.id;
    } catch (e) {
      setError(e.message || "Couldn't create that record.");
      return null;
    }
  }

  async function deleteHousehold(id) {
    try {
      const { error: e } = await supabase.from("household").delete().eq("id", id);
      if (e) throw e;
      setScreen("clients");
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't delete that record — it may still have linked referrals or invoices.");
    }
  }

  async function createSession({ householdId, date, time, duration }) {
    try {
      const { count } = await supabase
        .from("session")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId);
      const starts_at = new Date(`${date}T${time}:00`).toISOString();
      const { error: e } = await supabase.from("session").insert({
        household_id: householdId,
        session_number: (count || 0) + 1,
        starts_at,
        duration_min: Number(duration) || 50,
        status: "scheduled",
      });
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't add that appointment.");
    }
  }

  async function deleteSession(id) {
    try {
      const { error: e } = await supabase.from("session").delete().eq("id", id);
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't delete that session.");
    }
  }

  async function saveNote(note) {
    try {
      const { error: e } = await supabase.from("session_note").upsert(note, { onConflict: "session_id" });
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't save that note — signed notes can't be edited, only added to.");
    }
  }

  async function createPacket(householdId) {
    try {
      const hh = households.find((h) => h.id === householdId);
      const primaryPersonId = hh?.household_member?.[0]?.person?.id || null;

      const { data: packet, error: pErr } = await supabase
        .from("intake_packet")
        .insert({ household_id: householdId, sent_at: new Date().toISOString() })
        .select()
        .single();
      if (pErr) throw pErr;

      const rows = templates.map((t) => ({
        packet_id: packet.id,
        template_id: t.id,
        person_id: primaryPersonId,
        status: t.gates_packet ? "sent" : "blocked",
      }));
      const { error: dErr } = await supabase.from("intake_document").insert(rows);
      if (dErr) throw dErr;

      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't create that packet.");
    }
  }

  async function markDocumentSigned(intakeDocumentId, signatureName) {
    try {
      const { data: doc, error: dErr } = await supabase
        .from("intake_document")
        .update({ status: "signed", signed_at: new Date().toISOString(), signature_name: signatureName })
        .eq("id", intakeDocumentId)
        .select("*, document_template(*), intake_packet(id)")
        .single();
      if (dErr) throw dErr;

      // The gating rule: signing the scope-acknowledgement unlocks every
      // other blocked document in the same packet.
      if (doc.document_template.gates_packet) {
        const { error: uErr } = await supabase
          .from("intake_document")
          .update({ status: "sent" })
          .eq("packet_id", doc.intake_packet.id)
          .eq("status", "blocked");
        if (uErr) throw uErr;
      }

      // If every document in the packet is now signed, mark the packet complete.
      const { data: remaining } = await supabase
        .from("intake_document")
        .select("id, status")
        .eq("packet_id", doc.intake_packet.id);
      const allSigned = (remaining || []).every((d) => d.status === "signed");
      if (allSigned) {
        await supabase.from("intake_packet").update({ completed_at: new Date().toISOString() }).eq("id", doc.intake_packet.id);
      }

      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't update that document.");
    }
  }

  async function uploadTemplateFile(templateId, file) {
    try {
      const path = `${templateId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("document-templates").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase.from("document_template").update({ file_path: path, revised_on: todayISO() }).eq("id", templateId);
      if (updErr) throw updErr;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't upload that file.");
    }
  }

  async function viewTemplateFile(filePath) {
    try {
      const { data, error: sErr } = await supabase.storage.from("document-templates").createSignedUrl(filePath, 60);
      if (sErr) throw sErr;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      setError(e.message || "Couldn't open that file.");
    }
  }

  async function createReferralContact({ name, specialism, organisation, contact }) {
    try {
      const { error: e } = await supabase.from("referral_contact").insert({ name, specialism, organisation, contact });
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't add that contact.");
    }
  }

  async function createReferral({ householdId, personId, reason, contactId, contactFreetext }) {
    try {
      const { error: e } = await supabase.from("referral").insert({
        household_id: householdId, person_id: personId || null, reason,
        contact_id: contactId || null, contact_freetext: contactFreetext || null,
        flagged_on: todayISO(),
      });
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't create that referral.");
    }
  }

  async function updateReferralOutcome(id, outcome) {
    try {
      const patch = { outcome };
      if (outcome && outcome !== "unknown") patch.referred_on = todayISO();
      const { error: e } = await supabase.from("referral").update(patch).eq("id", id);
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't update that referral.");
    }
  }

  async function createInvoice({ householdId, description, amount, dueOn }) {
    try {
      const number = `INV-${Date.now().toString().slice(-8)}`;
      const { error: e } = await supabase.from("invoice").insert({
        number, household_id: householdId, description,
        amount_cents: Math.round(Number(amount) * 100), issued_on: todayISO(), due_on: dueOn, status: "open",
      });
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't create that invoice.");
    }
  }

  async function markInvoicePaid(id) {
    try {
      const { error: e } = await supabase.from("invoice").update({ status: "paid", paid_on: todayISO() }).eq("id", id);
      if (e) throw e;
      await loadAll();
    } catch (e) {
      setError(e.message || "Couldn't update that invoice.");
    }
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: SANS, color: C.muted }}>Loading…</div>;
  }
  if (!session) return <LoginScreen />;

  const householdById = (id) => households.find((h) => h.id === id);
  const selectedHousehold = selectedHouseholdId ? householdById(selectedHouseholdId) : null;

  function nav(name) {
    const on = screen === name;
    return { textAlign: "left", padding: "9px 11px", fontSize: 14.5, fontWeight: on ? 700 : 500, border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", background: on ? C.card : "transparent", color: on ? C.ink : "#5C4E43", boxShadow: on ? "0 1px 2px rgba(60,44,28,0.07)" : "none" };
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: SANS, color: C.ink, background: C.bg, WebkitFontSmoothing: "antialiased" }}>
      <GlobalStyle />

      <aside style={{ width: 252, flex: "0 1 252px", minWidth: 208, background: C.sidebar, borderRight: `1px solid ${C.sidebarBorder}`, display: "flex", flexDirection: "column", padding: "26px 0 18px" }}>
        <div style={{ padding: "0 22px 22px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.01em" }}>The Thriving<br />Families</div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.mutedLight, marginTop: 9, fontWeight: 600 }}>Practice Record</div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          <button onClick={() => setScreen("today")} style={nav("today")}>Today</button>
          <button onClick={() => setScreen("clients")} style={nav("clients")}>Clients &amp; Families</button>
        </nav>
        <div style={{ height: 1, background: C.sidebarBorder, margin: "18px 20px" }} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A2917F", fontWeight: 600, padding: "4px 10px 8px" }}>Practice</div>
          <button onClick={() => setScreen("programs")} style={nav("programs")}>Programs</button>
          <button onClick={() => setScreen("intake")} style={nav("intake")}>Intake &amp; Consent</button>
          <button onClick={() => setScreen("billing")} style={nav("billing")}>Billing</button>
          <button onClick={() => setScreen("referrals")} style={nav("referrals")}>Referrals</button>
          <button onClick={() => setScreen("reports")} style={nav("reports")}>Reports</button>
        </nav>
        <div style={{ marginTop: "auto", padding: "0 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 16, borderTop: `1px solid ${C.sidebarBorder}` }}>
            <div style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</div>
            <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.mutedLight, fontWeight: 600 }}>Sign out</button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {error && <div style={{ background: "#FBF0EC", borderBottom: "1px solid #EFCFC2", color: "#9A3B2A", fontSize: 13.5, padding: "10px 24px" }}>{error}</div>}
        {loadingData ? (
          <div style={{ padding: 40, color: C.muted }}>Loading your practice record…</div>
        ) : (
          <>
            {screen === "today" && (
              <TodayScreen households={households} sessions={sessions}
                onOpenNote={(sessId, hhId) => { setSelectedHouseholdId(hhId); setEditingSessionId(sessId); setScreen("note"); }}
                onAddAppointment={() => setShowNewAppt(true)}
                onGoHousehold={(id) => { setSelectedHouseholdId(id); setScreen("family"); }} />
            )}
            {screen === "clients" && (
              <ClientsScreen households={households} sessions={sessions}
                search={search} setSearch={setSearch} filterKind={filterKind} setFilterKind={setFilterKind}
                onOpenHousehold={(id) => { setSelectedHouseholdId(id); setScreen("family"); }}
                onNewFamily={() => setShowNewFamily(true)} />
            )}
            {screen === "family" && selectedHousehold && (
              <FamilyRecordScreen household={selectedHousehold}
                sessions={sessions.filter((s) => s.household_id === selectedHousehold.id)}
                assessmentReports={assessmentReports.filter((r) => r.household_id === selectedHousehold.id)}
                assessmentRequests={assessmentRequests.filter((r) => r.household_id === selectedHousehold.id)}
                onLinksChanged={refreshRequests}
                programs={programs} programSessions={programSessions}
                enrollments={enrollments.filter((e) => e.household_id === selectedHousehold.id)}
                homework={homeworkItems.filter((h) => h.household_id === selectedHousehold.id)}
                onProgramsChanged={refreshPrograms}
                initialTab={openTab}
                onBack={() => setScreen("clients")}
                onDelete={() => deleteHousehold(selectedHousehold.id)}
                onStartNote={() => { setEditingSessionId(null); setScreen("note"); }}
                onOpenNote={(id) => { setEditingSessionId(id); setScreen("note"); }}
                onDeleteSession={deleteSession} />
            )}
            {screen === "note" && (
              <NoteScreen household={selectedHousehold} households={households}
                sessionRow={editingSessionId ? sessions.find((s) => s.id === editingSessionId) : null}
                onBack={() => setScreen(selectedHousehold ? "family" : "today")}
                onSaveNote={saveNote}
                programs={programs} programSessions={programSessions}
                enrollments={selectedHousehold ? enrollments.filter((e) => e.household_id === selectedHousehold.id) : []}
                homework={selectedHousehold ? homeworkItems.filter((h) => h.household_id === selectedHousehold.id) : []}
                onProgramsChanged={refreshPrograms} />
            )}
            {screen === "programs" && (
              <ProgramsScreen programs={programs} programSessions={programSessions} enrollments={enrollments} onChanged={refreshPrograms} />
            )}
            {screen === "intake" && (
              <IntakeScreen households={households} templates={templates} packets={packets}
                onNewPacket={() => setShowNewPacket(true)}
                onMarkSigned={markDocumentSigned}
                onUploadFile={uploadTemplateFile}
                onViewFile={viewTemplateFile} />
            )}
            {screen === "billing" && (
              <BillingScreen households={households} invoices={invoices}
                onNewInvoice={() => setShowNewInvoice(true)}
                onMarkPaid={markInvoicePaid} />
            )}
            {screen === "referrals" && (
              <ReferralsScreen households={households} referralContacts={referralContacts} referrals={referrals}
                onNewReferral={() => setShowNewReferral(true)}
                onNewContact={() => setShowNewContact(true)}
                onUpdateOutcome={updateReferralOutcome} />
            )}
            {screen === "reports" && (
              <ReportsScreen households={households} sessions={sessions} packets={packets} referrals={referrals} invoices={invoices} />
            )}
          </>
        )}
      </main>

      {showNewFamily && (
        <NewFamilyModal onClose={() => setShowNewFamily(false)}
          onCreate={async (payload) => { const id = await createHousehold(payload); setShowNewFamily(false); if (id) { setSelectedHouseholdId(id); setScreen("family"); } }} />
      )}
      {showNewAppt && (
        <NewApptModal households={households} onClose={() => setShowNewAppt(false)}
          onCreate={async (payload) => { await createSession(payload); setShowNewAppt(false); }} />
      )}
      {showNewPacket && (
        <NewPacketModal households={households} onClose={() => setShowNewPacket(false)}
          onCreate={async (householdId) => { await createPacket(householdId); setShowNewPacket(false); }} />
      )}
      {showNewInvoice && (
        <NewInvoiceModal households={households} onClose={() => setShowNewInvoice(false)}
          onCreate={async (payload) => { await createInvoice(payload); setShowNewInvoice(false); }} />
      )}
      {showNewReferral && (
        <NewReferralModal households={households} referralContacts={referralContacts} onClose={() => setShowNewReferral(false)}
          onCreate={async (payload) => { await createReferral(payload); setShowNewReferral(false); }} />
      )}
      {showNewContact && (
        <NewContactModal onClose={() => setShowNewContact(false)}
          onCreate={async (payload) => { await createReferralContact(payload); setShowNewContact(false); }} />
      )}
    </div>
  );
}

// ---------- Intake & Consent ----------
function chipStyle(status) {
  if (status === "signed") return { color: C.sage, background: C.sageBg, border: "1px solid #D6DECF" };
  if (status === "blocked") return { color: C.placeholder, background: "transparent", border: "1px dashed #DFD5C6" };
  return { color: C.gold, background: C.goldBg, border: `1px solid ${C.goldBorder}` }; // sent / outstanding
}
function chipLabel(status) {
  if (status === "signed") return "Complete";
  if (status === "blocked") return "Blocked";
  return "Outstanding";
}

function IntakeScreen({ households, templates, packets, onNewPacket, onMarkSigned, onUploadFile, onViewFile }) {
  const [signingDoc, setSigningDoc] = useState(null); // { id, title }
  const [signatureName, setSignatureName] = useState("");

  return (
    <div style={{ padding: "26px 40px 60px", maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>Intake &amp; Consent</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: "7px 0 0" }}>
            Nothing else in a packet unlocks until the scope-of-practice acknowledgement is signed.
          </p>
        </div>
        <Btn variant="primary" onClick={onNewPacket} disabled={households.length === 0}>Send new packet</Btn>
      </div>

      <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, margin: "26px 0 14px" }}>Packets in progress</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {packets.length === 0 && (
          <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>
            No packets sent yet.
          </div>
        )}
        {packets.map((pkt) => (
          <div key={pkt.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "17px 19px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "6px 16px" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{pkt.household?.name || "Unknown"}</div>
              <div style={{ fontSize: 12.5, color: C.mutedLight }}>
                Sent {pkt.sent_at?.slice(0, 10)}
                {pkt.completed_at && <> · completed {pkt.completed_at.slice(0, 10)}</>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {(pkt.intake_document || []).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => doc.status !== "signed" && doc.status !== "blocked" && (setSigningDoc({ id: doc.id, title: doc.document_template?.title }), setSignatureName(""))}
                  disabled={doc.status === "blocked" || doc.status === "signed"}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 5, cursor: doc.status === "sent" ? "pointer" : "default", ...chipStyle(doc.status) }}
                  title={doc.status === "blocked" ? "Blocked until the scope acknowledgement is signed" : undefined}
                >
                  {doc.status === "signed" && "✓ "}{doc.document_template?.title} · {chipLabel(doc.status)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, margin: "34px 0 14px" }}>Document templates</h2>
      <p style={{ fontSize: 13, color: C.mutedLight, margin: "-6px 0 14px" }}>
        Upload the actual reviewed document (PDF or Word) for each one — this replaces the placeholder text.
      </p>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1.2fr) auto auto", background: C.panelCard, padding: "10px 18px", fontSize: 11.5, fontWeight: 700, color: C.mutedLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div>Document</div><div>Purpose</div><div>Revised</div><div>File</div>
        </div>
        {templates.map((t, i) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1.2fr) auto auto", padding: "14px 18px", fontSize: 13.5, borderTop: i > 0 ? `1px solid ${C.hairline}` : "none", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
              {t.title}
              {t.gates_packet && <Badge style={{ color: C.terracotta, background: C.terracottaTintBg, border: `1px solid ${C.terracottaTintBorder}` }}>Gates packet</Badge>}
            </div>
            <div style={{ color: C.muted }}>{t.purpose}</div>
            <div style={{ color: C.mutedLight, whiteSpace: "nowrap" }}>{t.revised_on}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
              {t.file_path && (
                <button onClick={() => onViewFile(t.file_path)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: C.sage }}>View current file</button>
              )}
              <label style={{ fontSize: 12.5, fontWeight: 600, color: C.terracotta, cursor: "pointer" }}>
                {t.file_path ? "Replace file" : "Upload file"}
                <input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(t.id, f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        ))}
      </div>

      {signingDoc && (
        <Modal title={`Record signature — ${signingDoc.title}`} onClose={() => setSigningDoc(null)}>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, marginTop: 0 }}>
            This records that the client has reviewed and agreed to this document (e.g. signed on paper, or verbally in session). A self-service client link is a future enhancement — for now, record it here once it's done.
          </p>
          <Field label="Client's name, as signed">
            <input style={inputStyle} value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Full name" />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <Btn onClick={() => setSigningDoc(null)}>Cancel</Btn>
            <Btn variant="primary" disabled={!signatureName.trim()} onClick={() => { onMarkSigned(signingDoc.id, signatureName.trim()); setSigningDoc(null); }}>Mark as signed</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewPacketModal({ households, onClose, onCreate }) {
  const [householdId, setHouseholdId] = useState(households[0]?.id || "");
  return (
    <Modal title="Send new packet" onClose={onClose}>
      {households.length === 0 ? (
        <div style={{ fontSize: 14, color: C.muted }}>Create a client or family record first.</div>
      ) : (
        <>
          <Field label="Family / client">
            <select style={inputStyle} value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
              {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
          <p style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.5 }}>
            This creates all five documents for this household. Only the scope-of-practice acknowledgement unlocks right away — everything else stays blocked until that one's signed.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!householdId} onClick={() => onCreate(householdId)}>Send packet</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------- Billing ----------
function money(cents) { return `$${(cents / 100).toFixed(2)}`; }

function BillingScreen({ households, invoices, onNewInvoice, onMarkPaid }) {
  const outstanding = invoices.filter((i) => i.status !== "paid");
  const totalOutstanding = outstanding.reduce((sum, i) => sum + i.amount_cents, 0);

  return (
    <div style={{ padding: "38px 40px 60px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>Billing</h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "7px 0 0" }}>
            {outstanding.length} outstanding invoice{outstanding.length === 1 ? "" : "s"} · {money(totalOutstanding)} owed
          </p>
        </div>
        <Btn variant="primary" onClick={onNewInvoice} disabled={households.length === 0}>New invoice</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 22 }}>
        {invoices.length === 0 && (
          <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>
            No invoices yet.
          </div>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", gap: 14, alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "14px 16px" }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{inv.household?.name || "Unknown"}</div>
              <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>{inv.description || inv.number} · due {inv.due_on}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{money(inv.amount_cents)}</div>
            <Badge style={inv.status === "paid" ? { color: C.sage, background: C.sageBg, border: "1px solid #D7E3D1" } : { color: C.gold, background: C.goldBg, border: `1px solid ${C.goldBorder}` }}>
              {inv.status === "paid" ? `Paid ${inv.paid_on}` : "Open"}
            </Badge>
            {inv.status !== "paid" && <Btn variant="tint" onClick={() => onMarkPaid(inv.id)}>Mark paid</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewInvoiceModal({ households, onClose, onCreate }) {
  const [householdId, setHouseholdId] = useState(households[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(todayISO());
  return (
    <Modal title="New invoice" onClose={onClose}>
      <Field label="Family / client">
        <select style={inputStyle} value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
          {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </Field>
      <Field label="Description"><input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. September sessions" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount (USD)"><input type="number" step="0.01" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Due date"><input type="date" style={inputStyle} value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!householdId || !amount} onClick={() => onCreate({ householdId, description, amount, dueOn })}>Create invoice</Btn>
      </div>
    </Modal>
  );
}

// ---------- Referrals ----------
function ReferralsScreen({ households, referralContacts, referrals, onNewReferral, onNewContact, onUpdateOutcome }) {
  return (
    <div style={{ padding: "38px 40px 60px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>Referrals</h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "7px 0 0" }}>{referrals.length} referral{referrals.length === 1 ? "" : "s"} on record</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onNewContact}>New contact</Btn>
          <Btn variant="primary" onClick={onNewReferral} disabled={households.length === 0}>New referral</Btn>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 22 }}>
        {referrals.length === 0 && (
          <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>
            No referrals yet.
          </div>
        )}
        {referrals.map((r) => (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.household?.name || "Unknown"}{r.person?.full_name ? ` — ${r.person.full_name}` : ""}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{r.reason}</div>
                <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 4 }}>
                  Flagged {r.flagged_on}{r.referral_contact?.name ? ` · referred to ${r.referral_contact.name}` : r.contact_freetext ? ` · referred to ${r.contact_freetext}` : ""}
                </div>
              </div>
              <select style={{ ...inputStyle, width: "auto", height: "fit-content" }} value={r.outcome || "unknown"} onChange={(e) => onUpdateOutcome(r.id, e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="booked">Booked</option>
                <option value="declined">Declined</option>
                <option value="no_response">No response</option>
                <option value="in_programme">In programme</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {referralContacts.length > 0 && (
        <>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, margin: "34px 0 14px" }}>Referral contacts</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {referralContacts.map((c) => (
              <div key={c.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 15px", fontSize: 13.5 }}>
                <strong>{c.name}</strong>{c.specialism ? ` · ${c.specialism}` : ""}{c.organisation ? ` · ${c.organisation}` : ""}{c.contact ? ` · ${c.contact}` : ""}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NewReferralModal({ households, referralContacts, onClose, onCreate }) {
  const [householdId, setHouseholdId] = useState(households[0]?.id || "");
  const [personId, setPersonId] = useState("");
  const [reason, setReason] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactFreetext, setContactFreetext] = useState("");
  const hh = households.find((h) => h.id === householdId);
  const members = hh?.household_member?.map((m) => m.person) || [];

  return (
    <Modal title="New referral" onClose={onClose}>
      <Field label="Family / client">
        <select style={inputStyle} value={householdId} onChange={(e) => { setHouseholdId(e.target.value); setPersonId(""); }}>
          {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </Field>
      {members.length > 0 && (
        <Field label="Specific person (optional)">
          <select style={inputStyle} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Whole household</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Reason"><textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {referralContacts.length > 0 ? (
        <Field label="Referred to">
          <select style={inputStyle} value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— choose a contact —</option>
            {referralContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Referred to (no contacts saved yet)"><input style={inputStyle} value={contactFreetext} onChange={(e) => setContactFreetext(e.target.value)} placeholder="Name or organisation" /></Field>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!householdId || !reason.trim()} onClick={() => onCreate({ householdId, personId: personId || null, reason: reason.trim(), contactId: contactId || null, contactFreetext: contactFreetext.trim() || null })}>Create referral</Btn>
      </div>
    </Modal>
  );
}

function NewContactModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [specialism, setSpecialism] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [contact, setContact] = useState("");
  return (
    <Modal title="New referral contact" onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Specialism"><input style={inputStyle} value={specialism} onChange={(e) => setSpecialism(e.target.value)} placeholder="e.g. Licensed marriage & family therapist" /></Field>
      <Field label="Organisation"><input style={inputStyle} value={organisation} onChange={(e) => setOrganisation(e.target.value)} /></Field>
      <Field label="Contact info"><input style={inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), specialism, organisation, contact })}>Add contact</Btn>
      </div>
    </Modal>
  );
}

// ---------- Reports ----------
function ReportsScreen({ households, sessions, packets, referrals, invoices }) {
  const signedCount = sessions.filter((s) => s.session_note?.[0]?.signed_at).length;
  const unsignedCount = sessions.length - signedCount;
  const completedPackets = packets.filter((p) => p.completed_at).length;
  const outcomeCounts = referrals.reduce((acc, r) => { const k = r.outcome || "unknown"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_cents, 0);
  const outstandingTotal = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount_cents, 0);

  return (
    <div style={{ padding: "38px 40px 60px", maxWidth: 1000 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Reports</h1>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 26px" }}>
        A practice-wide view built from what's actually recorded so far. The client-facing assessment system (pattern analytics, divergence reports) is a later phase and isn't reflected here yet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ReportCard title="Caseload">
          <StatRow label="Active households" value={households.length} />
          <Hairline /><StatRow label="Total sessions" value={sessions.length} />
          <Hairline /><StatRow label="Signed notes" value={signedCount} />
          <Hairline /><StatRow label="Unsigned notes" value={unsignedCount} />
        </ReportCard>
        <ReportCard title="Intake progress">
          <StatRow label="Packets sent" value={packets.length} />
          <Hairline /><StatRow label="Packets completed" value={completedPackets} />
          <Hairline /><StatRow label="In progress" value={packets.length - completedPackets} />
        </ReportCard>
        <ReportCard title="Referrals">
          <StatRow label="Total flagged" value={referrals.length} />
          <Hairline /><StatRow label="Booked" value={outcomeCounts.booked || 0} />
          <Hairline /><StatRow label="Awaiting outcome" value={outcomeCounts.unknown || 0} />
        </ReportCard>
        <ReportCard title="Billing">
          <StatRow label="Invoices" value={invoices.length} />
          <Hairline /><StatRow label="Collected" value={money(paidTotal)} />
          <Hairline /><StatRow label="Outstanding" value={money(outstandingTotal)} />
        </ReportCard>
      </div>
    </div>
  );
}
function ReportCard({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "16px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ---------- Today ----------
function TodayScreen({ households, sessions, onOpenNote, onAddAppointment, onGoHousehold }) {
  const t = todayISO();
  const todays = sessions.filter((s) => s.starts_at.slice(0, 10) === t).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const totalMinutes = todays.reduce((sum, s) => sum + (s.duration_min || 0), 0);
  const unsigned = sessions.filter((s) => s.starts_at.slice(0, 10) < t && !s.session_note?.[0]?.signed_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 6);
  const familiesActive = households.filter((h) => h.kind !== "individual").length;
  const individualsActive = households.reduce((sum, h) => sum + (h.household_member?.length || 0), 0);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", minHeight: "100%" }}>
      <div style={{ flex: "1 1 520px", minWidth: 0, padding: "38px 40px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.mutedLight, fontWeight: 600 }}>{todayLabel()}</div>
            <h1 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, letterSpacing: "-0.02em", margin: "6px 0 0" }}>{todayLong()}</h1>
          </div>
          <Btn onClick={onAddAppointment}>Add appointment</Btn>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "30px 0 14px" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, margin: 0 }}>Schedule</h2>
          <div style={{ fontSize: 13, color: C.mutedLight }}>{todays.length} session{todays.length === 1 ? "" : "s"} · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {todays.length === 0 && <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>Nothing on the calendar today.</div>}
          {todays.map((s) => {
            const hh = s.household;
            const accent = hh?.kind === "individual" ? C.terracotta : C.sage;
            const time = s.starts_at.slice(11, 16);
            const signed = !!s.session_note?.[0]?.signed_at;
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) auto", gap: 14, alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 9, padding: "16px 18px" }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 19 }}>{time}</div>
                  <div style={{ fontSize: 11.5, color: C.mutedLight }}>{s.duration_min} min</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); onGoHousehold(s.household_id); }} style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{hh ? hh.name : "Unknown"}</a>
                    {hh && <Badge style={kindBadgeStyle(hh.kind)}>{KIND_LABEL[hh.kind]}</Badge>}
                    {!signed && <Badge style={{ color: C.gold, background: C.goldBg, border: `1px solid ${C.goldBorder}` }}>Unsigned</Badge>}
                  </div>
                  <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>Session #{s.session_number}</div>
                </div>
                <Btn variant="tint" onClick={() => onOpenNote(s.id, s.household_id)}>Open note</Btn>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: "1 1 320px", minWidth: 300, borderLeft: `1px solid ${C.border}`, background: C.panelCard, padding: "38px 28px 60px" }}>
        <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, margin: "0 0 14px" }}>Needs attention</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {unsigned.length === 0 && <div style={{ fontSize: 13.5, color: C.mutedLight }}>Nothing outstanding.</div>}
          {unsigned.map((s) => (
            <div key={s.id} onClick={() => onOpenNote(s.id, s.household_id)} style={{ cursor: "pointer", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "13px 14px" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.terracotta, fontWeight: 700 }}>Note unsigned</div>
              <div style={{ fontSize: 14, marginTop: 5 }}>{s.household?.name || "Unknown"} — {s.starts_at.slice(0, 10)}</div>
            </div>
          ))}
        </div>
        <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, margin: "30px 0 14px" }}>Practice at a glance</h3>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 16px 14px" }}>
          <StatRow label="Sessions logged" value={sessions.length} />
          <Hairline /><StatRow label="Families active" value={familiesActive} />
          <Hairline /><StatRow label="People active" value={individualsActive} />
          <Hairline /><StatRow label="Notes unsigned" value={sessions.filter((s) => !s.session_note?.[0]?.signed_at).length} />
        </div>
      </div>
    </div>
  );
}
function StatRow({ label, value }) { return <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 14 }}><span style={{ color: C.muted }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span></div>; }
function Hairline() { return <div style={{ height: 1, background: C.hairline }} />; }

// ---------- Clients & Families ----------
function ClientsScreen({ households, sessions, search, setSearch, filterKind, setFilterKind, onOpenHousehold, onNewFamily }) {
  const filtered = households.filter((h) => {
    const matchesKind = filterKind === "All" || KIND_LABEL[h.kind] === filterKind || (filterKind === "Family units" && h.kind === "family") || (filterKind === "Individuals" && h.kind === "individual") || (filterKind === "Couples" && h.kind === "couple");
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || h.name.toLowerCase().includes(q);
    return matchesKind && matchesSearch;
  });
  return (
    <div style={{ padding: "38px 40px 60px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>Clients &amp; Families</h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "7px 0 0" }}>{households.length} active record{households.length === 1 ? "" : "s"}</p>
        </div>
        <Btn variant="primary" onClick={onNewFamily}>New record</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "22px 0 20px", alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search names…" style={{ flex: 1, minWidth: 240, ...inputStyle }} />
        {["All", "Family units", "Individuals", "Couples"].map((t) => <Btn key={t} variant={filterKind === t ? "dark" : "ghost"} onClick={() => setFilterKind(t)}>{t}</Btn>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {filtered.length === 0 && <div style={{ gridColumn: "1/-1", padding: "40px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>No records match.</div>}
        {filtered.map((h) => {
          const members = h.household_member?.map((m) => m.person) || [];
          const sessCount = sessions.filter((s) => s.household_id === h.id).length;
          return (
            <div key={h.id} onClick={() => onOpenHousehold(h.id)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: 20, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500 }}>{h.name}</div>
                  <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>{members.length} member{members.length === 1 ? "" : "s"}</div>
                </div>
                <Badge style={kindBadgeStyle(h.kind)}>{KIND_LABEL[h.kind]}</Badge>
              </div>
              <div style={{ display: "flex", gap: 5, margin: "15px 0 4px", flexWrap: "wrap" }}>
                {members.map((m) => <span key={m.id} style={{ fontSize: 12, color: "#4A3C31", background: C.terracottaTintBg, border: "1px solid #EADCC2", padding: "3px 8px", borderRadius: 20 }}>{m.full_name}</span>)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mutedLight, marginTop: 14, borderTop: `1px solid ${C.hairline}`, paddingTop: 11 }}>
                <span>{sessCount} session{sessCount === 1 ? "" : "s"}</span>
                <span>Since {h.opened_on}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Family Record ----------
function FamilyRecordScreen({ household, sessions, assessmentReports, assessmentRequests, onLinksChanged, programs, programSessions, enrollments, homework, onProgramsChanged, initialTab, onBack, onDelete, onStartNote, onOpenNote, onDeleteSession }) {
  const [tab, setTab] = useState(initialTab || "Sessions");
  const tabs = ["Assessments", "Patterns & cycles", "Programs", "Sessions", "Goals", "Documents", "Billing"];
  const members = household.household_member?.map((m) => m.person) || [];
  const sorted = [...sessions].sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  return (
    <div>
      <div style={{ padding: "34px 40px 0" }}>
        <div style={{ fontSize: 13, color: C.mutedLight }}><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Clients &amp; Families</a> &nbsp;/&nbsp; {household.name}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>{household.name}</h1>
            <p style={{ fontSize: 14, color: C.muted, margin: "7px 0 0" }}>{KIND_LABEL[household.kind]} · {members.length} member{members.length === 1 ? "" : "s"} · since {household.opened_on} · {sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={() => { window.location.href = `/assessment.html?household=${encodeURIComponent(household.id)}&name=${encodeURIComponent(household.name)}`; }}>Run assessment</Btn>
            <Btn variant="primary" onClick={onStartNote}>Start session note</Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 24, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
          {tabs.map((tb) => <div key={tb} onClick={() => setTab(tb)} style={{ paddingBottom: 11, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", fontWeight: tab === tb ? 700 : 400, color: tab === tb ? C.ink : C.mutedLight, borderBottom: tab === tb ? `2px solid ${C.terracotta}` : "2px solid transparent", marginBottom: -1 }}>{tb}</div>)}
        </div>
      </div>
      <div style={{ padding: "26px 40px 60px", maxWidth: 900 }}>
        {tab === "Sessions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sorted.length === 0 && <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>No session notes yet.</div>}
            {sorted.map((s) => {
              const signed = !!s.session_note?.[0]?.signed_at;
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14, alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "14px 16px" }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.starts_at.slice(0, 10)} · {s.starts_at.slice(11, 16)}</div>
                    <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>Session #{s.session_number}</div>
                  </div>
                  <Badge style={signed ? { color: C.sage, background: C.sageBg, border: "1px solid #D7E3D1" } : { color: C.gold, background: C.goldBg, border: `1px solid ${C.goldBorder}` }}>{signed ? "Signed" : "Unsigned"}</Badge>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button onClick={() => onOpenNote(s.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: C.terracotta }}>Open</button>
                    {!signed && <ConfirmDelete label="Delete this session" onConfirm={() => onDeleteSession(s.id)} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "Patterns & cycles" && (
          <PatternsTab reports={assessmentReports} members={members} />
        )}
        {tab === "Programs" && (
          <FamilyProgramsTab household={household} sessions={sessions} programs={programs} programSessions={programSessions}
            enrollments={enrollments} homework={homework} onChanged={onProgramsChanged} />
        )}
        {tab === "Assessments" && (
          <AssessmentsTab household={household} members={members} requests={assessmentRequests || []} onChanged={onLinksChanged} />
        )}
        {tab !== "Sessions" && tab !== "Patterns & cycles" && tab !== "Assessments" && tab !== "Programs" && <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>{tab} isn't wired up yet.</div>}
        <div style={{ marginTop: 26, textAlign: "right" }}>
          <ConfirmDelete label="Delete this whole record" onConfirm={onDelete} />
        </div>
      </div>
    </div>
  );
}

// ---------- Session Note ----------
// ---------- Patterns & cycles (assessment report display) ----------
const CREATURE_LABEL = { serpent: "The Breach", jackal: "The Ruin", dragon: "The Foundation Crack" };
function requestStatus(r) {
  if (r.submitted_at) return { label: "Submitted", tone: "done" };
  if (new Date(r.expires_at) < new Date()) return { label: "Expired", tone: "off" };
  if (r.opened_at && (r.last_step || 0) > 0) return { label: `In progress — step ${(r.last_step || 0) + 1} of 16`, tone: "wip" };
  if (r.opened_at) return { label: "Opened, not started", tone: "wip" };
  return { label: "Not opened yet", tone: "off" };
}
const TONE = {
  done: { color: C.sage, background: C.sageBg, border: "1px solid #D7E3D1" },
  wip: { color: C.gold, background: C.goldBg, border: `1px solid ${C.goldBorder}` },
  off: { color: C.mutedLight, background: C.hairline, border: `1px solid ${C.border}` },
};

// ---------- Assessments tab: send a private link, watch progress ----------
function AssessmentsTab({ household, members, requests, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [fresh, setFresh] = useState(null); // { personId, url } shown once
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  async function makeLink(person) {
    setBusyId(person.id); setErr(""); setCopied(false);
    const { data, error } = await supabase.rpc("create_assessment_link", { p_household: household.id, p_person: person.id, p_days: 21 });
    setBusyId(null);
    if (error) { setErr(error.message); return; }
    setFresh({ personId: person.id, name: person.full_name, url: `${window.location.origin}/assessment.html?t=${data}` });
    onChanged && onChanged();
  }
  async function copy(url) {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch (e) { setCopied(false); }
  }
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "Unknown";

  return (
    <div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
        Each person gets their own private link. They open it on any device with no login, answer at their own pace (it saves as they go), and submit once. Their results then appear under <strong>Patterns &amp; cycles</strong>.
      </div>

      {fresh && (
        <div style={{ background: C.sageBg, border: "1px solid #D7E3D1", borderRadius: 10, padding: "16px 18px", marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Link for {fresh.name} (valid 21 days)</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>Copy it now and send it by your usual email or message. For privacy it is shown only this once — if you lose it, make a new one (the old one stops working).</div>
          <input readOnly value={fresh.url} onFocus={(e) => e.target.select()} style={{ ...inputStyle, fontSize: 12.5, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Btn variant="primary" onClick={() => copy(fresh.url)}>{copied ? "Copied ✓" : "Copy link"}</Btn>
            <Btn onClick={() => setFresh(null)}>Done</Btn>
          </div>
        </div>
      )}
      {err && <div style={{ color: "#9A3B2A", fontSize: 13.5, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 26 }}>
        {members.map((m) => {
          const mine = requests.filter((r) => r.person_id === m.id);
          const latest = mine[0];
          const st = latest ? requestStatus(latest) : null;
          return (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14, alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "14px 18px" }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{m.full_name}</div>
                <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>{latest ? `Link sent ${latest.sent_at?.slice(0, 10)}` : "No link sent yet"}</div>
              </div>
              {st ? <Badge style={TONE[st.tone]}>{st.label}</Badge> : <span />}
              <Btn variant={latest && !latest.submitted_at ? "ghost" : "primary"} disabled={busyId === m.id} onClick={() => makeLink(m)}>
                {busyId === m.id ? "Making…" : latest ? (latest.submitted_at ? "Send another" : "New link") : "Send assessment link"}
              </Btn>
            </div>
          );
        })}
        {members.length === 0 && <div style={{ color: C.mutedLight, fontSize: 14 }}>Add household members first.</div>}
      </div>
      <div style={{ fontSize: 12.5, color: C.mutedLight }}>You can also use <strong>Run assessment</strong> at the top to complete it yourself together with a client in a session.</div>
    </div>
  );
}


// ---------- Discussion report (printable, for talking it through with the client) ----------
const REPORT_DOMAINS = [
  { gate: "gate_sheep", wall: "wall_worship", label: "Faith & worship", note: "Sheep Gate" },
  { gate: "gate_fish", wall: "wall_provision", label: "Money & provision", note: "Fish Gate" },
  { gate: "gate_old", wall: "wall_heritage", label: "Family heritage", note: "Old Gate" },
  { gate: "gate_valley", wall: "wall_transition", label: "Life transitions", note: "Valley Gate" },
  { gate: "gate_dung", wall: "wall_repentance", label: "Owning & clearing wrongs", note: "Dung Gate" },
  { gate: "gate_water", wall: "wall_word", label: "God's Word in the home", note: "Water Gate" },
  { gate: "gate_horse", wall: "wall_warfare", label: "Prayer & protection", note: "Horse Gate" },
  { gate: "gate_miphkad", wall: "wall_accountability", label: "Accountability", note: "Miphkad Gate" },
];
const escHtml = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildDiscussionReportHTML({ who, date, computed, gates, walls }) {
  const GOOD = "#4E7A4A", MID = "#C28A1E", BAD = "#A63D2A";
  const gateStatus = (v) => (v >= 4 ? { c: GOOD, t: "Working" } : v === 3 ? { c: MID, t: "Partly working" } : { c: BAD, t: "Needs attention" });
  const wallStatus = (v) => (v <= 2 ? { c: GOOD, t: "In place" } : v === 3 ? { c: MID, t: "Partly in place" } : { c: BAD, t: "Needs attention" });
  const bar = (pct, color) => `<div style="height:12px;background:#EDE6DA;border-radius:6px;overflow:hidden"><div style="height:12px;width:${Math.max(4, pct)}%;background:${color};border-radius:6px"></div></div>`;

  const sc = computed.scores || {};
  const patterns = [
    { name: "Honesty & trust", term: "The Breach", v: sc.serpent },
    { name: "Loss & grief", term: "The Ruin", v: sc.jackal },
    { name: "Patterns that repeat", term: "The Foundation Crack", v: sc.dragon },
  ].filter((p) => typeof p.v === "number");
  const patternHTML = patterns.length ? `
    <h2>Where the pressure is strongest</h2>
    <p class="sub">A longer bar means that area is carrying more strain right now.</p>
    ${patterns.map((p) => `<div class="row"><div class="lab"><strong>${p.name}</strong><span>${p.term}</span></div><div class="bar">${bar(p.v, p.v >= 60 ? BAD : p.v >= 40 ? MID : GOOD)}</div><div class="val">${Math.round(p.v)}%</div></div>`).join("")}` : "";

  const rows = REPORT_DOMAINS.map((d) => {
    const g = gates[d.gate], w = walls[d.wall];
    return { ...d, g, w, gs: g ? gateStatus(g) : null, ws: w ? wallStatus(w) : null };
  }).filter((r) => r.g || r.w);

  const domainHTML = rows.length ? `
    <h2>What is working and what needs work</h2>
    <p class="sub">For each area of family life we looked at two things: <strong>who is looking after it</strong>, and <strong>whether you have an agreed standard for it</strong>. <span style="color:${GOOD}">&#9679; Working</span> &nbsp; <span style="color:${MID}">&#9679; Partly</span> &nbsp; <span style="color:${BAD}">&#9679; Needs attention</span></p>
    ${rows.map((r) => `<div class="dom"><div class="domhead"><strong>${r.label}</strong><span>${r.note}</span></div>
      ${r.g ? `<div class="row"><div class="lab2">Who looks after it</div><div class="bar">${bar(((r.g - 1) / 4) * 100, r.gs.c)}</div><div class="val" style="color:${r.gs.c}">${r.gs.t}</div></div>` : ""}
      ${r.w ? `<div class="row"><div class="lab2">Agreed standard</div><div class="bar">${bar(((5 - r.w) / 4) * 100, r.ws.c)}</div><div class="val" style="color:${r.ws.c}">${r.ws.t}</div></div>` : ""}</div>`).join("")}` : "";

  const strong = rows.filter((r) => r.gs && r.ws && r.gs.c === GOOD && r.ws.c === GOOD).map((r) => r.label);
  const work = rows.filter((r) => (r.gs && r.gs.c === BAD) || (r.ws && r.ws.c === BAD)).map((r) => r.label);
  const summaryHTML = rows.length ? `
    <h2>In short</h2>
    <div class="two"><div class="box" style="border-color:${GOOD}"><strong style="color:${GOOD}">Working well</strong><p>${strong.length ? strong.map(escHtml).join(" &middot; ") : "No area is fully in place yet — and that is useful to know."}</p></div>
    <div class="box" style="border-color:${BAD}"><strong style="color:${BAD}">Needs attention</strong><p>${work.length ? work.map(escHtml).join(" &middot; ") : "Nothing stands out as seriously strained."}</p></div></div>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Family Assessment — ${escHtml(who)}</title>
<style>
body{font-family:Georgia,serif;color:#241E19;background:#fff;margin:0;padding:36px 44px;max-width:820px}
h1{font-size:28px;font-weight:500;margin:0 0 4px} h2{font-size:19px;font-weight:500;margin:30px 0 4px;border-bottom:2px solid #E4DBCE;padding-bottom:6px}
.meta{color:#6B5D52;font-size:13px;font-family:Helvetica,Arial,sans-serif} .sub{color:#6B5D52;font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.55;margin:4px 0 12px}
.row{display:grid;grid-template-columns:190px 1fr 120px;gap:14px;align-items:center;margin:9px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px}
.lab span,.domhead span{display:block;font-size:11px;color:#8A7A6B} .lab2{color:#3A302A} .val{font-weight:700;font-size:12.5px;text-align:right}
.dom{margin:12px 0 18px;page-break-inside:avoid} .domhead{display:flex;gap:10px;align-items:baseline;font-family:Helvetica,Arial,sans-serif;font-size:14px;margin-bottom:2px} .domhead span{display:inline}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;font-family:Helvetica,Arial,sans-serif} .box{border:2px solid;border-radius:10px;padding:12px 16px;font-size:13.5px;line-height:1.55} .box p{margin:6px 0 0}
.note{margin-top:34px;font-size:11.5px;color:#8A7A6B;font-family:Helvetica,Arial,sans-serif;line-height:1.55;border-top:1px solid #E4DBCE;padding-top:12px}
button{font-size:14px;padding:10px 18px;border-radius:7px;border:none;background:#A65A3A;color:#fff;cursor:pointer;margin-bottom:18px}
@media print{button{display:none} body{padding:0}}
</style></head><body>
<button onclick="window.print()">Print / Save as PDF</button>
<h1>Family Assessment — ${escHtml(who)}</h1>
<div class="meta">The Thriving Families &middot; ${escHtml(date)}</div>
${patternHTML}${domainHTML}${summaryHTML}
<div class="note">This report is a starting point for our conversation. It reflects the answers given on the assessment and is not a diagnosis or a label for who you are. It is a coaching and consulting tool, not clinical care.</div>
</body></html>`;
}

async function openDiscussionReport({ who, report }) {
  const c = report.computed || {};
  let gates = c.gate_scores, walls = c.wall_scores;
  if (!gates || !walls) {
    const { data } = await supabase.from("assessment_submission").select("answers").eq("request_id", c.request_id || "00000000-0000-0000-0000-000000000000").maybeSingle();
    const a = data?.answers || {};
    gates = {}; walls = {};
    REPORT_DOMAINS.forEach((d) => { if (a[d.gate]) gates[d.gate] = parseInt(a[d.gate]); if (a[d.wall]) walls[d.wall] = parseInt(a[d.wall]); });
  }
  const html = buildDiscussionReportHTML({ who, date: (report.created_at || "").slice(0, 10), computed: c, gates, walls });
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const w = window.open(url, "_blank");
  if (!w) alert("Your browser blocked the report window. Please allow pop-ups for this site and try again.");
}

// Combine the newest result from each person into one household picture.
const FRAMEWORK_NAMES = {
  identity: "Family Identity Program",
  authority: "Authority Restoration Program",
  parenting: "Stewardship Parenting Program",
  marriage: "Marriage Covenant Program",
};
function PatternsTab({ reports, members = [] }) {
  const [viewId, setViewId] = useState(null);
  if (!reports || reports.length === 0) {
    return (
      <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>
        No assessment results yet. Send a link from the Assessments tab, or run it yourself and use "Save to EHR".
      </div>
    );
  }
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name;

  // newest report per person (reports arrive newest first); practitioner-run ones count as one "session" entry
  const seen = new Set();
  const perPerson = [];
  for (const r of reports) {
    const key = r.computed?.person_id || `run-${r.computed?.client_name || "session"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    perPerson.push({ key, report: r, who: nameOf(r.computed?.person_id) || r.computed?.client_name || "Run in session" });
  }
  const totals = {};
  let counted = 0;
  perPerson.forEach(({ report }) => {
    const fs = report.computed?.framework_scores;
    if (Array.isArray(fs)) { counted++; fs.forEach((f) => { totals[f.key] = (totals[f.key] || 0) + (f.val || 0); }); }
  });
  const combined = Object.entries(totals).map(([key, val]) => ({ key, name: FRAMEWORK_NAMES[key] || key, val })).sort((a, b) => b.val - a.val);
  const topVal = combined[0]?.val || 0;
  const flagged = perPerson.filter(({ report }) => report.computed?.needs_referral_review);

  const shown = perPerson.find((p) => p.report.id === viewId) || perPerson[0];
  const latest = shown.report;
  const c = latest.computed || {};
  const older = reports.filter((r) => r.id !== latest.id && (r.computed?.person_id || null) === (c.person_id || null));

  return (
    <div>
      {flagged.length > 0 && (
        <div style={{ background: C.clayBg, border: `1px solid ${C.clayBorder}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.clay, fontWeight: 700, marginBottom: 8 }}>May need something other than coaching — please review</div>
          {flagged.map(({ key, who, report }) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{who}</div>
              {(report.computed.referral_flags || []).map((f, i) => <div key={i} style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>• {f}</div>)}
            </div>
          ))}
          <div style={{ fontSize: 12, color: C.mutedLight, marginTop: 6 }}>These flags come from a draft screening rule. They prompt a closer look and are not a determination.</div>
        </div>
      )}

      {combined.length > 0 && topVal > 0 && (
        <div style={{ background: "#EEF0FA", border: "1px solid #C7CDEE", borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A5DA6", fontWeight: 700, marginBottom: 6 }}>
            Household-wide suggestion · {counted} {counted === 1 ? "person" : "people"} combined
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500 }}>{combined[0].name}</div>
          {combined[1] && combined[1].val > 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Also consider: {combined[1].name}</div>}
          <div style={{ marginTop: 12 }}>
            {combined.map((f) => (
              <div key={f.key} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}><span>{f.name}</span><span style={{ fontWeight: 600 }}>{f.val}</span></div>
                <div style={{ height: 5, background: "#DDE1F4", borderRadius: 3 }}><div style={{ height: 5, width: `${(f.val / topVal) * 100}%`, background: "#4A5DA6", borderRadius: 3 }} /></div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.mutedLight, marginTop: 8 }}>Draft weighting — a starting point for your judgment, not a prescription.</div>
        </div>
      )}

      {perPerson.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {perPerson.map((p) => (
            <Btn key={p.key} variant={p.key === shown.key ? "dark" : "ghost"} onClick={() => setViewId(p.report.id)}>{p.who}</Btn>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontFamily: SERIF, fontSize: 18 }}>{perPerson.length > 1 ? shown.who : ""}</div>
        <Btn variant="tint" onClick={() => openDiscussionReport({ who: shown.who, report: latest })}>Download discussion report (with graphs)</Btn>
      </div>

      {c.suggested_framework && (
        <div style={{ background: "#EEF0FA", border: "1px solid #C7CDEE", borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A5DA6", fontWeight: 700, marginBottom: 6 }}>Suggested Program</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500 }}>{FRAMEWORK_NAMES[c.suggested_framework.key] || c.suggested_framework.name}</div>
          {c.runner_up_framework && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Also consider: {FRAMEWORK_NAMES[c.runner_up_framework.key] || c.runner_up_framework.name}</div>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: C.mutedLight }}>Assessment saved {latest.created_at?.slice(0, 10)} · version {latest.version_number}</div>
      </div>

      {c.scores && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, marginBottom: 10 }}>Pattern Indicator Scores</div>
          {Object.entries(c.scores).sort((a, b) => b[1] - a[1]).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span>{CREATURE_LABEL[key] || key}</span><span style={{ fontWeight: 600 }}>{val}%</span>
              </div>
              <div style={{ height: 6, background: C.hairline, borderRadius: 3 }}>
                <div style={{ height: 6, width: `${val}%`, background: C.terracotta, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {c.permutation && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, marginBottom: 6 }}>Entry Permutation: {c.permutation.combo}</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.permutation.label}</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{c.permutation.desc}</div>
        </div>
      )}

      {c.generational_break_point && (c.generational_break_point.his || c.generational_break_point.hers) && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, marginBottom: 10 }}>Generational Break Point</div>
          {c.generational_break_point.his && <div style={{ fontSize: 13.5, marginBottom: 8 }}><strong>His lineage:</strong> {c.generational_break_point.his.label}</div>}
          {c.generational_break_point.hers && <div style={{ fontSize: 13.5 }}><strong>Her lineage:</strong> {c.generational_break_point.hers.label}</div>}
        </div>
      )}

      {c.presenting_problems && c.presenting_problems.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>Presenting Problems</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.presenting_problems.map((p) => <Badge key={p} style={{ color: "#4A3C31", background: C.terracottaTintBg, border: "1px solid #EADCC2" }}>{p.replace(/_/g, " ")}</Badge>)}
          </div>
        </div>
      )}

      {older.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, color: C.mutedLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Earlier assessments</div>
          {older.map((r) => (
            <div key={r.id} style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Version {r.version_number} · {r.created_at?.slice(0, 10)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Programs: where you write your own session outlines ----------
function ProgramsScreen({ programs, programSessions, enrollments, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const prog = programs.find((p) => p.id === openId);
  return (
    <div style={{ padding: "34px 40px 60px", maxWidth: 900 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Programs</h1>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 22px", lineHeight: 1.6 }}>Your four programs. Open one to write each session's title, focus and homework. Whatever you write here is what appears in session notes and on clients' homework pages.</p>
      {!prog && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {programs.map((p) => {
            const sess = programSessions.filter((x) => x.program_id === p.id);
            const filled = sess.filter((x) => (x.focus || "").trim() || (x.homework || "").trim()).length;
            const active = enrollments.filter((e) => e.program_id === p.id && e.status === "active").length;
            return (
              <div key={p.id} onClick={() => setOpenId(p.id)} style={{ cursor: "pointer", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 19 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 4 }}>{sess.length} sessions · {filled} outlined · {active} {active === 1 ? "family" : "families"} enrolled</div>
                </div>
                <span style={{ color: C.terracotta, fontWeight: 600, fontSize: 13.5 }}>Edit outline</span>
              </div>
            );
          })}
        </div>
      )}
      {prog && <ProgramEditor key={prog.id} program={prog} sessions={programSessions.filter((x) => x.program_id === prog.id)} onBack={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  );
}

function ProgramEditor({ program, sessions, onBack, onChanged }) {
  const [rows, setRows] = useState(() => sessions.map((x) => ({ ...x })));
  const [desc, setDesc] = useState(program.description || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addRow = () => setRows((r) => [...r, { id: null, program_id: program.id, session_number: r.length + 1, title: `Session ${r.length + 1}`, focus: "", homework: "" }]);
  const removeLast = () => setRows((r) => r.slice(0, -1));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const { error: e1 } = await supabase.from("program").update({ description: desc }).eq("id", program.id);
      if (e1) throw e1;
      const keep = rows.length;
      const { error: e2 } = await supabase.from("program_session").delete().eq("program_id", program.id).gt("session_number", keep);
      if (e2) throw e2;
      const payload = rows.map((x, i) => ({ program_id: program.id, session_number: i + 1, title: x.title || `Session ${i + 1}`, focus: x.focus || null, homework: x.homework || null }));
      const { error: e3 } = await supabase.from("program_session").upsert(payload, { onConflict: "program_id,session_number" });
      if (e3) throw e3;
      await onChanged();
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) { setMsg(e.message || "Couldn't save"); }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: C.mutedLight, marginBottom: 12 }}><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Programs</a> &nbsp;/&nbsp; {program.name}</div>
      <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, margin: "0 0 14px" }}>{program.name}</h2>
      <Field label="What this program is about (optional)">
        <textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      {rows.map((x, i) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mutedLight, fontWeight: 700, marginBottom: 8 }}>Session {i + 1}</div>
          <Field label="Title"><input style={inputStyle} value={x.title || ""} onChange={(e) => set(i, "title", e.target.value)} /></Field>
          <Field label="Focus of the session"><textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} value={x.focus || ""} onChange={(e) => set(i, "focus", e.target.value)} /></Field>
          <Field label="Homework for this session"><textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} value={x.homework || ""} onChange={(e) => set(i, "homework", e.target.value)} /></Field>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn onClick={addRow}>Add a session</Btn>
        {rows.length > 1 && <Btn onClick={removeLast}>Remove last session</Btn>}
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, color: msg === "Saved" ? C.sage : "#9A3B2A" }}>{msg}</span>}
        <Btn variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save program"}</Btn>
      </div>
    </div>
  );
}

// ---------- Family record: Programs tab ----------
const HW_LABEL = { assigned: "Not reviewed yet", done: "Done", partial: "Partly done", not_done: "Not done" };
const HW_TONE = { assigned: "off", done: "done", partial: "wip", not_done: "wip" };

function FamilyProgramsTab({ household, sessions, programs, programSessions, enrollments, homework, onChanged }) {
  const [programId, setProgramId] = useState("");
  const [startOn, setStartOn] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fresh, setFresh] = useState(null);
  const [copied, setCopied] = useState(false);

  const activeIds = enrollments.filter((e) => e.status === "active").map((e) => e.program_id);
  const available = programs.filter((p) => !activeIds.includes(p.id));
  const nameOf = (id) => programs.find((p) => p.id === id)?.name || "Program";

  async function enroll() {
    if (!programId) return;
    setBusy(true); setErr("");
    const { error } = await supabase.from("program_enrollment").insert({ household_id: household.id, program_id: programId, started_on: startOn });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setProgramId("");
    onChanged();
  }
  async function setStatus(id, status) {
    const { error } = await supabase.from("program_enrollment").update({ status }).eq("id", id);
    if (error) setErr(error.message); else onChanged();
  }
  async function makeLink() {
    setBusy(true); setErr(""); setCopied(false);
    const { data, error } = await supabase.rpc("create_homework_link", { p_household: household.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setFresh(`${window.location.origin}/homework.html?t=${data}`);
  }
  async function copy(url) { try { await navigator.clipboard.writeText(url); setCopied(true); } catch (e) { setCopied(false); } }

  return (
    <div>
      {err && <div style={{ color: "#9A3B2A", fontSize: 13.5, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
        {enrollments.length === 0 && <div style={{ padding: "22px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>Not enrolled in a program yet.</div>}
        {enrollments.map((e) => {
          const total = programSessions.filter((x) => x.program_id === e.program_id).length;
          const linked = sessions.filter((s) => s.enrollment_id === e.id && s.program_session_number);
          const reached = linked.reduce((m, s) => Math.max(m, s.program_session_number), 0);
          const hw = homework.filter((h) => h.enrollment_id === e.id);
          const reviewed = hw.filter((h) => h.status !== "assigned");
          const done = reviewed.filter((h) => h.status === "done").length;
          return (
            <div key={e.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 19 }}>{nameOf(e.program_id)}</div>
                  <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 4 }}>Started {e.started_on} · Session {reached} of {total} · Homework done: {done} of {reviewed.length} reviewed</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge style={e.status === "completed" ? TONE.done : e.status === "paused" ? TONE.off : TONE.wip}>{e.status}</Badge>
                  {e.status === "active" && <Btn onClick={() => setStatus(e.id, "completed")}>Mark completed</Btn>}
                  {e.status === "active" && <Btn onClick={() => setStatus(e.id, "paused")}>Pause</Btn>}
                  {e.status !== "active" && <Btn onClick={() => setStatus(e.id, "active")}>Reactivate</Btn>}
                </div>
              </div>
              <div style={{ height: 6, background: C.hairline, borderRadius: 3, marginTop: 12 }}><div style={{ height: 6, width: `${total ? (reached / total) * 100 : 0}%`, background: C.terracotta, borderRadius: 3 }} /></div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div style={{ background: C.panelCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Enroll this family in a program</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto", gap: 10, alignItems: "end" }}>
            <Field label="Program"><select style={inputStyle} value={programId} onChange={(e) => setProgramId(e.target.value)}><option value="">Choose…</option>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Start date"><input type="date" style={inputStyle} value={startOn} onChange={(e) => setStartOn(e.target.value)} /></Field>
            <div style={{ marginBottom: 14 }}><Btn variant="primary" disabled={!programId || busy} onClick={enroll}>Enroll</Btn></div>
          </div>
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Homework link for the family</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>One private link per family. They open it, see their homework, and tick items off with a short note. Making a new link stops the old one.</div>
        {fresh && (
          <div style={{ background: C.sageBg, border: "1px solid #D7E3D1", borderRadius: 9, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>Copy it now and send it. For privacy it is shown only this once.</div>
            <input readOnly value={fresh} onFocus={(e) => e.target.select()} style={{ ...inputStyle, fontSize: 12.5, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 10 }}><Btn variant="primary" onClick={() => copy(fresh)}>{copied ? "Copied ✓" : "Copy link"}</Btn><Btn onClick={() => setFresh(null)}>Done</Btn></div>
          </div>
        )}
        <Btn disabled={busy} onClick={makeLink}>{fresh ? "Make another new link" : "Make homework link"}</Btn>
      </div>

      {homework.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, color: C.mutedLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Homework record</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {homework.map((h) => (
              <div key={h.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{h.description}</div>
                  <Badge style={TONE[HW_TONE[h.status]]}>{HW_LABEL[h.status]}</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 4 }}>{nameOf(enrollments.find((e) => e.id === h.enrollment_id)?.program_id)} · session {h.session_number || "–"} · assigned {h.assigned_on}{h.due_on ? ` · due ${h.due_on}` : ""}</div>
                {h.client_done && <div style={{ fontSize: 12.5, color: C.sage, marginTop: 4 }}>Client says: done{h.client_note ? ` — “${h.client_note}”` : ""}</div>}
                {!h.client_done && h.client_note && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Client note: “{h.client_note}”</div>}
                {h.accountability_note && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>Your note: {h.accountability_note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Session note: program session + homework accountability ----------
function SessionProgramPanel({ sessionRow, programs, programSessions, enrollments, homework, onChanged }) {
  const active = enrollments.filter((e) => e.status === "active");
  const [enrId, setEnrId] = useState(sessionRow.enrollment_id || active[0]?.id || "");
  const [num, setNum] = useState(sessionRow.program_session_number || "");
  const [newHw, setNewHw] = useState("");
  const [dueOn, setDueOn] = useState(() => { const d = new Date(Date.now() + 7 * 86400000); return d.toISOString().slice(0, 10); });
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState("");

  if (enrollments.length === 0) {
    return <div style={{ background: C.panelCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", fontSize: 13.5, color: C.muted, marginBottom: 18 }}>This family isn't enrolled in a program. Enroll them from the family's Programs tab to link this session to a program and track homework.</div>;
  }

  const enr = enrollments.find((e) => e.id === enrId);
  const prog = programs.find((p) => p.id === enr?.program_id);
  const planned = programSessions.find((x) => x.program_id === enr?.program_id && x.session_number === Number(num));
  const toReview = homework.filter((h) => h.enrollment_id === enrId && h.status === "assigned" && h.session_id !== sessionRow.id);
  const thisSession = homework.filter((h) => h.session_id === sessionRow.id);

  async function saveLink() {
    const { error } = await supabase.from("session").update({ enrollment_id: enrId || null, program_session_number: num ? Number(num) : null }).eq("id", sessionRow.id);
    setMsg(error ? error.message : "Linked");
    if (!error) { await onChanged(); setTimeout(() => setMsg(""), 1800); }
  }
  async function review(h, status) {
    const { error } = await supabase.from("homework").update({ status, accountability_note: notes[h.id] || null, reviewed_at: new Date().toISOString() }).eq("id", h.id);
    if (error) setMsg(error.message); else onChanged();
  }
  async function assign() {
    if (!newHw.trim() || !enrId) return;
    const { error } = await supabase.from("homework").insert({
      household_id: sessionRow.household_id, enrollment_id: enrId, session_id: sessionRow.id,
      session_number: num ? Number(num) : null, description: newHw.trim(), due_on: dueOn || null,
    });
    if (error) { setMsg(error.message); return; }
    setNewHw(""); onChanged();
  }
  async function removeHw(id) {
    const { error } = await supabase.from("homework").delete().eq("id", id);
    if (error) setMsg(error.message); else onChanged();
  }

  return (
    <div style={{ background: C.panelCard, border: `1px solid ${C.border}`, borderRadius: 11, padding: "18px 22px", marginBottom: 18 }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, marginBottom: 10 }}>Program &amp; homework</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto", gap: 10, alignItems: "end" }}>
        <Field label="Program"><select style={inputStyle} value={enrId} onChange={(e) => setEnrId(e.target.value)}>{active.map((e) => <option key={e.id} value={e.id}>{programs.find((p) => p.id === e.program_id)?.name}</option>)}{!active.find((e) => e.id === enrId) && enrId && <option value={enrId}>{prog?.name}</option>}</select></Field>
        <Field label="Session number"><input type="number" min="1" style={inputStyle} value={num} onChange={(e) => setNum(e.target.value)} /></Field>
        <div style={{ marginBottom: 14 }}><Btn onClick={saveLink}>Link session</Btn></div>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: msg === "Linked" ? C.sage : "#9A3B2A", marginBottom: 8 }}>{msg}</div>}

      {planned && (planned.title || planned.focus) && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mutedLight, fontWeight: 700, marginBottom: 4 }}>Planned for this session</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{planned.title}</div>
          {planned.focus && <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 4, lineHeight: 1.55 }}>{planned.focus}</div>}
        </div>
      )}

      {toReview.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold, marginBottom: 8 }}>Review last time's homework</div>
          {toReview.map((h) => (
            <div key={h.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{h.description}</div>
              <div style={{ fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>Due {h.due_on || "—"}{h.client_done ? " · Client says done" : ""}{h.client_note ? ` · “${h.client_note}”` : ""}</div>
              <input placeholder="Short note (optional)" style={{ ...inputStyle, margin: "8px 0" }} value={notes[h.id] || ""} onChange={(e) => setNotes({ ...notes, [h.id]: e.target.value })} />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="primary" onClick={() => review(h, "done")}>Done</Btn>
                <Btn onClick={() => review(h, "partial")}>Partly</Btn>
                <Btn onClick={() => review(h, "not_done")}>Not done</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold, marginBottom: 8 }}>Homework to assign from this session</div>
      {thisSession.map((h) => (
        <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 14px", marginBottom: 8, fontSize: 14 }}>
          <span>{h.description}{h.due_on ? <span style={{ color: C.mutedLight }}> · due {h.due_on}</span> : null}</span>
          <button onClick={() => removeHw(h.id)} style={{ background: "none", border: "none", color: "#9A3B2A", cursor: "pointer", fontSize: 12.5 }}>Remove</button>
        </div>
      ))}
      <textarea rows={2} placeholder="What should they do before next time?" style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }} value={newHw} onChange={(e) => setNewHw(e.target.value)} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: C.muted }}>Due <input type="date" style={{ ...inputStyle, width: 160, display: "inline-block", marginLeft: 6 }} value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></label>
        {planned?.homework && <Btn onClick={() => setNewHw(planned.homework)}>Use the program's homework</Btn>}
        <div style={{ flex: 1 }} />
        <Btn variant="primary" disabled={!newHw.trim()} onClick={assign}>Add homework</Btn>
      </div>
    </div>
  );
}

function NoteScreen({ household, households, sessionRow, onBack, onSaveNote, programs, programSessions, enrollments, homework, onProgramsChanged }) {
  const existing = sessionRow?.session_note?.[0];
  const signed = !!existing?.signed_at;
  const [shared, setShared] = useState(existing?.shared || "");
  const [observed, setObserved] = useState(existing?.observed || "");
  const [understanding, setUnderstanding] = useState(existing?.understanding || "");
  const [plan, setPlan] = useState(existing?.plan || "");
  const [scopeCheck, setScopeCheck] = useState(existing?.scope_check || "in_scope");
  const [scopeNote, setScopeNote] = useState(existing?.scope_note || "");
  const [saved, setSaved] = useState(false);

  if (!sessionRow) {
    return (
      <div style={{ padding: "34px 40px" }}>
        <div style={{ fontSize: 13, color: C.mutedLight, marginBottom: 14 }}><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Back</a></div>
        No session selected. Open a session from the schedule or a family record to write a note.
      </div>
    );
  }

  async function handleSave(sign) {
    await onSaveNote({
      session_id: sessionRow.id,
      shared, observed, understanding, plan,
      scope_check: scopeCheck, scope_note: scopeNote,
      signed_at: sign ? new Date().toISOString() : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div style={{ padding: "34px 40px 60px", maxWidth: 760 }}>
      <div style={{ fontSize: 13, color: C.mutedLight, marginBottom: 10 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{household ? household.name : "Today"}</a> &nbsp;/&nbsp; Session note
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Session #{sessionRow.session_number}</h1>
      <p style={{ fontSize: 13.5, color: C.mutedLight, margin: "0 0 22px" }}>{sessionRow.starts_at.slice(0, 10)} · {sessionRow.starts_at.slice(11, 16)} · {sessionRow.duration_min} min</p>

      {signed && (
        <div style={{ background: C.sageBg, border: "1px solid #D7E3D1", borderRadius: 9, padding: "12px 16px", fontSize: 13.5, color: "#3A4A34", marginBottom: 18 }}>
          This note is signed and locked — it can no longer be edited. That's intentional, matching how the record protects finalized notes.
        </div>
      )}

      <SessionProgramPanel sessionRow={sessionRow} programs={programs || []} programSessions={programSessions || []}
        enrollments={enrollments || []} homework={homework || []} onChanged={onProgramsChanged} />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: "22px 24px" }}>
        <Field label="What the family/client shared">
          <textarea rows={3} disabled={signed} style={{ ...inputStyle, resize: "vertical" }} value={shared} onChange={(e) => setShared(e.target.value)} />
        </Field>
        <Field label="What you observed">
          <textarea rows={3} disabled={signed} style={{ ...inputStyle, resize: "vertical" }} value={observed} onChange={(e) => setObserved(e.target.value)} />
        </Field>
        <Field label="Your working understanding">
          <textarea rows={3} disabled={signed} style={{ ...inputStyle, resize: "vertical" }} value={understanding} onChange={(e) => setUnderstanding(e.target.value)} />
        </Field>
        <Field label="Plan going forward">
          <textarea rows={3} disabled={signed} style={{ ...inputStyle, resize: "vertical" }} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <Field label="Scope check">
            <select disabled={signed} style={inputStyle} value={scopeCheck} onChange={(e) => setScopeCheck(e.target.value)}>
              <option value="in_scope">In scope</option><option value="monitor">Monitor</option><option value="refer">Refer</option>
            </select>
          </Field>
          <Field label="Scope note (optional)">
            <input disabled={signed} style={inputStyle} value={scopeNote} onChange={(e) => setScopeNote(e.target.value)} />
          </Field>
        </div>
        {!signed && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            {saved && <span style={{ fontSize: 12.5, color: C.sage, alignSelf: "center" }}>Saved</span>}
            <Btn onClick={() => handleSave(false)}>Save draft</Btn>
            <Btn variant="primary" onClick={() => handleSave(true)}>Save &amp; sign</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- New Family Modal ----------
function NewFamilyModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("family");
  const [members, setMembers] = useState([""]);
  return (
    <Modal title="New record" onClose={onClose} wide>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Smith Family" /></Field>
      <Field label="Type">
        <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="family">Family unit</option><option value="couple">Couple</option><option value="individual">Individual</option>
        </select>
      </Field>
      <Field label="Members">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {members.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input style={inputStyle} placeholder="Full name" value={m} onChange={(e) => { const copy = [...members]; copy[i] = e.target.value; setMembers(copy); }} />
              {members.length > 1 && <button onClick={() => setMembers(members.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedLight }}>✕</button>}
            </div>
          ))}
        </div>
        <Btn onClick={() => setMembers([...members, ""])}>Add member</Btn>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), kind, memberNames: members.map((m) => m.trim()).filter(Boolean) })}>Create record</Btn>
      </div>
    </Modal>
  );
}

// ---------- New Appointment Modal ----------
function NewApptModal({ households, onClose, onCreate }) {
  const [householdId, setHouseholdId] = useState(households[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(50);
  return (
    <Modal title="Add appointment" onClose={onClose}>
      {households.length === 0 ? <div style={{ fontSize: 14, color: C.muted }}>Create a client or family record first.</div> : (
        <>
          <Field label="Family / client">
            <select style={inputStyle} value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
              {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Time"><input type="time" style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Field label="Duration (min)"><input type="number" style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!householdId} onClick={() => onCreate({ householdId, date, time, duration })}>Add</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

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

      setReferralContacts(contacts || []);
      setReferrals(refs || []);
      setInvoices(invs || []);
    } catch (e) {
      setError(e.message || "Couldn't load your records.");
    } finally {
      setLoadingData(false);
    }
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
                onSaveNote={saveNote} />
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
function FamilyRecordScreen({ household, sessions, onBack, onDelete, onStartNote, onOpenNote, onDeleteSession }) {
  const [tab, setTab] = useState("Sessions");
  const tabs = ["Assessments", "Patterns & cycles", "Structure assessment", "Sessions", "Goals", "Documents", "Billing"];
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
          <Btn variant="primary" onClick={onStartNote}>Start session note</Btn>
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
        {tab !== "Sessions" && <div style={{ padding: "28px 18px", textAlign: "center", color: C.mutedLight, fontSize: 14, background: C.card, border: "1px dashed #DFD5C6", borderRadius: 9 }}>{tab} isn't wired up yet.</div>}
        <div style={{ marginTop: 26, textAlign: "right" }}>
          <ConfirmDelete label="Delete this whole record" onConfirm={onDelete} />
        </div>
      </div>
    </div>
  );
}

// ---------- Session Note ----------
function NoteScreen({ household, households, sessionRow, onBack, onSaveNote }) {
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

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, ShieldCheck } from "lucide-react";

type SessionView = { createdAt: string; expiresAt: string; current: boolean };
type SessionResponse = { sessions: SessionView[]; total: number; error?: string };

/** Account/session management, not wallet custody or token approvals. */
export function AccountSecurity({
  authenticated, onRequireLogin, onLoggedOut,
}: {
  authenticated: boolean;
  onRequireLogin: () => void;
  onLoggedOut: () => void;
}) {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sessions", { cache: "no-store" });
      const data = await response.json() as SessionResponse;
      if (!response.ok) throw new Error(data.error ?? "Cannot load active sessions");
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (e) {
      setSessions([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Session lookup failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) void refresh();
    else { setSessions([]); setTotal(0); setConfirm(false); }
  }, [authenticated]);

  async function revokeAll() {
    if (!confirm || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/sessions", { method: "DELETE" });
      const data = await response.json() as { revokedSessions?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not revoke sessions");
      setNotice(`Revoked ${data.revokedSessions ?? 0} active session(s).`);
      setConfirm(false);
      onLoggedOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed");
    } finally { setLoading(false); }
  }

  return <section aria-label="Looke account security" style={{border:"1px solid #ececec",borderRadius:15,padding:22,margin:"20px 0"}}>
    <div style={{display:"flex",alignItems:"center",gap:9}}>
      <ShieldCheck size={21}/><h2 style={{margin:0,fontSize:18}}>Account security</h2>
    </div>
    {!authenticated ? <div style={{marginTop:14}}>
      <p style={{fontSize:13,opacity:.7}}>Sign in with your Ultra EVM testnet wallet to review and revoke browser sessions.</p>
      <button type="button" className="subtle-cta" onClick={onRequireLogin}>Sign in</button>
    </div> : <>
      <p style={{fontSize:13,opacity:.7,margin:"14px 0"}}>Active login sessions: <strong>{loading ? "Checking…" : total}</strong>. Sessions use secure, HttpOnly browser cookies; this page never exposes signing keys.</p>
      <button type="button" className="subtle-cta" onClick={()=>void refresh()} disabled={loading}>Refresh sessions</button>
      {sessions.map((session, index) =>
        <div key={session.createdAt+index} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:"1px solid #eee",gap:14}}>
          <div style={{fontSize:12}}>
            <strong>{session.current ? "This browser" : "Another login session"}</strong>
            <div style={{opacity:.65,marginTop:4}}>Created {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}</div>
          </div>
          {session.current && <CheckCircle2 size={17} aria-label="Current session"/>}
        </div>
      )}
      {total>sessions.length && <p style={{fontSize:12,opacity:.65}}>Showing the latest 30 of {total} sessions.</p>}
      <div style={{marginTop:18}}>
        {!confirm ? <button type="button" className="subtle-cta" disabled={loading} onClick={()=>setConfirm(true)}><LogOut size={16}/> Sign out all sessions</button> :
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10}}>
            <p style={{width:"100%",margin:0,fontSize:12}}>This will immediately sign out this browser and every other active Looke session. It will not disconnect or transfer any wallet assets.</p>
            <button type="button" className="primary-button" disabled={loading} onClick={()=>void revokeAll()}>Confirm sign out everywhere</button>
            <button type="button" className="subtle-cta" disabled={loading} onClick={()=>setConfirm(false)}>Cancel</button>
          </div>}
      </div>
    </>}
    {error && <p role="alert" style={{color:"#b42546",marginTop:13,fontSize:12}}>{error}</p>}
    {notice && <p role="status" style={{marginTop:13,fontSize:12}}>{notice}</p>}
  </section>;
}

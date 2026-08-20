import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { LOCAL_FILE_SELECTED_EVENT } from "@/components/diarize/PlatformDownloadDock";
import { Cpu, Loader2, PlugZap, X } from "lucide-react";
import React, { useEffect, useState } from "react";

const COMPANION_BASE = "http://127.0.0.1:38491";
type CompanionJob = { id: string; stage: string; progress: number; error: string | null; filename: string | null };

async function localNetworkPermission() {
  try {
    const permissions = navigator.permissions as unknown as { query?: (descriptor: { name: string }) => Promise<PermissionStatus> };
    if (!permissions?.query) return "unknown";
    const result = await permissions.query({ name: "local-network" });
    return result?.state ?? "unknown";
  } catch { return "unknown"; }
}

function companionConnectionMessage(problem: unknown) {
  const message = problem instanceof Error ? problem.message : "";
  if (window.location.hostname.endsWith(".manus.computer")) return "The local companion cannot be reached from Manus Preview. Open the published Diarize site in a browser on the same computer where companion is running, then try again.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) return "Cannot reach the local companion. Start it in the repository’s companion folder with npm start, keep that terminal open, then allow local-network access if your browser asks.";
  return message || "Unable to connect to the local companion. Start it and try again.";
}

export function LocalCompanionDock({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [job, setJob] = useState<CompanionJob>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isWorking = Boolean(job && !["ready", "failed"].includes(job.stage));
  const canStart = rightsConfirmed && sourceUrl.trim().startsWith("https://") && !isWorking;

  useEffect(() => {
    if (!job || !isWorking) return;
    const timer = window.setInterval(() => {
      fetch(`${COMPANION_BASE}/v1/jobs/${job.id}`).then(async response => {
        const next = await response.json() as CompanionJob | { error?: string };
        if (!response.ok) throw new Error("error" in next && typeof next.error === "string" ? next.error : "The local companion did not return a job status.");
        setJob(next as CompanionJob);
      }).catch(problem => { setError(problem instanceof Error ? problem.message : "Unable to reach the local companion."); setJob(current => current ? { ...current, stage: "failed", error: "Unable to reach the local companion." } : current); });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isWorking, job?.id]);

  useEffect(() => {
    if (!job || job.stage !== "ready") return;
    fetch(`${COMPANION_BASE}/v1/jobs/${job.id}/audio`).then(async response => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "The companion audio is unavailable." })) as { error?: string };
        throw new Error(payload.error || "The companion audio is unavailable.");
      }
      return response.blob();
    }).then(blob => {
      const file = new File([blob], job.filename || "companion-speech.mp3", { type: "audio/mpeg" });
      window.dispatchEvent(new CustomEvent<File>(LOCAL_FILE_SELECTED_EVENT, { detail: file }));
      setMessage("Local audio is ready and has been selected in Diarize.");
      setJob(current => current ? { ...current, stage: "handed_off" } : current);
    }).catch(problem => setError(problem instanceof Error ? problem.message : "Unable to receive prepared companion audio."));
  }, [job?.id, job?.stage, job?.filename]);

  async function start() {
    setError(""); setMessage("");
    try {
      const permission = await localNetworkPermission();
      if (permission === "denied") throw new Error("Your browser has blocked local-network access for Diarize. Open the site controls next to the address bar, set Local network access to Allow, then reload this page.");
      const status = await fetch(`${COMPANION_BASE}/v1/status`);
      if (!status.ok) throw new Error("The local companion is not ready.");
      const handshakeResponse = await fetch(`${COMPANION_BASE}/v1/handshake`, { method: "POST" });
      const handshake = await handshakeResponse.json() as { nonce?: string; error?: string };
      if (!handshakeResponse.ok || !handshake.nonce) throw new Error(handshake.error || "The local companion handshake failed.");
      const response = await fetch(`${COMPANION_BASE}/v1/jobs`, { method: "POST", headers: { "content-type": "application/json", "x-diarize-companion": "1", "x-diarize-handshake": handshake.nonce }, body: JSON.stringify({ sourceUrl: sourceUrl.trim(), rightsConfirmed }) });
      const created = await response.json() as CompanionJob | { error?: string };
      if (!response.ok) throw new Error("error" in created && typeof created.error === "string" ? created.error : "The local companion rejected this request.");
      setJob(created as CompanionJob);
    } catch (problem) { setError(companionConnectionMessage(problem)); }
  }

  return <div className={embedded ? "" : "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 sm:bottom-6"}>
    {open ? <section aria-label="Use local companion" className="w-[min(92vw,440px)] rounded-2xl border border-[#b49345]/30 bg-[#fffaf0] p-4 shadow-[0_18px_44px_rgba(45,38,18,.18)]">
      <div className="mb-3 flex items-start justify-between gap-3"><div><p className="section-kicker">On this device</p><h2 className="font-display text-lg text-[#17243c]">Use local companion</h2></div><Button type="button" aria-label="Close local companion panel" variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-[#806a3e]"><X /></Button></div>
      <p className="text-xs leading-5 text-[#766241]">The companion uses your device’s network, downloads permitted public media locally, extracts compact audio, then selects it in Diarize. Keep the companion terminal running.</p>
      <div role="note" className="mt-3 rounded-lg border border-[#b49345]/25 bg-[#f8efd9] px-3 py-2 text-[11px] leading-4 text-[#66583f]"><strong>Start it first:</strong> in the repository folder, open a terminal and run <code className="rounded bg-white px-1 py-0.5">cd companion && npm start</code>. Keep that terminal open. Open the published Diarize site in a browser on this same computer—not Manus Preview—and allow local-network access if the browser asks. If status is OK but this panel fails, open the site controls next to the address bar, set <strong>Local network access</strong> to Allow, then reload.</div>
      <Label htmlFor="companion-source-url" className="mt-3 block text-xs text-[#675633]">Public YouTube URL</Label>
      <Input id="companion-source-url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="mt-1.5 h-10 border-[#b49345]/35 bg-white" />
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#66583f]"><Checkbox checked={rightsConfirmed} onCheckedChange={value => setRightsConfirmed(value === true)} /><span>I confirm I have the right to process this media locally.</span></label>
      <Button type="button" onClick={start} disabled={!canStart} className="mt-4 w-full bg-[#17243c] text-[#fffaf0] hover:bg-[#263a5e]">{isWorking ? <Loader2 className="animate-spin" /> : <Cpu />} {isWorking ? "Preparing audio locally" : "Prepare with companion"}</Button>
      {job && <div role="status" className="mt-3 rounded-lg border border-[#b49345]/25 bg-[#f8efd9] px-3 py-2 text-[11px] leading-4 text-[#78613a]"><div className="flex justify-between gap-3"><span>{job.stage.replaceAll("_", " ")}</span><span>{job.progress}%</span></div><Progress value={job.progress} className="mt-2 h-1.5 bg-[#eadfc6] [&>div]:bg-[#b49345]" />{job.error && <p className="mt-2 text-[#a44735]">{job.error}</p>}</div>}
      {message && <p role="status" className="mt-2 text-[11px] leading-4 text-[#61765c]">{message}</p>}
      {error && <p role="alert" className="mt-2 text-[11px] leading-4 text-[#a44735]">{error}</p>}
    </section> : <Button type="button" onClick={() => setOpen(true)} variant="outline" className="rounded-full border-[#b49345]/45 bg-[#fffaf0] px-4 text-[#675633] shadow-lg hover:bg-[#f8efd9]"><PlugZap /> Use local companion</Button>}
  </div>;
}

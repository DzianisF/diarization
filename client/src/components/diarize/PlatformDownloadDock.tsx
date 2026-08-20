import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DownloadProgress, savePlatformDownload, supportsMeasuredBrowserDownload } from "@/lib/browserDownload";
import { CheckCircle2, Download, Film, X } from "lucide-react";
import React, { useRef, useState } from "react";

function downloadHref(url: string): string {
  return `/api/platform-download?${new URLSearchParams({ url, rights: "true" }).toString()}`;
}

export const LOCAL_FILE_SELECTED_EVENT = "diarize:local-file-selected";

export function PlatformDownloadDock({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();
  const [downloadError, setDownloadError] = useState("");
  const [nativeDownloadStarted, setNativeDownloadStarted] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);
  const canDownload = rightsConfirmed && sourceUrl.trim().startsWith("https://");

  function handOffLocalFile(file: File | undefined) {
    if (!file) return;
    window.dispatchEvent(new CustomEvent<File>(LOCAL_FILE_SELECTED_EVENT, { detail: file }));
    setOpen(false);
  }

  async function saveWithMeasuredProgress() {
    setDownloadError(""); setNativeDownloadStarted(false); setDownloadProgress({ phase: "connecting", receivedBytes: 0 });
    try { await savePlatformDownload(downloadHref(sourceUrl.trim()), setDownloadProgress); }
    catch (error) { setDownloadProgress(undefined); setDownloadError(error instanceof Error ? error.message : "The browser could not save this video."); }
  }

  const supportsMeasuredSave = supportsMeasuredBrowserDownload();
  const progressPercent = downloadProgress?.totalBytes ? Math.min(100, Math.round((downloadProgress.receivedBytes / downloadProgress.totalBytes) * 100)) : undefined;

  return (
    <div className={embedded ? "" : "fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"}>
      {open ? (
        <section aria-label="Save platform video" className="w-[min(92vw,420px)] rounded-2xl border border-[#b49345]/30 bg-[#fffaf0] p-4 shadow-[0_18px_44px_rgba(45,38,18,.18)]">
          <div className="mb-3 flex items-start justify-between gap-3"><div><p className="section-kicker">Save to device</p><h2 className="font-display text-lg text-[#17243c]">Stream a public video</h2></div><Button type="button" aria-label="Close save video panel" variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-[#806a3e]"><X /></Button></div>
          <p className="mb-3 text-xs leading-5 text-[#766241]">For supported public YouTube URLs, Diarize streams the lightest available video directly to your browser’s download manager. No complete video file is stored in this app.</p>
          <Label htmlFor="platform-download-url" className="text-xs text-[#675633]">Public video URL</Label>
          <Input id="platform-download-url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="mt-1.5 h-10 border-[#b49345]/35 bg-white" />
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#66583f]"><Checkbox checked={rightsConfirmed} onCheckedChange={value => setRightsConfirmed(value === true)} /><span>I confirm I have the right to save this media. Platform verification may still prevent access.</span></label>
          {canDownload && supportsMeasuredSave ? <Button type="button" onClick={saveWithMeasuredProgress} disabled={Boolean(downloadProgress)} className="mt-4 w-full bg-[#17243c] text-[#fffaf0] hover:bg-[#263a5e]"><Download /> Save video with progress</Button> : canDownload ? <Button asChild className="mt-4 w-full bg-[#17243c] text-[#fffaf0] hover:bg-[#263a5e]"><a href={downloadHref(sourceUrl.trim())} onClick={() => setNativeDownloadStarted(true)}><Download /> Save video to device</a></Button> : <Button disabled className="mt-4 w-full"><Download /> Save video to device</Button>}
          {downloadProgress && <div role="status" className="mt-2 rounded-lg border border-[#b49345]/25 bg-[#f8efd9] px-3 py-2 text-[11px] leading-4 text-[#78613a]"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#61765c]" /><span>{downloadProgress.phase === "connecting" ? "Connected to the download route. Waiting for the source stream." : downloadProgress.phase === "complete" ? "Saved to the selected device location." : `Saving the verified response${progressPercent !== undefined ? ` · ${progressPercent}%` : ""}.`}</span></div>{downloadProgress.phase === "saving" && <Progress value={progressPercent} className="mt-2 h-1.5 bg-[#eadfc6] [&>div]:bg-[#b49345]" />}</div>}
          {nativeDownloadStarted && <div role="status" className="mt-2 flex items-start gap-2 rounded-lg border border-[#b49345]/25 bg-[#f8efd9] px-3 py-2 text-[11px] leading-4 text-[#78613a]"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#61765c]" /><span>This browser uses its native download UI for start, byte progress, cancellation, and errors. No success state is inferred by Diarize.</span></div>}
          {downloadError && <p role="alert" className="mt-2 text-[11px] leading-4 text-[#a44735]">{downloadError}</p>}
          <input ref={localFileRef} aria-label="Choose a saved file for Diarize" type="file" accept="audio/*,video/*" className="sr-only" onChange={event => handOffLocalFile(event.target.files?.[0])} />
          <Button type="button" variant="outline" onClick={() => localFileRef.current?.click()} className="mt-2 w-full border-[#b49345]/35 bg-transparent text-[#675633]">Choose a saved file for Diarize</Button>
          <p className="mt-2 text-[11px] leading-4 text-[#927c4a]">After the download finishes, select Local file in Diarize to transcribe it. If the source blocks this free host, use your permitted local file instead.</p>
        </section>
      ) : <Button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#17243c] px-4 text-[#fffaf0] shadow-lg hover:bg-[#263a5e]"><Film /> Save a video</Button>}
    </div>
  );
}

export { downloadHref };

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { LOCAL_FILE_SELECTED_EVENT } from "@/components/diarize/PlatformDownloadDock";
import { canPrepareMediaInBrowser, formatMediaBytes, isMediaWithinUploadLimit, prepareAudioForUpload } from "@/lib/mediaPreparation";
import { FileAudio, Scissors, X } from "lucide-react";
import React, { useRef, useState } from "react";

export function LocalMediaPreparationDock({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = canPrepareMediaInBrowser();

  function handOff(selected: File) {
    window.dispatchEvent(new CustomEvent<File>(LOCAL_FILE_SELECTED_EVENT, { detail: selected }));
    setOpen(false);
  }

  async function prepare() {
    if (!file) return;
    if (isMediaWithinUploadLimit(file)) return handOff(file);
    setProgress(0); setMessage("Creating a smaller audio copy in this browser. Keep this tab open until it finishes.");
    try {
      const prepared = await prepareAudioForUpload(file, setProgress);
      setMessage(`Audio copy ready: ${formatMediaBytes(prepared.size)}. It is now selected in Diarize.`);
      handOff(prepared);
    } catch (error) {
      setProgress(undefined);
      setMessage(error instanceof Error ? error.message : "Browser preparation could not finish.");
    }
  }

  return <div className={embedded ? "" : "fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6"}>
    {open ? <section aria-label="Prepare long video" className="w-[min(92vw,390px)] rounded-2xl border border-[#b49345]/30 bg-[#fffaf0] p-4 shadow-[0_18px_44px_rgba(45,38,18,.18)]">
      <div className="mb-3 flex items-start justify-between gap-3"><div><p className="section-kicker">Local preparation</p><h2 className="font-display text-lg text-[#17243c]">Prepare a long video</h2></div><Button type="button" aria-label="Close long video panel" variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-[#806a3e]"><X /></Button></div>
      <p className="text-xs leading-5 text-[#766241]">For diarization, video is not needed. On supported browsers, this creates a compact speech-audio copy locally; the original video never leaves your device.</p>
      <Input ref={inputRef} aria-label="Choose a long video to prepare" type="file" accept="audio/*,video/*" onChange={event => { setFile(event.target.files?.[0]); setMessage(""); setProgress(undefined); }} className="mt-3 h-10 border-[#b49345]/35 bg-white" />
      {file && <p className="mt-2 text-xs text-[#675633]">{file.name} · {formatMediaBytes(file.size)} {isMediaWithinUploadLimit(file) ? "— ready for Diarize" : "— needs preparation for the 16 MB limit"}</p>}
      {!supported && <p className="mt-2 rounded-lg bg-[#f8efd9] px-3 py-2 text-[11px] leading-4 text-[#806a3e]">This browser cannot create a local audio copy. You can still choose a file already under 16 MB or prepare/trim the recording locally.</p>}
      {typeof progress === "number" && <div className="mt-3"><Progress value={progress} className="h-1.5 bg-[#eadfc6] [&>div]:bg-[#b49345]" /><p className="mt-1 text-right text-[11px] text-[#806a3e]">{progress}% of the video played locally</p></div>}
      <Button type="button" disabled={!file || (!isMediaWithinUploadLimit(file) && !supported) || typeof progress === "number"} onClick={prepare} className="mt-3 w-full bg-[#17243c] text-[#fffaf0] hover:bg-[#263a5e]"><FileAudio /> {isMediaWithinUploadLimit(file ?? { size: Number.MAX_SAFE_INTEGER } as File) ? "Use in Diarize" : "Create smaller audio copy"}</Button>
      {message && <p role="status" className="mt-2 text-[11px] leading-4 text-[#806a3e]">{message}</p>}
    </section> : <Button type="button" onClick={() => setOpen(true)} variant="outline" className="rounded-full border-[#b49345]/45 bg-[#fffaf0] px-4 text-[#675633] shadow-lg hover:bg-[#f8efd9]"><Scissors /> Prepare long video</Button>}
  </div>;
}

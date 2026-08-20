import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { copyTranscript, downloadTranscript, timestampLabel } from "@/lib/transcript";
import { trpc } from "@/lib/trpc";
import { makeTranscriptText, validateIntake } from "@/lib/workflow";
import { Check, CircleAlert, Copy, Download, FileAudio, Link2, Loader2, Mic2, Play, Sparkles, Upload, UsersRound, Waves } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getSessionId } from "../lib/session";

type SourceType = "upload" | "url";

const stageCopy: Record<string, string> = {
  uploading: "Uploading source",
  preparing_source: "Preparing direct URL",
  getting_platform_media: "Getting YouTube media",
  extracting_audio: "Extracting audio",
  transcribing: "Transcribing with Whisper",
  diarizing: "Separating speakers",
  complete: "Ready",
  failed: "Needs attention",
};

const processingStages = ["uploading", "preparing_source", "getting_platform_media", "extracting_audio", "transcribing", "diarizing"];

export default function Home() {
  const [sessionId] = useState(getSessionId);
  const [sourceType, setSourceType] = useState<SourceType>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [preparedNames, setPreparedNames] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const jobsQuery = trpc.jobs.list.useQuery({ sessionId });
  const jobInput = useMemo(() => ({ id: activeJobId ?? "inactive-job", sessionId }), [activeJobId, sessionId]);
  const jobQuery = trpc.jobs.get.useQuery(jobInput, { enabled: Boolean(activeJobId), refetchInterval: activeJobId ? 1_500 : false });
  const createMutation = trpc.jobs.create.useMutation();
  const advanceMutation = trpc.jobs.advance.useMutation();
  const renameMutation = trpc.jobs.renameSpeaker.useMutation();
  const suggestMutation = trpc.jobs.suggestRoles.useMutation();

  const current = jobQuery.data;
  const job = current?.job;
  const turns = current?.turns ?? [];
  const speakers = current?.speakers ?? [];
  const isRunning = Boolean(job && !["complete", "failed"].includes(job.stage));

  useEffect(() => {
    if (!job || !isRunning || advanceMutation.isPending) return;
    const timeout = window.setTimeout(() => {
      advanceMutation.mutate({ id: job.id, sessionId }, {
        onSuccess: () => { jobQuery.refetch(); jobsQuery.refetch(); },
        onError: error => toast.error(error.message),
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [advanceMutation, isRunning, job?.id, job?.stage, sessionId]);

  useEffect(() => {
    if (!job || job.stage !== "complete" || !speakers.length || speakers.some(speaker => Boolean(speaker.suggestion)) || suggestMutation.isPending) return;
    suggestMutation.mutate({ id: job.id, sessionId }, { onSuccess: () => jobQuery.refetch() });
  }, [job?.id, job?.stage, sessionId, speakers.length, speakers.map(speaker => Boolean(speaker.suggestion)).join(""), suggestMutation]);

  const speakerName = (key: string) => {
    const speaker = speakers.find(item => item.speakerKey === key);
    return speaker?.displayName || speaker?.defaultName || "Speaker";
  };
  const exportText = makeTranscriptText(turns, speakerName, timestampLabel, showTimestamps);

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intakeError = validateIntake({ sourceType, hasFile: Boolean(selectedFile), sourceUrl, rightsConfirmed });
    if (intakeError) return toast.error(intakeError);
    try {
      const created = await createMutation.mutateAsync({
        sessionId,
        sourceType,
        sourceUrl: sourceType === "url" ? sourceUrl.trim() : undefined,
        sourceName: selectedFile?.name,
        preparedNames: preparedNames.split(",").map(name => name.trim()).filter(Boolean),
        rightsConfirmed: true,
      });
      if (!created) throw new Error("Unable to create the job.");
      setActiveJobId(created.job.id);
      if (sourceType === "upload" && selectedFile) {
        const data = new FormData();
        data.append("jobId", created.job.id);
        data.append("sessionId", sessionId);
        data.append("media", selectedFile);
        const response = await fetch("/api/media-upload", { method: "POST", body: data });
        if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "Upload failed." }))).error);
      }
      jobsQuery.refetch();
      toast.success("Media accepted. Processing will begin shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create this job.");
    }
  }

  function saveSpeaker(key: string) {
    if (!activeJobId || !nameDraft.trim()) return;
    renameMutation.mutate({ id: activeJobId, sessionId, speakerKey: key, displayName: nameDraft.trim() }, {
      onSuccess: () => { setEditingKey(null); jobQuery.refetch(); },
      onError: error => toast.error(error.message),
    });
  }

  return (
    <main className="diarize-shell min-h-screen px-4 py-5 sm:px-7 lg:px-9">
      <div className="relative z-10 mx-auto max-w-[1540px]">
        <header className="mb-5 flex items-center justify-between gap-4 border-b border-[#b49345]/25 pb-5">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-full border border-[#b49345]/60 bg-[#fbf5e5]/80"><Waves className="size-5 text-[#b49345]" /></div><div><p className="font-display text-xl font-semibold tracking-[-.05em] text-[#17243c]">Diarize</p><p className="text-[10px] uppercase tracking-[.22em] text-[#a17d35]">Conversation intelligence</p></div></div>
          <p className="hidden items-center gap-2 text-xs text-[#786747] sm:flex"><Sparkles className="size-3.5" /> Private session workspace</p>
        </header>
        <p className="mb-4 rounded-xl border border-[#b49345]/25 bg-[#f8efd9]/75 px-4 py-2.5 text-xs leading-5 text-[#735f35]">YouTube links are supported on a best-effort basis: Diarize attempts to fetch the lightest available public audio stream. If the platform blocks access or a file exceeds the limit, upload the permitted audio/video file instead.</p>

        <div className="grid gap-5 xl:grid-cols-[244px_minmax(0,1fr)_280px]">
          <aside className="order-3 rounded-2xl border border-[#b49345]/20 bg-[#fdf9ee]/70 p-3 xl:order-1">
            <div className="mb-3 flex items-center justify-between px-2 pt-1"><div><p className="section-kicker">Archive</p><h2 className="font-display text-lg text-[#17243c]">This session</h2></div><span className="grid size-6 place-items-center rounded-full bg-[#ede3ca] text-[10px] font-bold text-[#795d22]">{jobsQuery.data?.length ?? 0}</span></div>
            <ScrollArea className="h-[170px] xl:h-[calc(100vh-190px)]"><div className="space-y-1.5 pr-2">{jobsQuery.data?.map(item => <button key={item.id} onClick={() => setActiveJobId(item.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left ${activeJobId === item.id ? "border-[#b49345]/60 bg-[#f5ecd8]" : "border-transparent hover:border-[#b49345]/25 hover:bg-[#fbf5e8]"}`}><div className="mb-1 flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold text-[#26344e]">{item.sourceName || (item.sourceType === "url" ? "Direct media URL" : "Untitled source")}</p><span className={`size-1.5 rounded-full ${item.stage === "complete" ? "bg-[#61765c]" : item.stage === "failed" ? "bg-[#b75740]" : "bg-[#b49345]"}`} /></div><p className="text-[10px] uppercase tracking-[.12em] text-[#987d43]">{stageCopy[item.stage]}</p></button>)}{!jobsQuery.data?.length && <div className="rounded-xl border border-dashed border-[#b49345]/30 px-3 py-7 text-center text-xs leading-relaxed text-[#897959]">Your completed transcripts will appear here for this browser session.</div>}</div></ScrollArea>
          </aside>

          <section className="order-1 min-w-0 xl:order-2">
            {!activeJobId ? <div className="paper-card mx-auto max-w-3xl overflow-hidden"><div className="border-b border-[#b49345]/20 px-6 py-7 sm:px-9"><p className="section-kicker">Start a transcription</p><h1 className="font-display mt-1 text-3xl font-semibold tracking-[-.055em] text-[#17243c] sm:text-4xl">Turn a conversation into a considered record.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#786747]">Upload a recording or provide a direct public file URL. We will extract audio, transcribe the dialogue, and separate the participating voices.</p></div><form onSubmit={submitSource} className="space-y-6 px-6 py-7 sm:px-9"><div className="grid grid-cols-2 rounded-xl border border-[#b49345]/25 p-1"><button type="button" onClick={() => setSourceType("upload")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${sourceType === "upload" ? "bg-[#17243c] text-[#fffaf0]" : "text-[#715e39]"}`}><Upload className="size-4" /> Local file</button><button type="button" onClick={() => setSourceType("url")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${sourceType === "url" ? "bg-[#17243c] text-[#fffaf0]" : "text-[#715e39]"}`}><Link2 className="size-4" /> Direct URL</button></div>{sourceType === "upload" ? <label className="group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b49345]/50 bg-[#fdf8e9]/70 px-5 text-center hover:bg-[#f7eed9]"><input type="file" className="sr-only" accept="audio/*,video/*" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} /><div className="mb-3 grid size-11 place-items-center rounded-full bg-[#eaddbd] text-[#89671e]"><FileAudio className="size-5" /></div><p className="text-sm font-semibold text-[#26344e]">{selectedFile?.name || "Choose an audio or video file"}</p><p className="mt-1 text-xs text-[#907a4e]">MP3, WAV, M4A, MP4, MOV or WebM · up to 16 MB</p></label> : <div className="space-y-2"><Label htmlFor="source-url">Direct public media URL</Label><Input id="source-url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://cdn.example.org/recording.mp3" className="h-12 border-[#b49345]/30 bg-[#fffdf7]" /><p className="text-xs leading-5 text-[#8c7957]">A final audio or video file URL is required. Page URLs from YouTube, social media, and other platforms are intentionally unsupported here.</p></div>}<div className="space-y-2"><Label htmlFor="prepared-names">Optional participant names</Label><Input id="prepared-names" value={preparedNames} onChange={event => setPreparedNames(event.target.value)} placeholder="Alice, Bob" className="h-11 border-[#b49345]/30 bg-[#fffdf7]" /><p className="text-xs leading-5 text-[#8c7957]">Names are applied in the first-detected speaker order after diarization and can still be edited later.</p></div><label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#f5eedc] px-4 py-3 text-xs leading-5 text-[#66583f]"><Checkbox checked={rightsConfirmed} onCheckedChange={value => setRightsConfirmed(value === true)} className="mt-0.5" /><span>I confirm I have the right to process this recording and the URL, if used, points directly to the media file.</span></label><Button type="submit" disabled={createMutation.isPending} className="h-11 w-full bg-[#17243c] text-[#fffaf0] hover:bg-[#263a5e]">{createMutation.isPending ? <Loader2 className="animate-spin" /> : <Play className="size-4" />} Begin analysis</Button></form></div> : <div className="space-y-5"><div className="paper-card p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="section-kicker">{job?.stage === "complete" ? "Completed dialogue" : "Processing record"}</p><h1 className="font-display mt-1 text-2xl font-semibold tracking-[-.045em] text-[#17243c]">{job?.sourceName || (job?.sourceType === "url" ? "Direct media source" : "Untitled conversation")}</h1></div><Button variant="outline" onClick={() => setActiveJobId(null)} className="border-[#b49345]/30 bg-transparent text-[#675633]">New source</Button></div>{job && job.stage !== "complete" && <div className="mt-6"><div className="mb-3 flex items-center justify-between text-xs"><span className="font-medium text-[#5f5036]">{stageCopy[job.stage]}</span><span className="text-[#927c4a]">{job.progress}%</span></div><Progress value={job.progress} className="h-1.5 bg-[#eadfc6] [&>div]:bg-[#b49345]" /><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{processingStages.map((stage, index) => { const done = processingStages.indexOf(job.stage) > index || job.stage === "complete"; return <div key={stage} className={`rounded-lg border px-2.5 py-2 text-[10px] uppercase tracking-[.1em] ${done || job.stage === stage ? "border-[#b49345]/45 bg-[#f7efd9] text-[#7c5c1d]" : "border-[#b49345]/15 text-[#ac9d7e]"}`}>{done && <Check className="mr-1 inline size-3" />}{stage.replace("_", " ")}</div>; })}</div></div>}{job?.stage === "failed" && <div className="mt-5 flex gap-3 rounded-xl border border-[#b75740]/30 bg-[#fff2ed] p-4 text-sm text-[#873c29]"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Processing stopped</p><p className="mt-1 text-xs leading-5">{job.errorMessage}</p></div></div>}</div>{job?.stage === "complete" && <div className="paper-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b49345]/20 px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><Mic2 className="size-4 text-[#a17d35]" /><div><p className="font-display text-lg text-[#17243c]">Transcript</p><p className="text-xs text-[#8e7952]">{turns.length} dialogue turns · {speakers.length} detected voices</p></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full border border-[#b49345]/25 px-3 py-1.5"><Label htmlFor="timestamps" className="text-xs text-[#715f40]">Times</Label><Switch id="timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} /></div><Button size="sm" variant="outline" onClick={async () => { await copyTranscript(exportText); toast.success("Transcript copied."); }} className="border-[#b49345]/30 bg-transparent text-[#675633]"><Copy /> Copy</Button><Button size="sm" onClick={() => downloadTranscript("diarize-transcript.txt", exportText)} className="bg-[#17243c] text-[#fffaf0]"><Download /> TXT</Button></div></div><ScrollArea className="h-[min(55vh,680px)]"><div className="space-y-4 p-5 sm:p-7">{turns.map(turn => <article key={turn.id} className="grid gap-1.5 border-l-2 border-[#d6bb77] pl-4 sm:grid-cols-[140px_1fr] sm:gap-5"><div className="flex items-center gap-2 sm:block"><span className="font-semibold text-[#223450]">{speakerName(turn.speakerKey)}</span>{showTimestamps && <span className="font-mono text-[11px] text-[#a17d35] sm:mt-1 sm:block">{timestampLabel(turn.startMs)}</span>}</div><p className="max-w-3xl text-[15px] leading-7 text-[#3d4350]">{turn.text}</p></article>)}</div></ScrollArea></div>}</div>}</section>

          <aside className="order-2 rounded-2xl border border-[#b49345]/20 bg-[#fdf9ee]/70 p-4 xl:order-3"><div className="mb-4 flex items-center gap-2"><UsersRound className="size-4 text-[#a17d35]" /><div><p className="section-kicker">Participants</p><h2 className="font-display text-lg text-[#17243c]">Voices in focus</h2></div></div>{speakers.length ? <div className="space-y-3">{speakers.map((speaker, index) => <div key={speaker.speakerKey} className="rounded-xl border border-[#b49345]/20 bg-[#fffdf7] p-3"><div className="mb-2 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#e8d8af] text-[10px] font-bold text-[#735415]">{index + 1}</span>{editingKey === speaker.speakerKey ? <Input value={nameDraft} autoFocus onChange={event => setNameDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && saveSpeaker(speaker.speakerKey)} className="h-8 text-xs" /> : <p className="flex-1 text-sm font-semibold text-[#26344e]">{speaker.displayName || speaker.defaultName}</p>}<Button size="sm" variant="ghost" onClick={() => editingKey === speaker.speakerKey ? saveSpeaker(speaker.speakerKey) : (setEditingKey(speaker.speakerKey), setNameDraft(speaker.displayName || speaker.defaultName))} className="h-7 px-2 text-xs text-[#8b6c2c]">{editingKey === speaker.speakerKey ? "Save" : "Rename"}</Button></div>{speaker.suggestion ? <p className="rounded-lg bg-[#f4eddb] px-2.5 py-2 text-xs leading-5 text-[#756342]">Suggested role: {(speaker.suggestion as { suggestedRole?: string }).suggestedRole || "Review manually"}</p> : <p className="text-xs leading-5 text-[#9a8760]">Role suggestions appear after transcript analysis.</p>}</div>)}</div> : <div className="rounded-xl border border-dashed border-[#b49345]/30 px-4 py-8 text-center"><UsersRound className="mx-auto mb-3 size-5 text-[#b49345]" /><p className="text-xs leading-5 text-[#8c7957]">Speaker labels will appear here after diarization.</p></div>}</aside>
        </div>
      </div>
    </main>
  );
}

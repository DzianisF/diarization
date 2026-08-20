import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { copyTranscript, downloadTranscript } from "@/lib/transcript";
import { Copy, Download, FileText } from "lucide-react";
import React from "react";

export function TranscriptControls({
  timestamps,
  onTimestampsChange,
  content,
  srtContent,
  vttContent,
}: {
  timestamps: boolean;
  onTimestampsChange: (checked: boolean) => void;
  content: string;
  srtContent?: string;
  vttContent?: string;
}) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-2 rounded-full border border-[#b49345]/25 px-3 py-1.5">
      <Label htmlFor="timestamps" className="text-xs text-[#715f40]">Times</Label>
      <Switch id="timestamps" checked={timestamps} onCheckedChange={onTimestampsChange} />
    </div>
    <Button size="sm" variant="outline" aria-label="Copy transcript" onClick={() => copyTranscript(content)} className="border-[#b49345]/30 bg-transparent text-[#675633]"><Copy /> Copy</Button>
    <Button size="sm" aria-label="Download transcript as text" onClick={() => downloadTranscript("diarize-transcript.txt", content)} className="bg-[#17243c] text-[#fffaf0]"><Download /> TXT</Button>
    {srtContent && <Button size="sm" variant="outline" aria-label="Download transcript as SRT subtitles" onClick={() => downloadTranscript("diarize-transcript.srt", srtContent)} className="border-[#b49345]/30 bg-transparent text-[#675633]"><FileText /> SRT</Button>}
    {vttContent && <Button size="sm" variant="outline" aria-label="Download transcript as WebVTT subtitles" onClick={() => downloadTranscript("diarize-transcript.vtt", vttContent)} className="border-[#b49345]/30 bg-transparent text-[#675633]"><FileText /> VTT</Button>}
  </div>;
}

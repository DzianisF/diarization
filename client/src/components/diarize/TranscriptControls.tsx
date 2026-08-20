import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { copyTranscript, downloadTranscript } from "@/lib/transcript";
import { Copy, Download } from "lucide-react";
import React from "react";

export function TranscriptControls({
  timestamps,
  onTimestampsChange,
  content,
}: {
  timestamps: boolean;
  onTimestampsChange: (checked: boolean) => void;
  content: string;
}) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-2 rounded-full border border-[#b49345]/25 px-3 py-1.5">
      <Label htmlFor="timestamps" className="text-xs text-[#715f40]">Times</Label>
      <Switch id="timestamps" checked={timestamps} onCheckedChange={onTimestampsChange} />
    </div>
    <Button size="sm" variant="outline" aria-label="Copy transcript" onClick={() => copyTranscript(content)} className="border-[#b49345]/30 bg-transparent text-[#675633]"><Copy /> Copy</Button>
    <Button size="sm" aria-label="Download transcript as text" onClick={() => downloadTranscript("diarize-transcript.txt", content)} className="bg-[#17243c] text-[#fffaf0]"><Download /> TXT</Button>
  </div>;
}

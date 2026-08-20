import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function MediaIntakePanel({ onSubmit }: { onSubmit: (input: { mode: "upload" | "url"; url: string }) => void }) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState(false);
  return <form onSubmit={event => { event.preventDefault(); if (rights) onSubmit({ mode, url }); }}>
    <Button type="button" onClick={() => setMode("upload")}>Local file</Button>
    <Button type="button" onClick={() => setMode("url")}>Direct URL</Button>
    {mode === "url" && <Input aria-label="Direct media URL" value={url} onChange={event => setUrl(event.target.value)} />}
    <label><Checkbox aria-label="Confirm media rights" checked={rights} onCheckedChange={value => setRights(value === true)} /> Confirm rights</label>
    <Button type="submit">Begin analysis</Button>
  </form>;
}

export function ParticipantRenamePanel({ initialName, onSave }: { initialName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return <div><Input aria-label="Participant name" value={name} onChange={event => setName(event.target.value)} /><Button onClick={() => onSave(name)}>Save participant</Button></div>;
}

export function SessionHistoryPanel({ jobs, onOpen }: { jobs: Array<{ id: string; title: string }>; onOpen: (id: string) => void }) {
  return <nav aria-label="Session history">{jobs.map(job => <Button key={job.id} variant="ghost" onClick={() => onOpen(job.id)}>{job.title}</Button>)}</nav>;
}

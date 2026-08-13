import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { Bold, CheckCircle, Clock, Italic, List, Plus, RefreshCw, Sparkles, Trash2, Underline } from "lucide-react";
import { toast } from "sonner";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function NotesPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/notes/:subjectId");
  const subjectId = params?.subjectId ? Number(params.subjectId) : null;
  const noteIdFromUrl = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("noteId")) || null : null;
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(noteIdFromUrl);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef("");
  const lastSavedTitle = useRef("");

  const { data: notes, refetch } = trpc.notes.listBySubject.useQuery({ subjectId: subjectId! }, { enabled: !!subjectId });
  const createNote = trpc.notes.create.useMutation({ onError: e => toast.error(e.message) });
  const updateNote = trpc.notes.update.useMutation({ onError: e => { setStatus("error"); setError(e.message); } });
  const deleteNote = trpc.notes.delete.useMutation({ onSuccess: () => { setSelectedNoteId(null); setTitle(""); setContent(""); refetch(); toast.success("Note deleted."); }, onError: e => toast.error(e.message) });
  const generateNotes = trpc.notes.generateForSubject.useMutation({ onSuccess: data => { toast.success("Study notes are ready."); setSelectedNoteId(data.id); refetch(); navigate(`/notes/${subjectId}?noteId=${data.id}`); }, onError: e => toast.error(e.message) });

  useEffect(() => {
    if (!selectedNoteId || !notes) return;
    const note = notes.find(item => item.id === selectedNoteId);
    if (!note) return;
    setTitle(note.title); setContent(note.content); lastSaved.current = note.content; lastSavedTitle.current = note.title; setStatus("idle");
  }, [notes, selectedNoteId]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => { if (!isAuthenticated) navigate("/login"); else if (!subjectId) navigate("/subjects"); }, [isAuthenticated, navigate, subjectId]);
  if (!isAuthenticated || !subjectId) return null;

  const save = async (nextContent = content) => {
    if (!selectedNoteId || (nextContent === lastSaved.current && title === lastSavedTitle.current)) return;
    setStatus("saving"); setError(null);
    try { await updateNote.mutateAsync({ id: selectedNoteId, content: nextContent, title }); lastSaved.current = nextContent; lastSavedTitle.current = title; setStatus("saved"); setTimeout(() => setStatus("idle"), 1600); } catch { /* mutation handles state */ }
  };

  const onEditorInput = (event: React.FormEvent<HTMLDivElement>) => {
    const next = event.currentTarget.innerHTML;
    setContent(next); setStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(next), 2000);
  };

  const createBlank = async () => {
    const created = await createNote.mutateAsync({ subjectId, title: "Untitled note", content: "<h2>Start here</h2><p>Write what you want to remember.</p>" });
    await refetch(); setSelectedNoteId(created.id); navigate(`/notes/${subjectId}?noteId=${created.id}`);
  };

  const exec = (command: string) => { document.execCommand(command); editorRef.current?.focus(); setContent(editorRef.current?.innerHTML ?? ""); };

  const saveIndicator = status === "saving" ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />Saving...</span> : status === "saved" ? <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle className="size-3" />Saved</span> : status === "error" ? <span className="flex items-center gap-1 text-xs text-destructive"><RefreshCw className="size-3" />{error}</span> : <span className="text-xs text-muted-foreground">Auto-saves as you write</span>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Notes</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Make the important stuff easy to find.</h1></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => generateNotes.mutate({ subjectId, title: "Study Notes" })} disabled={generateNotes.isPending}><Sparkles className="mr-2 size-4" />{generateNotes.isPending ? "Writing your notes..." : "Generate study notes"}</Button><Button onClick={createBlank}><Plus className="mr-2 size-4" />Write your own</Button></div></div>
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="glass"><CardHeader><CardTitle className="text-base">Your notes</CardTitle></CardHeader><CardContent className="space-y-2">{notes?.map(note => <button key={note.id} className={`w-full rounded-xl border p-3 text-left ${selectedNoteId === note.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"}`} onClick={() => { setSelectedNoteId(note.id); navigate(`/notes/${subjectId}?noteId=${note.id}`); }}><p className="truncate text-sm font-medium">{note.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.content.replace(/<[^>]+>/g, " ").slice(0, 90)}</p></button>)}{!notes?.length && <p className="text-sm text-muted-foreground">Nothing here yet. Start with your own note or let StudyOS make one.</p>}</CardContent></Card>
          <Card className="glass-strong"><CardHeader><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><Input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (selectedNoteId) void save(content); }} className="border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0" placeholder="Untitled note" /></div>{selectedNoteId && <div className="flex items-center gap-2">{saveIndicator}<Button variant="ghost" size="icon" onClick={() => deleteNote.mutate({ id: selectedNoteId })} aria-label="Delete note"><Trash2 className="size-4" /></Button></div>}</div></CardHeader><CardContent>
            {selectedNoteId ? <>
              <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-border bg-background/40 p-1"><Button size="icon" variant="ghost" onClick={() => exec("bold")} aria-label="Bold"><Bold className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => exec("italic")} aria-label="Italic"><Italic className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => exec("underline")} aria-label="Underline"><Underline className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => exec("insertUnorderedList")} aria-label="Bulleted list"><List className="size-4" /></Button></div>
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={onEditorInput} dangerouslySetInnerHTML={{ __html: content }} className="min-h-[55vh] rounded-xl border border-border bg-background/40 p-5 leading-7 outline-none focus:ring-2 focus:ring-ring" />
              <div className="mt-3 flex justify-end"><Button variant="outline" onClick={() => void save()} disabled={status === "saving"}>Save now</Button></div>
            </> : <div className="grid min-h-[55vh] place-items-center text-center"><div><Sparkles className="mx-auto size-8 text-primary" /><p className="mt-3 font-medium">Your notes live here.</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Generate notes from your study material, or create a blank note and make it your own.</p></div></div>}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

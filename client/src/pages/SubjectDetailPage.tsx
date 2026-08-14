import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { BookOpen, Download, FileText, Layers, ListChecks, Loader2, Plus, Sparkles, Trash2, Upload, Youtube, Pencil, StickyNote } from "lucide-react";
import { toast } from "sonner";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 90) + ".txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SubjectDetailPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/subjects/:id");
  const subjectId = params?.id ? Number(params.id) : null;
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [playlistVideos, setPlaylistVideos] = useState<Array<{ id: string | null; title: string; url: string; educational?: boolean }>>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string[]>([]);
  const [renameLessonId, setRenameLessonId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [generatingDocId, setGeneratingDocId] = useState<number | null>(null);
  const [showManualTranscript, setShowManualTranscript] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");

  const { data: subjects } = trpc.subjects.list.useQuery();
  const { data: documents, refetch: refetchDocuments } = trpc.documents.listBySubject.useQuery({ subjectId: subjectId! }, { enabled: !!subjectId });
  const { data: lessons, refetch: refetchLessons } = trpc.lessons.listBySubject.useQuery({ subjectId: subjectId! }, { enabled: !!subjectId });

  const subject = subjects?.find(item => item.id === subjectId);

  const uploadDocument = trpc.documents.upload.useMutation({
    onSuccess: () => refetchDocuments(),
    onError: error => toast.error(error.message),
  });
  const uploadYouTube = trpc.documents.uploadYouTube.useMutation({
    onSuccess: data => { refetchDocuments(); toast.success(`Saved “${data.title}”.`); setShowManualTranscript(false); setManualTranscript(""); },
    onError: error => {
      toast.error(error.message);
      // Offer manual paste when auto-fetch is rate-limited / captcha'd.
      if (/transcript|youtube|too many requests|captcha/i.test(error.message)) {
        setShowManualTranscript(true);
      }
    },
  });
  const uploadYouTubeTranscript = trpc.documents.uploadYouTubeTranscript.useMutation({
    onSuccess: data => { refetchDocuments(); toast.success(`Saved “${data.title}” from pasted transcript.`); setShowManualTranscript(false); setManualTranscript(""); },
    onError: error => toast.error(error.message),
  });
  const previewYouTube = trpc.documents.previewYouTube.useQuery({ youtubeUrl }, { enabled: false, retry: false });
  const generateLesson = trpc.documents.generateLesson.useMutation({
    onMutate: vars => setGeneratingDocId(vars.documentId),
    onSettled: () => setGeneratingDocId(null),
    onSuccess: data => { refetchLessons(); navigate(`/lesson/${data.lessonId}`); },
    onError: error => toast.error(error.message),
  });  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => { refetchDocuments(); toast.success("Source removed."); },
    onError: error => toast.error(error.message),
  });
  const deleteLesson = trpc.lessons.delete.useMutation({
    onSuccess: () => { refetchLessons(); toast.success("Lesson removed."); },
    onError: error => toast.error(error.message),
  });
  const updateLesson = trpc.lessons.update.useMutation({
    onSuccess: () => { refetchLessons(); setRenameLessonId(null); toast.success("Lesson renamed."); },
    onError: error => toast.error(error.message),
  });
  const generateNotes = trpc.notes.generateForSubject.useMutation({
    onSuccess: data => { toast.success("Your study notes are ready."); navigate(`/notes/${subjectId}?noteId=${data.id}`); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => { if (!isAuthenticated) navigate("/login"); else if (!subjectId) navigate("/subjects"); }, [isAuthenticated, navigate, subjectId]);
  if (!isAuthenticated || !subjectId) return null;

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const uploadFiles = async () => {
    for (const file of selectedFiles) {
      const lower = file.name.toLowerCase();
      const fileType = lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : lower.endsWith(".pptx") ? "pptx" : null;
      if (!fileType) { toast.error(`${file.name}: PDF, DOCX and PPTX are supported.`); continue; }
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name} is over the 25 MB limit.`); continue; }
      try {
        await uploadDocument.mutateAsync({ subjectId, filename: file.name, fileType, fileBase64: await fileToBase64(file) });
        toast.success(`${file.name} is ready to study.`);
      } catch { /* mutation already surfaced the error */ }
    }
    setSelectedFiles([]);
  };

  const preview = async () => {
    if (!youtubeUrl.trim()) return;
    const result = await previewYouTube.refetch();
    if (!result.data) return;
    if (result.data.kind === "video") {
      const video = result.data.videos[0];
      if (video) await uploadYouTube.mutateAsync({ subjectId, youtubeUrl: video.url });
      return;
    }
    const educational = result.data.videos.filter(video => video.educational);
    setPlaylistVideos(educational);
    setSelectedPlaylist(educational.map(video => video.id ?? ""));
    if (!educational.length) toast.error("I couldn't find study-focused videos in that playlist.");
  };

  const processSelectedPlaylist = async () => {
    const chosen = playlistVideos.filter(video => video.id && selectedPlaylist.includes(video.id));
    for (let i = 0; i < chosen.length; i += 4) {
      await Promise.all(chosen.slice(i, i + 4).map(video => uploadYouTube.mutateAsync({ subjectId, youtubeUrl: video.url })));
    }
    setPlaylistVideos([]);
    setSelectedPlaylist([]);
    setYoutubeUrl("");
    refetchDocuments();
  };

  const startRename = (lesson: { id: number; title: string }) => { setRenameLessonId(lesson.id); setRenameTitle(lesson.title); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Study space</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{subject?.title ?? "Subject"}</h1>
          {subject?.description && <p className="mt-2 max-w-2xl text-muted-foreground">{subject.description}</p>}
        </div>

        <Card className="glass-strong">
          <CardHeader><CardTitle>Add study material</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-5">
              <div className="flex items-center gap-2 font-medium"><Upload className="size-4 text-primary" /> Upload notes</div>
              <p className="mt-1 text-sm text-muted-foreground">PDF, Word or PowerPoint. StudyOS will read the material for you.</p>
              <Input className="mt-4" type="file" multiple accept=".pdf,.docx,.pptx" onChange={e => setSelectedFiles(Array.from(e.target.files ?? []))} />
              {selectedFiles.length > 0 && <Button className="mt-3" onClick={uploadFiles} disabled={uploadDocument.isPending}><Upload className="mr-2 size-4" />{uploadDocument.isPending ? "Reading your files..." : `Add ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`}</Button>}
            </div>
            <div className="rounded-2xl border border-border/70 p-5">
              <div className="flex items-center gap-2 font-medium"><Youtube className="size-4 text-primary" /> Learn from YouTube</div>
              <p className="mt-1 text-sm text-muted-foreground">Use lectures, tutorials and educational playlists. Entertainment videos stay out.</p>
              <div className="mt-4 flex gap-2"><Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="Paste a YouTube video or playlist" /><Button onClick={preview} disabled={!youtubeUrl.trim() || previewYouTube.isFetching || uploadYouTube.isPending}>{previewYouTube.isFetching || uploadYouTube.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}</Button></div>
              {showManualTranscript && (
                <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">YouTube is rate-limiting transcript fetch right now. Paste the transcript below instead — it flows through the same lesson pipeline.</p>
                  <Textarea value={manualTranscript} onChange={e => setManualTranscript(e.target.value)} rows={4} placeholder="Paste the video transcript here..." className="mt-2" />
                  <Button className="mt-2" size="sm" onClick={() => uploadYouTubeTranscript.mutate({ subjectId, transcript: manualTranscript, youtubeUrl: youtubeUrl.trim() || undefined })} disabled={!manualTranscript.trim() || uploadYouTubeTranscript.isPending}>{uploadYouTubeTranscript.isPending ? "Saving..." : "Save transcript"}</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {playlistVideos.length > 0 && (
          <Card className="glass">
            <CardHeader><CardTitle>Pick the lessons you want from this playlist</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {playlistVideos.map(video => (
                <label key={video.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent/50">
                  <input type="checkbox" checked={selectedPlaylist.includes(video.id ?? "")} onChange={e => setSelectedPlaylist(current => e.target.checked ? [...current, video.id ?? ""] : current.filter(id => id !== video.id))} />
                  <span className="min-w-0 flex-1 truncate text-sm">{video.title}</span>
                </label>
              ))}
              <Button onClick={processSelectedPlaylist} disabled={!selectedPlaylist.length || uploadYouTube.isPending}>{uploadYouTube.isPending ? "Saving the selected videos..." : `Add ${selectedPlaylist.length} video${selectedPlaylist.length === 1 ? "" : "s"}`}</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="documents">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="lessons">Lessons</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-5 space-y-3">
            {documents?.length ? documents.map(doc => (
              <Card key={doc.id} className="glass">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{doc.fileType === "youtube" ? <Youtube className="size-5" /> : <FileText className="size-5" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.filename}</p><p className="text-xs text-muted-foreground">{doc.fileType === "youtube" ? "Educational YouTube source" : doc.fileType.toUpperCase()} · Added {new Date(doc.createdAt).toLocaleDateString()}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadText(doc.filename, doc.extractedText ?? "")} disabled={!doc.extractedText}><Download className="mr-2 size-4" />{doc.fileType === "youtube" ? "Download transcript" : "Download study text"}</Button>
                    <Button size="sm" onClick={() => generateLesson.mutate({ documentId: doc.id, subjectId })} disabled={generatingDocId === doc.id}><Sparkles className="mr-2 size-4" />{generatingDocId === doc.id ? "Making this lesson..." : "Make a lesson"}</Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteDocument.mutate({ id: doc.id, subjectId })} aria-label="Delete source"><Trash2 className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )) : <Card className="glass"><CardContent className="p-8 text-center text-muted-foreground">Add a lecture, document or tutorial and this space will become your study shelf.</CardContent></Card>}
          </TabsContent>

          <TabsContent value="lessons" className="mt-5 space-y-3">
            {lessons?.length ? lessons.map(lesson => (
              <Card key={lesson.id} className="glass">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5" /></div>
                  <div className="min-w-0 flex-1"><p className="font-medium">{lesson.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lesson.excerpt}</p></div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => navigate(`/lesson/${lesson.id}`)}>Open</Button><Button size="icon" variant="ghost" onClick={() => startRename(lesson)} aria-label="Rename lesson"><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => deleteLesson.mutate({ id: lesson.id })} aria-label="Delete lesson"><Trash2 className="size-4" /></Button></div>
                </CardContent>
              </Card>
            )) : <Card className="glass"><CardContent className="p-8 text-center text-muted-foreground">No lessons yet. Turn one of your sources into a lesson when you're ready.</CardContent></Card>}
          </TabsContent>

          <TabsContent value="notes" className="mt-5">
            <Card className="glass"><CardContent className="grid gap-4 p-6 sm:grid-cols-2"><Button className="h-auto justify-start p-5" variant="outline" onClick={() => generateNotes.mutate({ subjectId, title: `${subject?.title ?? "Study"} notes` })} disabled={generateNotes.isPending}><Sparkles className="mr-3 size-5 text-primary" /><span className="text-left"><span className="block font-medium">Generate study notes</span><span className="mt-1 block text-xs text-muted-foreground">Turn your sources and lessons into clean revision notes.</span></span></Button><Button className="h-auto justify-start p-5" variant="outline" onClick={() => navigate(`/notes/${subjectId}`)}><StickyNote className="mr-3 size-5 text-primary" /><span className="text-left"><span className="block font-medium">Write your own</span><span className="mt-1 block text-xs text-muted-foreground">Make notes your way and edit them whenever you want.</span></span></Button></CardContent></Card>
          </TabsContent>

          <TabsContent value="flashcards" className="mt-5"><Card className="glass"><CardContent className="p-6"><p className="text-sm text-muted-foreground">Build and review cards from this subject.</p><div className="mt-4 flex gap-2"><Button onClick={() => navigate(`/flashcards/${subjectId}`)}><Layers className="mr-2 size-4" />Open flashcards</Button>{lessons?.[0] && <Button variant="outline" onClick={() => navigate(`/lesson/${lessons[0].id}`)}><ListChecks className="mr-2 size-4" />Generate from a lesson</Button>}</div></CardContent></Card></TabsContent>
        </Tabs>
      </div>

      <Dialog open={renameLessonId !== null} onOpenChange={open => !open && setRenameLessonId(null)}>
        <DialogContent><DialogHeader><DialogTitle>Rename lesson</DialogTitle><DialogDescription>Give it a title you'll recognize later.</DialogDescription></DialogHeader><Input value={renameTitle} onChange={e => setRenameTitle(e.target.value)} autoFocus /><Button disabled={!renameTitle.trim() || updateLesson.isPending} onClick={() => renameLessonId && updateLesson.mutate({ id: renameLessonId, title: renameTitle.trim() })}>Save name</Button></DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

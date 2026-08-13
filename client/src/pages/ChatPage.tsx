import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AIChatBox, type Attachment, type ChatMessage } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquare, Pencil, Pin, Plus, Search, Trash2 } from "lucide-react";

interface BranchTree { id: string; messages: ChatMessage[]; sessionId?: number; parentBranchId?: string; }
type SendResponse = { content?: string; thinking?: string };
const makeId = () => crypto.randomUUID();

function toClientMessage(message: { id: number; role: "user" | "assistant" | "system"; content: string; metadata?: unknown; createdAt?: Date | string }): ChatMessage {
  const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata as { thinking?: unknown; attachments?: Attachment[] } : undefined;
  return { id: String(message.id), role: message.role, content: message.content, thinking: typeof metadata?.thinking === "string" ? metadata.thinking : undefined, attachments: Array.isArray(metadata?.attachments) ? metadata.attachments : undefined, timestamp: message.createdAt ? new Date(message.createdAt).getTime() : undefined };
}

export default function ChatPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/chat/:sessionId?");
  const urlSessionId = params?.sessionId && /^\d+$/.test(params.sessionId) ? Number(params.sessionId) : null;
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const contextSubjectId = Number(search.get("subjectId")) || undefined;
  const contextLessonId = Number(search.get("lessonId")) || undefined;
  const [branches, setBranches] = useState<BranchTree[]>([{ id: "main", messages: [] }]);
  const [activeBranchId, setActiveBranchId] = useState("main");
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const abortRef = useRef(false);

  const createSessionMutation = trpc.ai.createSession.useMutation();
  const sendMessageMutation = trpc.ai.sendMessage.useMutation();
  const updateSessionMutation = trpc.ai.updateSession.useMutation();
  const deleteSessionMutation = trpc.ai.deleteSession.useMutation();
  const listSessionsQuery = trpc.ai.listSessions.useQuery();
  const currentSessionQuery = trpc.ai.getSession.useQuery({ id: urlSessionId ?? 0 }, { enabled: Boolean(urlSessionId), retry: false });
  const utils = trpc.useUtils();

  const activeBranch = useMemo(() => branches.find(b => b.id === activeBranchId) ?? branches[0], [activeBranchId, branches]);
  const sessions = useMemo(() => (listSessionsQuery.data ?? []).filter(session => !searchTerm.trim() || (session.title ?? "Untitled chat").toLowerCase().includes(searchTerm.toLowerCase())), [listSessionsQuery.data, searchTerm]);

  const updateBranchMessages = useCallback((branchId: string, update: (messages: ChatMessage[]) => ChatMessage[]) => setBranches(current => current.map(branch => branch.id === branchId ? { ...branch, messages: update(branch.messages) } : branch)), []);

  useEffect(() => {
    if (!urlSessionId || !currentSessionQuery.data) return;
    const session = currentSessionQuery.data;
    const restored = { id: String(session.id), sessionId: session.id, messages: session.messages.map(toClientMessage) };
    setBranches(current => { const existing = current.find(branch => branch.sessionId === session.id); if (existing && existing.messages.length >= restored.messages.length) return current; return [...current.filter(branch => branch.sessionId !== session.id), restored]; });
    setActiveBranchId(restored.id);
  }, [currentSessionQuery.data, urlSessionId]);

  const requestAssistant = useCallback(async (branchId: string, sessionId: number | undefined, history: ChatMessage[], assistantId: string) => {
    if (!sessionId) return;
    setIsStreaming(true); abortRef.current = false;
    try {
      const response = await sendMessageMutation.mutateAsync({ sessionId, messages: history.filter(message => message.role !== "system").map(message => ({ role: message.role, content: message.content, attachments: message.attachments })) });
      if (abortRef.current) return;
      const result = response as SendResponse;
      updateBranchMessages(branchId, messages => messages.map(message => message.id === assistantId ? { ...message, content: result.content ?? "I hit a snag. Try that again?", thinking: result.thinking } : message));
      await utils.ai.listSessions.invalidate();
    } catch (error) {
      if (!abortRef.current) { toast.error(error instanceof Error ? error.message : "I couldn't answer that right now."); updateBranchMessages(branchId, messages => messages.filter(message => message.id !== assistantId)); }
    } finally { setIsStreaming(false); }
  }, [sendMessageMutation, updateBranchMessages, utils.ai.listSessions]);

  const handleSendMessage = useCallback(async (content: string, attachments: Attachment[] = []) => {
    if (isStreaming || !activeBranch || (!content.trim() && attachments.length === 0)) return;
    let branchId = activeBranchId;
    let sessionId = activeBranch.sessionId;
    if (!sessionId) {
      const created = await createSessionMutation.mutateAsync({ subjectId: contextSubjectId, lessonId: contextLessonId, title: content.trim().slice(0, 60), teachingMode: "teacher" });
      sessionId = created.id; branchId = `branch-${created.id}`;
      setBranches(current => [...current, { id: branchId, messages: [], sessionId }]); setActiveBranchId(branchId); navigate(`/chat/${created.id}`); await utils.ai.listSessions.invalidate();
    }
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: content.trim(), attachments, timestamp: Date.now() };
    const assistantMessage: ChatMessage = { id: makeId(), role: "assistant", content: "", timestamp: Date.now() };
    const baseMessages = branches.find(branch => branch.id === branchId)?.messages ?? activeBranch.messages;
    const history = [...baseMessages, userMessage, assistantMessage];
    setBranches(current => current.map(branch => branch.id === branchId ? { ...branch, sessionId, messages: history } : branch));
    await requestAssistant(branchId, sessionId, history.slice(0, -1), assistantMessage.id);
  }, [activeBranch, activeBranchId, branches, contextLessonId, contextSubjectId, createSessionMutation, isStreaming, navigate, requestAssistant, utils.ai.listSessions]);

  const handleRegenerate = useCallback(async (messageId: string) => {
    if (isStreaming || !activeBranch) return;
    const index = activeBranch.messages.findIndex(message => message.id === messageId);
    const target = activeBranch.messages[index];
    if (!target || target.role !== "assistant") return;
    const assistantMessage: ChatMessage = { ...target, content: "", thinking: undefined, timestamp: Date.now() };
    const nextMessages = [...activeBranch.messages.slice(0, index), assistantMessage];
    updateBranchMessages(activeBranchId, () => nextMessages);
    await requestAssistant(activeBranchId, activeBranch.sessionId, nextMessages.slice(0, -1), assistantMessage.id);
  }, [activeBranch, activeBranchId, isStreaming, requestAssistant, updateBranchMessages]);

  const handleFork = useCallback((messageId: string) => {
    if (!activeBranch) return;
    const index = activeBranch.messages.findIndex(message => message.id === messageId);
    if (index < 0) return;
    const branchId = `branch-${makeId()}`;
    const copied = activeBranch.messages.slice(0, index + 1).map(message => ({ ...message, attachments: message.attachments ? [...message.attachments] : undefined }));
    setBranches(current => [...current, { id: branchId, messages: copied, sessionId: activeBranch.sessionId, parentBranchId: activeBranchId }]);
    setActiveBranchId(branchId);
    toast.success("New study path created.");
  }, [activeBranch, activeBranchId]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isStreaming || !activeBranch || !newContent.trim()) return;
    const index = activeBranch.messages.findIndex(message => message.id === messageId);
    const target = activeBranch.messages[index];
    if (!target || target.role !== "user") return;
    const branchId = `branch-${makeId()}`;
    const edited = { ...target, content: newContent.trim(), timestamp: Date.now() };
    const assistantMessage: ChatMessage = { id: makeId(), role: "assistant", content: "", timestamp: Date.now() };
    const nextMessages = [...activeBranch.messages.slice(0, index), edited, assistantMessage];
    setBranches(current => [...current, { id: branchId, messages: nextMessages, sessionId: activeBranch.sessionId, parentBranchId: activeBranchId }]);
    setActiveBranchId(branchId);
    await requestAssistant(branchId, activeBranch.sessionId, nextMessages.slice(0, -1), assistantMessage.id);
  }, [activeBranch, activeBranchId, isStreaming, requestAssistant]);

  const handleSelectBranch = useCallback((messageId: string, branchIndex: number) => {
    const candidates = branches.filter(branch => branch.messages.some(message => message.id === messageId));
    const selected = candidates[branchIndex];
    if (selected) setActiveBranchId(selected.id);
  }, [branches]);

  const handleNewChat = useCallback(async () => {
    const result = await createSessionMutation.mutateAsync({ subjectId: contextSubjectId, lessonId: contextLessonId, title: "New study chat", teachingMode: "teacher" });
    const branch = { id: `branch-${result.id}`, messages: [], sessionId: result.id };
    setBranches(current => [...current, branch]); setActiveBranchId(branch.id); navigate(`/chat/${result.id}`); await utils.ai.listSessions.invalidate();
  }, [contextLessonId, contextSubjectId, createSessionMutation, navigate, utils.ai.listSessions]);

  const selectSession = (id: number) => { setActiveBranchId(String(id)); navigate(`/chat/${id}`); };
  const togglePin = async (session: { id: number; pinned?: boolean }) => { await updateSessionMutation.mutateAsync({ id: session.id, pinned: !session.pinned }); await utils.ai.listSessions.invalidate(); };
  const removeSession = async (id: number) => { if (!window.confirm("Delete this chat and its messages?")) return; await deleteSessionMutation.mutateAsync({ id }); setBranches(current => current.filter(branch => branch.sessionId !== id)); if (urlSessionId === id) navigate("/chat"); await utils.ai.listSessions.invalidate(); };

  const renameSession = async () => { if (!renameId || !renameValue.trim()) return; await updateSessionMutation.mutateAsync({ id: renameId, title: renameValue.trim() }); setRenameId(null); await utils.ai.listSessions.invalidate(); };

  const visibleMessages = useMemo(() => activeBranch?.messages ?? [], [activeBranch]);
  const loadingSession = Boolean(urlSessionId && currentSessionQuery.isLoading);

  return (
    <DashboardLayout>
      <main className="flex h-[calc(100vh-4rem)] min-h-0 gap-3 p-3 sm:p-5">
        <aside className="hidden w-72 shrink-0 flex-col rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-xl lg:flex">
          <div className="flex items-center justify-between px-2 pb-3"><div><p className="text-sm font-semibold">Your chats</p><p className="text-xs text-muted-foreground">Pick up where you left off.</p></div><Button size="icon" variant="ghost" onClick={handleNewChat} aria-label="New chat"><Plus className="size-4" /></Button></div>
          <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search chats" className="pl-9" /></div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {sessions.map(session => <div key={session.id} className={`group flex items-center gap-1 rounded-xl px-2 py-2 ${urlSessionId === session.id ? "bg-primary/10" : "hover:bg-accent/60"}`}><button onClick={() => selectSession(session.id)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><MessageSquare className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate text-sm">{session.title || "Untitled chat"}</span>{session.pinned && <Pin className="size-3 shrink-0 text-primary" />}</div></button><button className="hidden rounded p-1 hover:bg-accent group-hover:block" onClick={() => togglePin(session)} aria-label="Pin chat"><Pin className="size-3.5" /></button><button className="hidden rounded p-1 hover:bg-accent group-hover:block" onClick={() => { setRenameId(session.id); setRenameValue(session.title || ""); }} aria-label="Rename chat"><Pencil className="size-3.5" /></button><button className="hidden rounded p-1 text-destructive hover:bg-destructive/10 group-hover:block" onClick={() => removeSession(session.id)} aria-label="Delete chat"><Trash2 className="size-3.5" /></button></div>)}
            {!sessions.length && <p className="p-3 text-xs text-muted-foreground">No chats yet. Start with a topic you're working on.</p>}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">AI Tutor</h1><p className="text-xs text-muted-foreground">A tutor that remembers where you are in the lesson.</p></div><div className="flex items-center gap-2"><select className="max-w-[190px] rounded-xl border border-border bg-card px-3 py-2 text-sm lg:hidden" value={urlSessionId ?? ""} onChange={event => { const id = Number(event.target.value); if (id) selectSession(id); }}><option value="">Chats</option>{sessions.map(session => <option key={session.id} value={session.id}>{session.title || "Untitled chat"}</option>)}</select><Button onClick={handleNewChat} className="gap-2"><Plus className="size-4" />New chat</Button></div></div>
          <div className="min-h-0 flex-1">{loadingSession ? <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-card/60 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" />Opening your study chat...</div> : <AIChatBox messages={visibleMessages} isStreaming={isStreaming} onSendMessage={handleSendMessage} onRegenerate={handleRegenerate} onFork={handleFork} onEditMessage={handleEditMessage} onSelectBranch={handleSelectBranch} onStopStreaming={() => { abortRef.current = true; setIsStreaming(false); }} placeholder="Ask about what you're learning..." />}</div>
        </section>
      </main>
      <Dialog open={renameId !== null} onOpenChange={open => !open && setRenameId(null)}><DialogContent><DialogHeader><DialogTitle>Rename chat</DialogTitle></DialogHeader><Input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus /><Button onClick={renameSession}>Save name</Button></DialogContent></Dialog>
    </DashboardLayout>
  );
}

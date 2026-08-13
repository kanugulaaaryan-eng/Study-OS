import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import {
  ArrowDown, BarChart3, BookOpen, Bug, Calendar, ChevronDown, ChevronUp,
  Code2, Copy, Edit2, FileText, GitBranch, HelpCircle, ImageIcon,
  Loader2, Paperclip, RotateCcw, Send, Sparkles, StopCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  /** Temporary client-side payload used to send the file to StudyOS. Never persisted. */
  dataBase64?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  timestamp?: number;
  attachments?: Attachment[];
  branchIndex?: number;
  totalBranches?: number;
}

export interface AIChatBoxProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onStopStreaming?: () => void;
  onEditMessage?: (messageId: string, newContent: string, branchIndex?: number) => void;
  onRegenerate?: (messageId: string) => void;
  onFork?: (messageId: string, branchIndex?: number) => void;
  onSelectBranch?: (messageId: string, branchIndex: number) => void;
  placeholder?: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/", "text/", "application/pdf", "application/json", "application/msword", "application/vnd.openxmlformats-officedocument"];

const prompts = [
  ["Explain", "Explain a concept step by step", HelpCircle],
  ["Write Code", "Help me write clean, working code", Code2],
  ["Analyze", "Analyze this problem and identify key insights", BarChart3],
  ["Plan", "Create a practical plan for this goal", Calendar],
  ["Debug", "Help me debug an issue in my code", Bug],
  ["Learn", "Teach me this topic with examples", BookOpen],
] as const;

const isImage = (attachment: Attachment) => attachment.type.startsWith("image/");

export function AIChatBox({
  messages, isStreaming, onSendMessage, onStopStreaming, onEditMessage,
  onRegenerate, onFork, onSelectBranch, placeholder = "Message AI...",
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoScrollEnabledRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollViewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    autoScrollEnabledRef.current = true;
    setShowScrollBottom(false);
  }, []);

  const updateScrollState = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    autoScrollEnabledRef.current = distance <= 100;
    setShowScrollBottom(distance > 100);
  }, []);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    scrollViewportRef.current = viewport;
    viewport?.addEventListener("scroll", updateScrollState, { passive: true });
    return () => viewport?.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  useEffect(() => {
    if (autoScrollEnabledRef.current) scrollToBottom("auto");
  }, [messages, isStreaming, scrollToBottom]);

  useEffect(() => {
    const copyCode = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".code-copy-btn");
      if (!button) return;
      const code = button.closest("pre")?.querySelector("code")?.textContent ?? "";
      void navigator.clipboard.writeText(code).then(() => {
        setCopiedCodeIndex(button.dataset.codeIndex ?? "copied");
        toast.success("Copied!");
        window.setTimeout(() => setCopiedCodeIndex(null), 1500);
      });
    };
    document.addEventListener("click", copyCode);
    return () => document.removeEventListener("click", copyCode);
  }, []);

  useEffect(() => {
    const addCodeButtons = () => {
      scrollAreaRef.current?.querySelectorAll("pre").forEach((pre, index) => {
        if (pre.querySelector(".code-copy-btn")) return;
        pre.classList.add("group", "relative");
        const button = document.createElement("button");
        button.className = "code-copy-btn absolute right-2 top-2 rounded bg-background/90 p-1.5 opacity-0 shadow transition-opacity group-hover:opacity-100";
        button.dataset.codeIndex = String(index);
        button.type = "button";
        button.setAttribute("aria-label", "Copy code");
        button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        pre.appendChild(button);
      });
    };
    const timer = window.setTimeout(addCodeButtons, 0);
    return () => window.clearTimeout(timer);
  }, [messages, copiedCodeIndex]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const available = MAX_FILES - attachments.length;
    if (available <= 0) { toast.error(`You can attach up to ${MAX_FILES} files.`); return; }
    if (incoming.length > available) toast.error(`You can attach up to ${MAX_FILES} files.`);

    const valid: Attachment[] = [];
    for (const file of incoming.slice(0, available)) {
      if (file.size > MAX_FILE_SIZE) { toast.error(`${file.name} exceeds 10 MB.`); continue; }
      if (!ACCEPTED_TYPES.some((type) => type.endsWith("/") ? file.type.startsWith(type) : file.type === type)) {
        toast.error(`${file.name} is not a supported file type.`);
        continue;
      }

      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const value = typeof reader.result === "string" ? reader.result : "";
          resolve(value.includes(",") ? value.split(",", 2)[1] : value);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => "");

      valid.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataBase64: dataBase64 || undefined,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }
    setAttachments((current) => [...current, ...valid]);
  }, [attachments.length]);

  const removeAttachment = (id: string) => setAttachments((current) => {
    const removed = current.find((file) => file.id === id);
    if (removed?.url) URL.revokeObjectURL(removed.url);
    return current.filter((file) => file.id !== id);
  });

  const send = useCallback(() => {
    const content = input.trim();
    if ((!content && attachments.length === 0) || isStreaming) return;
    onSendMessage(content, attachments);
    setInput("");
    setAttachments([]);
    scrollToBottom();
    textareaRef.current?.focus();
  }, [attachments, input, isStreaming, onSendMessage, scrollToBottom]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editingId) { setEditingId(null); return; }
        if (attachments.length) { attachments.forEach((file) => file.url && URL.revokeObjectURL(file.url)); setAttachments([]); return; }
        if (isStreaming) onStopStreaming?.();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        const last = [...messages].reverse().find((message) => message.role !== "system");
        if (last) void navigator.clipboard.writeText(last.content).then(() => toast.success("Message copied"));
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [attachments, editingId, isStreaming, messages, onStopStreaming]);

  const displayMessages = messages.filter((message) => message.role !== "system");
  return <TooltipProvider><div
    className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground"
    onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }}
  >
    {isDragging && <div className="absolute inset-0 z-30 grid place-items-center bg-background/95 backdrop-blur-sm"><div className="rounded-xl border border-dashed border-foreground/50 px-8 py-6 text-center"><Paperclip className="mx-auto mb-2 size-7" /><p className="font-medium">Drop files to attach</p><p className="text-sm text-muted-foreground">Up to 5 files, 10 MB each</p></div></div>}
    <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
      {displayMessages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-12"><Sparkles className="mb-4 size-10 text-muted-foreground" /><h2 className="text-xl font-semibold">How can I help?</h2><p className="mt-2 text-center text-sm text-muted-foreground">Choose a starting point or write your own prompt.</p><div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">{prompts.map(([title, prompt, Icon]) => <button key={title} type="button" disabled={isStreaming} onClick={() => onSendMessage(prompt)} className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"><Icon className="mb-3 size-5" /><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{prompt}</p></button>)}</div></div> : <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">{displayMessages.map((message) => {
        const editing = editingId === message.id;
        const branch = message.branchIndex ?? 0;
        return <article key={message.id} className={cn("group flex gap-3", message.role === "user" && "justify-end")}>
          <div className={cn("max-w-[90%] rounded-xl px-4 py-3", message.role === "user" ? "bg-foreground text-background" : "bg-muted/50") }>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{message.role === "user" ? "You" : "Assistant"}</span><div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-7" onClick={() => void navigator.clipboard.writeText(message.content).then(() => toast.success("Message copied"))}><Copy className="size-3.5" /></Button></TooltipTrigger><TooltipContent>Copy message</TooltipContent></Tooltip>
              {message.role === "user" && onEditMessage && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingId(message.id); setEditContent(message.content); }}><Edit2 className="size-3.5" /></Button></TooltipTrigger><TooltipContent>Edit message</TooltipContent></Tooltip>}
              {message.role === "assistant" && onRegenerate && <Tooltip><TooltipTrigger asChild><Button disabled={isStreaming} variant="ghost" size="icon" className="size-7" onClick={() => onRegenerate(message.id)}><RotateCcw className={cn("size-3.5", isStreaming && "animate-spin")} /></Button></TooltipTrigger><TooltipContent>Regenerate</TooltipContent></Tooltip>}
              {message.role === "assistant" && onFork && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-7" onClick={() => onFork(message.id, branch)}><GitBranch className="size-3.5" /></Button></TooltipTrigger><TooltipContent>Fork conversation</TooltipContent></Tooltip>}
            </div></div>
            {message.totalBranches && message.totalBranches > 1 && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="mb-3 h-7 text-xs"><GitBranch className="mr-1 size-3" />Branch {branch + 1}/{message.totalBranches}<ChevronDown className="ml-1 size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">{Array.from({ length: message.totalBranches }, (_, index) => <DropdownMenuItem key={index} className={cn(index === branch && "bg-accent")} onClick={() => onSelectBranch?.(message.id, index)}>Branch {index + 1}{index === branch && " (current)"}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
            {message.role === "assistant" && message.thinking && <div className="mb-3 rounded-md border border-border/60 bg-background/40"><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground" onClick={() => setExpandedReasoning((current) => ({ ...current, [message.id]: !current[message.id] }))}>{expandedReasoning[message.id] ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}Reasoning Process</button>{expandedReasoning[message.id] && <div className="border-t border-border/60 p-3"><div className="flex justify-end"><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => void navigator.clipboard.writeText(message.thinking!).then(() => toast.success("Reasoning copied"))}><Copy className="mr-1 size-3" />Copy</Button></div><pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{message.thinking}</pre></div>}</div>}
            {editing ? <><Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} autoFocus className="min-h-24 bg-background text-foreground" /><div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button><Button size="sm" disabled={!editContent.trim()} onClick={() => { onEditMessage?.(message.id, editContent.trim(), branch); setEditingId(null); }}>Save & regenerate</Button></div></> : <><div className="prose prose-sm max-w-none break-words dark:prose-invert"><Streamdown>{message.content}</Streamdown></div>{message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}</>}
          </div>
        </article>;
      })}{isStreaming && <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Thinking…</div>}</div>}
    </ScrollArea>
    {showScrollBottom && <Button type="button" size="icon" className="absolute bottom-24 right-5 z-10 rounded-full shadow-lg" onClick={() => scrollToBottom()}><ArrowDown className="size-4" /></Button>}
    <form className="border-t border-border bg-background p-3" onSubmit={(event) => { event.preventDefault(); send(); }}>
      {attachments.length > 0 && <div className="mb-2 flex flex-wrap gap-2"><AttachmentList attachments={attachments} removable onRemove={removeAttachment} /></div>}
      <div className="flex items-end gap-2"><input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Attach files"><Paperclip className="size-4" /></Button><Textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || !event.shiftKey)) { event.preventDefault(); send(); } }} placeholder={placeholder} className="max-h-36 min-h-10 resize-none" rows={1} />{isStreaming ? <Button type="button" variant="secondary" size="icon" onClick={onStopStreaming} aria-label="Stop streaming"><StopCircle className="size-4" /></Button> : <Button type="submit" size="icon" disabled={!input.trim() && attachments.length === 0} aria-label="Send"><Send className="size-4" /></Button>}</div>
    </form>
  </div></TooltipProvider>;
}

function AttachmentList({ attachments, removable = false, onRemove }: { attachments: Attachment[]; removable?: boolean; onRemove?: (id: string) => void }) {
  return <>{attachments.map((file) => <div key={file.id} className="relative flex max-w-48 items-center gap-2 rounded-md border border-border bg-background/80 p-1.5 text-xs">{isImage(file) && file.url ? <img src={file.url} alt={file.name} className="size-9 rounded object-cover" /> : <FileText className="size-4 shrink-0" />}<span className="truncate">{file.name}</span><span className="text-muted-foreground">{Math.ceil(file.size / 1024)} KB</span>{removable && <Button type="button" variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => onRemove?.(file.id)} aria-label={`Remove ${file.name}`}><X className="size-3" /></Button>}</div>)}</>;
}

import { useState } from "react";
import { useLocation } from "wouter";
import { Brain, MessageCircle, Send, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getStudyOSPhrase } from "@/lib/studyosVoice";

type Message = { role: "user" | "assistant"; content: string };

export default function FloatingAITutor() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const createSession = trpc.ai.createSession.useMutation();
  const sendMessage = trpc.ai.sendMessage.useMutation();

  const ask = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setBusy(true);
    try {
      let id = sessionId;
      if (!id) {
        const created = await createSession.mutateAsync({ teachingMode: "teacher", title: "Quick Tutor" });
        id = created.id;
        setSessionId(id);
      }
      const response = await sendMessage.mutateAsync({
        sessionId: id,
        messages: next.map(message => ({ role: message.role, content: message.content })),
      });
      setMessages(current => [...current, { role: "assistant", content: response.content ?? response.response ?? "Let's try that again together." }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The tutor couldn't answer right now.");
      setMessages(current => current.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="glass-strong mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Brain className="size-4" /></div>
              <div><p className="text-sm font-semibold">StudyOS Tutor</p><p className="text-[11px] text-muted-foreground">{getStudyOSPhrase("start", null)}</p></div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen(false)} aria-label="Close tutor"><X className="size-4" /></Button>
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="rounded-xl bg-muted/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" />{getStudyOSPhrase("welcome", null)}</div>
                <p className="text-xs leading-5 text-muted-foreground">Ask me to explain a concept, quiz you, simplify notes, or help with whatever you're studying.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Explain this simply', 'Quiz me', 'Find my weak spot'].map(prompt => <button key={prompt} onClick={() => void ask(prompt)} className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-[11px] hover:bg-accent">{prompt}</button>)}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-8 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground" : "mr-8 rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm"}>{message.content}</div>
            ))}
            {busy && <div className="mr-8 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{getStudyOSPhrase("start", null)}</div>}
          </div>
          <form onSubmit={e => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 border-t border-border p-3">
            <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="What are we figuring out?" rows={1} className="min-h-10 resize-none" />
            <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Ask StudyOS Tutor"><Send className="size-4" /></Button>
          </form>
          <div className="border-t border-border px-3 py-2 text-center"><button className="text-[11px] font-medium text-primary hover:underline" onClick={() => navigate(sessionId ? `/chat/${sessionId}` : "/chat")}>Open full tutor →</button></div>
        </div>
      )}
      <Button onClick={() => setOpen(value => !value)} size="icon" className="size-14 rounded-full shadow-xl ring-4 ring-background/60" aria-label="Open StudyOS Tutor"><MessageCircle className="size-6" /></Button>
    </div>
  );
}

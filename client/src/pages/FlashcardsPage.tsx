import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, Plus, RotateCcw, Shuffle, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export default function FlashcardsPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/flashcards/:subjectId");
  const subjectId = params?.subjectId ? Number(params.subjectId) : null;
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewingIndex, setReviewingIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [order, setOrder] = useState<number[] | null>(null);

  const { data: flashcards, refetch } = trpc.flashcards.listBySubject.useQuery({ subjectId: subjectId! }, { enabled: !!subjectId });
  const { data: reviewCards } = trpc.flashcards.getForReview.useQuery({ limit: 20 });
  const createFlashcard = trpc.flashcards.create.useMutation({ onSuccess: () => { setFront(""); setBack(""); refetch(); toast.success("Flashcard saved."); }, onError: e => toast.error(e.message) });
  const updateFlashcard = trpc.flashcards.update.useMutation({ onSuccess: () => { setEditingId(null); setFront(""); setBack(""); refetch(); toast.success("Flashcard updated."); }, onError: e => toast.error(e.message) });
  const deleteFlashcard = trpc.flashcards.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Flashcard deleted."); }, onError: e => toast.error(e.message) });
  const recordReview = trpc.flashcards.recordReview.useMutation({ onSuccess: () => { if (orderedCards.length && reviewingIndex < orderedCards.length - 1) { setReviewingIndex(index => index + 1); setIsFlipped(false); } else { toast.success("Nice work. Review session done."); setReviewingIndex(0); setIsFlipped(false); } } });

  // Cards in review order — either the server's default order, or a locally shuffled copy.
  const orderedCards = useMemo(() => {
    if (!reviewCards) return [];
    if (!order) return reviewCards;
    return order.map(i => reviewCards[i]).filter(Boolean);
  }, [reviewCards, order]);

  const shuffle = () => {
    if (!reviewCards?.length) return;
    const indices = reviewCards.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setOrder(indices);
    setReviewingIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => { if (!isAuthenticated) navigate("/login"); }, [isAuthenticated, navigate]);
  useEffect(() => { if (!subjectId) navigate("/subjects"); }, [subjectId, navigate]);
  if (!isAuthenticated || !subjectId) return null;

  const submit = async () => {
    if (!front.trim() || !back.trim()) return toast.error("Give the card both a question and an answer.");
    if (editingId) await updateFlashcard.mutateAsync({ id: editingId, front: front.trim(), back: back.trim() });
    else await createFlashcard.mutateAsync({ subjectId, front: front.trim(), back: back.trim() });
  };

  const startEdit = (card: any) => { setEditingId(card.id); setFront(card.front); setBack(card.back); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (orderedCards.length && reviewingIndex < orderedCards.length) {
    const card = orderedCards[reviewingIndex];
    return <DashboardLayout><div className="mx-auto max-w-3xl space-y-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Review</p><h1 className="text-3xl font-semibold">What do you remember?</h1></div><span className="text-sm text-muted-foreground">{reviewingIndex + 1} / {orderedCards.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((reviewingIndex + 1) / orderedCards.length) * 100}%` }} /></div><div className="[perspective:1200px]"><button type="button" onClick={() => setIsFlipped(value => !value)} className="relative h-80 w-full text-left [transform-style:preserve-3d] transition-transform duration-500" style={{ transform: isFlipped ? "rotateY(180deg)" : undefined }}><div className="absolute inset-0 grid place-items-center rounded-3xl border border-border bg-card p-8 text-center [backface-visibility:hidden]"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Question</p><p className="mt-4 text-2xl font-semibold leading-tight">{card.front}</p><p className="mt-5 text-sm text-muted-foreground">Tap to reveal the answer</p></div></div><div className="absolute inset-0 grid place-items-center rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Answer</p><p className="mt-4 text-xl leading-8">{card.back}</p></div></div></button></div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={reviewingIndex === 0} onClick={() => { setReviewingIndex(i => Math.max(0, i - 1)); setIsFlipped(false); }}><ChevronLeft className="mr-1 size-4" />Previous</Button>
        <Button variant="outline" size="sm" onClick={shuffle}><Shuffle className="mr-1 size-4" />Shuffle</Button>
        <Button variant="outline" size="sm" disabled={reviewingIndex >= orderedCards.length - 1} onClick={() => { setReviewingIndex(i => Math.min(orderedCards.length - 1, i + 1)); setIsFlipped(false); }}>Next<ChevronRight className="ml-1 size-4" /></Button>
      </div>
      {isFlipped && <div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => recordReview.mutate({ flashcardId: card.id, quality: 0 })}><X className="mr-2 size-4" />I didn't know this</Button><Button variant="outline" onClick={() => recordReview.mutate({ flashcardId: card.id, quality: 2 })}>Hard</Button><Button onClick={() => recordReview.mutate({ flashcardId: card.id, quality: 4 })}><Check className="mr-2 size-4" />I knew this</Button></div>}</div></DashboardLayout>;
  }

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Flashcards</p><h1 className="mt-1 text-3xl font-semibold">Turn understanding into recall.</h1></div><Card className="glass-strong"><CardHeader><CardTitle>{editingId ? "Edit flashcard" : "Write a flashcard"}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Input placeholder="Question" value={front} onChange={e => setFront(e.target.value)} /><Input placeholder="Answer" value={back} onChange={e => setBack(e.target.value)} /><div className="md:col-span-2 flex gap-2"><Button onClick={submit} disabled={createFlashcard.isPending || updateFlashcard.isPending}>{createFlashcard.isPending || updateFlashcard.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}{editingId ? "Save changes" : "Add flashcard"}</Button>{editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setFront(""); setBack(""); }}>Cancel</Button>}</div></CardContent></Card><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Your cards</h2>{reviewCards?.length ? <Button onClick={() => { setOrder(null); setReviewingIndex(0); setIsFlipped(false); }}><RotateCcw className="mr-2 size-4" />Start review</Button> : null}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{flashcards?.map(card => <Card key={card.id} className="glass"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Question</p><p className="mt-2 font-medium">{card.front}</p><div className="my-4 h-px bg-border" /><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Answer</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.back}</p><div className="mt-5 flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(card)}>Edit</Button><Button size="icon" variant="ghost" onClick={() => deleteFlashcard.mutate({ id: card.id })} aria-label="Delete flashcard"><Trash2 className="size-4" /></Button></div></CardContent></Card>)}</div></div></DashboardLayout>;
}

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

type FeedbackCategory = "ux" | "ai" | "bug" | "idea" | "other";
import { Download, Heart, Star } from "lucide-react";
import { toast } from "sonner";

export default function BetaFeedbackPage() {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<FeedbackCategory>("ux");
  const [message, setMessage] = useState("");
  const feedback = trpc.beta.feedback.useMutation({
    onSuccess: () => { setMessage(""); toast.success("Thanks. That actually helps us make StudyOS better."); },
    onError: (error) => toast.error(error.message),
  });
  const exportQuery = trpc.beta.exportData.useQuery(undefined, { enabled: false });

  const downloadBackup = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Your StudyOS backup is ready.");
  };

  return <DashboardLayout>
    <div className="mx-auto max-w-3xl space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Public beta</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Help us make StudyOS better.</h1><p className="mt-2 text-muted-foreground">You’re testing something early. Tell us what feels great, what feels weird, and what you wish was here.</p></div>
      <Card className="glass-strong"><CardHeader><CardTitle>How’s it feeling?</CardTitle></CardHeader><CardContent className="space-y-6">
        <div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)} className={`grid size-11 place-items-center rounded-xl border transition ${n <= rating ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Star className={`size-5 ${n <= rating ? "fill-current" : ""}`} /></button>)}</div>
        <div className="grid gap-2 sm:grid-cols-5">{[["ux","UX"],["ai","AI tutor"],["bug","Bug"],["idea","Idea"],["other","Other"]].map(([value,label]) => <button key={value} onClick={() => setCategory(value as FeedbackCategory)} className={`rounded-xl border px-3 py-2 text-sm ${category === value ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{label}</button>)}</div>
        <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What happened? Be brutally honest. The useful stuff is usually in the details." rows={7} />
        <Button className="w-full" disabled={feedback.isPending || message.trim().length < 3} onClick={() => feedback.mutate({ rating, category, message })}><Heart className="mr-2 size-4" />Send feedback</Button>
      </CardContent></Card>
      <Card className="glass"><CardHeader><CardTitle>Keep your study data safe</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Download a portable copy of your StudyOS data before testing or moving devices.</p><Button variant="outline" className="mt-4" onClick={downloadBackup} disabled={exportQuery.isFetching}><Download className="mr-2 size-4" />{exportQuery.isFetching ? "Preparing backup..." : "Download my backup"}</Button></CardContent></Card>
    </div>
  </DashboardLayout>;
}

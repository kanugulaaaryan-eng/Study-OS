import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpen, Brain, FileText, MessageSquare, Plus, Sparkles, Target, Youtube } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useEffect } from "react";

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const { name, setName, isNewUser, isLoading: onboardingLoading } = useOnboarding(user?.id, user?.name);

  const { data: subjects } = trpc.subjects.list.useQuery();
  const { data: sessions } = trpc.studySessions.list.useQuery();
  const firstSubjectId = subjects?.[0]?.id;
  const { data: lessons } = trpc.lessons.listBySubject.useQuery({ subjectId: firstSubjectId! }, { enabled: !!firstSubjectId });
  const { data: recommendations } = trpc.ai.getRecommendations.useQuery({ subjectId: firstSubjectId, limit: 4 });
  const { data: weakTopics } = trpc.ai.getWeakTopics.useQuery({ subjectId: firstSubjectId }, { enabled: !!firstSubjectId });

  useEffect(() => { if (!isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;
  if (onboardingLoading) return <DashboardLayout><div className="grid h-[calc(100vh-4rem)] place-items-center text-sm text-muted-foreground">Getting your study space ready...</div></DashboardLayout>;

  const today = new Date().toDateString();
  const todaySession = sessions?.find(s => new Date(s.scheduledDate).toDateString() === today);
  const activeSubjects = subjects ?? [];



  return (
    <DashboardLayout>
      <Dialog open={isNewUser} onOpenChange={() => {}}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader className="text-center"><div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Brain className="size-6" /></div><DialogTitle className="text-2xl">Welcome to StudyOS.</DialogTitle><DialogDescription>One quick thing before we start: what should I call you?</DialogDescription></DialogHeader>
          <div className="mt-2 space-y-4 py-3"><Input placeholder="Your name" autoFocus autoComplete="given-name" onKeyDown={e => { if (e.key === "Enter" && e.currentTarget.value.trim()) setName(e.currentTarget.value); }} /><Button className="w-full" onClick={() => { const input = document.querySelector('input[placeholder="Your name"]') as HTMLInputElement | null; if (input?.value.trim()) setName(input.value); }}>Let's go <ArrowRight className="ml-2 size-4" /></Button></div>
        </DialogContent>
      </Dialog>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">{name ? `Good to see you, ${name}.` : "What are we learning today?"}</h1><p className="mt-2 text-muted-foreground">{activeSubjects.length ? "Continue where you left off." : "Add a subject to get started."}</p></div><Button onClick={() => navigate("/subjects")}><Plus className="mr-2 size-4" />Add study material</Button></section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
          <Card className="glass-strong overflow-hidden"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Continue learning</p><h2 className="mt-2 text-2xl font-semibold">{activeSubjects[0]?.title || "Your first subject"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{activeSubjects[0] ? activeSubjects[0].description || "Pick up where you left off." : "Upload a PDF, add a subject, or paste a YouTube lesson to get started."}</p></div><BookOpen className="hidden size-8 text-primary/60 sm:block" /></div><div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => activeSubjects[0] ? navigate(`/subjects/${activeSubjects[0].id}`) : navigate("/subjects")}>{activeSubjects[0] ? "Continue" : "Create a subject"}<ArrowRight className="ml-2 size-4" /></Button><Button variant="outline" onClick={() => navigate("/chat")}><MessageSquare className="mr-2 size-4" />Ask the tutor</Button></div></CardContent></Card>
          <Card className="card-hover-lift"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="size-4 text-primary" />Today's focus</CardTitle></CardHeader><CardContent>{todaySession ? <><p className="text-sm font-medium">{todaySession.title}</p><p className="mt-1 text-xs text-muted-foreground">{todaySession.durationMinutes} minute session</p><Button size="sm" className="mt-4" onClick={() => navigate("/revision")}>Open session</Button></> : <><p className="text-sm text-muted-foreground">No session planned yet.</p><Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/revision")}>Plan one</Button></>}</CardContent></Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="card-hover-lift"><CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-auto justify-start py-3" onClick={() => navigate("/subjects")}><FileText className="mr-2 size-4" />Upload notes</Button><Button variant="outline" className="h-auto justify-start py-3" onClick={() => navigate("/subjects")}><Youtube className="mr-2 size-4" />Study a video</Button><Button variant="outline" className="h-auto justify-start py-3" onClick={() => navigate("/chat")}><MessageSquare className="mr-2 size-4" />Ask tutor</Button><Button variant="outline" className="h-auto justify-start py-3" onClick={() => navigate("/revision")}><Sparkles className="mr-2 size-4" />Plan revision</Button></CardContent></Card>
          <Card className="card-hover-lift"><CardHeader><CardTitle className="text-base">AI recommendations</CardTitle></CardHeader><CardContent className="space-y-2">{recommendations?.length ? recommendations.slice(0,3).map((r:any) => <button key={`${r.type}-${r.title}`} onClick={() => r.action?.path ? navigate(r.action.path) : navigate("/chat")} className="w-full rounded-xl border border-border p-3 text-left hover:bg-accent"><p className="text-sm font-medium">{r.title}</p><p className="mt-1 text-xs text-muted-foreground">{r.description}</p></button>) : <p className="text-sm text-muted-foreground">Keep studying and I'll start spotting what to do next.</p>}</CardContent></Card>
          <Card className="card-hover-lift"><CardHeader><CardTitle className="text-base">Weak topics</CardTitle></CardHeader><CardContent>{weakTopics?.length ? <div className="space-y-2">{weakTopics.slice(0,4).map(topic => <button key={topic} onClick={() => navigate("/chat")} className="w-full rounded-xl border border-border p-3 text-left hover:bg-accent"><p className="text-sm font-medium">{topic}</p><p className="mt-1 text-xs text-muted-foreground">Let's make this one less confusing.</p></button>)}</div> : <p className="text-sm text-muted-foreground">No weak spots yet. Keep going and I'll help you find them.</p>}</CardContent></Card>
        </section>

        {activeSubjects.length > 0 && <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Your subjects</p><h2 className="mt-1 text-xl font-semibold">Pick up where you left off</h2></div><Button variant="ghost" onClick={() => navigate("/subjects")}>View all <ArrowRight className="ml-1 size-4" /></Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{activeSubjects.slice(0,4).map(subject => <button key={subject.id} onClick={() => navigate(`/subjects/${subject.id}`)} className="glass card-hover-lift rounded-2xl border p-4 text-left"><div className="mb-4 grid size-9 place-items-center rounded-xl bg-primary/10 font-semibold text-primary">{subject.title.charAt(0)}</div><p className="truncate text-sm font-semibold">{subject.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{subject.description || "Keep learning."}</p></button>)}</div></section>}

        {lessons?.length ? <section><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Recent lessons</p><h2 className="mt-1 text-xl font-semibold">One more thing you understand</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lessons.slice(0,3).map(lesson => <button key={lesson.id} onClick={() => navigate(`/lesson/${lesson.id}`)} className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40"><p className="text-sm font-semibold">{lesson.title}</p><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lesson.excerpt || "Continue the lesson."}</p></button>)}</div></section> : null}
      </motion.div>
    </DashboardLayout>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, BookOpen, Brain, FileText, MessageCircle, PlayCircle, Sparkles, Target, Youtube } from "lucide-react";
import { motion } from "framer-motion";
import { getStudyOSPhrase } from "@/lib/studyosVoice";
import { useEffect } from "react";

const features = [
  { icon: FileText, title: "Drop in your material", text: "PDFs, notes and study files become something you can actually learn from." },
  { icon: Youtube, title: "Paste a YouTube link", text: "StudyOS pulls the transcript, understands the lesson and helps you choose what to do next." },
  { icon: Brain, title: "Make it make sense", text: "Get simple explanations, examples, analogies and exam-ready breakdowns." },
  { icon: Target, title: "Practice what matters", text: "Turn the same material into quizzes, flashcards and focused revision." },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => { if (isAuthenticated) navigate("/dashboard"); }, [isAuthenticated, navigate]);

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><div className="text-center"><div className="mx-auto mb-4 size-8 animate-pulse rounded-full bg-primary/20" /><p className="text-sm text-muted-foreground">Getting your study space ready...</p></div></div>;

  return (
    <main className="bg-background min-h-screen overflow-hidden">
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/75 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Brain className="size-5" /></div><span className="font-bold tracking-tight">StudyOS</span></div>
          <Button variant="outline" onClick={() => navigate("/login")}>Get started <ArrowRight className="ml-2 size-4" /></Button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:pt-28">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"><Sparkles className="size-3.5 text-primary" />Your second brain for learning</div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-7xl">Stop rereading.<br /><span className="text-primary">Start understanding.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">StudyOS turns your notes, documents and videos into lessons you can actually understand, then helps you practice what matters.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" onClick={() => navigate("/login")}>Let's make this make sense <ArrowRight className="ml-2 size-4" /></Button><Button size="lg" variant="outline" onClick={() => navigate("/login")}><PlayCircle className="mr-2 size-4" />See how it works</Button></div>
          <p className="mt-5 text-sm text-muted-foreground">{getStudyOSPhrase("start", null)}</p>
        </div>

        <div className="relative">
          <div className="glass-strong relative rounded-3xl border p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Today's focus</p><h2 className="mt-1 text-xl font-semibold">Linear Algebra</h2></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">68% understood</span></div>
            <div className="rounded-2xl bg-muted/60 p-4"><div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageCircle className="size-4" /></div><div><p className="text-sm font-semibold">StudyOS Tutor</p><p className="mt-1 text-sm leading-6 text-muted-foreground">"Eigenvectors look intimidating. They're really just directions that stay the same after a transformation. Let's see it with a simple example."</p></div></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-border bg-background/60 p-3"><BookOpen className="mb-2 size-4 text-primary" /><p className="text-sm font-medium">Lesson</p><p className="text-xs text-muted-foreground">Keep learning</p></div><div className="rounded-xl border border-border bg-background/60 p-3"><Target className="mb-2 size-4 text-primary" /><p className="text-sm font-medium">Quick quiz</p><p className="text-xs text-muted-foreground">See what stuck</p></div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/30 px-5 py-20 backdrop-blur-sm"><div className="mx-auto max-w-6xl"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">One resource. One study package.</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Upload once. Study from every angle.</h2><p className="mt-4 text-muted-foreground">StudyOS keeps your material connected so you don't have to keep doing the same work.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }, index) => <motion.div key={title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} className="glass rounded-2xl border p-5"><div className="mb-5 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></motion.div>)}</div></div></section>

      <section className="mx-auto max-w-4xl px-5 py-24 text-center"><p className="text-3xl font-semibold tracking-tight sm:text-4xl">"I don't need another app to study.<br /><span className="text-primary">I need someone to finally explain it."</span></p><p className="mx-auto mt-5 max-w-xl text-muted-foreground">That's what StudyOS is for.</p><Button size="lg" className="mt-8" onClick={() => navigate("/login")}>Start your study space <ArrowRight className="ml-2 size-4" /></Button></section>
      <footer className="border-t border-border/60 px-5 py-8 text-center text-xs text-muted-foreground">StudyOS · Built to help you understand, not just memorize.</footer>
    </main>
  );
}

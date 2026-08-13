import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowRight, Flag, BookOpen, Brain, Zap, CircleCheck, Clock3 } from "lucide-react";
import { toast } from "sonner";

const STUDY_TAGS = [
  { value: "in-progress", label: "In progress", icon: Clock3 },
  { value: "high-priority", label: "High priority", icon: Flag },
  { value: "exam-soon", label: "Exam soon", icon: BookOpen },
  { value: "needs-practice", label: "Needs practice", icon: Brain },
  { value: "quick-review", label: "Quick review", icon: Zap },
  { value: "strong", label: "Feeling strong", icon: CircleCheck },
] as const;

function getTag(value?: string) {
  return STUDY_TAGS.find((tag) => tag.value === value) ?? STUDY_TAGS[0];
}

export default function SubjectsPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTag, setSelectedTag] = useState("in-progress");

  const { data: subjects, refetch } = trpc.subjects.list.useQuery();

  const createSubject = trpc.subjects.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setSelectedTag("in-progress");
      toast.success("Subject created. Let's make some progress.");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSubject = trpc.subjects.delete.useMutation({
    onSuccess: () => { toast.success("Subject removed."); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { if (!isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Give the subject a name first.");
      return;
    }
    await createSubject.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      // Kept in the existing backend field for backwards compatibility.
      color: selectedTag,
    });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-7">
        <header>
          <p className="text-sm font-medium text-primary">Your study shelf</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">What are we learning?</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Keep subjects simple. The tags tell you what needs attention next.</p>
        </header>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Start a subject</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Subject title</label>
                <Input placeholder="e.g. Machine Learning" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">What is this for?</label>
                <Input placeholder="e.g. 5th semester exam" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Study tag</label>
              <div className="grid grid-cols-2 gap-2">
                {STUDY_TAGS.map((tag) => {
                  const Icon = tag.icon;
                  const active = selectedTag === tag.value;
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => setSelectedTag(tag.value)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/40 text-muted-foreground hover:bg-accent"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tag.label}
                    </button>
                  );
                })}
              </div>
              <Button className="mt-4 w-full" onClick={handleCreate} disabled={createSubject.isPending || !title.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                {createSubject.isPending ? "Creating..." : "Create subject"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">Your subjects</h2>
              <p className="text-sm text-muted-foreground">Pick one and keep moving.</p>
            </div>
            <span className="text-sm text-muted-foreground">{subjects?.length ?? 0} subjects</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects?.map((subject) => {
              const tag = getTag(subject.color);
              const TagIcon = tag.icon;
              return (
                <Card key={subject.id} className="glass-panel group transition hover:-translate-y-0.5 hover:shadow-xl">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="line-clamp-2">{subject.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{subject.description || "Start with a source or a note."}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <TagIcon className="h-3.5 w-3.5" />
                        {tag.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button className="flex-1" onClick={() => navigate(`/subjects/${subject.id}`)}>
                      Open subject <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => deleteSubject.mutate({ id: subject.id })} aria-label={`Delete ${subject.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {(!subjects || subjects.length === 0) && (
              <Card className="glass-panel col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <BookOpen className="mb-3 h-9 w-9 text-muted-foreground" />
                  <h3 className="font-semibold">Your shelf is empty.</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first subject and let's get to work.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

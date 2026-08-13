import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Lightbulb, Zap, Sparkles, Layers, ListChecks, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LessonPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/lesson/:id");
  const lessonId = params?.id ? parseInt(params.id) : null;
  const [activeTab, setActiveTab] = useState("beginner");

  const { data: lesson, isLoading } = trpc.lessons.get.useQuery(
    { id: lessonId! },
    { enabled: !!lessonId }
  );

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  if (!lessonId) {
    navigate("/dashboard");
    return null;
  }

  const generateQuiz = trpc.quiz.generateFromLesson.useMutation({
    onSuccess: () => {
      toast.success("Quiz generated!");
      navigate(`/quiz/${lessonId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generateFlashcards = trpc.flashcards.generateFromLesson.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} flashcards created!`);
      navigate(`/flashcards/${getSubjectId()}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getSubjectId = () => {
    return lesson?.subjectId ?? 0;
  };

  const utils = trpc.useUtils();
  const deleteLesson = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Lesson deleted.");
      void utils.lessons.listBySubject.invalidate();
      navigate(getSubjectId() ? `/subjects/${getSubjectId()}` : "/dashboard");
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingScreen fullHeight />
      </DashboardLayout>
    );
  }

  if (!lesson) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={BookOpen}
          title="Lesson not found"
          description="This lesson may have been deleted or moved"
          action={{ label: "Back to Dashboard", onClick: () => navigate("/dashboard") }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{lesson.title}</h1>
            <p className="text-muted-foreground">{lesson.excerpt}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateQuiz.mutate({ lessonId })}
              disabled={generateQuiz.isPending}
              className="gap-2"
            >
              <ListChecks className="w-4 h-4" />
              {generateQuiz.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Putting together a quiz...
                </>
              ) : (
                "Generate Quiz"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => generateFlashcards.mutate({ lessonId, subjectId: getSubjectId() })}
              disabled={generateFlashcards.isPending}
              className="gap-2"
            >
              <Layers className="w-4 h-4" />
              {generateFlashcards.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Making flashcards...
                </>
              ) : (
                "Generate Flashcards"
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Delete lesson">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the lesson itself. Its source material stays in your subject, so you can regenerate it later if you want to.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteLesson.mutate({ id: lessonId })}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="beginner" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-card">
            <TabsTrigger value="beginner" className="text-foreground/80">
              <Lightbulb className="w-4 h-4 mr-2" />
              Beginner
            </TabsTrigger>
            <TabsTrigger value="college" className="text-foreground/80">
              <BookOpen className="w-4 h-4 mr-2" />
              College
            </TabsTrigger>
            <TabsTrigger value="analogies" className="text-foreground/80">
              <Zap className="w-4 h-4 mr-2" />
              Analogies
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-foreground/80">
              Terms
            </TabsTrigger>
            <TabsTrigger value="examples" className="text-foreground/80">
              Examples
            </TabsTrigger>
            <TabsTrigger value="misconceptions" className="text-foreground/80">
              Misconceptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="beginner" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Beginner Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/80 whitespace-pre-wrap">{lesson.beginnerExplanation}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="college" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">College-Level Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/80 whitespace-pre-wrap">{lesson.collegeExplanation}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analogies" className="space-y-4">
            {lesson.analogies && lesson.analogies.length > 0 ? (
              lesson.analogies.map((analogy: any, idx: number) => (
                <Card key={idx} className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">{analogy.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/80">{analogy.body}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No analogies available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="terms" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Key Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {lesson.keyTerms && lesson.keyTerms.length > 0 ? (
                    lesson.keyTerms.map((term: string, idx: number) => (
                      <div key={idx} className="bg-muted rounded p-2">
                        <p className="text-foreground/80 text-sm">{term}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No key terms available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Takeaways</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lesson.takeaways && lesson.takeaways.length > 0 ? (
                    lesson.takeaways.map((takeaway: string, idx: number) => (
                      <li key={idx} className="text-foreground/80 flex gap-2">
                        <span className="text-primary">•</span>
                        {takeaway}
                      </li>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No takeaways available</p>
                  )}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examples" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Real-World Examples</CardTitle>
              </CardHeader>
              <CardContent>
                {lesson.examples && lesson.examples.length > 0 ? (
                  <ul className="space-y-3">
                    {lesson.examples.map((example: string, idx: number) => (
                      <li key={idx} className="text-foreground/80 flex gap-3">
                        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No examples available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="misconceptions" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Common Misconceptions</CardTitle>
              </CardHeader>
              <CardContent>
                {lesson.misconceptions && lesson.misconceptions.length > 0 ? (
                  <ul className="space-y-3">
                    {lesson.misconceptions.map((misconception: string, idx: number) => (
                      <li key={idx} className="text-foreground/80 flex gap-3">
                        <span className="w-5 h-5 text-red-400 flex-shrink-0 mt-1">⚠</span>
                        <span>{misconception}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No misconceptions recorded</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-card border-border">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Try it yourself</p>
              <p className="mt-1 text-sm text-muted-foreground">Test what stuck with a quiz, or ask the tutor about anything that's still fuzzy.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/chat")} className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Ask the tutor
              </Button>
              <Button onClick={() => navigate(`/quiz/${lessonId}`)}>Take quiz</Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Back to dashboard
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

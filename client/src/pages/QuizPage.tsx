import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";

export default function QuizPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/quiz/:id");
  const lessonId = params?.id ? parseInt(params.id) : null;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const { data: questions, isLoading } = trpc.quiz.listByLesson.useQuery(
    { lessonId: lessonId! },
    { enabled: !!lessonId }
  );
  const recordAttempt = trpc.quiz.recordAttempt.useMutation();
  const getProgressStats = trpc.progress.getStats.useQuery();
  const updateStats = trpc.progress.updateStats.useMutation();

  useEffect(() => { if (!isAuthenticated) navigate("/"); else if (!lessonId) navigate("/dashboard"); }, [isAuthenticated, lessonId, navigate]);
  if (!isAuthenticated || !lessonId) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingScreen fullHeight />
      </DashboardLayout>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={CheckCircle}
          title="No quiz questions available"
          description="Generate a quiz for this lesson first"
          action={{ label: "Back to Dashboard", onClick: () => navigate("/dashboard") }}
        />
      </DashboardLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const handleSelectAnswer = (optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: optionIndex,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const isCorrect = selectedAnswers[i] === questions[i].correctAnswerIndex;
      if (isCorrect) correctCount++;
      await recordAttempt.mutateAsync({
        lessonId,
        questionId: questions[i].id,
        selectedAnswerIndex: selectedAnswers[i] || -1,
        isCorrect,
      });
    }

    // Update progress stats
    const currentStats = getProgressStats.data;
    if (currentStats) {
      const newTotalQuizzes = (currentStats.totalQuizzesTaken || 0) + 1;
      const currentAvg = Number(currentStats.averageQuizScore || 0);
      const newTotalScore = (currentAvg * (currentStats.totalQuizzesTaken || 0)) + Math.round((correctCount / questions.length) * 100);
      const newAverageScore = Math.round(newTotalScore / newTotalQuizzes);

      await updateStats.mutateAsync({
        totalQuizzesTaken: newTotalQuizzes,
        averageQuizScore: newAverageScore,
      });
    }

    toast.success(`Quiz completed! Score: ${correctCount}/${questions.length}`);
    setShowResults(true);
  };

  if (showResults) {
    const correctCount = Object.entries(selectedAnswers).filter(
      ([idx, answer]) => answer === questions[parseInt(idx)].correctAnswerIndex
    ).length;

    return (
      <DashboardLayout>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-center">Quiz Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">
                {Math.round((correctCount / questions.length) * 100)}%
              </div>
              <p className="text-foreground/80 text-lg">
                {correctCount} out of {questions.length} correct
              </p>
            </div>

            <div className="space-y-3">
              {questions.map((q: typeof questions[0], idx: number) => {
                const isCorrect = selectedAnswers[idx] === q.correctAnswerIndex;
                return (
                  <div key={idx} className="bg-muted rounded p-4">
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                      )}
                      <div className="flex-1">
                        <p className="text-foreground font-medium">{q.question}</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          Your answer: {q.options[selectedAnswers[idx]] || "Not answered"}
                        </p>
                        {!isCorrect && (
                          <p className="text-green-400 text-sm">
                            Correct answer: {q.options[q.correctAnswerIndex]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1">
                Back to Dashboard
              </Button>
              <Button
                onClick={() => {
                  setCurrentQuestionIndex(0);
                  setSelectedAnswers({});
                  setShowResults(false);
                }}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Retake Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">Quiz</h1>
            <span className="text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion.options.map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(idx)}
                className={`w-full p-4 text-left rounded-lg border-2 transition ${
                  selectedAnswers[currentQuestionIndex] === idx
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted hover:border-border"
                }`}
              >
                <p className="text-foreground">{option}</p>
              </button>
            ))}

            {currentQuestion.explanation && selectedAnswers[currentQuestionIndex] !== undefined && (
              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                <p className="text-blue-300 text-sm">{currentQuestion.explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            variant="outline"
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>
          <Button onClick={handleNext} className="flex-1 bg-primary hover:bg-primary/90">
            {currentQuestionIndex === questions.length - 1 ? "Review Answers" : "Next"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

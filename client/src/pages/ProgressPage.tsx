import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Target, BookOpen, Brain } from "lucide-react";
import { LoadingScreen, CardGridSkeleton } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";

export default function ProgressPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats } = trpc.progress.getStats.useQuery();
  const { data: history } = trpc.progress.getHistory.useQuery({ days: 30 });

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  if (history === undefined || stats === undefined) {
    return (
      <DashboardLayout>
        <LoadingScreen fullHeight />
      </DashboardLayout>
    );
  }

  const chartData = history?.map((day) => ({
    date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    lessons: day.lessonsCompleted,
    quizzes: day.quizzesTaken,
    flashcards: day.flashcardsReviewed,
    minutes: day.studyMinutes,
    score: day.averageQuizScore ? Math.round(parseFloat(day.averageQuizScore.toString())) : 0,
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Total Study Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalStudyMinutes || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">minutes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border-blue-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalLessonsCompleted || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">completed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/20 to-green-900/10 border-green-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <Brain className="w-4 h-4 text-green-500" />
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats?.totalQuizzesTaken || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">taken</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-900/20 to-pink-900/10 border-pink-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <Target className="w-4 h-4 text-pink-500" />
                Avg Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats?.averageQuizScore ? Math.round(parseFloat(stats.averageQuizScore.toString())) : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">quiz average</p>
            </CardContent>
          </Card>
        </div>

        {/* Study Time Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Daily Study Time (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ fill: "#a78bfa" }}
                  name="Minutes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Learning Activity (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend />
                <Bar dataKey="lessons" fill="#a78bfa" name="Lessons" />
                <Bar dataKey="quizzes" fill="#60a5fa" name="Quizzes" />
                <Bar dataKey="flashcards" fill="#34d399" name="Flashcards" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quiz Score Trend */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Quiz Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: "#f97316" }}
                  name="Avg Score (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Your Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="text-foreground font-medium">Current Streak</p>
                <p className="text-muted-foreground text-sm">{stats?.currentStreak || 0} days of consistent learning</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <div>
                <p className="text-foreground font-medium">Longest Streak</p>
                <p className="text-muted-foreground text-sm">{stats?.longestStreak || 0} days (keep it up!)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
              <div>
                <p className="text-foreground font-medium">Daily Goal Progress</p>
                <p className="text-muted-foreground text-sm">
                  {stats?.todayStudyMinutes || 0} of {stats?.dailyGoalMinutes || 60} minutes today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

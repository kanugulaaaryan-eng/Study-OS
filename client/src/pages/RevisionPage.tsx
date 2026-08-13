import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen, CardGridSkeleton } from "@/components/LoadingScreen";

export default function RevisionPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [subjectId, setSubjectId] = useState("1");
  const [isCreating, setIsCreating] = useState(false);

  const { data: sessions, refetch, isLoading } = trpc.studySessions.list.useQuery();
  const { data: subjects } = trpc.subjects.list.useQuery();

  useEffect(() => { if (!isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;
  const createSession = trpc.studySessions.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setScheduledDate("");
      setDurationMinutes("30");
      toast.success("Study session scheduled!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatus = trpc.studySessions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Session updated!");
      refetch();
    },
  });

  const handleCreate = async () => {
    if (!title.trim() || !scheduledDate) {
      toast.error("Please fill in title and date");
      return;
    }
    setIsCreating(true);
    await createSession.mutateAsync({
      subjectId: parseInt(subjectId),
      title,
      scheduledDate: new Date(scheduledDate),
      durationMinutes: parseInt(durationMinutes),
      description,
    });
    setIsCreating(false);
  };

  const upcomingSessions = sessions?.filter(s => new Date(s.scheduledDate) > new Date()) || [];
  const completedSessions = sessions?.filter(s => s.status === "completed") || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingScreen fullHeight />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Create Session */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Study Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Title</label>
                <Input
                  placeholder="e.g., Biology Chapter 5 Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground"
                >
                  {subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Duration (minutes)</label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="bg-muted border-border text-foreground"
                  min="5"
                  max="480"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Description (optional)</label>
              <Input
                placeholder="Add notes about what to study..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !title.trim() || !scheduledDate}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Sessions */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Upcoming Sessions</h2>
          <div className="space-y-3">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session) => (
                <Card key={session.id} className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-foreground font-semibold">{session.title}</h3>
                        <p className="text-muted-foreground text-sm">
                          {new Date(session.scheduledDate).toLocaleString()}
                        </p>
                        <p className="text-muted-foreground text-sm">{session.durationMinutes} minutes</p>
                        {session.description && (
                          <p className="text-muted-foreground text-sm mt-2">{session.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatus.mutate({
                              id: session.id,
                              status: "in_progress",
                            })
                          }
                        >
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatus.mutate({
                              id: session.id,
                              status: "completed",
                            })
                          }
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={Calendar}
                title="No upcoming sessions"
                description="Schedule a study session above to get started"
              />
            )}
          </div>
        </div>

        {/* Completed Sessions */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Completed Sessions</h2>
          <div className="space-y-3">
            {completedSessions.length > 0 ? (
              completedSessions.slice(0, 5).map((session) => (
                <Card key={session.id} className="bg-card border-border opacity-75">
                  <CardContent className="pt-6">
                    <div>
                      <h3 className="text-foreground font-semibold">{session.title}</h3>
                      <p className="text-muted-foreground text-sm">
                        Completed: {session.completedAt ? new Date(session.completedAt).toLocaleString() : "N/A"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={Calendar}
                title="No completed sessions yet"
                description="Complete a session to see it here"
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

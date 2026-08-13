import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SubjectsPage from "@/pages/SubjectsPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
import LessonPage from "@/pages/LessonPage";
import QuizPage from "@/pages/QuizPage";
import FlashcardsPage from "@/pages/FlashcardsPage";
import NotesPage from "@/pages/NotesPage";
import RevisionPage from "@/pages/RevisionPage";
import ProgressPage from "@/pages/ProgressPage";
import ChatPage from "@/pages/ChatPage";
import LoginPage from "@/pages/LoginPage";
import BetaFeedbackPage from "@/pages/BetaFeedbackPage";
import SettingsPage from "@/pages/SettingsPage";
import { AnimatePresence } from "framer-motion";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

function Router() {
  const [location] = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Switch key={location}>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={LoginPage} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/subjects"} component={SubjectsPage} />
        <Route path={"/subjects/:id"} component={SubjectDetailPage} />
        <Route path={"/lesson/:id"} component={LessonPage} />
        <Route path={"/quiz/:id"} component={QuizPage} />
        <Route path={"/flashcards/:subjectId"} component={FlashcardsPage} />
        <Route path={"/notes/:subjectId"} component={NotesPage} />
        <Route path={"/revision"} component={RevisionPage} />
        <Route path={"/progress"} component={ProgressPage} />
        <Route path={"/chat"} component={ChatPage} />
        <Route path={"/chat/:sessionId"} component={ChatPage} />
        <Route path={"/beta-feedback"} component={BetaFeedbackPage} />
        <Route path={"/settings"} component={SettingsPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function GlobalShortcuts() {
  const [, navigate] = useLocation();
  useGlobalShortcuts({
    onOpenChat: () => navigate("/chat"),
  });
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultThemeName="glassmorph-light" switchable>
        <TooltipProvider>
          <Toaster />
          <GlobalShortcuts />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

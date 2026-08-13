import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chrome, Loader2, ArrowRight, Eye, EyeOff, Mail, Lock, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, signup, isAuthenticated } = useAuth({ redirectOnUnauthenticated: false });
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password, rememberMe);
      toast.success(mode === "signup" ? "You're in. Let's make this make sense." : "Welcome back. Let's get one thing done.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't sign you in right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-background grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Mail className="size-6" /></div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">StudyOS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{mode === "signup" ? "Build your own study space." : "Welcome back."}</h1>
          <p className="mt-2 text-sm text-muted-foreground">One account. Your subjects, lessons, notes and tutor all in one place.</p>
        </div>

        <Card className="glass-strong shadow-xl">
          <CardHeader>
            <CardTitle>{mode === "signup" ? "Create your account" : "Sign in"}</CardTitle>
            <CardDescription>{mode === "signup" ? "We'll use your name to make StudyOS feel personal." : "Pick up where you left off."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="name">Your name</label>
                  <div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="name" value={name} onChange={e => setName(e.target.value)} className="pl-9" placeholder="Your name" autoComplete="name" required /></div>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="email">Email</label>
                <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="Email address" autoComplete="email" required /></div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="password">Password</label>
                <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10" placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              </div>
              {mode === "login" && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  Remember me on this device
                </label>
              )}
              <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <>Continue <ArrowRight className="ml-2 size-4" /></>}</Button>
            </form>

            <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">OR</span><div className="h-px flex-1 bg-border" /></div>
            <Button type="button" onClick={() => { window.location.href = "/api/auth/google"; }} disabled={busy} variant="outline" className="w-full gap-2"><Chrome className="size-4" />Continue with Google</Button>
            <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground">
              {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

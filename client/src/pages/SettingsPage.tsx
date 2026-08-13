import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme, type ThemeName } from "@/contexts/ThemeContext";
import { Check, Download } from "lucide-react";
import { CSSProperties } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * A miniature, non-interactive dashboard mockup rendered with a given theme's
 * own CSS variables scoped to this element only (not the whole document), so
 * every theme can be previewed side by side without switching the live app.
 */
function ThemePreviewCard({
  name,
  label,
  vars,
  mode,
  active,
  onSelect,
}: {
  name: ThemeName;
  label: string;
  vars: Record<string, string>;
  mode: "light" | "dark";
  active: boolean;
  onSelect: () => void;
}) {
  const style = vars as unknown as CSSProperties;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all ${
        active ? "border-primary shadow-lg" : "border-border/60 hover:border-border"
      }`}
      style={{ background: vars["--background"] as string }}
    >
      {active && (
        <div className="absolute right-3 top-3 z-10 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" />
        </div>
      )}
      <div style={style} className="rounded-xl border p-3" data-preview-scope>
        <div
          className="rounded-lg border p-3"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--card-foreground)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold" style={{ color: "var(--foreground)" }}>
              Good to see you
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              12 days
            </span>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-md p-1.5"
                style={{ background: "var(--muted)" }}
              >
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: "var(--primary)" }} />
              </div>
            ))}
          </div>
          <div
            className="rounded-md p-1.5"
            style={{ background: "var(--primary-soft)" }}
          >
            <div className="h-1 w-3/4 rounded-full" style={{ background: "var(--primary)" }} />
            <div className="mt-1 h-1 w-1/2 rounded-full opacity-60" style={{ background: "var(--primary)" }} />
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between px-0.5">
        <span className="text-sm font-medium" style={{ color: vars["--foreground"] as string }}>
          {label}
        </span>
        <span
          className="size-2.5 rounded-full"
          style={{ background: vars["--primary"] as string }}
        />
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { themes, themeName, setThemeName } = useTheme();
  const exportQuery = trpc.beta.exportData.useQuery(undefined, { enabled: false });

  const downloadBackup = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return toast.error("Couldn't export your data right now.");
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Your data export is downloading.");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Settings</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Appearance & account</h1>
        </div>

        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-medium">{user?.name || "Your study name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Pick the vibe that matches your style. You can change it anytime.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {themes.map((t) => (
                <ThemePreviewCard
                  key={t.name}
                  name={t.name}
                  label={t.label}
                  vars={t.cssVars}
                  mode={t.isDark ? "dark" : "light"}
                  active={themeName === t.name}
                  onSelect={() => setThemeName(t.name)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Your data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Download everything StudyOS has stored for your account — subjects, lessons, notes, flashcards and progress.</p>
            <Button variant="outline" onClick={downloadBackup} disabled={exportQuery.isFetching}>
              <Download className="mr-2 size-4" />
              {exportQuery.isFetching ? "Preparing export..." : "Export my data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

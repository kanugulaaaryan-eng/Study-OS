import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <Card className="w-full max-w-2xl border-border bg-card shadow-lg">
            <CardContent className="pt-8 pb-8 text-center">
              <AlertTriangle
                size={48}
                className="text-destructive mb-6 flex-shrink-0"
              />

              <h2 className="text-xl font-semibold text-foreground mb-4">
                Something went wrong
              </h2>

              <p className="text-muted-foreground mb-6">
                An unexpected error occurred. Our team has been notified.
              </p>

              <details className="text-left mb-6 p-4 rounded bg-muted overflow-auto">
                <summary className="text-sm font-medium text-muted-foreground cursor-pointer mb-2">
                  Error details (click to expand)
                </summary>
                <pre className="text-xs text-muted-foreground whitespace-break-spaces max-h-60 overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    "bg-primary text-primary-foreground",
                    "hover:opacity-90"
                  )}
                >
                  <RotateCcw size={16} />
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = "/"}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    "border-border text-foreground hover:bg-accent"
                  )}
                >
                  <Home size={16} />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

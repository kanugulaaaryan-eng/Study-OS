import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  label?: string;
  className?: string;
  /** Fill the parent's available height (use inside a page body). */
  fullHeight?: boolean;
}

/**
 * Full-section loading indicator for async page/data loads.
 * Announces itself to screen readers via aria-live and keeps the
 * spin/fade subtle (150-300ms) per animation conventions.
 */
export function LoadingScreen({ label = "Loading…", className, fullHeight = true }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullHeight && "min-h-[50vh]",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
      </motion.div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="text-sm"
      >
        {label}
      </motion.span>
    </div>
  );
}

/**
 * Skeleton-based loading placeholder for card grids (dashboard, subjects,
 * flashcards, etc). Mimics the shape of the eventual content so layout
 * doesn't jump once data arrives.
 */
export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading content"
      className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-8" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Simple skeleton rows for lists (chat history, notes list, etc). */
export function ListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading content" className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          className="flex items-center gap-3"
        >
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

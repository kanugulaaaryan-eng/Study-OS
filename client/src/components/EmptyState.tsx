import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/**
 * Shared empty state for pages/sections with no data yet.
 * Wraps the shadcn Empty primitive (semantic CSS vars, theme-safe)
 * with a subtle fade/scale-in and an optional call to action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="status"
      aria-live="polite"
    >
      <Empty className={className}>
        <EmptyHeader>
          <EmptyMedia variant="icon" aria-hidden="true">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {(action || secondaryAction) && (
          <EmptyContent>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              {action && (
                <Button onClick={action.onClick} className="flex-1" aria-label={action.label}>
                  {action.icon && <action.icon className="w-4 h-4 mr-2" aria-hidden="true" />}
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  onClick={secondaryAction.onClick}
                  variant="outline"
                  className="flex-1"
                  aria-label={secondaryAction.label}
                >
                  {secondaryAction.icon && (
                    <secondaryAction.icon className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          </EmptyContent>
        )}
      </Empty>
    </motion.div>
  );
}

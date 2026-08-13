import { motion, Variants, Transition } from "framer-motion";
import { ReactNode } from "react";

const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const pageTransition: Transition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.3,
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({ children, delayChildren = 0.1 }: { children: ReactNode; delayChildren?: number }) {
  const variants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: delayChildren,
      },
    },
  };
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, delay } },
  };
  return (
    <motion.div variants={variants}>
      {children}
    </motion.div>
  );
}

export function CardHover({ children }: { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ children, direction = "up", delay = 0 }: { children: ReactNode; direction?: "up" | "down" | "left" | "right"; delay?: number }) {
  const directionVariants: Record<string, Variants> = {
    up: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
    down: {
      hidden: { opacity: 0, y: -20 },
      visible: { opacity: 1, y: 0 },
    },
    left: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0 },
    },
    right: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0 },
    },
  };

  const variants: Variants = directionVariants[direction] || directionVariants.up;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </motion.div>
  );
}
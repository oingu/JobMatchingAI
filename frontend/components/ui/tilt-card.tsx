"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  intensity?: number;
  popOutChildren?: boolean;
}

export function TiltCard({ children, className, innerClassName, intensity = 15, popOutChildren = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-intensity, intensity]);

  const background = useTransform(
    () => `radial-gradient(400px circle at ${(x.get() + 0.5) * 100}% ${(y.get() + 0.5) * 100}%, rgba(16, 185, 129, 0.15), transparent 40%)`
  );

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: popOutChildren ? "preserve-3d" : "flat",
      }}
      className={cn("relative transition-all duration-200 ease-linear", className)}
    >
      {/* Light glow effect that follows mouse */}
      <motion.div
        className={cn(
          "pointer-events-none absolute -inset-px rounded-xl transition-opacity duration-300 z-0",
          isHovered ? "opacity-50" : "opacity-0"
        )}
        style={{
          background,
        }}
      />
      <div 
        style={popOutChildren ? { transform: "translateZ(30px)", transformStyle: "preserve-3d" } : {}} 
        className={cn("w-full h-full relative z-10", innerClassName)}
      >
        {children}
      </div>
    </motion.div>
  );
}

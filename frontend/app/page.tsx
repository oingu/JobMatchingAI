"use client";

import Link from "next/link";
import { Zap, ArrowRight, Users, Sparkles, Activity, Layers, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import dynamic from "next/dynamic";
const Scene3D = dynamic(() => import("@/components/ui/scene-3d").then(mod => mod.Scene3D), { ssr: false });
import { TiltCard } from "@/components/ui/tilt-card";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: <Users className="h-5 w-5 text-emerald-500" />,
    title: "Cosine Similarity Matching",
    desc: "Proficiency-weighted vectors that match candidates based on skills mapping, experience, and salary alignment rather than simple keywords.",
    badge: "Vector Search"
  },
  {
    icon: <Activity className="h-5 w-5 text-blue-500" />,
    title: "Time-Decayed Behavior Modeling",
    desc: "Dynamically tracks candidate response latency and login frequency, decay-scoring passive candidates to prioritize highly engaged talent.",
    badge: "Behavior Engine"
  },
  {
    icon: <Layers className="h-5 w-5 text-amber-500" />,
    title: "Event-Driven Orchestration",
    desc: "Automatic pipeline triggers recommendations in real time whenever a recruiter posts a new job or a candidate updates their profile.",
    badge: "Event Loop"
  },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  // Parallax effects
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacityText = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground selection:bg-muted selection:text-foreground font-sans antialiased overflow-x-hidden">
      {/* Refined Navigation Header */}
      <header className="border-b border-border bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border shadow-inner">
              <Zap className="h-4 w-4 text-emerald-500 fill-emerald-500/10" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">JobMatch AI</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link 
              href="/login" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-medium rounded-lg")}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Split Screen layout with 3D */}
      <div className="relative w-full overflow-hidden">
        {/* Full-width WebGL 3D Background */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none" 
          style={{ maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "-webkit-linear-gradient(top, black 60%, transparent 100%)" }}
        >
          <Scene3D />
        </div>
        
        <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column - Typographic Headline */}
        <motion.div style={{ y: yBg, opacity: opacityText }} className="lg:col-span-7 flex flex-col items-start text-left z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-foreground max-w-[18ch]"
          >
            The intelligent matching engine for engineering teams.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-[55ch]"
          >
            A state-of-the-art recruitment platform utilizing cosine vector similarity for skill matching, layered with user activity decay modeling and real-time event processing.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(16,185,129,0.3)] font-medium rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              )}
            >
              Explore Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/oingu/JobMatchingAI"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-border hover:border-border/80 hover:bg-muted/50 backdrop-blur-sm text-muted-foreground hover:text-foreground rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              )}
            >
              View GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>

        {/* Right Column - Tilt Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 100 }}
          className="lg:col-span-5 relative w-full flex items-center justify-center p-6 group"
          style={{ perspective: "1000px" }}
        >
          {/* Glassmorphism Tilt Card UI floating in 3D */}
          <TiltCard intensity={20} className="w-full max-w-[340px] z-10">
            <div className="relative bg-card/60 backdrop-blur-2xl border border-white/10 dark:border-white/5 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
                <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">Vector Matching Result</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  94% Match
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Position</div>
                  <div className="text-sm font-semibold text-foreground">Senior Backend Engineer</div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Required Skills vs. Candidate</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/80 text-foreground border border-border/50">Python [4/3]</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/80 text-foreground border border-border/50">FastAPI [5/4]</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background/50 text-muted-foreground border border-border/30">AWS [0/3]</span>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">Activity Score</div>
                    <div className="text-xs font-medium text-emerald-500">0.87 (High Engagement)</div>
                  </div>
                  <div className="h-6 w-16 bg-emerald-500/10 rounded-md border border-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-500 font-medium shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    Active
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
        </section>
      </div>

      {/* Feature Grid Section with Parallax Reveal */}
      <section className="border-t border-border/40 bg-card/20 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-xl text-left mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Engineered for precision.
            </h2>
            <p className="mt-4 text-muted-foreground text-base leading-relaxed">
              Moving past simple keyword filters to implement mathematical matching strategies with live database event loops.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <TiltCard key={f.title} intensity={10} className="h-full">
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="group relative h-full border border-border/50 bg-background/40 backdrop-blur-xl rounded-xl p-6 flex flex-col justify-between transition-all duration-300 shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 mb-6">
                      <div className="h-10 w-10 rounded-lg bg-card border border-border/50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {f.icon}
                      </div>
                      <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">{f.badge}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-border/40 bg-background/80 py-12 relative z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-card border border-border shadow-inner">
              <Zap className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-muted-foreground">JobMatch AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; 2026 JobMatch AI. Open-source under MIT License.
          </p>
        </div>
      </footer>
    </div>
  );
}

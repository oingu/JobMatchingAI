import Link from "next/link";
import { Zap, ArrowRight, Users, Sparkles, Activity, Layers, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-muted selection:text-foreground font-sans antialiased overflow-x-hidden">
      {/* Refined Navigation Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
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

      {/* Hero Section - Split Screen layout */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column - Typographic Headline */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Graduation Thesis Project</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-foreground max-w-[18ch]">
            The intelligent matching engine for engineering teams.
          </h1>
          <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-[55ch]">
            A state-of-the-art recruitment platform utilizing cosine vector similarity for skill matching, layered with user activity decay modeling and real-time event processing.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg font-medium rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 active:scale-[0.98]"
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
                "border-border hover:border-border/80 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 active:scale-[0.98]"
              )}
            >
              View GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Right Column - Compositional Graphic Preview */}
        <div className="lg:col-span-5 relative w-full aspect-[4/3] rounded-2xl border border-border bg-muted/30 overflow-hidden shadow-2xl flex items-center justify-center p-6 group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-muted/50 via-transparent to-transparent opacity-70"></div>
          
          {/* Mock Interactive Matching Card UI */}
          <div className="relative w-full max-w-[340px] bg-card border border-border rounded-xl p-5 shadow-xl transition-all duration-300 group-hover:-translate-y-1 hover:shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">Vector Matching Result</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
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
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">Python [4/3]</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">FastAPI [5/4]</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background text-muted-foreground border border-border/50">AWS [0/3]</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground">Activity Score</div>
                  <div className="text-xs font-medium text-muted-foreground">0.87 (High Engagement)</div>
                </div>
                <div className="h-6 w-16 bg-muted rounded-md border border-border flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                  Active
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="border-t border-border bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-xl text-left mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Engineered for precision.
            </h2>
            <p className="mt-4 text-muted-foreground text-base leading-relaxed">
              Moving past simple keyword filters to implement mathematical matching strategies with live database event loops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div 
                key={f.title} 
                className="group relative border border-border hover:border-border/80 rounded-xl bg-card/50 hover:bg-muted/50 p-6 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="inline-flex items-center gap-2 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm">
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">{f.badge}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-foreground/80 transition-colors">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-border/40 bg-background/80 py-12">
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

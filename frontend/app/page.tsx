import Link from "next/link";
import { Zap, ArrowRight, Users, Sparkles, Activity, Layers, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Refined Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-lg shadow-sm">
              ⚡
            </div>
            <span className="font-semibold text-lg tracking-tight text-zinc-100">JobMatch AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className={cn(buttonVariants({ size: "sm" }), "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 transition-all font-medium rounded-lg")}
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-300 mb-6">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Graduation Thesis Project</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] text-zinc-50 max-w-[18ch]">
            The intelligent matching engine for engineering teams.
          </h1>
          <p className="mt-6 text-zinc-400 text-base sm:text-lg leading-relaxed max-w-[55ch]">
            A state-of-the-art recruitment platform utilizing cosine vector similarity for skill matching, layered with user activity decay modeling and real-time event processing.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 shadow-lg font-medium rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 active:scale-[0.98]"
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
                "border-zinc-850 hover:border-zinc-800 hover:bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 rounded-lg px-6 py-6 w-full sm:w-auto gap-2 flex items-center justify-center transition-all duration-200 active:scale-[0.98]"
              )}
            >
              View GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Right Column - Compositional Graphic Preview */}
        <div className="lg:col-span-5 relative w-full aspect-[4/3] rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-2xl flex items-center justify-center p-6 group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent opacity-70"></div>
          
          {/* Mock Interactive Matching Card UI */}
          <div className="relative w-full max-w-[340px] bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:border-zinc-700">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-4">
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Vector Matching Result</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-900/40 px-2 py-0.5 rounded-full">
                94% Match
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-zinc-400">Position</div>
                <div className="text-sm font-semibold text-zinc-100">Senior Backend Engineer</div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-1.5">Required Skills vs. Candidate</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">Python [4/3]</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">FastAPI [5/4]</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 border border-zinc-900/80">AWS [0/3]</span>
                </div>
              </div>

              <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500">Activity Score</div>
                  <div className="text-xs font-medium text-zinc-300">0.87 (High Engagement)</div>
                </div>
                <div className="h-6 w-16 bg-zinc-800 rounded-md border border-zinc-750 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                  Active
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="border-t border-zinc-900 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-xl text-left mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              Engineered for precision.
            </h2>
            <p className="mt-4 text-zinc-400 text-base leading-relaxed">
              Moving past simple keyword filters to implement mathematical matching strategies with live database event loops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div 
                key={f.title} 
                className="group relative border border-zinc-900 hover:border-zinc-800 rounded-xl bg-zinc-900/10 hover:bg-zinc-900/20 p-6 flex flex-col justify-between transition-all duration-300"
              >
                <div>
                  <div className="inline-flex items-center gap-2 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900/80 border border-zinc-850 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase">{f.badge}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-zinc-50 transition-colors">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-zinc-950/40 bg-zinc-950/80 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm">
              ⚡
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-300">JobMatch AI</span>
          </div>
          <p className="text-xs text-zinc-600">
            &copy; 2026 JobMatch AI. Open-source under MIT License.
          </p>
        </div>
      </footer>
    </div>
  );
}

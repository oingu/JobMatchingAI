import Link from "next/link";
import { Zap, ArrowRight, Users, Briefcase, BarChart3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: <Users className="h-5 w-5" />,
    title: "Smart Matching",
    desc: "Proficiency-weighted cosine similarity between skill vectors.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Behavior Modeling",
    desc: "Activity score with time-decay and engagement tracking.",
  },
  {
    icon: <Briefcase className="h-5 w-5" />,
    title: "Event-Driven",
    desc: "Auto-triggered recommendations when jobs or profiles change.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <Zap className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">JobMatch AI</h1>
        <p className="mt-2 text-muted-foreground">
          Intelligent Job Matching &amp; Recommendation System with User Behavior Modeling
        </p>

        <div className="mt-8 grid gap-3">
          {features.map((f) => (
            <Card key={f.title} className="text-left">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-md bg-muted p-2">{f.icon}</div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2")}
        >
          Get Started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

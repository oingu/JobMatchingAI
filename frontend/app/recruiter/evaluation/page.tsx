"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

type EvalData = {
  recommendation_quality: { precision_at_k: number; recall_at_k: number };
  engagement: { ctr: number; apply_rate: number; ignore_rate: number };
  model_comparison: {
    baseline: { precision_at_k: number; recall_at_k: number };
    improved: { precision_at_k: number; recall_at_k: number };
    delta: { precision_at_k: number; recall_at_k: number };
  };
};

type StrategyInfo = { strategy: string; description: string; available: string[] };

export default function EvaluationPage() {
  return <RoleGuard allowedRole="recruiter">{(session) => <EvaluationContent session={session} />}</RoleGuard>;
}

function EvaluationContent({ session }: { session: SessionData }) {
  const [data, setData] = useState<EvalData | null>(null);
  const [strategyInfo, setStrategyInfo] = useState<StrategyInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [evalRes, stratRes] = await Promise.all([
          apiRequest<EvalData>("/evaluate", { method: "POST", session }),
          apiRequest<StrategyInfo>("/matching-strategy", { session }),
        ]);
        setData(evalRes.data);
        setStrategyInfo(stratRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load evaluation failed.");
      }
    })();
  }, [session]);

  const chartData = data
    ? [
        { metric: "Precision@K", baseline: data.model_comparison.baseline.precision_at_k, improved: data.model_comparison.improved.precision_at_k },
        { metric: "Recall@K", baseline: data.model_comparison.baseline.recall_at_k, improved: data.model_comparison.improved.recall_at_k },
      ]
    : [];

  return (
    <AppShell role="recruiter" title="Evaluation">
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {strategyInfo && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Matching Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge>{strategyInfo.strategy.toUpperCase()}</Badge>
              <span className="text-sm text-muted-foreground">{strategyInfo.description}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Precision@K", value: data.recommendation_quality.precision_at_k },
              { label: "Recall@K", value: data.recommendation_quality.recall_at_k },
              { label: "CTR", value: data.engagement.ctr },
              { label: "Apply Rate", value: data.engagement.apply_rate },
            ].map((m) => (
              <Card key={m.label}>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">{m.label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{m.value.toFixed(4)}</p></CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="h-72 pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="baseline" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="improved" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

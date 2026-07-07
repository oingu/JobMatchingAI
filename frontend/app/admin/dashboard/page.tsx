"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  FileText,
  ShieldCheck,
  Target,
  GitCompare,
  Zap,
  TrendingUp,
  Percent
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from "recharts";

type Stats = {
  total_users: number;
  candidates: number;
  recruiters: number;
  total_jobs: number;
  total_applications: number;
  pending_verifications: number;
  verified_recruiters: number;
  accuracy: {
    precision_at_5: number;
    recall_at_5: number;
  };
  engagement: {
    ctr: number;
    apply_rate: number;
    ignore_rate: number;
  };
  model_comparison: {
    baseline: {
      precision_at_k: number;
      recall_at_k: number;
    };
    improved: {
      precision_at_k: number;
      recall_at_k: number;
    };
    delta: {
      precision_at_k: number;
      recall_at_k: number;
    };
  };
  funnel: {
    views: number;
    clicks: number;
    applies: number;
    interviews: number;
  };
  trending_skills: {
    demand: { name: string; count: number }[];
    supply: { name: string; count: number }[];
  };
};

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRole="admin">
      {(session) => <Content session={session} />}
    </RoleGuard>
  );
}

function Content({ session }: { session: SessionData }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<Stats>("/admin/stats", { session });
        setStats(res.data);
      } catch {
        /* ignore */
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell role="admin" title="Admin Dashboard">
      {!stats ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Section: Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users className="h-5 w-5" />} label="Tổng số người dùng" value={stats.total_users} iconBg="bg-blue-500/10 text-blue-400" />
            <StatCard icon={<Users className="h-5 w-5" />} label="Ứng viên (Candidates)" value={stats.candidates} iconBg="bg-sky-500/10 text-sky-400" />
            <StatCard icon={<Users className="h-5 w-5" />} label="Nhà tuyển dụng (Recruiters)" value={stats.recruiters} iconBg="bg-indigo-500/10 text-indigo-400" />
            <StatCard icon={<Briefcase className="h-5 w-5" />} label="Tổng số tin tuyển dụng" value={stats.total_jobs} iconBg="bg-violet-500/10 text-violet-400" />
            <StatCard icon={<FileText className="h-5 w-5" />} label="Số hồ sơ ứng tuyển" value={stats.total_applications} iconBg="bg-purple-500/10 text-purple-400" />
            <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Yêu cầu xác minh chờ xử lý" value={stats.pending_verifications} className="text-amber-500" iconBg="bg-amber-500/10 text-amber-400" />
            <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Nhà tuyển dụng đã xác minh" value={stats.verified_recruiters} className="text-emerald-500" iconBg="bg-emerald-500/10 text-emerald-400" />
          </div>

          {/* Section: Advanced Accuracy & Evaluation Metrics */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Accuracy & Engagement Card */}
            <Card className="border-border bg-card/20 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-violet-500/10 rounded-lg text-violet-600 dark:text-violet-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Độ chính xác & Tương tác</h3>
                    <p className="text-xs text-muted-foreground">Chỉ số đánh giá độ chính xác của mô hình khuyến nghị & phản hồi từ ứng viên</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground/80">Precision@5 (Độ chuẩn xác)</span>
                      <span className="text-sm font-semibold text-foreground">{(stats.accuracy.precision_at_5 * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${stats.accuracy.precision_at_5 * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Tỷ lệ các công việc được gợi ý là phù hợp và ứng viên thực sự ứng tuyển.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground/80">Recall@5 (Độ bao phủ)</span>
                      <span className="text-sm font-semibold text-foreground">{(stats.accuracy.recall_at_5 * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${stats.accuracy.recall_at_5 * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Tỷ lệ các công việc ứng viên ứng tuyển nằm trong danh sách gợi ý.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/60">
                    <div className="text-center p-3 rounded-lg bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">CTR</p>
                      <p className="text-lg font-bold text-emerald-500 mt-1">{(stats.engagement.ctr * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">Click / Xem</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Apply Rate</p>
                      <p className="text-lg font-bold text-sky-500 mt-1">{(stats.engagement.apply_rate * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">Nộp hồ sơ / Click</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ignore Rate</p>
                      <p className="text-lg font-bold text-amber-500 mt-1">{(stats.engagement.ignore_rate * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">Bỏ qua / Xem</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Model Comparison Card */}
            <Card className="border-border bg-card/20 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <GitCompare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">So sánh hiệu năng mô hình</h3>
                    <p className="text-xs text-muted-foreground">Đánh giá mô hình cải tiến (Gợi ý tối ưu) so với Baseline (Trọng số mặc định)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Chỉ số (@K=5)</th>
                          <th className="pb-3 font-semibold text-center">Baseline</th>
                          <th className="pb-3 font-semibold text-center text-violet-600 dark:text-violet-400">Cải tiến</th>
                          <th className="pb-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">Độ chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-foreground/80">
                        <tr className="hover:bg-accent/10">
                          <td className="py-3.5 text-foreground/80 font-medium">Precision</td>
                          <td className="py-3.5 text-center text-muted-foreground">{(stats.model_comparison.baseline.precision_at_k * 100).toFixed(1)}%</td>
                          <td className="py-3.5 text-center font-semibold text-violet-600 dark:text-violet-300">{(stats.model_comparison.improved.precision_at_k * 100).toFixed(1)}%</td>
                          <td className="py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.model_comparison.delta.precision_at_k >= 0 ? "+" : ""}
                            {(stats.model_comparison.delta.precision_at_k * 100).toFixed(1)}%
                          </td>
                        </tr>
                        <tr className="hover:bg-accent/10">
                          <td className="py-3.5 text-foreground/80 font-medium">Recall</td>
                          <td className="py-3.5 text-center text-muted-foreground">{(stats.model_comparison.baseline.recall_at_k * 100).toFixed(1)}%</td>
                          <td className="py-3.5 text-center font-semibold text-violet-600 dark:text-violet-300">{(stats.model_comparison.improved.recall_at_k * 100).toFixed(1)}%</td>
                          <td className="py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.model_comparison.delta.recall_at_k >= 0 ? "+" : ""}
                            {(stats.model_comparison.delta.recall_at_k * 100).toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Hiệu năng cải tiến của hệ thống</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Mô hình khuyến nghị tối ưu sử dụng sự kết hợp giữa kỹ năng, sự tương thích về địa điểm, kỳ vọng lương, cùng với điểm hoạt động của ứng viên (Activity Score) để mang lại gợi ý tốt hơn mô hình Baseline mặc định.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section: Analytics & Insights */}
          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            {/* Conversion Funnel Card */}
            <Card className="border-border bg-card/20 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Phễu Chuyển đổi Tuyển dụng</h3>
                    <p className="text-xs text-muted-foreground">Hành trình của ứng viên từ lượt xem đến phỏng vấn</p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Lượt xem", count: stats.funnel.views },
                        { name: "Click", count: stats.funnel.clicks },
                        { name: "Ứng tuyển", count: stats.funnel.applies },
                        { name: "Phỏng vấn", count: stats.funnel.interviews },
                      ]}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                      <XAxis type="number" stroke="#888" />
                      <YAxis dataKey="name" type="category" width={80} stroke="#888" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Trending Skills Card */}
            <Card className="border-border bg-card/20 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-400">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Lỗ hổng Kỹ năng (Skill Gap)</h3>
                    <p className="text-xs text-muted-foreground">Top Kỹ năng Doanh nghiệp cần (Demand) vs Ứng viên có (Supply)</p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.trending_skills.demand.map((d) => {
                        const supplyMatch = stats.trending_skills.supply.find((s) => s.name === d.name);
                        return {
                          name: d.name,
                          Demand: d.count,
                          Supply: supplyMatch ? supplyMatch.count : 0,
                        };
                      }).slice(0, 7)}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" stroke="#888" angle={-45} textAnchor="end" height={60} />
                      <YAxis stroke="#888" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="Demand" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Supply" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  className,
  iconBg = "bg-zinc-900 text-zinc-400"
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
  iconBg?: string;
}) {
  return (
    <Card className="border-border/80 bg-card/40 hover:bg-accent/40 transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-foreground/5 group">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${iconBg.replace('zinc-900', 'muted').replace('zinc-400', 'muted-foreground')}`}>
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold tracking-tight text-foreground ${className ?? ""}`}>{value}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}


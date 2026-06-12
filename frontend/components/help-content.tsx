"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Info, Calculator, Star, Zap, CheckCircle2 } from "lucide-react";

export function HelpContent() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to know about how JobMatchingAI works and how to read the metrics.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-500" />
              Matching Score Explained
            </CardTitle>
            <CardDescription>How the AI calculates your fit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The <strong>Match %</strong> you see on job cards or candidate profiles is not a simple keyword count. It is a comprehensive score calculated using an AI algorithm (Cosine Similarity in a Vector Space) based on 3 main factors:
            </p>
            <ul className="space-y-2 list-disc pl-4">
              <li><strong>Skill Match (50%):</strong> Evaluates not just if you have the skill, but whether your <em>proficiency level</em> (1-5) meets the job's requirement.</li>
              <li><strong>Preference Match (30%):</strong> Looks at Location, Salary expectations, and Experience Level (Junior, Senior, etc.).</li>
              <li><strong>Activity Score (20%):</strong> Rewards users who frequently interact with the platform (apply, chat, update profile).</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Skill Proficiency Levels
            </CardTitle>
            <CardDescription>What the 1-5 stars actually mean</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-slate-100 text-slate-700">Level 1</Badge>
              <span><strong>Beginner:</strong> Just started learning, basic academic knowledge.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-700">Level 2</Badge>
              <span><strong>Intermediate:</strong> Can use it with supervision or reference materials.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700">Level 3</Badge>
              <span><strong>Proficient:</strong> Independent user, can build features reliably.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-purple-100 text-purple-700">Level 4</Badge>
              <span><strong>Advanced:</strong> Deep understanding, can mentor others and optimize.</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-rose-100 text-rose-700">Level 5</Badge>
              <span><strong>Expert:</strong> Industry-leading knowledge, architect-level understanding.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How long does it take to get matched?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Matches are generated in real-time. Whenever a new job is posted or you update your profile/skills, the AI runs a background process and immediately pushes the highest-scoring matches to your feed.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Why is my Match Score lower than expected?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                This usually happens if your proficiency levels don't meet the minimum requirements, or if there is a mismatch in Location/Salary. Updating your profile with more accurate skill levels and preferred locations can drastically improve your score.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How do I chat or schedule an interview?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Messaging and interview scheduling are unlocked <strong>only after</strong> a Recruiter has reviewed and "Accepted" a Candidate's application. Once accepted, both parties can access the chat interface directly from the Applications tab.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

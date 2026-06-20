"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bot, Trophy, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";

interface MockInterviewDialogProps {
  appId: string;
  isOpen: boolean;
  onClose: () => void;
  session: SessionData | null;
}

interface Question {
  question: string;
  hint: string;
}

export function MockInterviewDialog({ appId, isOpen, onClose, session }: MockInterviewDialogProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      startInterview();
    } else {
      // Reset state when closed
      setQuestions([]);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback(null);
      setIsFinished(false);
      setTotalScore(0);
      setError("");
    }
  }, [isOpen, appId]);

  const startInterview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<{ questions: Question[] }>(`/applications/${appId}/mock-interview/generate`, {
        method: "POST",
        session
      });
      setQuestions(res.data.questions || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setEvaluating(true);
    setError("");
    try {
      const res = await apiRequest<{ score: number; feedback: string }>(`/applications/${appId}/mock-interview/evaluate`, {
        method: "POST",
        session,
        body: {
          question: questions[currentIndex].question,
          answer: answer
        }
      });
      setFeedback(res.data);
      setTotalScore((prev) => prev + res.data.score);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setAnswer("");
      setFeedback(null);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-indigo-500/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bot className="w-6 h-6 text-indigo-500" />
            AI Mock Interview
          </DialogTitle>
          <DialogDescription>
            Practice your interview skills with our AI tailored specifically to this job.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 min-h-[300px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p>AI is analyzing the Job Description and your CV...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-4">
              <AlertCircle className="w-8 h-8" />
              <p>{error}</p>
              <Button variant="outline" onClick={startInterview}>Retry</Button>
            </div>
          ) : isFinished ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-8"
            >
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                <Trophy className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold">Interview Completed!</h3>
              <p className="text-muted-foreground">
                Your average score: <span className="text-indigo-500 font-bold">{Math.round(totalScore / questions.length)}/100</span>
              </p>
              <Button className="mt-4" onClick={onClose}>Close</Button>
            </motion.div>
          ) : questions.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col flex-1 gap-4"
              >
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-xs">
                    Technical & Behavioral
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="font-medium text-lg leading-relaxed">
                    {questions[currentIndex].question}
                  </p>
                  {questions[currentIndex].hint && (
                    <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
                      💡 Hint: {questions[currentIndex].hint}
                    </p>
                  )}
                </div>

                {!feedback ? (
                  <div className="flex flex-col gap-3 mt-4">
                    <label className="text-sm font-semibold">Your Answer</label>
                    <Textarea 
                      placeholder="Type your detailed answer here..." 
                      className="min-h-[150px] resize-none focus-visible:ring-indigo-500"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={evaluating}
                    />
                    <div className="flex justify-end mt-2">
                      <Button 
                        onClick={submitAnswer} 
                        disabled={!answer.trim() || evaluating}
                        className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
                      >
                        {evaluating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</> : "Submit Answer"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex flex-col gap-4"
                  >
                    <div className={`p-4 rounded-xl border ${feedback.score >= 70 ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900' : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold flex items-center gap-2">
                          <CheckCircle2 className={`w-5 h-5 ${feedback.score >= 70 ? 'text-green-500' : 'text-amber-500'}`} />
                          AI Evaluation
                        </h4>
                        <span className={`font-bold text-lg ${feedback.score >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                          {feedback.score}/100
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{feedback.feedback}</p>
                    </div>
                    <Button onClick={nextQuestion} className="w-full">
                      {currentIndex < questions.length - 1 ? "Next Question" : "Finish Interview"}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bot, Trophy, CheckCircle2, AlertCircle, Sparkles, Send, Mic, Square, Volume2, VolumeX, History, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";

interface MockInterviewDialogProps {
  jobId: number;
  isOpen: boolean;
  onClose: () => void;
  session: SessionData | null;
}

interface Question {
  question: string;
  hint: string;
}

interface QAHistoryItem {
  question: string;
  answer: string;
}

const MAX_QUESTIONS = 3;

export function MockInterviewDialog({ jobId, isOpen, onClose, session }: MockInterviewDialogProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [nextQuestionObj, setNextQuestionObj] = useState<Question | null>(null);
  const [history, setHistory] = useState<QAHistoryItem[]>([]);
  
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  
  const [isFinished, setIsFinished] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [error, setError] = useState("");

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState<"en" | "vi">("vi");
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(120);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      startInterview();
    } else {
      resetState();
    }
    
    return () => {
      stopVoiceAndRecording();
    };
  }, [isOpen, jobId]);

  const resetState = () => {
    setCurrentQuestion(null);
    setNextQuestionObj(null);
    setHistory([]);
    setAnswer("");
    setFeedback(null);
    setIsFinished(false);
    setTotalScore(0);
    setError("");
    setTimeLeft(120);
    stopVoiceAndRecording();
  };

  const stopVoiceAndRecording = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "vi" ? "vi-VN" : "en-US";
    utterance.rate = 1.2;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === "vi" ? "vi-VN" : "en-US";
      
      let finalTranscript = answer;

      recognition.onstart = () => setIsRecording(true);
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let currentFinal = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (currentFinal) {
          finalTranscript += (finalTranscript ? " " : "") + currentFinal;
        }
        setAnswer(finalTranscript + (interimTranscript ? " " + interimTranscript : ""));
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          setIsRecording(false);
        }
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const startInterview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<{ questions: Question[] }>(`/jobs/${jobId}/mock-interview/generate?language=${language}`, {
        method: "POST",
        session
      });
      if (res.data.questions && res.data.questions.length > 0) {
        const q = res.data.questions[0];
        setCurrentQuestion(q);
        setTimeLeft(120);
        setTimeout(() => speakText(q.question), 500);
      } else {
        setError("Could not generate interview questions.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (forceContent?: any) => {
    const finalAnswer = typeof forceContent === "string" ? forceContent : answer.trim();
    if (!finalAnswer || !currentQuestion) return;
    
    stopVoiceAndRecording();
    setEvaluating(true);
    setError("");
    
    try {
      const res = await apiRequest<any>(`/jobs/${jobId}/mock-interview/evaluate`, {
        method: "POST",
        session,
        body: {
          current_question: currentQuestion.question,
          current_answer: finalAnswer,
          history: history,
          language: language
        }
      });
      
      setFeedback({ score: res.data.score, feedback: res.data.feedback });
      setTotalScore((prev) => prev + res.data.score);
      
      if (res.data.next_question) {
        setNextQuestionObj({
          question: res.data.next_question,
          hint: res.data.next_hint || ""
        });
      } else {
        setNextQuestionObj(null);
      }
      
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion) {
      setHistory(prev => [...prev, { question: currentQuestion.question, answer: answer }]);
    }
    
    if (nextQuestionObj) {
      setCurrentQuestion(nextQuestionObj);
      setAnswer("");
      setFeedback(null);
      setNextQuestionObj(null);
      setTimeLeft(120);
      setTimeout(() => speakText(nextQuestionObj.question), 500);
    } else {
      setIsFinished(true);
    }
  };

  const replayQuestion = () => {
    if (currentQuestion) {
      speakText(currentQuestion.question);
    }
  };

  // Countdown Timer Effect
  useEffect(() => {
    if (!currentQuestion || feedback || loading || evaluating || isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, feedback, loading, evaluating, isFinished]);

  // Auto-submit when time is up
  useEffect(() => {
    if (timeLeft === 0 && !evaluating && !feedback && currentQuestion && !isFinished) {
      submitAnswer("No answer provided due to timeout.");
    }
  }, [timeLeft, evaluating, feedback, currentQuestion, isFinished]);

  const questionIndex = history.length;
  const progressPercentage = ((questionIndex + (feedback ? 1 : 0)) / MAX_QUESTIONS) * 100;
  const avgScore = (history.length > 0 || feedback) ? Math.round(totalScore / (history.length + (feedback ? 1 : 0))) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-2xl border-indigo-500/30 shadow-2xl shadow-indigo-500/10 p-0">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent p-6 pb-4 border-b border-indigo-500/10 flex-shrink-0">
          <DialogHeader className="flex flex-col items-start w-full">
            <div className="flex w-full items-start justify-between">
              <div>
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
                  <div className="p-2 bg-indigo-500/10 rounded-xl">
                    <Bot className="w-6 h-6 text-indigo-500" />
                  </div>
                  AI Interviewer
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-2">
                  Real-time adaptive interview with voice interaction.
                </DialogDescription>
              </div>
            <div className="flex items-center gap-4">
              {!loading && !isFinished && currentQuestion && (
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`px-3 py-1 text-xs h-7 rounded-md ${language === "vi" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-semibold" : "text-muted-foreground"}`}
                    onClick={() => setLanguage("vi")}
                    disabled={evaluating}
                  >
                    VI
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`px-3 py-1 text-xs h-7 rounded-md ${language === "en" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-semibold" : "text-muted-foreground"}`}
                    onClick={() => setLanguage("en")}
                    disabled={evaluating}
                  >
                    EN
                  </Button>
                </div>
              )}
            </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 flex flex-col flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
                <Bot className="w-16 h-16 text-indigo-500 animate-bounce relative z-10" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg text-foreground">AI is preparing your first question...</p>
                <p className="text-sm opacity-70">Analyzing the Job Description & mapping your skills.</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-4">
              <AlertCircle className="w-12 h-12" />
              <p className="font-medium text-center">{error}</p>
              <Button variant="outline" onClick={startInterview}>Retry Preparation</Button>
            </div>
          ) : isFinished ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full animate-pulse" />
                <div className="w-24 h-24 bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl relative z-10">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <div>
                <h3 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-amber-600">
                  Interview Completed!
                </h3>
                <p className="text-muted-foreground mt-2 text-lg">
                  Your overall performance score:
                </p>
                <div className="text-5xl font-black text-foreground mt-2">
                  {avgScore}<span className="text-2xl text-muted-foreground font-medium">/100</span>
                </div>
              </div>
              
              <Button className="mt-4 px-8 py-6 rounded-xl text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20" onClick={onClose}>
                Return to Job Details
              </Button>
            </motion.div>
          ) : currentQuestion ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={questionIndex + (feedback ? 0.5 : 0)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col flex-1 gap-6"
              >
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                    <span className="text-indigo-500">
                      Question {questionIndex + 1}
                      {history.length + 1 > MAX_QUESTIONS ? " (Bonus)" : ` / ${MAX_QUESTIONS}`}
                    </span>
                    <div className="flex items-center gap-3">
                      {!loading && !isFinished && currentQuestion && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={isSpeaking ? stopVoiceAndRecording : replayQuestion} 
                          className="h-7 w-7 text-muted-foreground hover:text-indigo-500 bg-slate-100 dark:bg-slate-800 rounded-full"
                          title={isSpeaking ? "Stop Voice" : "Replay Question"}
                        >
                          {isSpeaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {!feedback && (
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                          timeLeft <= 15 ? "bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        }`}>
                          <Timer className="w-3.5 h-3.5" /> 
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                        <Sparkles className="w-3.5 h-3.5" /> Adaptive AI
                      </span>
                    </div>
                  </div>
                  <Progress value={Math.min(progressPercentage, 100)} className="h-2" />
                </div>

                {/* Question Bubble */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1 relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg relative z-10">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    {isSpeaking && (
                      <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="flex-1 bg-indigo-50 dark:bg-indigo-500/5 p-5 rounded-2xl rounded-tl-sm border border-indigo-500/10 relative">
                    <p className="font-semibold text-lg leading-relaxed text-foreground">
                      {currentQuestion.question}
                    </p>
                    {currentQuestion.hint && (
                      <div className="mt-4 p-3 bg-white/60 dark:bg-black/20 rounded-xl text-sm text-muted-foreground italic flex items-start gap-2 border border-white/20 dark:border-white/5">
                        <span className="text-xl leading-none">💡</span>
                        <span>{currentQuestion.hint}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Answer Area */}
                {!feedback ? (
                  <div className="flex flex-col gap-3 mt-2 pl-14">
                    <div className="relative">
                      <Textarea 
                        placeholder="Type your response or use the microphone to answer verbally..." 
                        className={`min-h-[160px] resize-none bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 rounded-xl p-4 text-base shadow-inner transition-all ${isRecording ? 'border-red-500/50 ring-2 ring-red-500/20' : ''}`}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={evaluating || isRecording}
                      />
                      {isRecording && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-red-500 font-medium text-sm animate-pulse bg-red-500/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Listening...
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <Button
                        variant={isRecording ? "destructive" : "outline"}
                        size="lg"
                        className={`rounded-xl shadow-sm ${isRecording ? 'animate-pulse' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 hover:border-indigo-200'}`}
                        onClick={toggleRecording}
                        disabled={evaluating}
                      >
                        {isRecording ? (
                          <><Square className="w-4 h-4 mr-2" /> Stop Recording</>
                        ) : (
                          <><Mic className="w-4 h-4 mr-2" /> Speak Answer</>
                        )}
                      </Button>
                      
                      <Button 
                        onClick={submitAnswer} 
                        disabled={!answer.trim() || evaluating || isRecording}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 py-5 shadow-lg shadow-indigo-500/20 font-semibold"
                        size="lg"
                      >
                        {evaluating ? (
                          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Evaluating...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" /> Submit Answer</>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-2 pl-14 flex flex-col gap-6"
                  >
                    {/* User's Answer Summary */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 opacity-60">
                      <p className="text-sm italic line-clamp-3">"{answer}"</p>
                    </div>

                    {/* AI Feedback */}
                    <div className={`relative p-6 rounded-2xl border backdrop-blur-sm overflow-hidden ${
                      feedback.score >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' : 
                      feedback.score >= 50 ? 'bg-amber-500/5 border-amber-500/20' : 
                      'bg-red-500/5 border-red-500/20'
                    }`}>
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        feedback.score >= 80 ? 'bg-emerald-500' : 
                        feedback.score >= 50 ? 'bg-amber-500' : 
                        'bg-red-500'
                      }`} />
                      
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold flex items-center gap-2 text-lg">
                          <CheckCircle2 className={`w-6 h-6 ${
                            feedback.score >= 80 ? 'text-emerald-500' : 
                            feedback.score >= 50 ? 'text-amber-500' : 
                            'text-red-500'
                          }`} />
                          Feedback
                        </h4>
                        <div className={`flex flex-col items-end`}>
                          <span className={`font-black text-3xl leading-none ${
                            feedback.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 
                            feedback.score >= 50 ? 'text-amber-600 dark:text-amber-400' : 
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {feedback.score}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">Score</span>
                        </div>
                      </div>
                      <p className="text-base leading-relaxed text-foreground whitespace-pre-line">{feedback.feedback}</p>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        onClick={nextQuestion} 
                        className="rounded-xl px-8 shadow-lg font-semibold w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                        size="lg"
                      >
                        {nextQuestionObj ? "Next Question" : "View Final Results"}
                        <Sparkles className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
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

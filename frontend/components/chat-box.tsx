"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Phone, Video, Minus, X, Image as ImageIcon, Sticker, SmilePlus, ThumbsUp } from "lucide-react";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/api";
import type { SessionData } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COMMON_EMOJIS = ["😀", "😂", "🥰", "😍", "🙏", "👍", "❤️", "🔥", "✨", "😢", "😡", "🤔", "🙌", "🎉", "💯", "😭", "🥺", "😊", "😎", "🥳"];

type Message = {
  id: number;
  application_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
};

type ChatBoxProps = {
  applicationId: number;
  currentUserId: number;
  session: SessionData;
  recipientName?: string;
  recipientAvatar?: string;
  onClose?: () => void;
  className?: string;
};

export function ChatBox({ applicationId, currentUserId, session, recipientName, recipientAvatar, onClose, className }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { error: toastError } = useToast();

  async function markAsRead() {
    try {
      await apiRequest(`/applications/${applicationId}/messages/read`, { method: "POST", session });
    } catch {
      // ignore
    }
  }

  async function loadMessages() {
    try {
      const res = await apiRequest<Message[]>(`/applications/${applicationId}/messages`, { session });
      setMessages(res.data);
      if (res.data.length > 0 && !isMinimized) {
        const lastMsg = res.data[res.data.length - 1];
        if (lastMsg.sender_id !== currentUserId && !lastMsg.is_read) {
          void markAsRead();
        }
      }
    } catch {
      // ignore silently for polling
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    void loadMessages();
  }, [applicationId, session]);

  // Listen to WebSocket events
  useEffect(() => {
    const handleWsMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg.type === "new_message" && msg.application_id === applicationId) {
        setMessages(prev => {
          // Avoid duplicates by ID
          if (prev.find(m => m.id === msg.message.id)) return prev;
          return [...prev, msg.message];
        });
        if (!isMinimized && msg.message.sender_id !== currentUserId) {
          void markAsRead();
        }
      }
    };
    window.addEventListener('ws-message', handleWsMessage);
    return () => window.removeEventListener('ws-message', handleWsMessage);
  }, [applicationId, isMinimized, currentUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (!isMinimized) {
      void markAsRead();
    }
  }, [messages, isMinimized]);

  async function sendMessage(e?: React.FormEvent, isThumbsUp = false) {
    if (e) e.preventDefault();
    const content = isThumbsUp ? "👍" : input.trim();
    if (!content) return;

    if (!isThumbsUp) setInput("");
    
    // Optimistic UI update
    const tempMsg: Message = {
      id: Date.now(),
      application_id: applicationId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await apiRequest(`/applications/${applicationId}/messages`, {
        method: "POST",
        session,
        body: { content }
      });
    } catch (err) {
      toastError("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      if (!isThumbsUp) setInput(content); // restore input
    }
  }

  return (
    <div 
      className={cn("flex flex-col border shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-background transition-all duration-200 overflow-hidden", className)} 
      style={{ borderRadius: "12px", height: isMinimized ? "52px" : undefined }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b bg-card cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={recipientAvatar} />
              <AvatarFallback>{(recipientName || "U").charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card"></div>
          </div>
          <div>
            <h3 className="font-semibold text-[15px] leading-tight">{recipientName || "User"}</h3>
            <span className="text-[11px] text-muted-foreground leading-tight">Đang hoạt động</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 text-primary">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full" 
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="p-3">
              {loading && messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground mt-4">Đang tải tin nhắn...</p>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Avatar className="h-16 w-16 mb-2">
                    <AvatarImage src={recipientAvatar} />
                    <AvatarFallback className="text-2xl">{(recipientName || "U").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-lg">{recipientName || "User"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Các bạn đã được kết nối. Hãy gửi tin nhắn chào hỏi!</p>
                </div>
              ) : (
                <div className="space-y-1">
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUserId;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
              
              const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;

              return (
                <div key={msg.id} className={cn("flex w-full gap-2", isMine ? "justify-end" : "justify-start", isFirstInGroup ? "mt-3" : "mt-0.5")}>
                  {!isMine && (
                    <div className="w-7 flex-shrink-0 flex items-end">
                      {isLastInGroup && (
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={recipientAvatar} />
                          <AvatarFallback className="text-[10px]">{(recipientName || "U").charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                  
                  <div className={cn("max-w-[70%] group flex flex-col", isMine ? "items-end" : "items-start")}>
                    {msg.content === "👍" ? (
                      <span className="text-4xl leading-none pt-1 text-primary">{msg.content}</span>
                    ) : (
                      <div className={cn(
                        "px-3.5 py-2 text-[15px] leading-snug",
                        isMine ? "bg-[#0084FF] text-white" : "bg-muted text-foreground dark:bg-[#303030]",
                        isMine ? "rounded-l-[18px]" : "rounded-r-[18px]",
                        isMine && isFirstInGroup ? "rounded-tr-[18px]" : "rounded-tr-[4px]",
                        isMine && isLastInGroup ? "rounded-br-[18px]" : "rounded-br-[4px]",
                        !isMine && isFirstInGroup ? "rounded-tl-[18px]" : "rounded-tl-[4px]",
                        !isMine && isLastInGroup ? "rounded-bl-[18px]" : "rounded-bl-[4px]"
                      )}>
                        {msg.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>

      {/* Footer */}
      <div className="p-2 bg-background border-t">
        <form onSubmit={(e) => sendMessage(e, false)} className="flex gap-1.5 items-center">
          <div className="relative flex-1">
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Aa" 
              className="pr-10 bg-muted border-0 rounded-full h-9 focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px]"
              disabled={loading && messages.length === 0}
            />
            <Popover>
              <PopoverTrigger className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center rounded-full text-[#0084FF] hover:bg-transparent focus:outline-none">
                <SmilePlus className="h-[20px] w-[20px]" />
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-2" side="top" align="end" sideOffset={10}>
                <div className="grid grid-cols-5 gap-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className="h-8 w-8 text-xl hover:bg-muted rounded-md flex items-center justify-center transition-colors"
                      onClick={() => setInput(prev => prev + emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {input.trim() ? (
            <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[#0084FF] hover:bg-muted shrink-0">
              <Send className="h-[20px] w-[20px]" />
            </Button>
          ) : (
            <Button type="button" onClick={() => sendMessage(undefined, true)} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[#0084FF] hover:bg-muted shrink-0">
              <ThumbsUp className="h-[20px] w-[20px] fill-current" />
            </Button>
          )}
        </form>
      </div>
        </>
      )}
    </div>
  );
}

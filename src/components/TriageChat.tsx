import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Send, Loader2, CheckCircle2, Brain } from 'lucide-react';
import type { ChatMessage, TriageResult } from '@/lib/gemma';
import { saveTriage } from '@/lib/gemma';

const OPENING_EN = "Hi, I'm here to help you find the right therapist. To get started — what's been on your mind lately, or what's brought you to Nawe today?";
const OPENING_SW = "Habari, niko hapa kukusaidia kupata mtaalamu anayekufaa. Kuanzia hapa — ni nini kimekuwa akilini mwako hivi karibuni, au nini kimekufanya uje Nawe leo?";

interface Props {
  onComplete?: (triage: TriageResult) => void;
}

const TriageChat = ({ onComplete }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'en' | 'sw'>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: OPENING_EN },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const switchLanguage = (lang: 'en' | 'sw') => {
    if (lang === language) return;
    setLanguage(lang);
    setMessages([{ role: 'assistant', content: lang === 'sw' ? OPENING_SW : OPENING_EN }]);
    setInput('');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || done) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('gemma-triage', {
        body: {
          messages: nextMessages,
          language,
          user_id: user?.id ?? null,
        },
      });

      if (error) throw error;

      if (data.done) {
        const triage = data.triage as TriageResult;
        saveTriage(triage);
        setDone(true);
        if (onComplete) onComplete(triage);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message.content }]);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl text-foreground">Your matches are ready</h2>
          <p className="font-body text-sm text-muted-foreground max-w-sm">
            Gemma has assessed your needs and identified therapists best suited for you.
          </p>
        </div>
        <Button className="font-ui rounded-full px-8" onClick={() => navigate('/matches')}>
          See My Therapist Matches →
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-ui text-sm font-semibold text-foreground">Nawe AI</p>
            <p className="font-body text-[11px] text-muted-foreground">Powered by Gemma 4</p>
          </div>
        </div>
        {/* Language toggle */}
        <div className="flex gap-1 bg-muted/40 p-0.5 rounded-full">
          {(['en', 'sw'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => switchLanguage(lang)}
              className={`px-3 py-1 rounded-full font-ui text-xs transition-colors ${
                language === lang
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang === 'en' ? 'English' : 'Swahili'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl font-body text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={language === 'sw' ? 'Andika hapa…' : 'Type your message…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading || done}
            className="flex-1 bg-muted/40 border border-input rounded-full px-4 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button
            size="icon"
            className="rounded-full shrink-0"
            onClick={send}
            disabled={!input.trim() || loading || done}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="font-body text-[10px] text-muted-foreground text-center mt-2">
          Your conversation is private and processed locally — it never leaves our servers.
        </p>
      </div>
    </div>
  );
};

export default TriageChat;

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, CheckCircle, Loader2 } from "lucide-react";
import { ChatMessage } from "./types";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import BouncingDots from './BouncingDots';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  currentStep:
  | "greeting"
  | "initialInput"
  | "awaitMissingInfo"
  | "awaitAdditionalAndLatestSpecs"
  | "awaitAdvancedSpecs"
  | "confirmAfterMissingInfo"
  | "showSummary"
  | "finalConfirmation"
  | "finalAnalysis"
  | "analysisError"
  | "default";
  isValidationComplete: boolean;
  productType: string | null;
  collectedData: { [key: string]: string };
  vendorAnalysisComplete: boolean;
  onRetry: () => void;
  searchSessionId?: string; // Optional session ID for debugging
}

interface MessageRowProps {
  message: ChatMessage;
  isHistory: boolean;
  renderVendorAnalysisStatus: (message: ChatMessage) => React.ReactNode;
  formatTimestamp: (ts: any) => string;
}

const MessageRow = ({ message, isHistory, renderVendorAnalysisStatus, formatTimestamp }: MessageRowProps) => {
  const [isVisible, setIsVisible] = useState(isHistory);

  useEffect(() => {
    if (!isHistory) {
      const delay = message.type === "user" ? 200 : 0;
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isHistory, message.type]);

  return (
    <div
      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"
        }`}
    >
      <div
        className={`max-w-[80%] flex items-start space-x-2 ${message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
          }`}
      >
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${message.type === "user"
            ? "bg-transparent text-white"
            : "bg-transparent"
            }`}
        >
          {message.type === "user" ? (
            <img
              src="/icon-user-3d.png"
              alt="User"
              className="w-10 h-10 object-contain"
            />
          ) : (
            <img
              src="/icon-engenie.png"
              alt="Assistant"
              className="w-14 h-14 object-contain"
            />
          )}
        </div>
        <div className="flex-1">
          <div
            className={`break-words ${message.type === "user"
              ? "glass-bubble-user"
              : "glass-bubble-assistant"
              }`}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "scale(1)" : "scale(0.8)",
              transformOrigin: message.type === "user" ? "top right" : "top left",
              transition: "opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}
          >
            <div>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            {renderVendorAnalysisStatus(message)}
          </div>
          <p
            className={`text-xs text-muted-foreground mt-1 px-1 ${message.type === "user" ? "text-right" : ""
              }`}
            style={{
              opacity: isVisible ? 1 : 0,
              transition: "opacity 0.8s ease 0.3s"
            }}
          >
            {formatTimestamp(message.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};

const ChatInterface = ({
  messages,
  onSendMessage,
  isLoading,
  isStreaming,
  inputValue,
  setInputValue,
  currentStep,
  isValidationComplete,
  productType,
  collectedData,
  vendorAnalysisComplete,
  onRetry,
  searchSessionId,
}: ChatInterfaceProps) => {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isHistoryRef = useRef(true);

  // Set isHistory to false after initial mount so new messages animate
  useEffect(() => {
    // Small timeout to ensure first render completes before we switch mode
    const timer = setTimeout(() => {
      isHistoryRef.current = false;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const [activeDescription, setActiveDescription] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowThinking(true);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setShowThinking(false);
    }
  }, [isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, showThinking]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
    }
  }, [inputValue]);

  const prettifyRequirement = (req: string) =>
    req
      .replace(/\_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  // ... existing code ...
  {
    showThinking && !isStreaming && (
      <div className="flex justify-start">
        <div className={`max-w-[80%] flex items-start space-x-2`}>
          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
            <img
              src="/icon-engenie.png"
              alt="Assistant"
              className="w-14 h-14 object-contain"
            />
          </div>
          <div className="p-3 rounded-lg">
            <BouncingDots />
          </div>
        </div>
      </div>
    )
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "";
    // If already a Date
    if (ts instanceof Date) {
      try {
        return ts.toLocaleTimeString();
      } catch (e) {
        return ts.toString();
      }
    }

    // If numeric (epoch ms)
    if (typeof ts === "number") {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? String(ts) : d.toLocaleTimeString();
    }

    // If ISO/string, try to parse
    if (typeof ts === "string") {
      const parsed = Date.parse(ts);
      if (!isNaN(parsed)) {
        return new Date(parsed).toLocaleTimeString();
      }

      // If string isn't parseable, return as-is (fallback)
      return ts;
    }

    // Unknown type: fallback to string
    try {
      return String(ts);
    } catch (e) {
      return "";
    }
  };

  const handleSend = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      toast({
        title: "Input required",
        description: "Please enter your data before sending.",
        variant: "destructive",
      });
      return;
    }
    if (isLoading) return;
    onSendMessage(trimmedInput);
    setInputValue("");
    setActiveDescription(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };



  const handleSampleClick = (sampleText: string) => {
    setInputValue(sampleText);
    textareaRef.current?.focus();
    setActiveDescription(null);
  };

  const handleInteractiveButtonClick = (label: string) => {
    setActiveDescription((current) => (current === label ? null : label));
  };

  const renderVendorAnalysisStatus = (message: ChatMessage) => {
    if (message.metadata?.vendorAnalysisComplete) {
      return (
        <div className="mt-3 p-4 rounded-lg bg-ai-primary/5 border border-ai-primary/20 space-y-2 shadow-inner">
          <h4 className="font-semibold text-ai-primary mb-1 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" /> Vendor Analysis Complete
          </h4>
          <p className="text-sm text-muted-foreground">
            Detailed results are displayed in the right panel.
          </p>
        </div>
      );
    }
    return null;
  };

  const getPlaceholderText = () => {
    if (isLoading) {
      return "Thinking...";
    }
    switch (currentStep) {
      case "initialInput":
        return "";
      case "awaitMissingInfo":
        return "";
      case "awaitAdditionalAndLatestSpecs":
        return "";
      case "awaitAdvancedSpecs":
        return "";
      case "showSummary":
      case "analysisError":
        return "";
      case "finalAnalysis":
        return "";
      default:
        return "Send a message...";
    }
  };

  const sampleInputs = [
    {
      label: "Pressure Transmitter",
      text: "I am looking for a very specific pressure transmitter. The required performance includes a tight pressure range of -10 to 10 inH2O and a high standard accuracy of 0.035% of span. For system integration, the device must provide a 4-20mA with HART output signal. In terms of materials, the process-wetted parts must be compatible with Hastelloy C-276, and it should feature a 1/4-18 NPT process connection.",
    },
    {
      label: "Temperature Transmitter",
      text: "We are looking for a high-performance temperature transmitter suitable for a critical process monitoring application. The unit must be compatible with a Pt100 RTD sensor and provide a high degree of accuracy, specifically ±0.10 °C. For integration with our current system, it needs to have a 4-20 mA output signal with HART protocol. The physical installation requires a rugged stainless steel housing and the ability to be pipe-mounted. Most importantly, the transmitter must meet our stringent safety standards, which requires both a SIL 3 certification and an ATEX rating for use in potentially hazardous areas.",
    },
    {
      label: "Humidity Transmitter",
      text: "I am looking for a humidity transmitter with a 0-10V output. The measurement range should be 0-100% RH and it needs to be wall-mountable.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative">
      {/* Debug session indicator - can be removed in production
      {searchSessionId && (
        <div className="text-xs text-gray-500 px-4 py-1 bg-gray-50 border-b">
          Session: {searchSessionId.slice(-8)}
        </div>
      )} */}
      <div className="flex-none py-2 border-b border-white/10 bg-transparent z-20 flex justify-center items-center">
        <div className="flex items-center gap-1">
          <div className="flex items-center justify-center">
            <img
              src="/icon-engenie.png"
              alt="EnGenie"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-[#0f172a]">
            EnGenie
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-no-scrollbar pb-32">
        {messages.length === 0 ? (
          <div className="text-center p-6">
            {/* Empty state */}
          </div>
        ) : (
          messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              isHistory={isHistoryRef.current}
              renderVendorAnalysisStatus={renderVendorAnalysisStatus}
              formatTimestamp={formatTimestamp}
            />
          ))
        )}

        {showThinking && !isStreaming && (
          <div className="flex justify-start">
            <div className={`max-w-[80%] flex items-start space-x-2`}>
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                <img
                  src="/icon-engenie.png"
                  alt="Assistant"
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div className="p-3 rounded-lg">
                <BouncingDots />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {activeDescription && (
        <div
          className="p-4 bg-secondary/30 rounded border border-border text-sm text-muted-foreground max-w-2xl mx-auto mb-4 cursor-pointer hover:bg-secondary/50 transition"
          onClick={() =>
            handleSampleClick(
              sampleInputs.find(({ label }) => label === activeDescription)
                ?.text || ""
            )
          }
        >
          <p>
            {sampleInputs.find(({ label }) => label === activeDescription)?.text}
          </p>
        </div>
      )}

      {/*
      {messages.length === 0 && (
        <div className="flex flex-wrap justify-center items-center gap-2 space-x-2 p-2 border-t border-border bg-background">
          {sampleInputs.map(({ label }) => (
            <Button
              key={label}
              variant={activeDescription === label ? "default" : "outline"}
              onClick={() => handleInteractiveButtonClick(label)}
              className="min-w-[150px]"
              type="button"
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      */}

      <div className="p-4 bg-transparent absolute bottom-0 w-full z-10">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <div className={`relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent hover:scale-[1.02]`}
              style={{
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                WebkitBackdropFilter: 'blur(12px)',
                backdropFilter: 'blur(12px)',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: 'rgba(0, 0, 0, 0.8)'
              }}>
              <textarea
                ref={textareaRef}
                placeholder="Type your message here..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none px-4 py-2.5 pr-12 text-sm resize-none min-h-[40px] max-h-[200px] leading-relaxed flex items-center custom-no-scrollbar"
                style={{
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  boxShadow: 'none',
                  overflowY: 'auto'
                }}
              />

              <div className="absolute bottom-1.5 right-1.5">
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className={`w-8 h-8 p-0 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-transparent ${!inputValue.trim() ? 'text-muted-foreground' : 'text-primary hover:scale-110'}`}
                  variant="ghost"
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
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
    | "awaitOptional"
    | "awaitAdvanced"
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

  const [activeDescription, setActiveDescription] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const prettifyRequirement = (req: string) =>
    req
      .replace(/\_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

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
      case "awaitOptional":
        return "";
      case "awaitAdvanced":
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
    <div className="flex-1 flex flex-col h-full bg-background overflow-auto y">
      {/* Debug session indicator - can be removed in production */}
      {searchSessionId && (
        <div className="text-xs text-gray-500 px-4 py-1 bg-gray-50 border-b">
          Session: {searchSessionId.slice(-8)}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-no-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center p-6">
            {/* Heading removed - now shown in Requirements page */}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] flex items-start space-x-2 ${
                  message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === "user"
                      ? "bg-ai-primary text-white"
                      : "bg-transparent"
                  }`}
                >
                  {message.type === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <img 
                      src="/remove_that_circle_also-removebg-preview.png" 
                      alt="Assistant"
                      className="w-8 h-8 object-contain"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`p-3 rounded-lg break-words ${
                      message.type === "user"
                        ? "bg-ai-primary text-white"
                        : "bg-card border border-border shadow-sm"
                    }`}
                  >
                    <div>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {renderVendorAnalysisStatus(message)}
                  </div>
                  <p
                    className={`text-xs text-muted-foreground mt-1 px-1 ${
                      message.type === "user" ? "text-right" : ""
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && !isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] flex items-start space-x-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-transparent">
                <img 
                  src="/remove_that_circle_also-removebg-preview.png" 
                  alt="Assistant"
                  className="w-8 h-8 object-contain"
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

      <div className="border-t border-border p-4 bg-background">
        <div className="flex space-x-3">
          <Textarea
            ref={textareaRef}
            placeholder={getPlaceholderText()}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[60px] resize-none bg-secondary/50 border-2 border-black focus:border-black focus:ring-0 focus:ring-offset-0 focus:outline-none focus:shadow-none hover:border-black active:border-black [&:focus]:!border-black [&:focus]:!ring-0 [&:focus]:!ring-offset-0 [&:focus]:!shadow-none [&:focus]:!outline-none"
            disabled={currentStep === 'finalAnalysis'}
            style={{ boxShadow: 'none' }}
          />
          <Button
            onClick={handleSend}
            disabled={
              !inputValue.trim() || isLoading || currentStep === "finalAnalysis"
            }
            className={
              "w-14 h-14 p-0 rounded-full flex items-center justify-center bg-ai-primary " +
              "hover:bg-ai-blue active:bg-ai-blue transition-colors duration-200 " +
              "shadow-lg border-2 border-ai-primary/80 " +
              "focus:ring-2 focus:ring-ai-blue focus:outline-none"
            }
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Send className="h-6 w-6 text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
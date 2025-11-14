import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AppState,
  ChatMessage,
  ValidationResult,
  AnalysisResult,
  RequirementSchema,
  WorkflowStep,
  IntentClassificationResult,
  AgentResponse,
  AdvancedParametersResult,
  AdvancedParametersSelection,
} from "./types";
import LeftSidebar from "./LeftSidebar";
import ChatInterface from "./ChatInterface";
import RightPanel from "./RightPanel";
import {
  validateRequirements,
  analyzeProducts,
  getRequirementSchema,
  structureRequirements,
  additionalRequirements,
  generateAgentResponse,
  classifyIntent,
  discoverAdvancedParameters,
  addAdvancedParameters,
  initializeNewSearch,
  clearSessionValidationState,
} from "./api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
 
type ConversationStep = WorkflowStep;
 
const AIRecommender = ({ initialInput, fillParent }: { initialInput?: string; fillParent?: boolean }) => {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
 
  // Generate unique search session ID for this component instance
  const [searchSessionId] = useState(() => {
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[SEARCH_SESSION] Created new AIRecommender with session ID: ${id}`);
    return id;
  });

  // Add session tracking for debugging
  useEffect(() => {
    console.log(`[TAB_SESSION] Tab initialized with session ID: ${searchSessionId}`);
    return () => {
      console.log(`[TAB_SESSION] Tab with session ID ${searchSessionId} is unmounting`);
      // Clean up validation tracker when component unmounts
      clearSessionValidationState(searchSessionId);
    };
  }, [searchSessionId]);
  
  const [collectedData, setCollectedData] = useState<{ [key: string]: any }>({});
  const [advancedParameters, setAdvancedParameters] = useState<AdvancedParametersResult | null>(null);
  const [selectedAdvancedParams, setSelectedAdvancedParams] = useState<{ [key: string]: string }>({});
  const [state, setState] = useState<AppState>({
    messages: [],
    currentProductType: null,
    validationResult: null,
    analysisResult: null,
    requirementSchema: null,
    isLoading: false,
    inputValue: "",
    productType: "",
  });
  const [currentStep, setCurrentStep] = useState<ConversationStep>("greeting");
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
 
  // Layout states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDocked, setIsDocked] = useState(true);
  const [isRightDocked, setIsRightDocked] = useState(true);
  const DEFAULT_DOCKED_WIDTH = 0;
  const DEFAULT_EXPANDED_WIDTH = 16;
  const DEFAULT_RIGHT_DOCKED_WIDTH = 0;
  const DEFAULT_RIGHT_EXPANDED_WIDTH = 46;
  const [widths, setWidths] = useState({ left: DEFAULT_DOCKED_WIDTH, center: 100 - DEFAULT_DOCKED_WIDTH - DEFAULT_RIGHT_DOCKED_WIDTH, right: DEFAULT_RIGHT_DOCKED_WIDTH });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<"left" | "right" | null>(null);
 
  // Update sidebar width when docking state changes
  useEffect(() => {
    const newLeftWidth = isDocked ? DEFAULT_DOCKED_WIDTH : DEFAULT_EXPANDED_WIDTH;
    const newRightWidth = isRightDocked ? DEFAULT_RIGHT_DOCKED_WIDTH : DEFAULT_RIGHT_EXPANDED_WIDTH;
    setWidths({
      left: newLeftWidth,
      center: 100 - newLeftWidth - newRightWidth,
      right: newRightWidth
    });
  }, [isDocked, isRightDocked, DEFAULT_DOCKED_WIDTH, DEFAULT_EXPANDED_WIDTH, DEFAULT_RIGHT_DOCKED_WIDTH, DEFAULT_RIGHT_EXPANDED_WIDTH]);

  // Initialize new search session when component mounts
  useEffect(() => {
    const initializeSearch = async () => {
      try {
        await initializeNewSearch(searchSessionId);
        console.log(`[SEARCH_SESSION] Initialized independent search session: ${searchSessionId}`);
      } catch (error) {
        console.warn(`[SEARCH_SESSION] Failed to initialize search session: ${searchSessionId}`, error);
        // Continue anyway - the backend will handle missing session ID gracefully
      }
    };
    
    initializeSearch();
  }, [searchSessionId]);
 
  // --- Resize functionality ---
  const handleMouseDown = useCallback((e: React.MouseEvent, handle: "left" | "right") => {
    e.preventDefault();
    setDraggingHandle(handle);
   
    const startX = e.clientX;
    const startWidths = { ...widths };
    const containerWidth = containerRef.current?.offsetWidth || 1200;
 
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
     
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
 
      let newWidths;
      if (handle === "left") {
        // Dragging left handle (between sidebar and chat)
        const newLeft = Math.max(7, Math.min(30, startWidths.left + deltaPercent));
        const adjustment = newLeft - startWidths.left;
        newWidths = {
          left: newLeft,
          center: Math.max(10, startWidths.center - adjustment),
          right: startWidths.right
        };
      } else {
        // Dragging right handle (between chat and right panel)
        const newCenter = Math.max(10, Math.min(60, startWidths.center + deltaPercent));
        const adjustment = newCenter - startWidths.center;
        newWidths = {
          left: startWidths.left,
          center: newCenter,
          right: Math.max(10, startWidths.right - adjustment)
        };
      }
 
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
     
      animationFrameRef.current = requestAnimationFrame(() => {
        setWidths(newWidths);
      });
    };
 
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDraggingHandle(null);
     
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
 
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [widths]);
 
  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
 
  // --- Helper functions ---
  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        role: message.role,
        type: message.type,
      };
      setState((prev) => ({ ...prev, messages: [...prev.messages, newMessage] }));
      return newMessage;
    },
    []
  );
 
  const updateMessage = useCallback((id: string, newContent: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === id ? { ...msg, content: newContent } : msg
      ),
    }));
  }, []);
 
  const streamAssistantMessage = useCallback(
    async (fullText: string, delay = 30) => {
      setIsStreaming(true);
      const msg = addMessage({ type: "assistant", content: "", role: undefined });
      let current = "";
      for (let i = 0; i < fullText.length; i++) {
        current += fullText[i];
        updateMessage(msg.id, current);
        await new Promise((res) => setTimeout(res, delay));
      }
      setIsStreaming(false);
      return msg.id;
    },
    [addMessage, updateMessage]
  );
 
  const composeUserDataString = (data: any): string => {
    const parts: string[] = [];
    if (data.productType) parts.push(`Product Type: ${data.productType}`);
    for (const key in data) {
      if (key === "productType") continue;
      const value = data[key];
      if (value != null && value !== "") {
        parts.push(
          typeof value === "object"
            ? Object.entries(value)
                .map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.join(", ")}` : `${k}: ${v}`))
                .join(". ")
            : `${key}: ${value}`
        );
      }
    }
    return parts.join(". ");
  };
 
  const flattenRequirements = (provided: any): { [key: string]: any } => {
    const flat: { [key: string]: any } = {};
    const process = (reqs: any) => {
      if (!reqs) return;
      Object.keys(reqs).forEach((key) => {
        const value = reqs[key];
        if (value !== null && value !== "") flat[key] = value;
      });
    };
    if (provided) {
      process(provided.mandatoryRequirements);
      process(provided.optionalRequirements);
      Object.keys(provided).forEach((key) => {
        if (!["mandatoryRequirements", "optionalRequirements"].includes(key) && !(key in flat)) {
          if (provided[key] !== null && provided[key] !== "") flat[key] = provided[key];
        }
      });
    }
    return flat;
  };
 
  const mergeRequirementsWithSchema = (provided: { [key: string]: any }, schema: RequirementSchema) => {
    const merged: { [key: string]: any } = { ...provided };
    const allKeys = [
      ...(schema.mandatoryRequirements ? Object.keys(schema.mandatoryRequirements) : []),
      ...(schema.optionalRequirements ? Object.keys(schema.optionalRequirements) : []),
    ];
    allKeys.forEach((key) => {
      if (!(key in merged)) merged[key] = "";
    });
    return merged;
  };
 
  // --- Core analysis and summary flow ---
  const performAnalysis = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const fullInputStr = `Product Type: ${state.productType}. ${composeUserDataString(collectedData)}`;
      const analysis: AnalysisResult = await analyzeProducts(fullInputStr);
      const threshold = 80;
      const highScoringProducts = analysis.overallRanking.rankedProducts.filter(
        (p) => p.overallScore >= threshold && p.requirementsMatch === true
      );
      const count = highScoringProducts.length;
 
      const llmResponse = await generateAgentResponse(
        "finalAnalysis",
        { analysisResult: analysis },
        `Analysis complete. Found ${count} matching products.`,
        undefined,
        searchSessionId
      );
      await streamAssistantMessage(llmResponse.content);

      setState((prev) => ({ ...prev, analysisResult: analysis, isLoading: false }));
      setCurrentStep("initialInput");

      toast({ title: "Analysis Complete", description: `Found ${count} matching products.` });
    } catch (error) {
      console.error("Analysis error:", error);
      const llmResponse = await generateAgentResponse(
        "analysisError",
        {},
        "An error occurred during final analysis.",
        undefined,
        searchSessionId
      );
      await streamAssistantMessage(llmResponse.content);
      setState((prev) => ({ ...prev, isLoading: false }));
      setCurrentStep("analysisError");
    }
  }, [collectedData, state.productType, toast, streamAssistantMessage, searchSessionId]);  const handleShowSummaryAndProceed = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const requirementsOnly = (({ productType, ...rest }) => rest)(collectedData);
      const requirementsString = composeUserDataString(requirementsOnly);
      const structuredResponse = await structureRequirements(requirementsString);
      const summaryContent = structuredResponse.structuredRequirements;
 
      const summaryIntro = await generateAgentResponse(
        "showSummary",
        collectedData,
        "Summary of requirements is ready.",
        undefined,
        searchSessionId
      );
      await streamAssistantMessage(summaryIntro.content);
      addMessage({ type: "assistant", content: `\n\n${summaryContent}\n\n`, role: undefined });

      setState((prev) => ({ ...prev, isLoading: false }));
      await performAnalysis();
    } catch (error) {
      console.error("Summary error:", error);
      const llmResponse = await generateAgentResponse(
        "showSummary",
        {},
        "Error generating summary.",
        undefined,
        searchSessionId
      );
      await streamAssistantMessage(llmResponse.content);
      setState((prev) => ({ ...prev, isLoading: false }));
      setCurrentStep("showSummary");
    }
  }, [collectedData, performAnalysis, streamAssistantMessage, addMessage, searchSessionId]);  // --- New workflow-aware message handler ---
  const handleSendMessage = useCallback(
    async (userInput: string) => {
      const trimmedInput = userInput.trim();
      if (!trimmedInput) return;
     
      // Add user message
      addMessage({ type: "user", content: trimmedInput, role: undefined });
      setState((prev) => ({ ...prev, inputValue: "", isLoading: true }));
 
      try {
        // Step 1: Classify user intent (with session ID for isolation)
        const intentResult: IntentClassificationResult = await classifyIntent(trimmedInput, searchSessionId);
        console.log('Intent classification result:', intentResult);
       
        // Handle knowledge questions (interrupts workflow)
        if (intentResult.intent === "knowledgeQuestion") {
          const agentResponse: AgentResponse = await generateAgentResponse(
            currentStep,
            {
              productType: state.productType,
              collectedData: collectedData
            },
            trimmedInput,
            "knowledgeQuestion",
            searchSessionId
          );
         
          await streamAssistantMessage(agentResponse.content);
          setState((prev) => ({ ...prev, isLoading: false }));
          // Keep current step unchanged for workflow resumption
          return;
        }
 
        // Step 2: Handle workflow based on intent and current step
        let targetStep = intentResult.nextStep || currentStep;
        let agentResponse: AgentResponse;
       
        // Force initialInput if user provides product requirements regardless of current step
        if (intentResult.intent === "productRequirements") {
          targetStep = "initialInput";
        }
       
        console.log('Target step:', targetStep);
 
        // Handle direct transition to showSummary from intent classification
        if (targetStep === "showSummary" && currentStep === "awaitAdvanced") {
          // Skip sales-agent API call and go directly to summary
          setCurrentStep("showSummary");
          await handleShowSummaryAndProceed();
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }
 
        switch (targetStep) {
          case "greeting": {
            agentResponse = await generateAgentResponse(
              "greeting",
              {},
              trimmedInput,
              undefined,
              searchSessionId
            );
            await streamAssistantMessage(agentResponse.content);
            setCurrentStep("initialInput");
            break;
          }
 
          case "initialInput": {
            // Process product requirements
            console.log('Processing initialInput - calling validateRequirements with:', trimmedInput);
            try {
              const validation: ValidationResult = await validateRequirements(trimmedInput, undefined, searchSessionId);
              if (!validation.productType) {
                agentResponse = await generateAgentResponse("initialInput", {}, "No product type detected.", undefined, searchSessionId);
                await streamAssistantMessage(agentResponse.content);
                setCurrentStep("initialInput");
                break;
              }
 
              const schema = await getRequirementSchema(validation.productType);
              const flatRequirements = flattenRequirements(validation.providedRequirements);
              const mergedData = mergeRequirementsWithSchema(flatRequirements, schema);
 
              setCollectedData(mergedData);
              setState((prev) => ({
                ...prev,
                requirementSchema: schema,
                productType: validation.productType,
                currentProductType: validation.productType,
                validationResult: validation,
              }));
 
              if (validation.validationAlert) {
                // Ask the user for missing info (LLM will later decide on confirmation)
                await streamAssistantMessage(validation.validationAlert.message);
                setCurrentStep("awaitMissingInfo");
              } else {
                agentResponse = await generateAgentResponse(
                  "initialInput",
                  {
                    productType: validation.productType,
                    requirements: flatRequirements
                  },
                  `Product type detected: ${validation.productType}.`,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);
                // Use LLM nextStep if provided, otherwise fall back to awaitOptional
                if (agentResponse.nextStep) setCurrentStep(agentResponse.nextStep as any);
                else setCurrentStep("awaitOptional");
              }
            } catch (error) {
              console.error("Initial input error:", error);
              agentResponse = await generateAgentResponse("default", {}, "Error during initial processing.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
              setCurrentStep("initialInput");
            }
            break;
          }
 
          case "awaitOptional": {
            // Let LLM decide whether to proceed to summary or continue collecting
            try {
              const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");
 
              // Check if user wants to stop adding requirements
              if (normalizedInput === "no" || normalizedInput === "n" || normalizedInput.includes("proceed") || normalizedInput.includes("ready")) {
                // Let backend handle the transition to advanced parameters
                agentResponse = await generateAgentResponse(
                  "awaitOptional",
                  { productType: state.productType },
                  trimmedInput,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);
               
                if (agentResponse.nextStep === "awaitAdvanced") {
                  setCurrentStep("awaitAdvanced");
                  // Discover parameters in the background for later use
                  const parametersResult = await discoverAdvancedParameters(state.productType!, searchSessionId);
                  setAdvancedParameters(parametersResult);
                 
                  // Call backend again to get the formatted parameter display
                  const advancedResponse = await generateAgentResponse(
                    "awaitAdvanced",
                    {
                      productType: state.productType,
                      availableParameters: [], // Empty to trigger discovery in backend
                    },
                    "show parameters", // Trigger parameter display
                    undefined,
                    searchSessionId
                  );
                  await streamAssistantMessage(advancedResponse.content);
                }
               
                setState((prev) => ({ ...prev, isLoading: false }));
                return;
              }
 
              // User appears to provide more requirements, extract them first
              if (normalizedInput !== "no" && !/^(no|n)$/i.test(trimmedInput)) {
                const fullContextInput = `${composeUserDataString(collectedData)} ${trimmedInput}`;
                const { providedRequirements } = await additionalRequirements(state.productType!, fullContextInput);
                const newFlatRequirements = flattenRequirements(providedRequirements);
                const updatedData = mergeRequirementsWithSchema({ ...collectedData, ...newFlatRequirements }, state.requirementSchema!);
                setCollectedData(updatedData);
 
                // Ask the LLM whether to continue collecting or move to advanced parameters
                agentResponse = await generateAgentResponse(
                  "awaitOptional",
                  { productType: state.productType, updatedData },
                  trimmedInput,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);
 
                if (agentResponse.nextStep === "awaitAdvanced") {
                  // Discover parameters in the background for later use
                  const parametersResult = await discoverAdvancedParameters(state.productType!, searchSessionId);
                  setAdvancedParameters(parametersResult);
                  setCurrentStep("awaitAdvanced");
                 
                  // Call backend again to get the formatted parameter display
                  const advancedResponse = await generateAgentResponse(
                    "awaitAdvanced",
                    {
                      productType: state.productType,
                      availableParameters: [], // Empty to trigger discovery in backend
                    },
                    "show parameters" // Trigger parameter display
                  );
                  await streamAssistantMessage(advancedResponse.content);
                } else if (agentResponse.nextStep) {
                  setCurrentStep(agentResponse.nextStep as any);
                }
              }
            } catch (error) {
              console.error("Additional requirements error:", error);
              agentResponse = await generateAgentResponse("awaitOptional", {}, "Error processing optional requirements.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
              setCurrentStep("awaitOptional");
            }
            setState((prev) => ({ ...prev, isLoading: false }));
            break;
          }
 
          case "awaitAdvanced": {
            try {
              const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");
 
              // Check if user wants to skip advanced parameters
              if (normalizedInput === "no" || normalizedInput === "n" || normalizedInput.includes("skip") || normalizedInput.includes("done")) {
                // Skip intent and sales-agent API calls
                // Go directly to structure requirements and analysis
                setCurrentStep("showSummary");
               
                try {
                  // Structure requirements directly
                  const requirementsOnly = (({ productType, ...rest }) => rest)(collectedData);
                  const requirementsString = composeUserDataString(requirementsOnly);
                  const structuredResponse = await structureRequirements(requirementsString);
                  const summaryContent = structuredResponse.structuredRequirements;
 
                  // Show summary without LLM intro message
                  await streamAssistantMessage("Here's a summary of your requirements:");
                  addMessage({ type: "assistant", content: `\n\n${summaryContent}\n\n`, role: undefined });
                  await streamAssistantMessage("Starting product analysis...");
 
                  // Proceed directly to analysis
                  setState((prev) => ({ ...prev, isLoading: false }));
                  await performAnalysis();
                } catch (error) {
                  console.error("Direct summary error:", error);
                  await streamAssistantMessage("Error generating summary. Please try again.");
                  setState((prev) => ({ ...prev, isLoading: false }));
                  setCurrentStep("showSummary");
                }
                return;
              }
 
              // Handle parameter selection or any other advanced parameters input
              if (advancedParameters) {
                // First add parameters to collection if user specified any
                const selectionResult = await addAdvancedParameters(
                  state.productType!,
                  trimmedInput,
                  advancedParameters.uniqueParameters
                );
 
                if (selectionResult.totalSelected > 0) {
                  // Merge selected advanced parameters with collected data
                  const updatedData = { ...collectedData, ...selectionResult.selectedParameters };
                  setCollectedData(updatedData);
                  setSelectedAdvancedParams({ ...selectedAdvancedParams, ...selectionResult.selectedParameters });
                }
 
                // Let backend generate the response (including parameter list display)
                agentResponse = await generateAgentResponse(
                  "awaitAdvanced",
                  {
                    productType: state.productType,
                    selectedParameters: selectionResult?.selectedParameters || {},
                    totalSelected: selectionResult?.totalSelected || 0,
                    availableParameters: advancedParameters.uniqueParameters
                  },
                  trimmedInput,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);
 
                if (agentResponse.nextStep === "showSummary") {
                  setCurrentStep("showSummary");
                  await handleShowSummaryAndProceed();
                }
              } else {
                // No parameters discovered yet, let backend handle
                agentResponse = await generateAgentResponse(
                  "awaitAdvanced",
                  { productType: state.productType },
                  trimmedInput,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);
              }
            } catch (error) {
              console.error("Advanced parameters error:", error);
              agentResponse = await generateAgentResponse("awaitAdvanced", {}, "Error processing advanced parameters.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
            }
            setState((prev) => ({ ...prev, isLoading: false }));
            break;
          }
 
          case "showSummary": {
            // User is confirming to proceed with analysis after seeing summary
            const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");
            if (["yes", "proceed", "continue", "run", "analyze", "ok"].some(cmd => normalizedInput.includes(cmd))) {
              await performAnalysis();
            }
            break;
          }
         
          case "finalAnalysis": {
            // Handle rerun requests after analysis
            const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");
            if (["rerun", "run", "runagain"].some(cmd => normalizedInput.includes(cmd))) {
              await performAnalysis();
            }
            break;
          }
 
          case "analysisError": {
            const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");
            if (["rerun", "run", "runagain"].includes(normalizedInput)) {
              await performAnalysis();
            } else {
              agentResponse = await generateAgentResponse("analysisError", {}, "Please type 'rerun' to try again.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
            }
            break;
          }
 
          default: {
            // Handle missing info or general conversation
            if (currentStep === "awaitMissingInfo") {
              try {
                // Short-circuit confirmations like "yes", "y", "skip" to allow skipping missing fields
                const shortConfirm = /^(yes|y|skip)$/i.test(trimmedInput);
                if (shortConfirm) {
                  // Let backend and LLM know user chose to skip providing missing mandatory info
                  const confirmationResponse = await generateAgentResponse(
                    "confirmAfterMissingInfo",
                    { productType: state.productType, collectedData },
                    "User confirmed to proceed without providing missing mandatory fields.",
                    undefined,
                    searchSessionId
                  );
                  await streamAssistantMessage(confirmationResponse.content);
                  // Move to optional requirements step
                  setCurrentStep("awaitOptional");
                } else {
                  // User provided additional data - run validation to check if missing fields are satisfied
                  const combinedInput = `${composeUserDataString(collectedData)} ${trimmedInput}`;
                  const newValidation: ValidationResult = await validateRequirements(combinedInput, state.validationResult?.productType, searchSessionId);
                  const newFlatRequirements = flattenRequirements(newValidation.providedRequirements);
                  const updatedData = mergeRequirementsWithSchema({ ...collectedData, ...newFlatRequirements }, state.requirementSchema!);
 
                  // Update collected data with the new information
                  setCollectedData(updatedData);
                  setState((prev) => ({ ...prev, validationResult: newValidation }));
 
                  if (newValidation.validationAlert) {
                    // Still missing some required info
                    await streamAssistantMessage(newValidation.validationAlert.message);
                    setCurrentStep("awaitMissingInfo");
                  } else {
                    // All required info is now provided - let LLM handle confirmation
                    agentResponse = await generateAgentResponse(
                      "confirmAfterMissingInfo",
                      { productType: state.productType, collectedData: updatedData },
                      "All mandatory requirements provided.",
                      undefined,
                      searchSessionId
                    );
                    await streamAssistantMessage(agentResponse.content);
 
                    // Move to awaitOptional step
                    if (agentResponse.nextStep) {
                      setCurrentStep(agentResponse.nextStep as any);
                    } else {
                      setCurrentStep("awaitOptional");
                    }
                  }
                }
              } catch (error) {
                console.error("Missing info processing error:", error);
                agentResponse = await generateAgentResponse("default", {}, "Error processing your input.", undefined, searchSessionId);
                await streamAssistantMessage(agentResponse.content);
              }
            } else {
              // Default conversation handling
              agentResponse = await generateAgentResponse("default", {}, trimmedInput, undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
            }
          }
        }
 
        setState((prev) => ({ ...prev, isLoading: false }));
 
      } catch (error) {
        console.error("Message handling error:", error);
        await streamAssistantMessage("I'm sorry, there was an error processing your message. Please try again.");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [currentStep, collectedData, state.productType, state.validationResult, state.requirementSchema, addMessage, performAnalysis, handleShowSummaryAndProceed, streamAssistantMessage]
  );
 
  const setInputValue = useCallback((value: string) => {
    setState((prev) => ({ ...prev, inputValue: value }));
  }, []);
 
  const handleRetry = useCallback(() => performAnalysis(), [performAnalysis]);
 
  // Handle URL parameters for auto-filling input (but not auto-submitting)
  useEffect(() => {
    // Check for sessionStorage key first (for large inputs from Requirements page)
    const inputKey = searchParams.get('inputKey');
    let inputParam = searchParams.get('input');
    
    if (inputKey) {
      // Retrieve from sessionStorage and clean up
      const storedInput = sessionStorage.getItem(inputKey);
      if (storedInput) {
        inputParam = storedInput;
        sessionStorage.removeItem(inputKey); // Clean up after reading
      }
    }
    
    // Prefer prop-based initial input when provided (for embedded tabs)
    if (!inputParam && initialInput) {
      inputParam = initialInput;
    }

    if (inputParam && !hasAutoSubmitted) {
      // Only set the input value, don't auto-submit - let user decide when to submit
      setState((prev) => ({ ...prev, inputValue: inputParam }));
      setHasAutoSubmitted(true); // Mark as processed to avoid re-setting
    }
  }, [searchParams, hasAutoSubmitted, initialInput]);
 
  return (
    <div
      className={`flex flex-col ${fillParent ? 'h-full' : 'h-screen'} bg-gray-50 dark:bg-zinc-900 text-foreground`}
      ref={containerRef}
    >
      {/* Left corner dock button - positioned below header */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-34 left-4 z-50 bg-background/80 backdrop-blur-sm border shadow-lg hover:bg-background/90"
        onClick={() => setIsDocked(!isDocked)}
        aria-label={isDocked ? "Expand left panel" : "Collapse left panel"}
      >
        {isDocked ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      {/* Right corner dock button - positioned below header */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-35 right-4 z-50 bg-background/80 backdrop-blur-sm border shadow-lg hover:bg-background/90"
        onClick={() => setIsRightDocked(!isRightDocked)}
        aria-label={isRightDocked ? "Expand right panel" : "Collapse right panel"}
      >
        {isRightDocked ? <ChevronLeft /> : <ChevronRight />}
      </Button>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="h-full flex flex-col relative transition-all duration-150 ease-in-out"
          style={{ 
            width: `${widths.left}%`, 
            minWidth: widths.left === 0 ? "0%" : "7%", 
            willChange: "width",
            overflow: "hidden"
          }}
        >
          <LeftSidebar
            validationResult={state.validationResult}
            requirementSchema={state.requirementSchema}
            currentProductType={state.currentProductType}
            collectedData={collectedData}
            logout={logout}
            isDocked={isDocked}
            setIsDocked={setIsDocked}
            hideProfile={true}
          />
        </div>
 
        {widths.left > 0 && (
          <div
            className={`w-1.5 cursor-col-resize transition-colors duration-150 ease-in-out ${
              draggingHandle === "left"
                ? "bg-blue-500"
                : "bg-border hover:bg-blue-500"
            }`}
            style={{ height: "100%", zIndex: 20 }}
            onMouseDown={(e) => handleMouseDown(e, "left")}
          />
        )}
 
        <div
          className="h-full transition-all duration-150 ease-in-out overflow-auto flex flex-col"
          style={{ width: `${100 - (widths.left > 0 ? widths.left : 0) - (widths.right > 0 ? widths.right : 0)}%`, minWidth: "10%", willChange: "width" }}
        >
          <ChatInterface
            messages={state.messages}
            onSendMessage={handleSendMessage}
            isLoading={state.isLoading}
            isStreaming={isStreaming}
            inputValue={state.inputValue}
            setInputValue={setInputValue}
            currentStep={currentStep}
            isValidationComplete={!!state.validationResult}
            productType={state.currentProductType}
            collectedData={collectedData}
            vendorAnalysisComplete={!!state.analysisResult}
            onRetry={handleRetry}
            searchSessionId={searchSessionId}
          />
        </div>
 
        {widths.right > 0 && (
          <div
            className={`w-1.5 cursor-col-resize transition-colors duration-150 ease-in-out ${
              draggingHandle === "right"
                ? "bg-blue-500"
                : "bg-border hover:bg-blue-500"
            }`}
            style={{ height: "100%", zIndex: 20 }}
            onMouseDown={(e) => handleMouseDown(e, "right")}
          />
        )}
 
        <div
          className="h-full transition-all duration-150 ease-in-out"
          style={{ 
            width: `${widths.right}%`, 
            minWidth: widths.right === 0 ? "0%" : "7%", 
            willChange: "width",
            overflow: "hidden"
          }}
        >
          <RightPanel
            analysisResult={state.analysisResult}
            productType={""}
            validationResult={undefined}
            requirementSchema={undefined}
            isDocked={isRightDocked}
            setIsDocked={setIsRightDocked}
          />
        </div>
      </div>
    </div>
  );
};
 
export default AIRecommender;
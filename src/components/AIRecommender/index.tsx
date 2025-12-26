
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
  getAnalysisProductImages,
} from "./api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ConversationStep = WorkflowStep;

interface AIRecommenderProps {
  initialInput?: string;
  fillParent?: boolean;
  onStateChange?: (state: {
    messages: ChatMessage[];
    collectedData: { [key: string]: any };
    currentStep: ConversationStep;
    analysisResult: AnalysisResult | null;
    searchSessionId: string;
    // Extended state for complete restoration
    requirementSchema: RequirementSchema | null;
    validationResult: ValidationResult | null;
    currentProductType: string | null;
    inputValue: string;
    advancedParameters: AdvancedParametersResult | null;
    selectedAdvancedParams: { [key: string]: string };
    fieldDescriptions: Record<string, string>;
    pricingData: Record<string, any>;
  }) => void;
  // Props for restoring saved state
  savedMessages?: ChatMessage[];
  savedCollectedData?: { [key: string]: any };
  savedCurrentStep?: ConversationStep;
  savedAnalysisResult?: AnalysisResult | null;
  // Extended saved state
  savedRequirementSchema?: RequirementSchema | null;
  savedValidationResult?: ValidationResult | null;
  savedCurrentProductType?: string | null;
  savedInputValue?: string;
  savedAdvancedParameters?: AdvancedParametersResult | null;
  savedSelectedAdvancedParams?: { [key: string]: string };
  savedFieldDescriptions?: Record<string, string>;
  savedPricingData?: Record<string, any>;
}

const AIRecommender = ({
  initialInput,
  fillParent,
  onStateChange,
  savedMessages,
  savedCollectedData,
  savedCurrentStep,
  savedAnalysisResult,
  savedRequirementSchema,
  savedValidationResult,
  savedCurrentProductType,
  savedInputValue,
  savedAdvancedParameters,
  savedSelectedAdvancedParams,
  savedFieldDescriptions,
  savedPricingData
}: AIRecommenderProps) => {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();

  // State for pricing data from RightPanel
  const [pricingData, setPricingData] = useState<Record<string, any>>(savedPricingData || {});

  // Handle pricing data updates from RightPanel
  const handlePricingDataUpdate = (priceReviewMap: Record<string, any>) => {
    console.log('[PRICING_DATA] Received pricing data update:', Object.keys(priceReviewMap).length, 'products');
    setPricingData(priceReviewMap);
  };

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
  const [fieldDescriptions, setFieldDescriptions] = useState<Record<string, string>>(savedFieldDescriptions || {});
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

  // Track if component has been initialized to prevent continuous re-loading
  const hasInitialized = useRef(false);

  // Initialize with saved state if provided (only once)
  useEffect(() => {
    if (hasInitialized.current) {
      console.log(`[${searchSessionId}] Already initialized, skipping`);
      return;
    }


    if (savedMessages || savedCollectedData || savedCurrentStep || savedAnalysisResult || savedRequirementSchema || savedValidationResult) {
      console.log(`[${searchSessionId}] Restoring saved state...`);

      // Restore saved state
      if (savedMessages && savedMessages.length > 0) {
        console.log(`[${searchSessionId}] Restoring ${savedMessages.length} messages`);
        setState(prev => ({
          ...prev,
          messages: savedMessages
        }));
      }

      if (savedCollectedData) {
        console.log(`[${searchSessionId}] Restoring collected data with ${Object.keys(savedCollectedData).length} keys`);
        setCollectedData(savedCollectedData);
      }

      if (savedCurrentStep) {
        console.log(`[${searchSessionId}] Restoring current step: ${savedCurrentStep}`);
        setCurrentStep(savedCurrentStep);
      }

      if (savedAnalysisResult) {
        console.log(`[${searchSessionId}] Restoring analysis result`);
        setState(prev => ({
          ...prev,
          analysisResult: savedAnalysisResult
        }));
      }

      // Restore extended state
      if (savedRequirementSchema) {
        console.log(`[${searchSessionId}] Restoring requirement schema`);
        setState(prev => ({
          ...prev,
          requirementSchema: savedRequirementSchema
        }));
      }

      if (savedValidationResult) {
        console.log(`[${searchSessionId}] Restoring validation result`);
        setState(prev => ({
          ...prev,
          validationResult: savedValidationResult,
          currentProductType: savedCurrentProductType,
          productType: savedCurrentProductType || prev.productType
        }));
      }

      // Determine input value: prefer saved draft if provided, otherwise fall back to initial input.
      // This ensures when users were mid-chat and saved a draft input, it is restored on load.
      const hasMessages = savedMessages && savedMessages.length > 0;
      // If conversation already has messages (i.e., the search was run), leave input empty.
      // Otherwise show saved draft or initial input so user can submit it.
      const inputValueToSet = hasMessages ? '' : (savedInputValue ?? initialInput ?? '');

      console.log(`[${searchSessionId}] Setting input value on restore: hasMessages=${hasMessages}, value="${inputValueToSet}"`);
      setState(prev => ({ ...prev, inputValue: inputValueToSet }));
      // Mark auto-fill as handled so other effects don't overwrite this restored input
      setHasAutoSubmitted(true);

      if (savedAdvancedParameters) {
        console.log(`[${searchSessionId}] Restoring advanced parameters`);
        setAdvancedParameters(savedAdvancedParameters);
      }

      if (savedSelectedAdvancedParams) {
        console.log(`[${searchSessionId}] Restoring selected advanced params`);
        setSelectedAdvancedParams(savedSelectedAdvancedParams);
      }

      if (savedFieldDescriptions && Object.keys(savedFieldDescriptions).length > 0) {
        console.log(`[${searchSessionId}] Restoring field descriptions:`, Object.keys(savedFieldDescriptions).length, 'fields');
        setFieldDescriptions(savedFieldDescriptions);
      }

      if (savedPricingData && Object.keys(savedPricingData).length > 0) {
        console.log(`[${searchSessionId}] Restoring pricing data:`, Object.keys(savedPricingData).length, 'products');
        setPricingData(savedPricingData);
      }

      // After restoration, trigger state notification to parent
      if (onStateChange) {
        console.log(`[${searchSessionId}] Notifying parent of restored state`);
        const hasMessages = savedMessages && savedMessages.length > 0;
        const inputValueToNotify = hasMessages ? '' : (savedInputValue ?? initialInput ?? '');
        onStateChange({
          messages: savedMessages || [],
          collectedData: savedCollectedData || {},
          currentStep: savedCurrentStep || "greeting",
          analysisResult: savedAnalysisResult || null,
          searchSessionId,
          requirementSchema: savedRequirementSchema || null,
          validationResult: savedValidationResult || null,
          currentProductType: savedCurrentProductType || null,
          inputValue: inputValueToNotify,
          advancedParameters: savedAdvancedParameters || null,
          selectedAdvancedParams: savedSelectedAdvancedParams || {},
          fieldDescriptions: savedFieldDescriptions || {},
          pricingData: savedPricingData || {}
        });
      }
    } else {
      console.log(`[${searchSessionId}] No saved state found, using defaults`);
    }

    // Mark as initialized to prevent re-initialization
    hasInitialized.current = true;
    console.log(`[${searchSessionId}] Initialization complete`);
  }, [savedMessages, savedCollectedData, savedCurrentStep, savedAnalysisResult, savedRequirementSchema, savedValidationResult, savedCurrentProductType, savedInputValue, savedAdvancedParameters, savedSelectedAdvancedParams, savedFieldDescriptions, savedPricingData, searchSessionId, initialInput]);

  // Notify parent component of state changes for project saving
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        messages: state.messages,
        collectedData,
        currentStep,
        analysisResult: state.analysisResult,
        searchSessionId,
        requirementSchema: state.requirementSchema,
        validationResult: state.validationResult,
        currentProductType: state.currentProductType,
        inputValue: state.inputValue,
        advancedParameters,
        selectedAdvancedParams,
        fieldDescriptions,
        pricingData
      });
    }
  }, [state.messages, collectedData, currentStep, state.analysisResult, searchSessionId, state.requirementSchema, state.validationResult, state.currentProductType, state.inputValue, advancedParameters, selectedAdvancedParams, fieldDescriptions, pricingData]);

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

  // Handle field descriptions updates from LeftSidebar
  const handleFieldDescriptionsChange = useCallback((descriptions: Record<string, string>) => {
    console.log(`[${searchSessionId}] Field descriptions updated:`, Object.keys(descriptions).length, 'fields');
    setFieldDescriptions(descriptions);
  }, [searchSessionId]);

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
    async (fullText: string) => {
      // For single-response steps we no longer stream character-by-character.
      // Add the assistant message once with the complete content.
      setIsStreaming(true);
      const msg = addMessage({ type: "assistant", content: fullText, role: undefined });
      // Slight delay to allow UI to reflect loading state briefly
      await new Promise((res) => setTimeout(res, 50));
      setIsStreaming(false);
      return msg.id;
    },
    [addMessage]
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

      // Thresholds for match quality
      // Exact matches: No score threshold - show ALL products where requirementsMatch === true
      // Approximate matches: Minimum score of 50% to ensure reasonable quality
      const APPROXIMATE_THRESHOLD = 50;

      // Split products into exact and approximate matches
      // Exact matches: ALL products where requirementsMatch === true (no score requirement)
      const exactMatches = analysis.overallRanking.rankedProducts.filter(
        (p) => p.requirementsMatch === true
      );

      // Approximate matches: requirementsMatch === false AND score >= 50%
      const approximateMatches = analysis.overallRanking.rankedProducts.filter(
        (p) => p.requirementsMatch === false && (p.overallScore ?? 0) >= APPROXIMATE_THRESHOLD
      );

      // Fallback logic: use exact if available, otherwise approximate
      const count = exactMatches.length > 0 ? exactMatches.length : approximateMatches.length;
      const displayMode = exactMatches.length > 0 ? 'exact' : 'approximate';

      const message = exactMatches.length > 0
        ? `Found ${exactMatches.length} product${exactMatches.length !== 1 ? 's' : ''} matching all requirements`
        : `No exact matches found. Found ${approximateMatches.length} close alternative${approximateMatches.length !== 1 ? 's' : ''}`;

      // ✅ Fetch images ONLY for products that will be displayed
      // If exact matches exist, fetch only for exact matches
      // If no exact matches, fetch only for approximate matches
      const productsToFetchImagesFor = displayMode === 'exact' ? exactMatches : approximateMatches;

      if (productsToFetchImagesFor.length > 0) {
        try {
          console.log(`[IMAGE_FETCH] Fetching images for ${productsToFetchImagesFor.length} ${displayMode} match products`);

          const imageFetchPromises = productsToFetchImagesFor.map(async (product) => {
            if (!product.vendor || !product.productName) return product;

            try {
              const modelFamilies = product.modelFamily ? [product.modelFamily] : [];
              const imageResult = await getAnalysisProductImages(
                product.vendor,
                state.productType || "",
                product.productName,
                modelFamilies
              );

              // Update product with images and logo
              return {
                ...product,
                topImage: imageResult.topImage,
                vendorLogo: imageResult.vendorLogo,
                allImages: imageResult.allImages || [],
              };
            } catch (error) {
              console.error(`Failed to fetch images for ${product.vendor} - ${product.productName}:`, error);
              return product; // Return product without images if fetch fails
            }
          });

          const productsWithImages = await Promise.all(imageFetchPromises);

          // Update the analysis result with products that have images
          // Replace only the products we fetched images for
          analysis.overallRanking.rankedProducts = analysis.overallRanking.rankedProducts.map(product => {
            const updatedProduct = productsWithImages.find(
              p => p.vendor === product.vendor && p.productName === product.productName
            );
            return updatedProduct || product; // Use updated if found, otherwise keep original
          });

          // Also update vendorMatches if they exist
          if (analysis.vendorAnalysis?.vendorMatches) {
            for (const match of analysis.vendorAnalysis.vendorMatches) {
              const correspondingProduct = productsWithImages.find(
                p => p.vendor === match.vendor && p.productName === match.productName
              );
              if (correspondingProduct) {
                match.topImage = correspondingProduct.topImage;
                match.vendorLogo = correspondingProduct.vendorLogo;
                match.allImages = correspondingProduct.allImages;
              }
            }
          }

          console.log(`[IMAGE_FETCH] Successfully fetched images for ${productsWithImages.length} products`);
        } catch (error) {
          console.error("Error fetching product images:", error);
          // Continue even if image fetching fails
        }
      } else {
        console.log(`[IMAGE_FETCH] No products to fetch images for (displayMode: ${displayMode})`);
      }

      // Show same message for both exact and approximate matches (no warning)
      const contextMessage = `Analysis complete. ${message}.`;

      const llmResponse = await generateAgentResponse(
        "finalAnalysis",
        {
          analysisResult: analysis,
          displayMode
        },
        contextMessage,
        undefined,
        searchSessionId
      );
      await streamAssistantMessage(llmResponse.content);

      setState((prev) => ({ ...prev, analysisResult: analysis, isLoading: false }));
      setCurrentStep("initialInput");
      toast({
        title: "Analysis Complete",
        description: message,
        variant: "default"  // Same variant for both exact and approximate
      });
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
  }, [collectedData, state.productType, toast, streamAssistantMessage, searchSessionId]);

  const handleShowSummaryAndProceed = useCallback(async (options?: { skipIntro?: boolean; introAlreadyStreamed?: boolean; skipAnalysis?: boolean }) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const requirementsOnly = (({ productType, ...rest }) => rest)(collectedData);
      const requirementsString = composeUserDataString(requirementsOnly);
      const structuredResponse = await structureRequirements(requirementsString);
      const summaryContent = structuredResponse.structuredRequirements;

      if (!options?.skipIntro && !options?.introAlreadyStreamed) {
        const summaryIntro = await generateAgentResponse(
          "showSummary",
          collectedData,
          "Summary of requirements is ready.",
          undefined,
          searchSessionId
        );
        await streamAssistantMessage(summaryIntro.content);
      }

      addMessage({ type: "assistant", content: `\n\n${summaryContent}\n\n`, role: undefined });

      // ✅ Always call analysis immediately after structure response
      // Analysis should be called right after structure_requirements response
      await performAnalysis();

      setState((prev) => ({ ...prev, isLoading: false }));
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
  }, [collectedData, performAnalysis, streamAssistantMessage, addMessage, searchSessionId]);

  // --- New workflow-aware message handler ---
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

        // Special case: When intent API identifies nextStep as "showSummary",
        // directly call structure_requirements and then analyze, skipping sales agent response
        if (intentResult.nextStep === "showSummary") {
          setCurrentStep("showSummary");
          setState((prev) => ({ ...prev, isLoading: true }));
          try {
            // Directly call structure_requirements API
            if (!collectedData || Object.keys(collectedData).length === 0) {
              throw new Error("No collected data available for summary");
            }

            const requirementsOnly = (({ productType, ...rest }) => rest)(collectedData);
            const requirementsString = composeUserDataString(requirementsOnly);
            const structuredResponse = await structureRequirements(requirementsString);
            const summaryContent = structuredResponse.structuredRequirements;

            // Display the structured summary
            addMessage({ type: "assistant", content: `\n\n${summaryContent}\n\n`, role: undefined });

            // Directly call analyze API after structure_requirements
            await performAnalysis();

            setState((prev) => ({ ...prev, isLoading: false }));
            return;
          } catch (error) {
            console.error("Error in direct structure and analysis flow:", error);
            setState((prev) => ({ ...prev, isLoading: false }));
            // Fall through to normal flow if error occurs
          }
        }

        // Force initialInput if user provides product requirements, but only when
        // the conversation is starting or in a neutral state. Do NOT force a reset
        // when the user is already in `awaitAdditionalAndLatestSpecs`, `awaitAdvancedSpecs`, or
        // `awaitMissingInfo` — that causes an extra /validate call.
        if (intentResult.intent === "productRequirements") {
          const forceableSteps = ["greeting", "initialInput", "default"];
          if (forceableSteps.includes(currentStep)) {
            targetStep = "initialInput";
          } else {
            // Keep the current step to continue collecting optional/advanced info
            targetStep = currentStep;
          }
        }

        console.log('Target step:', targetStep);

        // Note: Do NOT shortcut to `showSummary` from the client.
        // Let the backend sales-agent workflow decide next steps for awaitAdvancedSpecs.

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
              const validation: ValidationResult = await validateRequirements(trimmedInput, undefined, searchSessionId, currentStep);
              if (!validation.productType) {
                agentResponse = await generateAgentResponse("initialInput", {}, "No product type detected.", undefined, searchSessionId);
                await streamAssistantMessage(agentResponse.content);
                setCurrentStep("initialInput");
                break;
              }

              const schema = await getRequirementSchema(validation.productType);
              const flatRequirements = flattenRequirements(validation.providedRequirements);
              const mergedData = mergeRequirementsWithSchema(flatRequirements, schema);

              if (validation.validationAlert) {
                // Missing mandatory fields - update state and show validation message
                setCollectedData(mergedData);
                setState((prev) => ({
                  ...prev,
                  requirementSchema: schema,
                  productType: validation.productType,
                  currentProductType: validation.productType,
                  validationResult: validation,
                }));
                // Ask the user for missing info (LLM will later decide on confirmation)
                await streamAssistantMessage(validation.validationAlert.message);
                // Undock the sidebar after the response message is streamed
                setIsDocked(false);
                setCurrentStep("awaitMissingInfo");
              } else {
                // All mandatory fields provided - fetch agent response FIRST before updating state
                // This ensures the sidebar undocking and response message appear at the same time
                agentResponse = await generateAgentResponse(
                  "initialInputWithSpecs",
                  {
                    productType: validation.productType,
                    requirements: flatRequirements
                  },
                  `Product type detected: ${validation.productType}. All mandatory requirements provided.`,
                  undefined,
                  searchSessionId
                );

                // Now update state and stream message together
                setCollectedData(mergedData);
                setState((prev) => ({
                  ...prev,
                  requirementSchema: schema,
                  productType: validation.productType,
                  currentProductType: validation.productType,
                  validationResult: validation,
                }));
                // Stream the response message AND undock sidebar at the same time
                await streamAssistantMessage(agentResponse.content);
                setIsDocked(false);

                // Use LLM nextStep if provided, otherwise fall back to awaitAdditionalAndLatestSpecs
                if (agentResponse.nextStep) setCurrentStep(agentResponse.nextStep as any);
                else setCurrentStep("awaitAdditionalAndLatestSpecs");
              }
            } catch (error) {
              console.error("Initial input error:", error);
              agentResponse = await generateAgentResponse("default", {}, "Error during initial processing.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
              setCurrentStep("initialInput");
            }
            break;
          }

          case "awaitAdditionalAndLatestSpecs": {
            // Handle the combined "Additional and Latest Specs" step
            try {
              const normalizedInput = trimmedInput.toLowerCase().trim();
              const isYes = /^(yes|y|yeah|yep|sure|ok|okay)$/i.test(normalizedInput);
              const isNo = /^(no|n|nope|skip)$/i.test(normalizedInput);

              // Always send to backend to handle yes/no logic and state tracking
              agentResponse = await generateAgentResponse(
                "awaitAdditionalAndLatestSpecs",
                { productType: state.productType, collectedData },
                trimmedInput,
                undefined,
                searchSessionId
              );

              // Follow backend's nextStep decision
              if (agentResponse.nextStep) {
                if (agentResponse.nextStep === "awaitAdvancedSpecs") {
                  // User said YES - backend already discovered parameters and formatted the response
                  // Just stream the response which contains the parameters list
                  await streamAssistantMessage(agentResponse.content);
                  setCurrentStep("awaitAdvancedSpecs");
                } else if (agentResponse.nextStep === "showSummary") {
                  // User said "no" - stream the transition message first
                  await streamAssistantMessage(agentResponse.content);
                  setCurrentStep("showSummary");
                  // Then proceed with summary - intro was already streamed
                  await handleShowSummaryAndProceed({ introAlreadyStreamed: true, skipAnalysis: true });
                } else {
                  // Other transitions - stream the message
                  await streamAssistantMessage(agentResponse.content);
                  setCurrentStep(agentResponse.nextStep as any);
                }
              } else {
                // Stay in current step if no nextStep provided - stream the message
                await streamAssistantMessage(agentResponse.content);
                setCurrentStep("awaitAdditionalAndLatestSpecs");
              }
            } catch (error) {
              console.error("Additional and latest specs error:", error);
              agentResponse = await generateAgentResponse("awaitAdditionalAndLatestSpecs", {}, "Error processing additional specifications.", undefined, searchSessionId);
              await streamAssistantMessage(agentResponse.content);
              setCurrentStep("awaitAdditionalAndLatestSpecs");
            }
            setState((prev) => ({ ...prev, isLoading: false }));
            break;
          }

          case "awaitAdvancedSpecs": {
            try {
              // Do not short-circuit skip/summary behavior on the client.
              // Always send the user's input to the backend sales-agent handler
              // and follow the `nextStep` it returns.
              const normalizedInput = trimmedInput.toLowerCase().replace(/\s/g, "");

              if (advancedParameters) {
                // If we already discovered parameters locally, attempt to parse selections
                const selectionResult = await addAdvancedParameters(
                  state.productType!,
                  trimmedInput,
                  advancedParameters.uniqueParameters
                );

                if (selectionResult.totalSelected > 0) {
                  const updatedData = { ...collectedData, ...selectionResult.selectedParameters };
                  setCollectedData(updatedData);
                  setSelectedAdvancedParams({ ...selectedAdvancedParams, ...selectionResult.selectedParameters });
                }

                // Let backend generate the response (including parameter list display)
                agentResponse = await generateAgentResponse(
                  "awaitAdvancedSpecs",
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
                  // If backend returned no assistant content (empty string), it already indicated to proceed
                  const introAlreadyStreamed = !agentResponse.content || agentResponse.content.trim().length === 0;
                  await handleShowSummaryAndProceed({ introAlreadyStreamed });
                } else if (agentResponse.nextStep) {
                  setCurrentStep(agentResponse.nextStep as any);
                }
              } else {
                // No parameters discovered yet, always ask backend what to do next
                agentResponse = await generateAgentResponse(
                  "awaitAdvancedSpecs",
                  { productType: state.productType },
                  trimmedInput,
                  undefined,
                  searchSessionId
                );
                await streamAssistantMessage(agentResponse.content);

                if (agentResponse.nextStep === "showSummary") {
                  setCurrentStep("showSummary");
                  const introAlreadyStreamed = !agentResponse.content || agentResponse.content.trim().length === 0;
                  await handleShowSummaryAndProceed({ introAlreadyStreamed });
                  setState((prev) => ({ ...prev, isLoading: false }));
                  return;
                } else if (agentResponse.nextStep) {
                  setCurrentStep(agentResponse.nextStep as any);
                }
              }
            } catch (error) {
              console.error("Advanced parameters error:", error);
              agentResponse = await generateAgentResponse("awaitAdvancedSpecs", {}, "Error processing advanced parameters.", undefined, searchSessionId);
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
                // Short-circuit confirmations like "yes", "y", "skip", "proceed", "continue" to allow skipping missing fields
                const shortConfirm = /^(yes|y|skip|proceed|continue)$/i.test(trimmedInput);
                // Check for "no" response
                const shortNo = /^(no|n|nope)$/i.test(trimmedInput);

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
                  // Move to additional and latest specs step
                  setCurrentStep("awaitAdditionalAndLatestSpecs");
                } else if (shortNo) {
                  // User said "no" - they want to provide missing fields
                  // Get the missing fields from validation result
                  const missingFields = state.validationResult?.validationAlert?.missingFields || [];
                  const missingFieldsFormatted = missingFields
                    .map((f: string) => f.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()).trim())
                    .join(", ");

                  // Generate a response asking what they want to add
                  const noResponse = await generateAgentResponse(
                    "askForMissingFields",
                    {
                      productType: state.productType,
                      missingFields: missingFieldsFormatted,
                      missingFieldsList: missingFields
                    },
                    `User wants to provide missing fields: ${missingFieldsFormatted}`,
                    undefined,
                    searchSessionId
                  );
                  await streamAssistantMessage(noResponse.content);
                  // Stay at awaitMissingInfo step - loop until user says yes
                  setCurrentStep("awaitMissingInfo");
                } else {
                  // User provided additional data - run validation to check if missing fields are satisfied
                  const combinedInput = `${composeUserDataString(collectedData)} ${trimmedInput}`;
                  const newValidation: ValidationResult = await validateRequirements(combinedInput, state.validationResult?.productType, searchSessionId, currentStep);
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

                    // Move to awaitAdditionalAndLatestSpecs step
                    if (agentResponse.nextStep) {
                      setCurrentStep(agentResponse.nextStep as any);
                    } else {
                      setCurrentStep("awaitAdditionalAndLatestSpecs");
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
      // If a saved conversation already has messages, do not auto-fill the input
      const hasSavedMessages = savedMessages && savedMessages.length > 0;
      if (hasSavedMessages) {
        // Avoid overwriting the restored empty input for previously-run conversations
        console.log(`[${searchSessionId}] Skipping auto-fill from initialInput because saved messages exist`);
      } else {
        // Only set the input value, don't auto-submit - let user decide when to submit
        setState((prev) => ({ ...prev, inputValue: inputParam }));
        setHasAutoSubmitted(true); // Mark as processed to avoid re-setting
      }
    }
  }, [searchParams, hasAutoSubmitted, initialInput, savedMessages, searchSessionId]);

  return (

    <div
      className={`flex flex-col ${fillParent ? 'h-full' : 'h-screen'} text-foreground`}
      ref={containerRef}
    >
      {/* Left corner dock button - positioned below header */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-32 left-0 z-20 btn-glass-secondary border-0 shadow-lg rounded-l-none"
        onClick={() => setIsDocked(!isDocked)}
        aria-label={isDocked ? "Expand left panel" : "Collapse left panel"}
      >
        {isDocked ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      {/* Right corner dock button - positioned below header (raise above panel content) */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-32 right-0 z-50 btn-glass-secondary border-0 shadow-lg rounded-r-none"
        onClick={() => setIsRightDocked(!isRightDocked)}
        aria-label={isRightDocked ? "Expand right panel" : "Collapse right panel"}
      >
        {isRightDocked ? <ChevronLeft /> : <ChevronRight />}
      </Button>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="h-full flex flex-col relative transition-all duration-500 ease-in-out"
          style={{
            width: `${widths.left}%`,
            minWidth: widths.left === 0 ? "0%" : "7%",
            willChange: "width, opacity",
            overflow: "hidden",
            opacity: isDocked ? 0 : 1
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
            fieldDescriptions={fieldDescriptions}
            onFieldDescriptionsChange={handleFieldDescriptionsChange}
          />
        </div>

        {widths.left > 0 && (
          <div
            className={`w-1.5 cursor-col-resize transition-colors duration-500 ease-in-out ${draggingHandle === "left"
              ? "bg-[#5FB3E6]"
              : "bg-border hover:bg-[#5FB3E6]"
              }`}
            style={{ height: "100%", zIndex: 20 }}
            onMouseDown={(e) => handleMouseDown(e, "left")}
          />
        )}

        <div
          className="h-full transition-all duration-500 ease-in-out overflow-auto flex flex-col glass-sidebar"
          style={{ width: `${100 - (widths.left > 0 ? widths.left : 0) - (widths.right > 0 ? widths.right : 0)}%`, minWidth: "5%", willChange: "width" }}
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
            className={`w-1.5 cursor-col-resize transition-colors duration-500 ease-in-out ${draggingHandle === "right"
              ? "bg-[#5FB3E6]"
              : "bg-border hover:bg-[#5FB3E6]"
              }`}
            style={{ height: "100%", zIndex: 20 }}
            onMouseDown={(e) => handleMouseDown(e, "right")}
          />
        )}

        <div
          className="h-full transition-all duration-500 ease-in-out"
          style={{
            width: `${widths.right}%`,
            minWidth: widths.right === 0 ? "0%" : "7%",
            willChange: "width, opacity",
            overflow: "hidden",
            opacity: isRightDocked ? 0 : 1
          }}
        >
          <RightPanel
            analysisResult={state.analysisResult}
            productType={""}
            validationResult={undefined}
            requirementSchema={undefined}
            isDocked={isRightDocked}
            setIsDocked={setIsRightDocked}
            onPricingDataUpdate={handlePricingDataUpdate}
          />
        </div>
      </div>
    </div>
  );
};

export default AIRecommender;

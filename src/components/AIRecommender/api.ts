// api.ts - No changes are necessary here
import axios from "axios";
import {
  ValidationResult,
  AnalysisResult,
  RequirementSchema,
  UserCredentials,
  ChatMessage,
  IntentClassificationResult,
  AgentResponse,
  AdvancedParametersResult,
  AdvancedParametersSelection,
  InstrumentIdentificationResult,
  AnalysisImageResult,
} from "./types";

const BASE_URL = "http://localhost:5000";
axios.defaults.baseURL = BASE_URL;
axios.defaults.withCredentials = true;

interface User {
  username: string;
  name: string;
  email: string;
  // Add other user properties if needed
}

interface Vendor {
  name: string;
  logoUrl: string | null;
}

interface PendingUser {
  id: number;
  username: string;
  email: string;
}

// --- NEW INTERFACES FOR PDF SEARCH ---
interface PdfSearchResult {
  title: string;
  url: string;
  snippet: string;
}
interface PriceReviewResponse {
  productName: string;
  results: Array<{
    price: string | null;
    reviews: number | null;
    source: string | null;
  }>;
}

/**
 * Converts snake_case or kebab-case keys to camelCase recursively.
 */
function convertKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => convertKeysToCamelCase(v));
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
      const camelKey = key.replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace("-", "").replace("_", "")
      );
      acc[camelKey] = convertKeysToCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

/**
 * Normalizes user input by removing backslashes, underscores, and hyphens and converting to lowercase.
 */
function normalizeUserInput(input: string): string {
  return input.replace(/[\\_-]/g, "").toLowerCase();
}

/**
 * Registers a new user (status is set to 'pending' on backend).
 */
export const signup = async (
  credentials: UserCredentials
): Promise<{ message: string }> => {
  try {
    const response = await axios.post(`/register`, credentials);
    return response.data;
  } catch (error: any) {
    console.error("Signup error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Signup failed");
  }
};

/**
 * Logs a user in; will fail if user status is not 'active'.
 */
export const login = async (
  credentials: Omit<UserCredentials, "email">
): Promise<{ message: string; user: User }> => {
  try {
    const response = await axios.post(`/login`, credentials);
    return convertKeysToCamelCase(response.data) as { message: string; user: User };
  } catch (error: any) {
    console.error("Login error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Login failed");
  }
};

/**
 * Logs out the current user.
 */
export const logout = async (): Promise<{ message: string }> => {
  try {
    const response = await axios.post(`/logout`);
    return response.data;
  } catch (error: any) {
    console.error("Logout error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Logout failed");
  }
};

/**
 * Checks if the user is authenticated, returning user info or null if not authenticated.
 */
export const checkAuth = async (): Promise<{ user: User } | null> => {
  try {
    const response = await axios.get(`/user`);
    return convertKeysToCamelCase(response.data) as { user: User };
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      console.log("Authentication check failed: User is not logged in.");
      return null;
    }
    console.error("Unexpected error during authentication check:", error);
    return null;
  }
};

/**
 * Fetches the list of vendors with their logo URLs.
 * @param vendorNames - Array of vendor names from analysis results (optional)
 */
export const getVendors = async (vendorNames?: string[]): Promise<Vendor[]> => {
  try {
    // Build query string with vendor names if provided
    const params = vendorNames && vendorNames.length > 0 
      ? { vendors: vendorNames.join(',') }
      : {};
    
    const response = await axios.get(`/vendors`, { params });
    const vendors = convertKeysToCamelCase(response.data.vendors) as Vendor[];
    return vendors;
  } catch (error: any) {
    console.error("Failed to fetch vendors:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to fetch vendors");
  }
};

/**
 * Fetches the submodel to model series mapping.
 * This is used to map analysis results (submodel names) to images (model series names).
 */
export const getSubmodelMapping = async (): Promise<Record<string, string>> => {
  try {
    const response = await axios.get(`/submodel-mapping`);
    return convertKeysToCamelCase(response.data.mapping) as Record<string, string>;
  } catch (error: any) {
    console.error("Failed to fetch submodel mapping:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to fetch submodel mapping");
  }
};

let hasValidatedOnce = false;
/**
 * Initialize a new search session
 */
export const initializeNewSearch = async (searchSessionId: string): Promise<void> => {
  try {
    await axios.post('/new-search', {
      search_session_id: searchSessionId
    });
    console.log(`[NEW_SEARCH] Initialized search session: ${searchSessionId}`);
  } catch (error: any) {
    console.error("Failed to initialize new search session:", error.response?.data || error.message);
    // Don't throw error - continue with search even if initialization fails
  }
};

/**
 * Validates user input requirements.
 */
export const validateRequirements = async (
  userInput: string,
  productType?: string,
  searchSessionId?: string
): Promise<ValidationResult> => {
  try {
    const normalizedInput = normalizeUserInput(userInput);

    const payload: any = {
      user_input: normalizedInput,
      is_repeat: hasValidatedOnce, // ✅ tell backend if this is a repeat
    };

    if (productType) {
      payload.product_type = productType; // 🚀 Only include if detected
    }

    if (searchSessionId) {
      payload.search_session_id = searchSessionId; // 🚀 Include search session ID for independent searches
    }

    const response = await axios.post(`/validate`, payload);

    hasValidatedOnce = true; // ✅ mark that validation has run at least once

    return convertKeysToCamelCase(response.data) as ValidationResult;
  } catch (error: any) {
    console.error("Validation error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Validation failed");
  }
};



/**
 * Analyzes products based on user input.
 */
export const analyzeProducts = async (
  userInput: string
): Promise<AnalysisResult> => {
  try {
    const normalizedInput = normalizeUserInput(userInput);
    const response = await axios.post(`/analyze`, { user_input: normalizedInput });
    return convertKeysToCamelCase(response.data) as AnalysisResult;
  } catch (error: any) {
    console.error("Analysis error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Analysis failed");
  }
};

/**
 * Gets requirement schema for the given product type.
 */
export const getRequirementSchema = async (
  productType: string
): Promise<RequirementSchema> => {
  try {
    if (!productType || productType.trim() === "") {
      return {
        default: { mandatory: {}, optional: {} },
        mandatoryRequirements: {},
        optionalRequirements: {},
      } as RequirementSchema;
    }
    const response = await axios.get(`/schema`, {
      params: { product_type: productType },
    });
    return convertKeysToCamelCase(response.data) as RequirementSchema;
  } catch (error: any) {
    console.error("Schema fetch error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Schema fetch failed");
  }
};

/**
 * Processes additional requirements and returns explanations.
 */
export const additionalRequirements = async (
  productType: string,
  userInput: string
): Promise<{ explanation: string; providedRequirements: any }> => {
  try {
    const response = await axios.post(`/additional_requirements`, {
      product_type: productType,
      user_input: userInput,
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Additional requirements error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to process additional requirements.");
  }
};

/**
 * Structures the requirements using backend logic.
 */
export const structureRequirements = async (fullInput: string): Promise<any> => {
  try {
    const normalizedInput = normalizeUserInput(fullInput);
    const response = await axios.post(`/structure_requirements`, { full_input: normalizedInput });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Requirement structuring error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Requirement structuring failed");
  }
};

/**
 * Discovers advanced parameters from top vendors for a product type
 */
export const discoverAdvancedParameters = async (productType: string): Promise<any> => {
  try {
    const response = await axios.post(`/api/advanced_parameters`, { 
      product_type: productType 
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Advanced parameters discovery error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to discover advanced parameters");
  }
};

/**
 * Processes user selection of advanced parameters
 */
export const addAdvancedParameters = async (
  productType: string, 
  userInput: string, 
  availableParameters: string[]
): Promise<any> => {
  try {
    const response = await axios.post(`/api/add_advanced_parameters`, {
      product_type: productType,
      user_input: userInput,
      available_parameters: availableParameters
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Add advanced parameters error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to process advanced parameters");
  }
};

/**
 * Fetches a human-readable description for a schema field.
 */
export const getFieldDescription = async (
  field: string,
  productType: string | null
): Promise<{ description: string }> => {
  try {
    const response = await axios.post(`/get_field_description`, { field, product_type: productType });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Field description fetch error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to fetch field description.");
  }
};

/**
 * Fetches the list of users pending approval (admin only).
 */
export const getPendingUsers = async (): Promise<PendingUser[]> => {
  try {
    const response = await axios.get(`/admin/pending_users`);
    const users = convertKeysToCamelCase(response.data.pendingUsers) as PendingUser[];
    return users;
  } catch (error: any) {
    console.error("Failed to fetch pending users:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to fetch pending users");
  }
};

/**
 * Admin approves or rejects a user.
 * @param userId - ID of the user to approve/reject.
 * @param action - "approve" or "reject".
 */
export const approveOrRejectUser = async (
  userId: number,
  action: "approve" | "reject"
): Promise<{ message: string }> => {
  try {
    const response = await axios.post(`/admin/approve_user`, { user_id: userId, action });
    return response.data;
  } catch (error: any) {
    console.error("Failed to update user status:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to update user status");
  }
};


// ====================================================================
// === NEW: LLM Sales Agent API call ===
// ====================================================================

/**
 * Calls the backend LLM agent to generate a conversational response.
 * @param step - The current conversation step (e.g., 'initialInput', 'awaitOptional').
 * @param dataContext - All collected data relevant to the current step.
 * @param userMessage - The user's most recent message.
 * @returns A promise that resolves with the LLM's text response.
 */
/**
 * Classifies user intent and determines next workflow step
 */
export const classifyIntent = async (userInput: string): Promise<IntentClassificationResult> => {
  try {
    const response = await axios.post(`/api/intent`, {
      userInput,
    });
    return response.data;
  } catch (error: any) {
    console.error("Intent classification error:", error.response?.data || error.message);
    // Fallback classification
    return {
      intent: "other",
      nextStep: null,
      resumeWorkflow: false
    };
  }
};

/**
 * Generates agent response based on workflow step with enhanced response structure
 */
export const generateAgentResponse = async (
  step: string,
  dataContext: any,
  userMessage: string,
  intent?: string
): Promise<AgentResponse> => {
  try {
    const response = await axios.post(`/api/sales-agent`, {
      step,
      dataContext,
      userMessage,
      intent,
    });
    
    // Return the enhanced response structure
    return {
      content: response.data.content,
      nextStep: response.data.nextStep,
      maintainWorkflow: response.data.maintainWorkflow
    };
  } catch (error: any) {
    console.error("LLM agent response error:", error.response?.data || error.message);
    return {
      content: "I'm having trouble connecting to my brain right now. Please try again in a moment.",
      nextStep: null
    };
  }
};

export const uploadPdfFile = async (file: File): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("File upload error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "File upload failed");
  }
};


// ====================================================================
// === UPDATES FOR PDF SEARCH, VIEW, AND URL UPLOAD ===
// ====================================================================

/**
 * Searches for PDF files based on a user query.
 * @param query The search term.
 * @returns A promise that resolves with a list of search results.
 */
export const searchPdfs = async (query: string): Promise<PdfSearchResult[]> => {
  try {
    const response = await axios.get(`/api/search_pdfs`, { params: { query } });
    const results = convertKeysToCamelCase(response.data.results) as PdfSearchResult[];
    return results;
  } catch (error: any) {
    console.error("PDF search error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "PDF search failed");
  }
};

/**
 * Returns the URL to view a PDF. The backend handles the file serving.
 * The client-side code should open this URL in a new tab or iframe.
 * @param pdfUrl The URL of the PDF to view.
 * @returns The backend endpoint URL to view the PDF.
 */
export const viewPdf = (pdfUrl: string): string => {
  // Use encodeURIComponent to ensure the URL is safe for a query parameter
  return `${BASE_URL}/api/view_pdf?url=${encodeURIComponent(pdfUrl)}`;
};

/**
 * Uploads a PDF to the backend for analysis by providing its URL.
 * @param url The URL of the PDF file.
 * @returns A promise that resolves with the analysis result.
 */
export const uploadPdfFromUrl = async (url: string): Promise<any> => {
  try {
    const response = await axios.post(`/api/upload_pdf_from_url`, { url });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("URL-based PDF upload error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "URL-based PDF upload failed");
  }
};


/**
 * Fetches price and reviews dynamically from the backend for a given product.
 * @param productName - Name of the product.
 * @returns An object with an array of results, each containing price, reviews, and source.
 */
export const getProductPriceReview = async (
  productName: string
): Promise<PriceReviewResponse> => {
  try {
    if (!productName) {
      throw new Error("productName is required");
    }

    const params: Record<string, string> = { productName };

    const response = await axios.get("/api/get-price-review", { params });

    // The backend now returns a structured object with a 'results' array.
    // The response data matches the PriceReviewResponse interface.
    return convertKeysToCamelCase(response.data) as PriceReviewResponse;

  } catch (error: any) {
    console.error(
      `Failed to fetch price/review for product ${productName}:`,
      error.response?.data || error.message
    );
    // Return a default object with an empty results array on failure.
    return { productName: productName, results: [] };
  }
};

// --- NEW: Function to handle analysis feedback ---

/**
 * Submits user feedback (thumbs up/down and a comment) and gets an LLM-generated response.
 * @param feedbackType - 'positive' for thumbs up, 'negative' for thumbs down. Can be null if only a comment is provided.
 * @param comment - Optional text feedback from the user.
 * @returns A promise that resolves with the LLM's response string.
 */
export const submitFeedback = async (
  feedbackType: "positive" | "negative" | null,
  comment?: string
): Promise<string> => {
  try {
    const response = await axios.post("/api/feedback", {
      feedbackType,
      comment: comment || "",
    });
    // The backend returns a JSON object with a 'response' field.
    return response.data.response;
  } catch (error: any) {
    console.error(
      "Failed to submit feedback:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error || "Submitting feedback failed"
    );
  }
};

// ====================================================================
// === NEW: PRIMARY CONVERSATION API CALL ===
// ====================================================================

/**
 * Sends the user's message to the central agent endpoint and gets a response.
 * This single function replaces the old validate, analyze, and sales-agent calls.
 * @param message The user's current message.
 * @param chatHistory The entire conversation history for context.
 * @returns A promise that resolves with the agent's string response.
 */
export const postConversationTurn = async (
  message: string,
  chatHistory: ChatMessage[]
): Promise<string> => {
  try {
    const response = await axios.post(`/api/conversation-turn`, {
      message,
      // Note: The backend uses the Flask session for secure state,
      // but sending history can be useful for stateless backends or context.
      history: chatHistory,
    });
    // The new backend endpoint returns a JSON object with a 'response' field.
    return response.data.response;
  } catch (error: any) {
    console.error("Conversation turn error:", error.response?.data || error.message);
    return "Sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
};

/**
 * Identifies instruments from user requirements using LLM
 * @param requirements User's requirements text
 * @returns A promise that resolves with identified instruments
 */
export const identifyInstruments = async (
  requirements: string
): Promise<InstrumentIdentificationResult> => {
  try {
    const response = await axios.post(`/api/identify-instruments`, {
      requirements,
    });
    return convertKeysToCamelCase(response.data) as InstrumentIdentificationResult;
  } catch (error: any) {
    console.error("Instrument identification error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to identify instruments");
  }
};

/**
 * Gets images for specific analysis products with vendor logo
 * @param vendor Vendor name (e.g. "Emerson")
 * @param productType Product type (e.g. "Flow Transmitter") 
 * @param productName Product name (e.g. "Rosemount 3051")
 * @param modelFamilies Array of model families (e.g. ["3051C", "3051S"])
 * @returns A promise that resolves with analysis image result containing top image, vendor logo, and all images
 */
export const getAnalysisProductImages = async (
  vendor: string,
  productType: string,
  productName: string,
  modelFamilies: string[]
): Promise<AnalysisImageResult> => {
  try {
    const response = await axios.post(`/api/get_analysis_product_images`, {
      vendor,
      product_type: productType,
      product_name: productName,
      model_families: modelFamilies
    });
    return convertKeysToCamelCase(response.data) as AnalysisImageResult;
  } catch (error: any) {
    console.error("Analysis image fetch error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to fetch analysis images");
  }
};


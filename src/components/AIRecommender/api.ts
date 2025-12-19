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

export const BASE_URL = "http://localhost:5000";
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
 * Updates the user's profile (first name, last name, username).
 */
export const updateProfile = async (
  data: { first_name?: string; last_name?: string; username?: string }
): Promise<any> => {
  try {
    const response = await axios.post(`/api/update_profile`, data);
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Profile update error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Profile update failed");
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

// Track if validation has been called at least once per session to help backend
const validationTracker = new Map<string, boolean>();

/**
 * Initialize a new search session
 */
export const initializeNewSearch = async (searchSessionId: string): Promise<void> => {
  try {
    // Clear validation tracker for fresh start
    validationTracker.set(searchSessionId, false);

    await axios.post('/new-search', {
      search_session_id: searchSessionId,
      reset: true
    });
    console.log(`[NEW_SEARCH] Initialized search session: ${searchSessionId}`);
  } catch (error: any) {
    console.error("Failed to initialize new search session:", error.response?.data || error.message);
    // Don't throw error - continue with search even if initialization fails
  }
};

/**
 * Clean up validation tracker for a session (call when tab closes)
 */
export const clearSessionValidationState = (searchSessionId: string): void => {
  validationTracker.delete(searchSessionId);
};

/**
 * Validates user input requirements.
 */
export const validateRequirements = async (
  userInput: string,
  productType?: string,
  searchSessionId?: string,
  currentStep?: string // ✅ Add current step to determine if this is a repeat validation
): Promise<ValidationResult> => {
  try {
    const normalizedInput = normalizeUserInput(userInput);

    // Check if this session has validated before
    const sessionId = searchSessionId || 'default';
    const hasSessionValidated = validationTracker.get(sessionId) || false;

    // ✅ If user is in awaitMissingInfo step, it means they've already seen the validation alert once
    // So this is a repeat validation and is_repeat should be true
    const isRepeat = hasSessionValidated || currentStep === "awaitMissingInfo";

    const payload: any = {
      user_input: normalizedInput,
      is_repeat: isRepeat, // ✅ tell backend if this is a repeat validation
      reset: false, // By default do not reset session state on validation
    };

    if (productType) {
      payload.product_type = productType; // 🚀 Only include if detected
    }

    if (searchSessionId) {
      payload.search_session_id = searchSessionId; // 🚀 Include search session ID for independent searches
    }

    const response = await axios.post(`/validate`, payload);

    validationTracker.set(sessionId, true); // ✅ mark that this session has validated at least once

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
    // Send the full, un-normalized userInput to /analyze so the analysis LLM
    // receives complete context (numbers, units, and punctuation) needed
    // for accurate product type detection and requirement matching.
    const response = await axios.post(`/analyze`, { user_input: userInput });
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
export const discoverAdvancedParameters = async (productType: string, searchSessionId?: string): Promise<any> => {
  try {
    const payload: any = {
      product_type: productType
    };

    if (searchSessionId) {
      payload.search_session_id = searchSessionId;
    }

    const response = await axios.post(`/api/advanced_parameters`, payload);
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
export const classifyIntent = async (userInput: string, searchSessionId?: string): Promise<IntentClassificationResult> => {
  try {
    const payload: any = {
      userInput,
    };

    if (searchSessionId) {
      payload.search_session_id = searchSessionId;
    }

    const response = await axios.post(`/api/intent`, payload);
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
  intent?: string,
  searchSessionId?: string
): Promise<AgentResponse> => {
  try {
    const payload: any = {
      step,
      dataContext,
      userMessage,
      intent,
    };

    // Include session ID if provided
    if (searchSessionId) {
      payload.search_session_id = searchSessionId;
      console.log(`[SESSION_${searchSessionId}] Generating agent response for step: ${step}`);
    }

    const response = await axios.post(`/api/sales-agent`, payload);

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
  comment?: string,
  projectId?: string
): Promise<string> => {
  try {
    const body: any = { feedbackType, comment: comment || "" };
    if (projectId) body.projectId = projectId;

    const response = await axios.post("/api/feedback", body);
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

/**
 * Searches for vendors based on instrument/accessory details
 * @param category Instrument category
 * @param productName Product name or accessory name  
 * @param strategy Procurement strategy (optional)
 * @returns A promise that resolves with vendor search results
 */
export const searchVendors = async (
  category: string,
  productName: string,
  strategy?: string
): Promise<any> => {
  try {
    const response = await axios.post(`/api/search-vendors`, {
      category,
      product_name: productName,
      strategy: strategy || ""
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Vendor search error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to search vendors");
  }
};

// ==================== STRATEGY DOCUMENT API FUNCTIONS ====================

/**
 * Strategy document interface
 */
export interface StrategyDocument {
  _id?: string;
  userId?: string;
  vendorId: string;
  vendorName: string;
  category: string;
  subcategory: string;
  strategy: string;
  refinery: string;
  additionalComments: string;
  ownerName: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

/**
 * Get all strategy documents for the current user
 * @param category Optional category filter
 * @returns A promise that resolves with the list of strategy documents
 */
export const getStrategyDocuments = async (category?: string): Promise<{
  success: boolean;
  documents: StrategyDocument[];
  totalCount: number;
}> => {
  try {
    const params = category ? { category } : {};
    const response = await axios.get(`/api/strategy-documents`, { params });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Get strategy documents error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to get strategy documents");
  }
};

/**
 * Upload a single strategy document
 * @param document Strategy document data
 * @returns A promise that resolves with the created document ID
 */
export const uploadStrategyDocument = async (document: Partial<StrategyDocument>): Promise<{
  success: boolean;
  documentId: string;
  message: string;
}> => {
  try {
    const response = await axios.post(`/api/strategy-documents`, {
      vendor_id: document.vendorId,
      vendor_name: document.vendorName,
      category: document.category,
      subcategory: document.subcategory,
      strategy: document.strategy,
      refinery: document.refinery,
      additional_comments: document.additionalComments,
      owner_name: document.ownerName
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Upload strategy document error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to upload strategy document");
  }
};

/**
 * Bulk upload strategy documents from a CSV file
 * @param file CSV file containing strategy documents
 * @returns A promise that resolves with upload results
 */
export const bulkUploadStrategyDocuments = async (file: File): Promise<{
  success: boolean;
  uploadedCount: number;
  documentIds: string[];
  message: string;
}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`/api/strategy-documents/bulk`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Bulk upload strategy documents error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to bulk upload strategy documents");
  }
};

/**
 * Delete all strategy documents for the current user
 * @returns A promise that resolves with delete results
 */
export const deleteAllStrategyDocuments = async (): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> => {
  try {
    const response = await axios.delete(`/api/strategy-documents`);
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Delete strategy documents error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to delete strategy documents");
  }
};

/**
 * Import strategy documents from the default CSV file on the server
 * @returns A promise that resolves with import results
 */
export const importDefaultStrategyDocuments = async (): Promise<{
  success: boolean;
  uploadedCount: number;
  message: string;
}> => {
  try {
    const response = await axios.post(`/api/strategy-documents/import-default`);
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Import default strategy documents error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to import default strategy documents");
  }
};

/**
 * Strategy file extraction result interface
 */
export interface StrategyFileUploadResult {
  success: boolean;
  message: string;
  documentId?: string;
  filename?: string;
  fileType?: string;
  entryCount?: number;
  extractedData?: Array<{
    vendorName: string;
    category: string;
    subcategory: string;
    stratergy: string;
  }>;
  error?: string;
  extractedTextPreview?: string;
}

/**
 * Upload a strategy file (PDF, DOCX, TXT, Images) and extract structured strategy data using Gemini 2.5 Flash
 * 
 * This function accepts any supported file format and sends it to the backend where:
 * 1. Text is extracted from the file (PDF, DOCX, images via OCR, etc.)
 * 2. Gemini 2.5 Flash LLM analyzes the text to extract structured strategy data
 * 3. The extracted data is stored in MongoDB
 * 
 * @param file The file to upload (PDF, DOCX, TXT, JPG, PNG, etc.)
 * @returns A promise that resolves with the extraction results including extracted strategy data
 */
export const uploadStrategyFile = async (file: File): Promise<StrategyFileUploadResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`/api/upload-strategy-file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return convertKeysToCamelCase(response.data);
  } catch (error: any) {
    console.error("Strategy file upload error:", error.response?.data || error.message);

    // Return a structured error response
    return {
      success: false,
      message: error.response?.data?.error || "Failed to upload and process strategy file",
      error: error.response?.data?.error || error.message,
      extractedTextPreview: error.response?.data?.extracted_text_preview
    };
  }
};
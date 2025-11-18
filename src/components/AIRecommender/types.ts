export interface ChatMessage {
  role: any;
  id: string;
  type: "user" | "assistant" | "feedback";
  content: string;
  timestamp: Date;
  metadata?: {
    productType?: string;
    validationResult?: ValidationResult;
    analysisResult?: AnalysisResult;
    examplePrompt?: string;
    vendorAnalysisComplete?: boolean;
    requirementSchema?: RequirementSchema | null;
  };
}

export interface ValidationResult {
  validationAlert: any;
  isComplete: boolean;
  detectedSchema?: Record<string, any>;
  providedRequirements: Record<string, any>;
  productType: string;
}
export interface StructuredRequirements {
  [requirement: string]: string | number | boolean | null;
}

export interface ProductMatch {
  productName: string;
  vendor: string;
  matchScore: number;
  requirementsMatch: boolean;
  reasoning: string;
  limitations: string;
  imageUrl?: string; // ✅ Product image URL for vendorMatches
  // New fields for enhanced image support
  topImage?: ProductImage;
  vendorLogo?: VendorLogo;
  allImages?: ProductImage[];
}

export interface VendorAnalysis {
  vendorMatches: ProductMatch[];
}

// ADD imageUrl HERE:
export interface RankedProduct {
  modelFamily: any;
  productType: string;
  rank: number;
  productName: string;
  vendor: string;
  overallScore: number;
  keyStrengths: string;
  concerns: string;
  requirementsMatch: boolean;
  imageUrl?: string; // ✅ Product image URL for rankedProducts
  // New fields for enhanced image support
  topImage?: ProductImage;
  vendorLogo?: VendorLogo;
  allImages?: ProductImage[];
}

export interface AnalysisResult {
  productType: string;
  vendorAnalysis: VendorAnalysis;
  overallRanking: {
    markdownAnalysis: any;
    rankedProducts: RankedProduct[];
  };
}

export interface RequirementSchema {
  [productType: string]: {
    mandatory?: Record<string, string>;
    optional?: Record<string, string>;
  } | Record<string, string>;
  mandatoryRequirements?: Record<string, any>; // camelCase keys as per backend
  optionalRequirements?: Record<string, any>; // camelCase keys as per backend
}

export interface AppState {
  messages: ChatMessage[];
  currentProductType: string | null;
  validationResult: ValidationResult | null;
  analysisResult: AnalysisResult | null;
  requirementSchema: RequirementSchema | null;
  isLoading: boolean;
  inputValue: string;
  productType?: string;
}

export interface UserCredentials {
  username: string;
  email: string;
  password: string;
}

// New types for step-based workflow
export interface IntentClassificationResult {
  intent: "greeting" | "knowledgeQuestion" | "productRequirements" | "workflow" | "chitchat" | "other";
  nextStep: "greeting" | "initialInput" | "awaitAdditionalAndLatestSpecs" | "awaitAdvancedSpecs" | "showSummary" | "finalAnalysis" | null;
  resumeWorkflow?: boolean;
}

export interface AgentResponse {
  content: string;
  nextStep?: string | null;
  maintainWorkflow?: boolean;
}

export type WorkflowStep = 
  | "greeting"
  | "initialInput" 
  | "awaitMissingInfo"
  | "awaitAdditionalAndLatestSpecs"
  | "awaitAdvancedSpecs"
  | "confirmAfterMissingInfo"
  | "showSummary" 
  | "finalAnalysis" 
  | "analysisError"
  | "default";

// Advanced Parameters types
export interface AdvancedParameter {
  name: string;
  value?: string;
  selected?: boolean;
}

export interface VendorParametersResult {
  vendor: string;
  parameters: string[];
  sourceUrl: string;
}

export interface AdvancedParametersResult {
  productType: string;
  vendorParameters: VendorParametersResult[];
  uniqueParameters: string[];
  totalVendorsSearched: number;
  totalUniqueParameters: number;
  fallback?: boolean;
}

export interface AdvancedParametersSelection {
  selectedParameters: Record<string, string>;
  explanation: string;
  friendlyResponse: string;
  totalSelected: number;
}

// Instrument Identification types
export interface IdentifiedInstrument {
  category: string;
  quantity?: number;
  productName: string;
  specifications: Record<string, string>;
  sampleInput: string;
}

export interface IdentifiedAccessory {
  category: string;
  quantity?: number;
  accessoryName: string;
  specifications: Record<string, string>;
  sampleInput: string;
}

export interface InstrumentIdentificationResult {
  projectName?: string;
  instruments: IdentifiedInstrument[];
  accessories?: IdentifiedAccessory[];
  summary: string;
}

// New interfaces for image API integration
export interface ProductImage {
  url: string;
  title: string;
  source: "google_cse" | "serpapi" | "serper";
  thumbnail: string;
  domain: string;
  searchType?: string;
  searchPriority?: number;
  relevanceScore?: number;
}

export interface VendorLogo {
  url: string;
  thumbnail: string;
  source: string;
  title?: string;
  domain?: string;
}

export interface AnalysisImageResult {
  vendor: string;
  productType: string;
  productName: string;
  modelFamilies: string[];
  topImage: ProductImage | null;
  vendorLogo: VendorLogo | null;
  allImages: ProductImage[];
  totalFound: number;
  uniqueCount: number;
  bestCount: number;
  searchSummary: {
    searchesPerformed: number;
    searchTypes: string[];
    sourcesUsed: string[];
  };
}

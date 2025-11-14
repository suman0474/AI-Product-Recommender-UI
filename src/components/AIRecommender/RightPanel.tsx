import React, { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisResult, RequirementSchema, ValidationResult, AnalysisImageResult, ProductImage, VendorLogo } from "./types";
import { getVendors, getProductPriceReview, submitFeedback as submitFeedbackApi, getSubmodelMapping, getAnalysisProductImages, BASE_URL } from "./api";
import { Trophy, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import "./ImageComponents.css";

// Type that allows images to be either objects or strings
type VendorImage = { fileName: string; url: string; productKey?: string } | string;
type VendorInfo = { name: string; logoUrl: string | null; images: VendorImage[] };

// Image Gallery Component
interface ImageGalleryProps {
  images: ProductImage[];
  isOpen: boolean;
  onClose: () => void;
  productName: string;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, isOpen, onClose, productName }) => {
  if (!isOpen) return null;

  // Helper function for quality badges
  const getQualityBadge = (source: string) => {
    switch (source) {
      case 'google_cse': return '🟢 Official';
      case 'serpapi': return '🟡 Verified';
      case 'serper': return '🟠 General';
      default: return '⚫ Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-6xl max-h-[90vh] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{productName} - All Images</h3>
          <button 
            onClick={onClose}
            className="text-2xl font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 max-h-[70vh] overflow-y-auto">
          {images.map((image, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
              <img 
                src={image.url} 
                alt={image.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{image.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">{getQualityBadge(image.source)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{image.domain}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export type RightPanelProps = {
  productType?: string;
  analysisResult: AnalysisResult;
  validationResult?: ValidationResult;
  requirementSchema?: RequirementSchema;
  isDocked: boolean;
  setIsDocked: React.Dispatch<React.SetStateAction<boolean>>;
};

// PriceReviewResult now includes the 'link' name as nullable
interface PriceReviewResult {
  link: string | null;
  price: string | null;
  reviews: number | null;
  source: string | null;
}

interface PriceReview {
  results: PriceReviewResult[];
}

const RightPanel: React.FC<RightPanelProps> = ({
  productType,
  analysisResult,
  validationResult,
  requirementSchema,
  isDocked,
  setIsDocked,
}) => {
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [priceReviewMap, setPriceReviewMap] = useState<Record<string, PriceReview>>({});
  const [submodelMapping, setSubmodelMapping] = useState<Record<string, string>>({});
  // New state for analysis images
  const [analysisImages, setAnalysisImages] = useState<Record<string, AnalysisImageResult>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [imageGalleryOpen, setImageGalleryOpen] = useState<{ images: ProductImage[]; productName: string } | null>(null);
  const hasAutoUndocked = useRef(false);
  const { toast } = useToast();

  type FeedbackType = "positive" | "negative" | null;
  interface FeedbackEntry {
    type: FeedbackType;
    comment: string;
    loading: boolean;
    submitted: boolean;
    response?: string;
  }
  const [feedbackState, setFeedbackState] = useState<Record<string, FeedbackEntry>>({});

  const getProductKey = (vendor: string, productName: string) => `${vendor}-${productName}`;

  // Function to fetch images for analysis results
  const fetchAnalysisImages = React.useCallback(async (
    vendor: string,
    productType: string,
    productName: string,
    modelFamilies: string[]
  ) => {
    const key = `${vendor}-${productName}`;
    if (analysisImages[key] || loadingImages[key]) return;

    setLoadingImages(prev => ({ ...prev, [key]: true }));
    
    try {
      const imageResult = await getAnalysisProductImages(vendor, productType, productName, modelFamilies);
      setAnalysisImages(prev => ({ ...prev, [key]: imageResult }));
    } catch (error) {
      console.error(`Failed to fetch images for ${vendor} ${productName}:`, error);
    } finally {
      setLoadingImages(prev => ({ ...prev, [key]: false }));
    }
  }, [analysisImages, loadingImages]);

  const setFeedbackType = (key: string, type: FeedbackType) => {
    setFeedbackState((prev) => ({
      ...prev,
      [key]: { type, comment: prev[key]?.comment ?? "", loading: false, submitted: false, response: undefined },
    }));
  };

  const setFeedbackComment = (key: string, comment: string) => {
    setFeedbackState((prev) => ({
      ...prev,
      [key]: { type: prev[key]?.type ?? null, comment, loading: false, submitted: false, response: undefined },
    }));
  };

  const submitFeedback = async (key: string, vendor: string, productName: string) => {
    const entry = feedbackState[key] ?? { type: null, comment: "", loading: false, submitted: false };
    if (!entry.type && !entry.comment.trim()) {
      toast({ title: "Please provide thumbs up/down or a comment." });
      return;
    }
    setFeedbackState((prev) => ({ ...prev, [key]: { ...entry, loading: true } }));
    try {
      const response = await submitFeedbackApi(entry.type ?? null, `[${vendor} - ${productName}] ${entry.comment ?? ""}`);
      setFeedbackState((prev) => ({ ...prev, [key]: { ...entry, loading: false, submitted: true, response } }));
      toast({ title: "Thanks for your feedback!" });
    } catch (err: any) {
      setFeedbackState((prev) => ({ ...prev, [key]: { ...entry, loading: false } }));
      toast({ title: "Failed to send feedback", description: err?.message ?? "Please try again later." });
    }
  };

  const handleFeedbackKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, key: string, vendor: string, productName: string) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitFeedback(key, vendor, productName);
    }
  };

  useEffect(() => {
    // Only fetch vendors ONCE after analysis is complete with ranked products
    if (!analysisResult?.overallRanking?.rankedProducts || vendors.length > 0) return;
    
    // Extract unique vendor names from analysis results
    const uniqueVendors = Array.from(
      new Set(
        analysisResult.overallRanking.rankedProducts
          .filter((product) => product.requirementsMatch === true)
          .map((product) => product.vendor)
      )
    );
    
    console.log(`✓ Analysis complete - Fetching logos for ${uniqueVendors.length} vendors:`, uniqueVendors);
    
    getVendors(uniqueVendors)
      .then((apiVendors: any[]) => {
        const withImages: VendorInfo[] = apiVendors.map((vendor) => ({
          name: vendor.name,
          logoUrl: vendor.logoUrl ?? null,
          images: vendor.images ?? [],
        }));
        setVendors(withImages);
      })
      .catch((error) => {
        console.error("Error fetching vendors:", error);
        setVendors([]);
      });
  }, [analysisResult, vendors.length]);

  useEffect(() => {
    getSubmodelMapping()
      .then((mapping) => {
        setSubmodelMapping(mapping || {});
      })
      .catch((error) => {
        console.error("Failed to fetch submodel mapping:", error);
        setSubmodelMapping({});
      });
  }, []);

  // Fetch images when analysis results arrive (after analysis completion)
  useEffect(() => {
    if (!analysisResult?.overallRanking?.rankedProducts) return;

    console.log("✓ Analysis complete - Fetching product images now");

    const matchedProducts = analysisResult.overallRanking.rankedProducts.filter(
      (product) => product.requirementsMatch === true
    );

    // Fetch images for each matched product using vendor name, product type, product name, and model families
    matchedProducts.forEach((product) => {
      // Extract model families from product name
      const modelFamilies: string[] = [];
      
      if (product.productName) {
        // Extract model numbers and series from product name
        // Examples: "Rosemount 3051" -> ["3051"], "ST 3000 Series 100" -> ["3000", "100"]
        const modelMatches = product.productName.match(/\d+[A-Z]*/g);
        if (modelMatches) {
          modelFamilies.push(...modelMatches);
        }
        
        // Also include the full product name for better matching
        modelFamilies.push(product.productName);
      }
      
      // Fetch images using vendor name, product type, product name, and extracted model families
      fetchAnalysisImages(
        product.vendor,
        product.productType,
        product.productName,
        modelFamilies
      );
    });
  }, [analysisResult, fetchAnalysisImages]);

  // Auto-undock when analysis data becomes available (only once)
  useEffect(() => {
    if (analysisResult?.vendorAnalysis?.vendorMatches?.length > 0 && isDocked && !hasAutoUndocked.current) {
      setIsDocked(false);
      hasAutoUndocked.current = true;
    }
  }, [analysisResult, isDocked, setIsDocked]);

  useEffect(() => {
    if (!analysisResult?.overallRanking?.rankedProducts) return;

    const matchedProducts = analysisResult.overallRanking.rankedProducts.filter((product) => product.requirementsMatch === true);

    const fetchPromises = matchedProducts.map((product) => {
      const key = `${product.vendor}-${product.productName}`;
      return getProductPriceReview(product.productName)
        .then((data: any) => {
          const normalizedResults: PriceReviewResult[] = (data?.results ?? []).map((r: any) => ({
            price: r.price ?? null,
            reviews: r.reviews ?? null,
            source: r.source ?? null,
            link: r.link ?? null,
          }));

          const sortedResults = normalizedResults.sort((a, b) => {
            const getNumericPrice = (price: string | null) => {
              if (!price) return Infinity;
              const match = price.match(/\d+([.,]\d+)?/);
              return match ? parseFloat(match[0].replace(",", "")) : Infinity;
            };
            return getNumericPrice(a.price) - getNumericPrice(b.price);
          });

          return { key, results: sortedResults };
        })
        .catch(() => ({ key, results: [] }));
    });

    Promise.all(fetchPromises).then((results) => {
      const map: Record<string, PriceReview> = {};
      results.forEach(({ key, results: priceResults }) => {
        map[key] = { results: priceResults as PriceReviewResult[] };
      });
      setPriceReviewMap(map);
    });
  }, [analysisResult]);

  // Enhanced normalization function for better name matching
  const normalizeText = (name: string): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/[\s\-_\.\+\&\(\)\[\]\{\}]/g, "") // Remove spaces, dashes, underscores, dots, plus, ampersand, brackets
      .replace(/[^a-z0-9]/g, "") // Remove any non-alphanumeric characters
      .trim();
  };

  // Create multiple normalized variations of a name for fuzzy matching
  const createNameVariations = (name: string): string[] => {
    const variations = new Set<string>();
    const normalized = normalizeText(name);
    
    // Add the fully normalized version
    variations.add(normalized);
    
    // Add version without numbers
    variations.add(normalized.replace(/[0-9]/g, ""));
    
    // Add version with just letters and first number group
    const firstNumberMatch = name.match(/\d+/);
    if (firstNumberMatch) {
      variations.add(normalizeText(name.split(firstNumberMatch[0])[0] + firstNumberMatch[0]));
    }
    
    // Add first word only
    const firstWord = name.split(/[\s\-_\.]/)[0];
    if (firstWord) {
      variations.add(normalizeText(firstWord));
    }
    
    return Array.from(variations).filter(v => v.length > 0);
  };

  const normalizeVendorName = (name: string) => normalizeText(name);

  const vendorLogoMap = useMemo(() => {
    const out: { [name: string]: string | null } = {};
    vendors.forEach(({ name, logoUrl }) => {
      out[normalizeVendorName(name)] = logoUrl ?? null;
    });
    return out;
  }, [vendors]);

  const productImageMap = useMemo(() => {
    const out: { [vendor: string]: { [product: string]: string } } = {};
    vendors.forEach(({ name, images }) => {
      const vendorKey = normalizeVendorName(name);
      if (!Array.isArray(images)) return;
      if (!out[vendorKey]) out[vendorKey] = {};
      
      images.forEach((img) => {
        // Backend can return either a string URL or an object { fileName, url, productKey }
        const url = typeof img === "string" ? img : (img && img.url) ?? null;
        if (!url) return;

        // If backend provided a productKey explicitly, prefer that (it's already normalized)
        const providedKey = typeof img === "object" && img?.productKey ? img.productKey : null;
        if (providedKey) {
          out[vendorKey][normalizeText(providedKey)] = url;
          return;
        }

        // Extract filename from URL - handle various patterns
        let fileName = "";
        
        // Try different URL patterns
        const patterns = [
          /\/([^\/\?#]+)\.(png|jpg|jpeg|svg|webp)(?:[\?#].*)?$/i, // Standard: /path/filename.ext
          /\/([^\/\?#]+?)(?:\.(png|jpg|jpeg|svg|webp))?(?:[\?#].*)?$/i, // Without extension
          /([^\/\\]+?)\.(png|jpg|jpeg|svg|webp)$/i, // Just filename.ext
        ];
        
        for (const pattern of patterns) {
          const matches = url.match(pattern);
          if (matches) {
            fileName = matches[1];
            break;
          }
        }
        
        if (!fileName) {
          // Last resort: use the last part of the URL
          const urlParts = url.split('/');
          fileName = urlParts[urlParts.length - 1].split('.')[0];
        }
        
        // Decode percent-encoded names
        try {
          fileName = decodeURIComponent(fileName);
        } catch (e) {
          // ignore malformed sequences
        }
        
        // Create multiple variations of the filename for matching
        const nameVariations = createNameVariations(fileName);
        nameVariations.forEach(variation => {
          if (variation) {
            out[vendorKey][variation] = url;
          }
        });
      });
    });
    
    // Optional: Log summary for debugging
    const vendorCount = Object.keys(out).length;
    const totalImages = Object.values(out).reduce((sum, vendor) => sum + Object.keys(vendor).length, 0);
    console.log(`Product image map created: ${vendorCount} vendors, ${totalImages} total product images`);
    
    return out;
  }, [vendors]);

  const getProductImageUrl = (vendor: string, productName: string): string | undefined => {
    const vendorKey = normalizeVendorName(vendor);
    const vendorImages = productImageMap[vendorKey];
    
    if (!vendorImages) {
      console.log(`No images found for vendor: ${vendor} (${vendorKey})`);
      return undefined;
    }
    
    console.log(`Looking for image: vendor="${vendor}" (${vendorKey}), product="${productName}"`);
    console.log(`Available products for ${vendorKey}:`, Object.keys(vendorImages));
    
    // Strategy 1: Try submodel mapping first
    const modelSeriesName = submodelMapping[productName] || productName;
    if (modelSeriesName !== productName) {
      const mappedVariations = createNameVariations(modelSeriesName);
      for (const variation of mappedVariations) {
        if (vendorImages[variation]) {
          console.log(`Found image via submodel mapping: ${variation}`);
          return vendorImages[variation];
        }
      }
    }
    
    // Strategy 2: Try exact product name variations
    const productVariations = createNameVariations(productName);
    for (const variation of productVariations) {
      if (vendorImages[variation]) {
        console.log(`Found image via exact match: ${variation}`);
        return vendorImages[variation];
      }
    }
    
    // Strategy 3: Fuzzy matching - find images that contain the product name or vice versa
    const productNormalized = normalizeText(productName);
    const availableKeys = Object.keys(vendorImages);
    
    // Try partial matches
    for (const imageKey of availableKeys) {
      // Check if image name contains product name
      if (imageKey.includes(productNormalized) || productNormalized.includes(imageKey)) {
        console.log(`Found image via fuzzy match: ${imageKey}`);
        return vendorImages[imageKey];
      }
      
      // Check if any product variation matches any part of the image key
      for (const variation of productVariations) {
        if (variation.length > 2 && (imageKey.includes(variation) || variation.includes(imageKey))) {
          console.log(`Found image via variation fuzzy match: ${imageKey} ~ ${variation}`);
          return vendorImages[imageKey];
        }
      }
    }
    
    // Strategy 4: If still no match, try the first available image for the vendor
    if (availableKeys.length > 0) {
      console.log(`Using first available image for ${vendor}: ${availableKeys[0]}`);
      return vendorImages[availableKeys[0]];
    }
    
    console.log(`No image found for ${vendor}-${productName}`);
    return undefined;
  };

  const requirementsMatchMap = useMemo(() => {
    const map = new Map<string, boolean>();
    analysisResult?.vendorAnalysis?.vendorMatches?.forEach((match) => {
      map.set(`${match.vendor}-${match.productName}`, !!match.requirementsMatch);
    });
    return map;
  }, [analysisResult]);

  const filteredAnalysisResult = analysisResult
    ? {
        ...analysisResult,
        vendorAnalysis: {
          ...analysisResult.vendorAnalysis,
          vendorMatches: (analysisResult.vendorAnalysis?.vendorMatches ?? []).filter((match) => match.requirementsMatch === true),
        },
        overallRanking: {
          ...analysisResult.overallRanking,
          rankedProducts: (analysisResult.overallRanking?.rankedProducts ?? [])
            .filter((product) => (requirementsMatchMap.get(`${product.vendor}-${product.productName}`) ?? product.requirementsMatch) === true)
            .map((product, index) => ({
              ...product,
              rank: index + 1,
              requirementsMatch: requirementsMatchMap.get(`${product.vendor}-${product.productName}`) ?? product.requirementsMatch,
            })),
        },
      }
    : null;

  const finalAnalysisResult = filteredAnalysisResult;

  // If no matches, render minimal docked panel
  if (!finalAnalysisResult?.vendorAnalysis?.vendorMatches?.length) {
    return (
      <div className="w-full h-full flex flex-col bg-background text-foreground border-l border-border overflow-hidden sticky top-0 right-0 z-20" style={{ minWidth: 0 }}>
        {/* Header space - dock button moved to corner */}
        <div className="flex items-center justify-end py-4 px-3 flex-shrink-0">
          {/* Dock button moved to corner */}
        </div>
        <div style={{ flex: 1 }} />
        <style>{`
          .custom-no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .custom-no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    );
  }

  const getRankIcon = (rank: number | undefined) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank ? `#${rank}` : "•";
    }
  };

  // Helper function for quality badges
  const getQualityBadge = (source: string) => {
    switch (source) {
      case 'google_cse': return '🟢 Official';
      case 'serpapi': return '🟡 Verified';
      case 'serper': return '🟠 General';
      default: return '⚫ Unknown';
    }
  };

  // Function to open image gallery
  const openImageGallery = (images: ProductImage[], productName: string) => {
    setImageGalleryOpen({ images, productName });
  };

  const renderMarkdownContent = (content: string | string[] | undefined) => {
    if (!content) return null;
    const markdownText = Array.isArray(content) ? content.join("\n\n") : content;
    return (
      <div
        className="prose prose-sm max-w-none prose-slate dark:prose-invert 
                      prose-headings:text-lg prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-headings:mb-3 prose-headings:mt-4
                      prose-p:text-base prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-3
                      prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold prose-strong:bg-yellow-100 dark:prose-strong:bg-yellow-900/30 prose-strong:px-1 prose-strong:rounded
                      prose-ul:text-base prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ul:mb-3 prose-ul:mt-2
                      prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:leading-relaxed prose-li:mb-2 prose-li:pl-1
                      prose-h1:text-xl prose-h1:font-bold prose-h1:text-blue-800 dark:prose-h1:text-blue-300 prose-h1:mb-4 prose-h1:mt-4 prose-h1:border-b prose-h1:border-blue-200 prose-h1:pb-2
                      prose-h2:text-lg prose-h2:font-bold prose-h2:text-blue-700 dark:prose-h2:text-blue-400 prose-h2:mb-3 prose-h2:mt-4
                      prose-h3:text-base prose-h3:font-semibold prose-h3:text-blue-600 dark:prose-h3:text-blue-500 prose-h3:mb-2 prose-h3:mt-3
                      prose-h4:text-sm prose-h4:font-semibold prose-h4:text-slate-600 dark:prose-h4:text-slate-400 prose-h4:mb-2 prose-h4:mt-2
                      prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-code:bg-pink-50 dark:prose-code:bg-pink-900/30 prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-sm
                      prose-blockquote:border-l-4 prose-blockquote:border-blue-300 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic
                      [&_ul]:ml-2 [&_li]:ml-0 [&_p]:select-text [&_li]:select-text [&_strong]:select-text [&_code]:select-text
                      [&_ul>li]:marker:text-blue-500 [&_ol>li]:marker:text-blue-500 [&_ol>li]:marker:font-semibold
                      [&_em]:text-slate-600 dark:[&_em]:text-slate-400 [&_em]:italic [&_em]:font-medium"
      >
        <ReactMarkdown>{markdownText}</ReactMarkdown>
      </div>
    );
  };

  const CircularProgressBarSVG = ({ score }: { score: number }) => {
    const safeScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - safeScore / 100);
    const strokeColor = safeScore >= 80 ? "#16a34a" : safeScore >= 60 ? "#f59e0b" : "#ef4444";
    return (
      <svg className="w-full h-full text-foreground" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} stroke="#e5e7eb" strokeWidth="4" fill="transparent" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
        <text x="22" y="22" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">
          {`${safeScore}%`}
        </text>
      </svg>
    );
  };

  // Helper to return border color classes for containers based on score
  const getBorderColor = (overallScore: number | undefined) => {
    const score = Number.isFinite(overallScore as number) ? (overallScore as number) : 0;
    if (score >= 80) return "border-green-400";
    if (score >= 60) return "border-amber-400";
    return "border-red-400";
  };

  const { vendorAnalysis, overallRanking } = finalAnalysisResult!;
  const vendorsGrouped = (vendorAnalysis.vendorMatches || []).reduce((acc: { [vendor: string]: typeof vendorAnalysis.vendorMatches }, current) => {
    if (!acc[current.vendor]) acc[current.vendor] = [];
    acc[current.vendor].push(current);
    return acc;
  }, {});
  const vendorNames = Object.keys(vendorsGrouped);

  const RenderVendorLogo: React.FC<{ vendorName: string; size?: number }> = ({ vendorName, size = 22 }) => {
    const normalizedVendorName = normalizeVendorName(vendorName);
    const logoUrl = vendorLogoMap[normalizedVendorName];
    if (!logoUrl) return null;
    const safeUrl = logoUrl.startsWith("/") ? `${BASE_URL}${logoUrl}` : logoUrl;
    return (
      <img
        src={safeUrl}
        alt={`${vendorName} logo`}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 4,
          marginRight: 6,
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  };

  const getPriceReview = (vendor: string, productName: string): PriceReview => {
    const key = `${vendor}-${productName}`;
    return priceReviewMap[key] || { results: [] };
  };

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground border-l border-border sticky top-0 right-0 z-20" style={{ minWidth: 0, position: "relative" }}>
      {/* Header space - dock button moved to corner */}
      <div className="flex items-center justify-end py-4 px-3 flex-shrink-0">
        {/* Dock button moved to corner */}
      </div>


      {/* Docked view: show compact summary/icon */}
      {isDocked ? (
        <div className="flex flex-col items-center justify-center flex-1 py-8">
          <Trophy className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">Results</span>
        </div>
      ) : (
        <ScrollArea className="flex-1 overflow-auto custom-no-scrollbar min-w-0">
          <div className="p-4 space-y-4 min-w-0 flex flex-col">
            <Tabs defaultValue="ranking" className="w-full min-w-0">
              <ScrollArea className="w-full whitespace-nowrap min-w-0">
                <TabsList className="flex w-full p-1 rounded-xl bg-muted/30">
                  <TabsTrigger value="ranking" className="flex-shrink-0 px-4 py-2 rounded-lg transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow whitespace-nowrap flex items-center justify-center">
                    <Trophy className="h-5 w-5" color="black" />
                  </TabsTrigger>
                  {vendorNames.map((vendorName) => (
                    <TabsTrigger
                      key={vendorName}
                      value={vendorName}
                      className="flex-shrink-0 px-4 py-2 rounded-lg transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow whitespace-nowrap flex items-center gap-1 justify-center"
                      title={vendorName}
                      aria-label={vendorName}
                      style={{ minWidth: 30, minHeight: 30 }}
                    >
                      <RenderVendorLogo vendorName={vendorName} size={40} />
                      <span
                        style={{
                          position: "absolute",
                          width: 1,
                          height: 1,
                          padding: 0,
                          overflow: "hidden",
                          clip: "rect(0, 0, 0, 0)",
                          whiteSpace: "nowrap",
                          border: 0,
                        }}
                        aria-hidden="true"
                      >
                        {vendorName}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>

              {/* Best Match Tab */}
              <TabsContent value="ranking" className="mt-4 min-w-0">
                <Card className="bg-gradient-card shadow-card rounded-lg min-w-0 flex flex-col">
                  <CardHeader className="pb-3 min-w-0">
                    <CardTitle className="text-sm font-semibold flex items-center min-w-0 flex-wrap"></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 min-w-0">
                    {overallRanking.rankedProducts.map((product, index) => {
                      const key = `${product.vendor}-${product.productName}`;
                      const imageData = analysisImages[key];
                      const isLoadingImage = loadingImages[key];
                      const productImgUrl = imageData?.topImage?.url || getProductImageUrl(product.vendor, product.productName) || product.imageUrl;
                      const priceReviews = getPriceReview(product.vendor, product.productName);
                      const fbKey = getProductKey(product.vendor, product.productName);
                      const fb = feedbackState[fbKey] ?? { type: null, comment: "", loading: false, submitted: false };

                      const overallScore = product.overallScore ?? 0;

                      return (
                        <div
                          key={`${product.vendor}-${product.productName}-${index}`}
                          className={`bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-xl border-2 ${getBorderColor(
                            overallScore
                          )} w-full max-w-full overflow-hidden break-words hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}
                          style={{ position: "relative" }}
                        >
                          <div className="flex items-center justify-between flex-wrap min-w-0 gap-2">
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {/* Product image before product name */}
                                {isLoadingImage ? (
                                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs text-gray-500">...</span>
                                  </div>
                                ) : productImgUrl ? (
                                  <div className="relative flex-shrink-0">
                                    <img
                                      src={productImgUrl.startsWith("/") ? `${BASE_URL}${productImgUrl}` : productImgUrl}
                                      alt={`${product.productName} thumbnail`}
                                      onMouseEnter={() => setHoveredImage(productImgUrl)}
                                      onMouseLeave={() => setHoveredImage(null)}
                                      className="w-10 h-10 rounded object-contain cursor-pointer hover:scale-110 transition-transform"
                                    />
                                    {imageData?.topImage?.source && (
                                      <div className="absolute -top-1 -right-1 text-xs">
                                        {getQualityBadge(imageData.topImage.source).charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                                <h2 className="font-bold truncate select-text text-xl text-slate-900 dark:text-slate-100">{product.productName}</h2>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-base font-medium text-slate-600 dark:text-slate-400 truncate select-text">{product.vendor}</p>
                              </div>
                            </div>
                            <div className="w-12 h-12 flex items-center justify-center relative">
                              <CircularProgressBarSVG score={overallScore} />
                            </div>
                          </div>

                          <div className="space-y-3 mt-3">
                            <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">✨</span>
                                <p className="text-lg font-bold text-green-800 dark:text-green-300 select-text">Highlights</p>
                              </div>
                              {renderMarkdownContent(product.keyStrengths)}
                            </div>

                            {product.concerns && (
                              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">⚠️</span>
                                  <p className="text-lg font-bold text-amber-800 dark:text-amber-300 select-text">Limitations</p>
                                </div>
                                {renderMarkdownContent(product.concerns)}
                              </div>
                            )}

                            {priceReviews.results.length > 0 && (
                              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/50 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">💰</span>
                                  <p className="text-lg font-bold text-blue-800 dark:text-blue-300 select-text">Pricing Information</p>
                                </div>
                                <div className="space-y-3">
                                  {priceReviews.results
                                    .filter((result) => result.price)
                                    .map((result, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                        <div className="flex flex-col">
                                          <span className="text-xl font-bold text-blue-700 dark:text-blue-400">{result.price}</span>
                                          {result.source && <span className="text-sm text-slate-600 dark:text-slate-400">Available on {result.source}</span>}
                                        </div>
                                        {result.link && (
                                          <a href={result.link} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 no-underline">
                                            View Deal
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Feedback Form for this product */}
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">💬</span>
                                <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Feedback</p>
                              </div>
                              {fb.submitted ? (
                                <div className="flex items-center gap-2 text-base text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                  <span>{fb.response ? ` ${fb.response}` : "!"}</span>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex gap-3">
                                    <Button variant={fb.type === "positive" ? "default" : "outline"} size="sm" onClick={() => setFeedbackType(fbKey, "positive")} className="flex-1 h-12 text-base font-medium">
                                      <span className="text-lg mr-2">👍</span>
                                    </Button>
                                    <Button variant={fb.type === "negative" ? "destructive" : "outline"} size="sm" onClick={() => setFeedbackType(fbKey, "negative")} className="flex-1 h-12 text-base font-medium">
                                      <span className="text-lg mr-2">👎</span>
                                    </Button>
                                  </div>
                                  <Textarea 
                                    value={fb.comment} 
                                    onChange={(e) => setFeedbackComment(fbKey, e.target.value)} 
                                    onKeyDown={(e) => handleFeedbackKeyDown(e, fbKey, product.vendor, product.productName)}
                                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-base min-h-[80px]" 
                                  />
                                  <Button onClick={() => submitFeedback(fbKey, product.vendor, product.productName)} disabled={fb.loading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium">
                                    {fb.loading ? (
                                      <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Submitting...
                                      </>
                                    ) : (
                                      <>Submit Feedback</>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {index < overallRanking.rankedProducts.length - 1 && <Separator className="my-3" />}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Vendor Specific Tabs */}
              {vendorNames.map((vendorName) => (
                <TabsContent key={vendorName} value={vendorName} className="mt-4 min-w-0">
                  <Card className="bg-gradient-card shadow-card rounded-lg min-w-0 flex flex-col">
                    <CardHeader className="pb-3 min-w-0">
                      {/* Vendor Logo at top of vendor tab */}
                      <div className="flex items-center gap-3 mb-4">
                        <RenderVendorLogo vendorName={vendorName} size={48} />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{vendorName}</h3>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 min-w-0">
                      {vendorsGrouped[vendorName]
                        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
                        .map((productMatch, idx) => {
                          // Get product-specific image from analysis images
                          const key = `${productMatch.vendor}-${productMatch.productName}`;
                          const imageData = analysisImages[key];
                          const productImgUrl = imageData?.topImage?.url || (getProductImageUrl(productMatch.vendor, productMatch.productName) ?? productMatch.imageUrl);
                          const priceReviews = getPriceReview(productMatch.vendor, productMatch.productName);
                          const matchScore = productMatch.matchScore ?? 0;

                          return (
                            <div
                              key={`${productMatch.vendor}-${productMatch.productName}-${idx}`}
                              className={`bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-xl border-2 ${getBorderColor(
                                matchScore
                              )} w-full max-w-full overflow-hidden break-words hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}
                            >
                              <div className="flex items-center justify-between flex-wrap min-w-0 gap-2">
                                {/* Product image (not vendor logo) */}
                                {productImgUrl ? (
                                  <img
                                    src={productImgUrl.startsWith("/") ? `${BASE_URL}${productImgUrl}` : productImgUrl}
                                    alt={`${productMatch.productName} thumbnail`}
                                    onMouseEnter={() => setHoveredImage(productImgUrl)}
                                    onMouseLeave={() => setHoveredImage(null)}
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: 6,
                                      objectFit: "contain",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <span className="flex-shrink-0 text-lg select-none">{productMatch.productName?.charAt(0) ?? "•"}</span>
                                )}
                                <div className="flex flex-col flex-1 min-w-0">
                                  <h2 className="font-bold truncate select-text text-xl text-slate-900 dark:text-slate-100 mb-1">{productMatch.productName}</h2>
                                  <div className="flex items-center gap-2"></div>
                                </div>
                                <div className="w-12 h-12 flex items-center justify-center relative">
                                  <CircularProgressBarSVG score={matchScore} />
                                </div>
                              </div>

                              <div className="space-y-3 mt-3">
                                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg">✨</span>
                                    <p className="text-lg font-bold text-green-800 dark:text-green-300 select-text">Highlights</p>
                                  </div>
                                  {renderMarkdownContent(productMatch.reasoning)}
                                </div>

                                {productMatch.limitations && (
                                  <div className="p-4 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700/50 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-lg">⚠️</span>
                                      <p className="text-lg font-bold text-red-800 dark:text-red-300 select-text">Limitations</p>
                                    </div>
                                    {renderMarkdownContent(productMatch.limitations)}
                                  </div>
                                )}

                                {priceReviews.results.length > 0 && (
                                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/50 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-lg">💰</span>
                                      <p className="text-lg font-bold text-blue-800 dark:text-blue-300 select-text">Pricing Information</p>
                                    </div>
                                    <div className="space-y-3">
                                      {priceReviews.results
                                        .filter((result) => result.price)
                                        .map((result, idx) => (
                                          <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                            <div className="flex flex-col">
                                              <span className="text-xl font-bold text-blue-700 dark:text-blue-400">{result.price}</span>
                                              {result.source && <span className="text-sm text-slate-600 dark:text-slate-400">Available on {result.source}</span>}
                                            </div>
                                            {result.link && (
                                              <a href={result.link} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 no-underline">
                                                View Deal
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {idx < vendorsGrouped[vendorName].length - 1 && <Separator className="my-3" />}
                            </div>
                          );
                        })}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </ScrollArea>
      )}

      {hoveredImage && (
        <div
          onMouseLeave={() => setHoveredImage(null)}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(255, 255, 255, 0.98)",
            padding: 24,
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            zIndex: 9999,
            maxWidth: "600px",
            maxHeight: "600px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: "2px solid rgba(0,0,0,0.1)",
          }}
          className="dark:bg-slate-800/98 dark:border-slate-600"
        >
          <img
            src={hoveredImage.startsWith("/") ? `${BASE_URL}${hoveredImage}` : hoveredImage}
            alt="Product preview"
            style={{
              maxWidth: "550px",
              maxHeight: "550px",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        </div>
      )}

      {/* Image Gallery Modal */}
      {imageGalleryOpen && (
        <ImageGallery
          images={imageGalleryOpen.images}
          isOpen={true}
          onClose={() => setImageGalleryOpen(null)}
          productName={imageGalleryOpen.productName}
        />
      )}

      <style>{`
        .custom-no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default RightPanel;

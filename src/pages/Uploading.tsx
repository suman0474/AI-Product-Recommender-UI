import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  CloudUpload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadPdfFile, searchPdfs, uploadPdfFromUrl, viewPdf } from "../components/AIRecommender/api";

interface PdfSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const PdfSearchAndUpload = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [pdfList, setPdfList] = useState<PdfSearchResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "processing">("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Search PDFs ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsProcessing(true);
    setStatus("processing");
    setMessage("Searching for PDFs...");
    try {
      const searchResults: PdfSearchResult[] = await searchPdfs(searchQuery);
      setPdfList(searchResults);
      setStatus("success");
      setMessage(`${searchResults.length} PDFs found.`);
    } catch (err: any) {
      console.error(err);
      setMessage(err.response?.data?.error || "Failed to search for PDFs.");
      setStatus("error");
      setPdfList([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Handle a URL-based upload from a search result ---
  const handleUrlUpload = async (url: string) => {
    setIsProcessing(true);
    setStatus("processing");
    setMessage("Processing your file...");
    setResults(null);

    try {
      const data = await uploadPdfFromUrl(url);
      setResults(data);
      setStatus("success");
      setMessage("Success! Your data has been extracted.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "An unexpected error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Handle a local file upload ---
  const handleLocalFileUpload = async (file: File) => {
    setIsProcessing(true);
    setStatus("processing");
    setMessage("Processing your file...");
    setResults(null);

    try {
      const data = await uploadPdfFile(file);
      setResults(data);
      setStatus("success");
      setMessage("Success! Your data has been extracted.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "An unexpected error occurred during upload.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "processing":
        return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">PDF Explorer & Extractor</h1>
          <Button
            variant="outline"
            onClick={() => navigate("/project")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Requirements
          </Button>
          <p className="text-gray-500">
            Search vendor/product PDFs, view them, or extract data.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex mb-6 gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Search vendor/product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <Button onClick={handleSearch} className="px-6 bg-blue-600 text-white hover:bg-blue-700" disabled={isProcessing}>
            {isProcessing ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* PDF List */}
        {pdfList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {pdfList.map((pdf) => (
              <Card key={pdf.url} className="border border-blue-300 rounded-lg shadow-sm">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <p className="font-medium text-gray-900 mb-2">{pdf.title}</p>
                    <p className="text-sm text-gray-500 truncate">{pdf.url}</p>
                    <p className="text-sm text-gray-400 mt-1">{pdf.snippet}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => window.open(viewPdf(pdf.url), "_blank")}
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      <Eye className="w-4 h-4 mr-2" /> View
                    </Button>
                    <Button
                      onClick={() => handleUrlUpload(pdf.url)}
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                      disabled={isProcessing}
                    >
                      <CloudUpload className="w-4 h-4 mr-2" />
                      {isProcessing ? "Processing..." : "Upload"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Local PDF Upload */}
        <Card className="border border-blue-300 rounded-lg shadow-sm">
          <CardContent className="p-6 text-center">
            <div
              className={cn(
                "border-2 border-dashed border-blue-400 rounded-2xl p-8 cursor-pointer flex flex-col items-center justify-center mb-4 transition-colors hover:border-blue-700",
                selectedFile ? "bg-blue-50 border-blue-400" : "border-blue-400"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-14 h-14 text-blue-400 mb-2" />
              {selectedFile ? (
                <div className="flex items-center justify-center space-x-3 mt-2">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-gray-900 mb-1">Choose a PDF file</p>
                  <p className="text-gray-400">Click here to select your document</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                className="hidden"
              />
            </div>
            <Button
              onClick={() => selectedFile && handleLocalFileUpload(selectedFile)}
              disabled={!selectedFile || isProcessing}
              className="w-full sm:w-auto px-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Upload and Process"}
            </Button>
          </CardContent>
        </Card>

        {/* Status */}
        {status !== "idle" && (
          <div
            className={cn(
              "p-4 rounded-lg flex items-center space-x-3 mt-4",
              status === "success" && "bg-green-100 text-green-700",
              status === "error" && "bg-red-100 text-red-700",
              status === "processing" && "bg-blue-100 text-blue-700"
            )}
          >
            {getStatusIcon()}
            <p className="font-medium">{message}</p>
          </div>
        )}

        {/* Extraction Results */}
        {results && (
          <div className="mt-6 text-left">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Extraction Results</h3>
            <div className="bg-gray-100 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfSearchAndUpload;
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Play, Bot, LogOut, User, Upload, Save, FolderOpen, FileText, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { BASE_URL } from '../components/AIRecommender/api';
import { identifyInstruments, validateRequirements, searchVendors } from '@/components/AIRecommender/api';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import AIRecommender from "@/components/AIRecommender";
import { useAuth } from '@/contexts/AuthContext';
import ProjectListDialog from '@/components/ProjectListDialog';
import '../components/TabsLayout.css';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProfileEditDialog } from '@/components/ProfileEditDialog';

interface IdentifiedInstrument {
    category: string;
    quantity?: number;
    productName: string;
    specifications: Record<string, string>;
    sampleInput: string;
}

interface IdentifiedAccessory {
    category: string;
    quantity?: number;
    accessoryName: string;
    specifications: Record<string, string>;
    sampleInput: string;
}

const Project = () => {
    const [requirements, setRequirements] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [instruments, setInstruments] = useState<IdentifiedInstrument[]>([]);
    const [accessories, setAccessories] = useState<IdentifiedAccessory[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('project');
    const [previousTab, setPreviousTab] = useState<string>('project');
    const [searchTabs, setSearchTabs] = useState<{ id: string; title: string; input: string }[]>([]);
    const [projectName, setProjectName] = useState<string>('Project');
    const [editingProjectName, setEditingProjectName] = useState<boolean>(false);
    const [editProjectNameValue, setEditProjectNameValue] = useState<string>(projectName);
    const editNameInputRef = useRef<HTMLInputElement | null>(null);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [duplicateNameDialogOpen, setDuplicateNameDialogOpen] = useState(false);
    const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);
    const [autoRenameSuggestion, setAutoRenameSuggestion] = useState<string | null>(null);
    const [duplicateDialogNameInput, setDuplicateDialogNameInput] = useState<string>('');
    const [duplicateDialogError, setDuplicateDialogError] = useState<string | null>(null);
    const [isProjectListOpen, setIsProjectListOpen] = useState(false);
    const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);

    // Track conversation states for each search tab
    const [tabStates, setTabStates] = useState<Record<string, any>>({});
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, logout } = useAuth(); // Get user info and logout function

    // NEW: For scroll position handling
    const projectScrollRef = useRef<HTMLDivElement | null>(null);
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);

    // NEW: For generic product type images
    const [genericImages, setGenericImages] = useState<Record<string, string>>({});

    // NEW: For greeting/question responses
    const [responseMessage, setResponseMessage] = useState<string>('');

    // NEW: For file upload
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const capitalizeFirstLetter = (str?: string): string => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Helper to convert relative image URLs to absolute URLs
    const getAbsoluteImageUrl = (url: string | undefined | null): string | undefined => {
        if (!url) return undefined;

        // Already absolute URL
        if (url.startsWith('http') || url.startsWith('data:')) {
            return url;
        }

        // Convert relative URL to absolute
        const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
        const path = url.startsWith('/') ? url : `/${url}`;
        return `${baseUrl}${path}`;
    };

    // Helper to format keys into human-readable text
    const prettifyKey = (key: string) => {
        return key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1') // Add space before camelCase capitals
            .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
            .trim();
    };

    // Batched parallel loading: Load multiple images at once in batches
    // Collects ALL images first, then displays them all at once
    const fetchGenericImagesLazy = async (productTypes: string[]) => {
        const uniqueTypes = [...new Set(productTypes)]; // Remove duplicates

        // Batch configuration
        const BATCH_SIZE = 5; // Load 5 images at a time (safe for 8/min limit)
        const BATCH_DELAY = 2000; // 2 seconds between batches

        console.log(`[PARALLEL_BATCH] Starting batched parallel load for ${uniqueTypes.length} images (batch size: ${BATCH_SIZE})...`);

        // Collect all loaded images here - don't update state until ALL are loaded
        const allLoadedImages: Record<string, string> = {};

        // Process images in batches
        for (let i = 0; i < uniqueTypes.length; i += BATCH_SIZE) {
            const batch = uniqueTypes.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(uniqueTypes.length / BATCH_SIZE);

            console.log(`[PARALLEL_BATCH] Processing batch ${batchNumber}/${totalBatches} (${batch.length} images)...`);

            // Fetch all images in this batch IN PARALLEL
            const batchPromises = batch.map(async (productType, batchIndex) => {
                const globalIndex = i + batchIndex;

                try {
                    const encodedType = encodeURIComponent(productType);
                    console.log(`[PARALLEL_BATCH] [${globalIndex + 1}/${uniqueTypes.length}] Fetching: ${productType}`);

                    const response = await fetch(`${BASE_URL}/api/generic_image/${encodedType}`, {
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.image) {
                            const absoluteUrl = getAbsoluteImageUrl(data.image.url);
                            if (absoluteUrl) {
                                // Store in temporary object instead of updating state immediately
                                allLoadedImages[productType] = absoluteUrl;
                                console.log(`[PARALLEL_BATCH] ✓ Loaded ${globalIndex + 1}/${uniqueTypes.length}: ${productType}`);
                                return { success: true, productType };
                            }
                        }
                    } else {
                        console.warn(`[PARALLEL_BATCH] ✗ Failed (${response.status}): ${productType}`);
                    }
                } catch (error) {
                    console.error(`[PARALLEL_BATCH] ✗ Error fetching ${productType}:`, error);
                }
                return { success: false, productType };
            });

            // Wait for all images in this batch to complete
            const batchResults = await Promise.all(batchPromises);
            const successCount = batchResults.filter(r => r.success).length;
            console.log(`[PARALLEL_BATCH] Batch ${batchNumber} complete: ${successCount}/${batch.length} succeeded`);

            // Wait before next batch (except for last batch)
            if (i + BATCH_SIZE < uniqueTypes.length) {
                console.log(`[PARALLEL_BATCH] Waiting ${BATCH_DELAY / 1000}s before next batch...`);
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        // ALL batches complete - now update state with ALL images at once
        console.log(`[PARALLEL_BATCH] All batches complete! Displaying ${Object.keys(allLoadedImages).length} images at once...`);
        setGenericImages(allLoadedImages);
    };

    // Escape string for use in RegExp
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Compute next available duplicate name: e.g., if 'Name' exists, suggest 'Name (1)';
    // if 'Name (1)' exists, suggest 'Name (2)', etc.
    const computeNextDuplicateName = (base: string, projects: any[]) => {
        if (!base) return `${base} (1)`;
        const baseTrim = base.trim();

        // Extract the actual base name without any numbering
        // If base is "Distillation Column (1)", extract "Distillation Column"
        const baseNameMatch = baseTrim.match(/^(.*?)(?:\s*\(\d+\))?$/);
        const actualBaseName = baseNameMatch ? baseNameMatch[1].trim() : baseTrim;

        // Create regex to match all variations of the base name with numbers
        const regex = new RegExp(`^${escapeRegExp(actualBaseName)}(?:\\s*\\((\\d+)\\))?$`, 'i');
        let maxNum = 0;
        let foundBase = false;

        for (const p of projects) {
            const pName = (p.projectName || p.project_name || '').trim();
            if (!pName) continue;
            const m = pName.match(regex);
            if (m) {
                if (!m[1]) {
                    foundBase = true;
                } else {
                    const n = parseInt(m[1], 10);
                    if (!isNaN(n) && n > maxNum) maxNum = n;
                }
            }
        }

        if (maxNum > 0) {
            return `${actualBaseName} (${maxNum + 1})`;
        }

        if (foundBase) return `${actualBaseName} (1)`;

        // fallback
        return `${actualBaseName} (1)`;
    };

    useEffect(() => {
        setEditProjectNameValue(projectName);
    }, [projectName]);

    const profileButtonLabel = capitalizeFirstLetter(user?.name || user?.username || "User");
    const profileFullName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || "User";

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Check if we have either text requirements or extracted text from file
        if (!requirements.trim() && !extractedText.trim()) {
            toast({
                title: "Input Required",
                description: "Please enter your requirements or attach a file",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        // Clear previous response message
        setResponseMessage('');

        try {
            // Combine manual requirements with extracted text from file
            const finalRequirements = requirements.trim() && extractedText.trim()
                ? `${requirements}\n\n${extractedText}`
                : requirements.trim() || extractedText.trim();

            // Send the final requirements to LLM
            const response = await identifyInstruments(finalRequirements);

            // Check response type
            const responseType = (response as any).responseType || (response as any).response_type;

            // CASE 1: Greeting response - Show message below smaller input box
            if (responseType === 'greeting') {
                setResponseMessage((response as any).message || '');
                setShowResults(true); // Make input box smaller, consistent with requirements
                setInstruments([]);
                setAccessories([]);
                // Clear attached file and extracted text after successful submission
                setAttachedFile(null);
                setExtractedText('');
                return;
            }

            // CASE 2: Question response - Show message below smaller input box
            if (responseType === 'question') {
                setResponseMessage((response as any).message || '');
                setShowResults(true); // Make input box smaller, consistent with requirements
                setInstruments([]);
                setAccessories([]);
                // Clear attached file and extracted text after successful submission
                setAttachedFile(null);
                setExtractedText('');
                return;
            }

            // CASE 3: Requirements response (instruments and accessories)
            if (responseType === 'requirements') {
                setInstruments(response.instruments || []);
                setAccessories(response.accessories || []);
                setShowResults(true);
                setResponseMessage(''); // Clear any previous message

                // Set the project name from the API response, fallback to 'Project' if not provided
                if (response.projectName) {
                    setProjectName(response.projectName);
                }

                // Lazy load generic images in BACKGROUND (non-blocking)
                // Images will appear progressively as they're fetched
                const productNames: string[] = [];
                (response.instruments || []).forEach((inst: any) => {
                    if (inst.productName) productNames.push(inst.productName);
                });
                (response.accessories || []).forEach((acc: any) => {
                    if (acc.accessoryName) productNames.push(acc.accessoryName);
                });

                if (productNames.length > 0) {
                    // This runs asynchronously - doesn't block UI
                    fetchGenericImagesLazy(productNames);
                }

                // Clear attached file and extracted text after successful submission
                setAttachedFile(null);
                setExtractedText('');

                toast({
                    title: "Success",
                    description: `Identified ${response.instruments?.length || 0} instruments and ${response.accessories?.length || 0} accessories`,
                });
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to process request",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Handle file selection and immediately extract text
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Attach the file and start extraction immediately
        setAttachedFile(file);
        setIsExtracting(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${BASE_URL}/api/upload-requirements`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to extract text from file');
            }

            const data = await response.json();

            if (data.success && data.extracted_text) {
                // Store the extracted text for later use on submit
                setExtractedText(data.extracted_text);

            } else {
                throw new Error(data.error || 'No text extracted from file');
            }
        } catch (error: any) {
            toast({
                title: "Extraction Failed",
                description: error.message || "Failed to extract text from file",
                variant: "destructive",
            });
            // Clear the file if extraction failed
            setAttachedFile(null);
            setExtractedText('');
        } finally {
            setIsExtracting(false);
            // Reset file input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle removing attached file and its extracted text
    const handleRemoveFile = () => {
        setAttachedFile(null);
        setExtractedText('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const addSearchTab = (input: string, categoryName?: string) => {
        // Save current scroll position before switching tabs
        if (activeTab === 'project' && projectScrollRef.current) {
            setSavedScrollPosition(projectScrollRef.current.scrollTop);
        }

        const title = categoryName || `Search ${searchTabs.length + 1}`;
        const existingTabIndex = searchTabs.findIndex(tab => tab.title === title);

        if (existingTabIndex !== -1) {
            const updatedTabs = [...searchTabs];
            updatedTabs[existingTabIndex] = { ...updatedTabs[existingTabIndex], input };
            setSearchTabs(updatedTabs);

            setTimeout(() => {
                setPreviousTab(activeTab);
                setActiveTab(updatedTabs[existingTabIndex].id);
            }, 0);

            return;
        }

        const nextIndex = searchTabs.length + 1;
        const id = `search-${Date.now()}-${nextIndex}`;
        const newTabs = [...searchTabs, { id, title, input }];
        setSearchTabs(newTabs);

        setTimeout(() => {
            setPreviousTab(activeTab);
            setActiveTab(id);
        }, 0);
    };

    const closeSearchTab = (id: string) => {
        const remaining = searchTabs.filter(t => t.id !== id);
        setSearchTabs(remaining);
        if (activeTab === id) {
            const targetTab = remaining.find(t => t.id === previousTab)
                ? previousTab
                : remaining.length > 0
                    ? remaining[remaining.length - 1].id
                    : 'project';

            // If returning to project tab, restore scroll position
            setPreviousTab(activeTab);
            setActiveTab(targetTab);
        }
    };

    const handleRun = async (instrument: IdentifiedInstrument, index: number) => {
        const qty = instrument.quantity ? ` (${instrument.quantity})` : '';

        // Automatically search for vendors
        try {
            console.log(`[VENDOR_SEARCH] Input details:`, {
                category: instrument.category,
                productName: instrument.productName,
                strategy: ''
            });
            console.log(`[VENDOR_SEARCH] Searching vendors for: ${instrument.category} - ${instrument.productName}`);
            const vendorResults = await searchVendors(
                instrument.category,
                instrument.productName,
                '' // Default empty strategy
            );
            console.log(`[VENDOR_SEARCH] API Response for ${instrument.productName}:`);
            console.log('- Total Count:', vendorResults.totalCount);
            console.log('- Full Response:', vendorResults);

            // Display vendor results with complete details
            if (vendorResults.vendors && vendorResults.vendors.length > 0) {
                console.log(`[VENDOR_LIST] Found ${vendorResults.totalCount} matching vendors from CSV:`);
                vendorResults.vendors.forEach((vendor, index) => {
                    console.log(`  ${index + 1}. Vendor:`, {
                        name: vendor.vendor_name,
                        category: vendor.category,
                        subcategory: vendor.subcategory,
                        strategy: vendor.strategy,
                        refinery: vendor.refinery,
                        owner: vendor.owner_name,
                        comments: vendor.additional_comments
                    });
                });
                console.log('[VENDOR_NAMES] Vendor names only:', vendorResults.vendors.map(v => v.vendor_name));
            } else {
                console.log('[VENDOR_LIST] No vendors found in CSV for this product type');
            }
        } catch (error) {
            console.warn(`[VENDOR_SEARCH] Failed to search vendors for ${instrument.productName}:`, error);
        }

        addSearchTab(instrument.sampleInput, `${index + 1}. ${instrument.category}${qty}`);
    };

    const handleRunAccessory = async (accessory: IdentifiedAccessory, index: number) => {
        const qty = accessory.quantity ? ` (${accessory.quantity})` : '';

        // Automatically search for vendors
        try {
            console.log(`[VENDOR_SEARCH] Input details:`, {
                category: accessory.category,
                accessoryName: accessory.accessoryName,
                strategy: ''
            });
            console.log(`[VENDOR_SEARCH] Searching vendors for accessory: ${accessory.category} - ${accessory.accessoryName}`);
            const vendorResults = await searchVendors(
                accessory.category,
                accessory.accessoryName,
                '' // Default empty strategy
            );
            console.log(`[VENDOR_SEARCH] API Response for ${accessory.accessoryName}:`);
            console.log('- Total Count:', vendorResults.totalCount);
            console.log('- Full Response:', vendorResults);

            // Display vendor results with complete details
            if (vendorResults.vendors && vendorResults.vendors.length > 0) {
                console.log(`[VENDOR_LIST] Found ${vendorResults.totalCount} matching vendors from CSV:`);
                vendorResults.vendors.forEach((vendor, index) => {
                    console.log(`  ${index + 1}. Vendor:`, {
                        name: vendor.vendor_name,
                        category: vendor.category,
                        subcategory: vendor.subcategory,
                        strategy: vendor.strategy,
                        refinery: vendor.refinery,
                        owner: vendor.owner_name,
                        comments: vendor.additional_comments
                    });
                });
                console.log('[VENDOR_NAMES] Vendor names only:', vendorResults.vendors.map(v => v.vendor_name));
            } else {
                console.log('[VENDOR_LIST] No vendors found in CSV for this accessory type');
            }
        } catch (error) {
            console.warn(`[VENDOR_SEARCH] Failed to search vendors for ${accessory.accessoryName}:`, error);
        }

        addSearchTab(accessory.sampleInput, `${index + 1}. ${accessory.category}${qty}`);
    };

    const handleNewProject = () => {
        // Clear current project ID to create a new project instead of updating
        setCurrentProjectId(null);

        // Reset all project state
        setShowResults(false);
        setInstruments([]);
        setAccessories([]);
        setRequirements('');
        setResponseMessage(''); // Clear any greeting/question responses
        setSearchTabs([]);
        setPreviousTab('project');
        setActiveTab('project');
        setProjectName('Project'); // Reset project name to default
        setTabStates({});

        console.log('Started new project - cleared project ID');

        toast({
            title: "New Project Started",
            description: "You can now create a fresh project",
        });
    };

    // Handle state updates from AIRecommender instances
    const handleTabStateChange = (tabId: string, state: any) => {
        setTabStates(prev => {
            // Only update if state has actually changed
            if (JSON.stringify(prev[tabId]) !== JSON.stringify(state)) {
                return {
                    ...prev,
                    [tabId]: state
                };
            }
            return prev;
        });
    };

    const handleSaveProject = async (
        overrideName?: string,
        options?: { skipDuplicateDialog?: boolean }
    ) => {
        // Use detected product type if available; do NOT fallback to projectName.
        // Do not call validation during Save to avoid blocking the save operation.
        let detectedProductType = tabStates['project']?.currentProductType || '';
        const effectiveProjectName = ((overrideName ?? projectName) || '').trim() || 'Project';

        try {
            // Collect all current project data including chat states
            const conversationHistories: Record<string, any> = {};
            const collectedDataAll: Record<string, any> = {};
            const analysisResults: Record<string, any> = {};

            // Collect data from each search tab
            const allFieldDescriptions: Record<string, string> = {};
            Object.entries(tabStates).forEach(([tabId, state]) => {
                if (state) {
                    conversationHistories[tabId] = {
                        messages: state.messages || [],
                        currentStep: state.currentStep || 'greeting',
                        searchSessionId: state.searchSessionId,
                        // Extended state for complete restoration
                        requirementSchema: state.requirementSchema || null,
                        validationResult: state.validationResult || null,
                        currentProductType: state.currentProductType || null,
                        inputValue: state.inputValue || '',
                        advancedParameters: state.advancedParameters || null,
                        selectedAdvancedParams: state.selectedAdvancedParams || {},
                        fieldDescriptions: state.fieldDescriptions || {}
                    };

                    if (state.collectedData) {
                        collectedDataAll[tabId] = state.collectedData;
                    }

                    if (state.analysisResult) {
                        analysisResults[tabId] = state.analysisResult;
                    }

                    // Merge field descriptions from all tabs
                    if (state.fieldDescriptions) {
                        Object.assign(allFieldDescriptions, state.fieldDescriptions);
                    }
                }
            });

            // Create field descriptions for better data understanding
            const baseFieldDescriptions = {
                project_name: 'Name/title of the project',
                project_description: 'Detailed description of the project purpose and scope',
                initial_requirements: 'Original user requirements and specifications provided at project start',
                product_type: 'Type/category of product being developed or analyzed',
                identified_instruments: 'List of instruments identified as suitable for the project requirements',
                identified_accessories: 'List of accessories and supporting equipment identified for the project',
                search_tabs: 'Individual search sessions created by user for different aspects of the project',
                conversation_histories: 'Complete conversation threads for each search tab including AI interactions',
                collected_data: 'Data collected during conversations and analysis for each search tab',
                current_step: 'Current workflow step in the project (greeting, requirements, analysis, etc.)',
                active_tab: 'The tab that was active when the project was last saved',
                analysis_results: 'Results from AI analysis and recommendations for each search tab',
                workflow_position: 'Detailed position in workflow to enable exact continuation',
                user_interactions: 'Summary of user actions and decisions made during the project',
                project_metadata: 'Additional metadata about project creation, updates, and usage patterns'
            };

            // Merge field descriptions from tabs with base descriptions
            const fieldDescriptions = { ...baseFieldDescriptions, ...allFieldDescriptions };

            // Use detected product type if available; do NOT fallback to projectName.
            // Do not call validation during Save to avoid blocking the save operation.
            detectedProductType = tabStates['project']?.currentProductType || '';

            // Check for duplicate project name on the client by looking at existing projects.
            // This ensures we can prompt even if the backend does not enforce unique names.
            if (!options?.skipDuplicateDialog) {
                try {
                    const listResponse = await fetch(`${BASE_URL}/api/projects`, {
                        credentials: 'include'
                    });

                    if (listResponse.ok) {
                        const data = await listResponse.json();
                        const projects: any[] = data.projects || [];

                        const nameLower = effectiveProjectName.toLowerCase();
                        const hasDuplicate = projects.some((p: any) => {
                            const pName = (p.projectName || p.project_name || '').trim();
                            const pId = p.id || p._id || null;
                            if (!pName) return false;
                            // Same name (case-insensitive) and not the very same project we are updating
                            const isSameName = pName.toLowerCase() === nameLower;
                            const isSameProject = currentProjectId && pId === currentProjectId;
                            return isSameName && !isSameProject;
                        });

                        if (hasDuplicate) {
                            const projectsList: any[] = data.projects || [];
                            const suggested = computeNextDuplicateName(effectiveProjectName, projectsList);
                            setDuplicateProjectName(effectiveProjectName);
                            setAutoRenameSuggestion(suggested);
                            setDuplicateNameDialogOpen(true);
                            return;
                        }
                    }
                } catch (e) {
                    // If duplicate check fails, continue with normal save flow.
                }
            }

            // Combine manual requirements with extracted text from file (same logic as submit)
            const finalRequirements = requirements.trim() && extractedText.trim()
                ? `${requirements}\n\n${extractedText}`
                : requirements.trim() || extractedText.trim();

            const projectData: any = {
                project_name: effectiveProjectName,
                project_description: `Project for ${effectiveProjectName} - Created on ${new Date().toLocaleDateString()}`,
                initial_requirements: finalRequirements,
                product_type: detectedProductType,
                detected_product_type: detectedProductType,
                identified_instruments: instruments,
                identified_accessories: accessories,
                search_tabs: searchTabs,
                conversation_histories: conversationHistories,
                collected_data: collectedDataAll,
                generic_images: genericImages,
                current_step: activeTab === 'project' ? (showResults ? 'showSummary' : 'initialInput') : 'search',
                active_tab: activeTab === 'project' ? 'Project' : (searchTabs.find(t => t.id === activeTab)?.title || activeTab), // Save tab name instead of ID
                analysis_results: analysisResults,
                field_descriptions: fieldDescriptions,
                workflow_position: {
                    current_tab: activeTab,
                    has_results: showResults,
                    total_search_tabs: searchTabs.length,
                    last_interaction: new Date().toISOString(),
                    project_phase: showResults ? 'results_review' : 'requirements_gathering'
                },
                user_interactions: {
                    tabs_created: searchTabs.length,
                    conversations_count: Object.keys(conversationHistories).length,
                    has_analysis: Object.keys(analysisResults).length > 0,
                    last_save: new Date().toISOString()
                }
            };

            // Include client-side pricing and feedback entries if present in local state
            // `pricing` may be assembled by the frontend or analysisResult; include if available
            if ((analysisResults && Object.keys(analysisResults).length > 0) || (tabStates && Object.keys(tabStates).length > 0)) {
                try {
                    // Try to collect pricing info from tab states (from RightPanel)
                    const pricingDataFromTabs: any = {};
                    Object.entries(tabStates).forEach(([tabId, tabState]: [string, any]) => {
                        if (tabState && tabState.pricingData && Object.keys(tabState.pricingData).length > 0) {
                            console.log(`[SAVE_PROJECT] Collecting pricing data from tab ${tabId}:`, Object.keys(tabState.pricingData).length, 'products');
                            pricingDataFromTabs[tabId] = tabState.pricingData;
                        }
                    });

                    if (Object.keys(pricingDataFromTabs).length > 0) {
                        projectData.pricing = pricingDataFromTabs;
                        console.log(`[SAVE_PROJECT] Included pricing data from`, Object.keys(pricingDataFromTabs).length, 'tabs');
                    }

                    // Also try to collect pricing info embedded in analysisResults for the active tab (fallback)
                    const activeAnalysis = analysisResults[activeTab] || analysisResults['project'] || null;
                    if (activeAnalysis && activeAnalysis.pricing && !projectData.pricing) {
                        projectData.pricing = activeAnalysis.pricing;
                    }
                } catch (e) {
                    console.error('[SAVE_PROJECT] Error collecting pricing data:', e);
                }
            }

            // If UI has any feedback objects (from RightPanel interactions), include them
            // We expect feedback entries to be stored in `tabStates` under each tab's user interactions
            try {
                const feedbackEntries: any[] = [];
                Object.values(tabStates).forEach((s: any) => {
                    if (s && s.feedbackEntries && Array.isArray(s.feedbackEntrieshy)) {
                        feedbackEntries.push(...s.feedbackEntries);
                    }
                });
                if (feedbackEntries.length > 0) projectData.feedback_entries = feedbackEntries;
            } catch (e) {
                // ignore
            }

            // If we have a current project ID, include it to update the existing project
            if (currentProjectId) {
                projectData.project_id = currentProjectId;
                console.log('Updating existing project:', currentProjectId);
            } else {
                console.log('Creating new project');
            }
            console.log('Saving project with comprehensive data and descriptions:', {
                fieldCount: Object.keys(projectData).length,
                hasFieldDescriptions: !!projectData.field_descriptions,
                descriptionsCount: projectData.field_descriptions ? Object.keys(projectData.field_descriptions).length : 0,
                hasWorkflowPosition: !!projectData.workflow_position,
                hasUserInteractions: !!projectData.user_interactions
            });

            const response = await fetch(`${BASE_URL}/api/projects/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Include only media currently displayed on the frontend (reduce unnecessary downloads/storage)
                body: JSON.stringify({
                    ...projectData,
                    displayed_media_map: (() => {
                        try {
                            const map: Record<string, any> = {};
                            const activeState = tabStates[activeTab];
                            if (!activeState || !activeState.analysisResult) return map;

                            const ranked = (activeState.analysisResult?.overallRanking?.rankedProducts) || [];
                            ranked.forEach((product: any) => {
                                try {
                                    // Save ALL products (both exact and approximate matches)
                                    if (!product) return;
                                    const vendor = product.vendor || product.vendorName || product.vendor_name || '';
                                    const pname = product.productName || product.product_name || product.name || '';
                                    if (!vendor && !pname) return;
                                    const key = `${vendor}-${pname}`.trim();
                                    const entry: any = {};

                                    const top = product.topImage || product.top_image || product.top_image_url || product.topImageUrl || null;
                                    const vendorLogo = product.vendorLogo || product.vendor_logo || product.logo || null;

                                    const resolveUrl = (obj: any) => {
                                        if (!obj) return null;
                                        if (typeof obj === 'string') return obj;
                                        return obj.url || obj.src || null;
                                    };

                                    const topUrl = resolveUrl(top);
                                    const vLogoUrl = resolveUrl(vendorLogo);

                                    if (topUrl) entry.top_image = { url: topUrl };
                                    if (vLogoUrl) entry.vendor_logo = { url: vLogoUrl };

                                    // Add matchType metadata
                                    entry.matchType = product.requirementsMatch ? 'exact' : 'approximate';

                                    if (Object.keys(entry).length > 0) map[key] = entry;
                                } catch (e) {
                                    // Continue on minor errors
                                }
                            });
                            return map;
                        } catch (e) {
                            return {};
                        }
                    })()
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                let errorData: any = null;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // ignore JSON parse errors
                }

                const errorMessage = errorData?.error || 'Failed to save project';
                const errorCode = errorData?.code || errorData?.errorCode;

                const looksLikeDuplicateNameError =
                    response.status === 409 ||
                    errorCode === 'DUPLICATE_PROJECT_NAME' ||
                    /already exists|already present|duplicate project name/i.test(errorMessage);

                if (!options?.skipDuplicateDialog && looksLikeDuplicateNameError) {
                    const nameInErrorMatch = errorMessage.match(/"([^"]+)"/);
                    const nameFromError = nameInErrorMatch ? nameInErrorMatch[1] : effectiveProjectName;
                    // Compute smarter suggestion based on existing projects
                    let suggested = `${nameFromError} (1)`;
                    try {
                        const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
                        if (listResp.ok) {
                            const listData = await listResp.json();
                            suggested = computeNextDuplicateName(nameFromError, listData.projects || []);
                        }
                    } catch (e) {
                        // fallback remains
                    }

                    setDuplicateProjectName(nameFromError);
                    setAutoRenameSuggestion(suggested);
                    setDuplicateDialogNameInput(nameFromError);
                    setDuplicateDialogError(null);
                    setDuplicateNameDialogOpen(true);

                    // Do not show generic error toast here; the dialog will guide the user.
                    return;
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();

            // Extract project_id from the response
            // Backend returns: { message: "...", project: { project_id: "...", ... } }
            const savedProjectId = result.project?.project_id || result.project_id;

            // If we didn't have a project ID before, set it now for future updates
            if (!currentProjectId && savedProjectId) {
                setCurrentProjectId(savedProjectId);
                console.log('Set currentProjectId for future updates:', savedProjectId);
            }

            // Ensure local state reflects the name we actually saved
            if (overrideName && overrideName.trim()) {
                setProjectName(overrideName.trim());
            }

            toast({
                title: currentProjectId ? "Project Updated" : "Project Saved",
                description: currentProjectId
                    ? `"${effectiveProjectName}" has been updated successfully`
                    : `"${effectiveProjectName}" has been saved successfully`,
            });

        } catch (error: any) {
            // Check if this is a duplicate name error from backend
            const errorMessage = error.message || "";
            if (errorMessage.includes("already exists") && errorMessage.includes("Please choose a different name")) {
                // Extract the project name from the error message
                const nameMatch = errorMessage.match(/Project name '([^']+)' already exists/);
                const duplicateName = nameMatch ? nameMatch[1] : effectiveProjectName;

                // Get current projects to compute suggestion
                try {
                    const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
                    if (listResp.ok) {
                        const listData = await listResp.json();
                        const suggested = computeNextDuplicateName(duplicateName, listData.projects || []);
                        setDuplicateProjectName(duplicateName);
                        setAutoRenameSuggestion(suggested);
                        setDuplicateDialogNameInput(duplicateName);
                        setDuplicateDialogError(null);
                        setDuplicateNameDialogOpen(true);
                        return; // Don't show the generic error toast
                    }
                } catch (e) {
                    // If we can't get projects list, fall back to default behavior
                }
            }

            toast({
                title: "Save Failed",
                description: error.message || "Failed to save project",
                variant: "destructive",
            });
        }
    };

    const handleProjectDelete = (deletedProjectId: string) => {
        // Check if the deleted project was the currently active one
        if (currentProjectId === deletedProjectId) {
            console.log('Current project was deleted, starting new project...');
            handleNewProject();
        }
    };

    const handleOpenProject = async (projectId: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load project');
            }

            const data = await response.json();
            const project = data.project;
            console.log('Loading project data:', project);

            // Do not clear existing session state before loading project

            // Restore project state with debugging
            // Restore product type from loaded project
            const restoredProductType = project.productType || project.product_type || projectName;
            setProjectName(project.projectName || project.project_name || 'Project');
            setRequirements(project.initialRequirements || project.initial_requirements || '');
            setInstruments(project.identifiedInstruments || project.identified_instruments || []);
            setAccessories(project.identifiedAccessories || project.identified_accessories || []);
            // Set product type in tabStates for use in API calls
            setTabStates(prev => ({
                ...prev,
                project: {
                    ...(prev.project || {}),
                    currentProductType: restoredProductType
                }
            }));
            console.log('Restoring project name:', project.projectName || project.project_name);
            setProjectName(project.projectName || project.project_name || 'Project');

            console.log('Restoring requirements:', (project.initialRequirements || project.initial_requirements || '').substring(0, 100));
            setRequirements(project.initialRequirements || project.initial_requirements || '');

            console.log('Restoring instruments count:', (project.identifiedInstruments || project.identified_instruments || []).length);
            setInstruments(project.identifiedInstruments || project.identified_instruments || []);

            console.log('Restoring accessories count:', (project.identifiedAccessories || project.identified_accessories || []).length);
            console.log('Restoring accessories count:', (project.identifiedAccessories || project.identified_accessories || []).length);
            setAccessories(project.identifiedAccessories || project.identified_accessories || []);

            // Restore generic images
            const savedGenericImages = project.genericImages || project.generic_images || {};
            if (Object.keys(savedGenericImages).length > 0) {
                console.log('Restoring generic images:', Object.keys(savedGenericImages).length);
                // Convert all relative URLs to absolute URLs for deployment compatibility
                const absoluteGenericImages: Record<string, string> = {};
                Object.entries(savedGenericImages).forEach(([key, url]) => {
                    const absoluteUrl = getAbsoluteImageUrl(url as string);
                    if (absoluteUrl) {
                        absoluteGenericImages[key] = absoluteUrl;
                    }
                });
                setGenericImages(absoluteGenericImages);
            } else {
                setGenericImages({});
            }

            // Show results if we have instruments/accessories
            const instruments = project.identifiedInstruments || project.identified_instruments || [];
            const accessories = project.identifiedAccessories || project.identified_accessories || [];
            console.log('Checking results - instruments:', instruments.length, 'accessories:', accessories.length);
            const hasResults = instruments.length > 0 || accessories.length > 0;
            if (hasResults) {
                console.log('Setting showResults to true');
                setShowResults(true);
            } else {
                console.log('No results to show, keeping showResults false');
            }

            // Restore search tabs and conversation states
            const savedSearchTabs = project.searchTabs || project.search_tabs || [];
            console.log('Saved search tabs:', savedSearchTabs);

            if (savedSearchTabs.length > 0) {
                console.log('Restoring search tabs...');
                setSearchTabs(savedSearchTabs);

                // Restore conversation histories for each tab
                const conversationHistories = project.conversationHistories || project.conversation_histories || project.conversationHistory || project.conversation_history || {};
                const restoredTabStates: Record<string, any> = {};

                console.log('Conversation histories:', conversationHistories);

                savedSearchTabs.forEach((tab: any) => {
                    console.log(`Processing tab ${tab.id}:`, tab);

                    if (conversationHistories[tab.id]) {
                        const tabHistory = conversationHistories[tab.id];
                        console.log(`Restoring conversation for tab ${tab.id}:`, tabHistory);

                        restoredTabStates[tab.id] = {
                            messages: tabHistory.messages || [],
                            currentStep: tabHistory.currentStep || 'greeting',
                            searchSessionId: tabHistory.searchSessionId || tab.id,
                            collectedData: (project.collectedData || project.collected_data)?.[tab.id] || {},
                            analysisResult: (project.analysisResults || project.analysis_results)?.[tab.id] || null,
                            // Extended state restoration
                            requirementSchema: tabHistory.requirementSchema || null,
                            validationResult: tabHistory.validationResult || null,
                            currentProductType: tabHistory.currentProductType || null,
                            inputValue: tabHistory.inputValue || '',
                            advancedParameters: tabHistory.advancedParameters || null,
                            selectedAdvancedParams: tabHistory.selectedAdvancedParams || {},
                            fieldDescriptions: tabHistory.fieldDescriptions || (project.fieldDescriptions || project.field_descriptions) || {}
                        };

                        console.log(`Restored state for tab ${tab.id}:`, restoredTabStates[tab.id]);
                    } else {
                        // Create default state for tabs without conversation history
                        restoredTabStates[tab.id] = {
                            messages: [],
                            currentStep: 'greeting',
                            searchSessionId: tab.id,
                            collectedData: {},
                            analysisResult: null,
                            fieldDescriptions: (project.fieldDescriptions || project.field_descriptions) || {}
                        };
                    }
                });

                console.log('Setting restored tab states:', restoredTabStates);
                // Inject project_id into each tab's analysisResult for downstream components
                Object.keys(restoredTabStates).forEach((tabId) => {
                    const ar = restoredTabStates[tabId].analysisResult;
                    if (ar && !ar.projectId) {
                        ar.projectId = projectId;
                    }

                    // Embed pricing data into analysisResult for RightPanel to use
                    if (ar && project.pricing) {
                        // Check if we have pricing data for this specific tab
                        const tabPricing = project.pricing[tabId];
                        if (tabPricing) {
                            console.log(`[LOAD_PROJECT] Embedding pricing data for tab ${tabId}:`, Object.keys(tabPricing).length, 'products');

                            // Embed pricing data into the ranked products
                            if (ar.overallRanking && ar.overallRanking.rankedProducts) {
                                ar.overallRanking.rankedProducts.forEach((product: any) => {
                                    const key = `${product.vendor || product.vendorName || product.vendor_name || ''}-${product.productName || product.product_name || product.name || ''}`.trim();
                                    if (tabPricing[key]) {
                                        console.log(`[LOAD_PROJECT] Embedding pricing for product: ${key}`);
                                        product.priceReview = tabPricing[key];
                                        product.pricing = tabPricing[key];
                                    }
                                });
                            }
                        } else {
                            // If no tab-specific pricing, check if we have general pricing data
                            if (typeof project.pricing === 'object' && !Array.isArray(project.pricing)) {
                                console.log(`[LOAD_PROJECT] Checking general pricing data for tab ${tabId}`);
                                if (ar.overallRanking && ar.overallRanking.rankedProducts) {
                                    ar.overallRanking.rankedProducts.forEach((product: any) => {
                                        const key = `${product.vendor || product.vendorName || product.vendor_name || ''}-${product.productName || product.product_name || product.name || ''}`.trim();
                                        if (project.pricing[key]) {
                                            console.log(`[LOAD_PROJECT] Embedding general pricing for product: ${key}`);
                                            product.priceReview = project.pricing[key];
                                            product.pricing = project.pricing[key];
                                        }
                                    });
                                }
                            }
                        }
                    }
                });
                setTabStates(restoredTabStates);

                // Restore the active tab that was saved
                const savedActiveTab = project.activeTab || project.active_tab;
                if (savedActiveTab) {
                    console.log('Restoring saved active tab:', savedActiveTab);

                    if (savedActiveTab === 'Project' || savedActiveTab === 'project') {
                        setActiveTab('project');
                        setPreviousTab('project');
                    } else {
                        // Try to find tab by title first (new behavior)
                        const tabByTitle = savedSearchTabs.find((t: any) => t.title === savedActiveTab);
                        if (tabByTitle) {
                            setActiveTab(tabByTitle.id);
                            setPreviousTab('project');
                        } else {
                            // Fallback: try to find by ID (legacy behavior)
                            const tabById = savedSearchTabs.find((t: any) => t.id === savedActiveTab);
                            if (tabById) {
                                setActiveTab(tabById.id);
                                setPreviousTab('project');
                            } else {
                                // Default if not found
                                if (savedSearchTabs.length > 0) {
                                    setActiveTab(savedSearchTabs[0].id);
                                    setPreviousTab('project');
                                } else {
                                    setActiveTab('project');
                                    setPreviousTab('project');
                                }
                            }
                        }
                    }
                } else if (savedSearchTabs.length > 0) {
                    console.log('No saved active tab, setting to first search tab:', savedSearchTabs[0].id);
                    setActiveTab(savedSearchTabs[0].id);
                    setPreviousTab('project');
                }
            } else {
                console.log('No search tabs to restore');
                // Clear tab states if no search tabs
                setTabStates({});
            }

            // Only reset to project tab if no search tabs were restored and no active tab was saved
            const savedActiveTab = project.activeTab || project.active_tab;
            if (savedSearchTabs.length === 0 && !savedActiveTab) {
                console.log('No search tabs and no saved active tab, setting active tab to project');
                setActiveTab('project');
                setPreviousTab('project');
            } else {
                console.log('Search tabs or saved active tab found, active tab should be restored above');
            }

            console.log('Project loading completed successfully');

            // Log field descriptions and metadata if available
            const fieldDescriptions = project.fieldDescriptions || project.field_descriptions;
            if (fieldDescriptions) {
                console.log('Project field descriptions loaded:', Object.keys(fieldDescriptions).length, 'fields documented');
            }

            const workflowPosition = project.workflowPosition || project.workflow_position;
            if (workflowPosition) {
                console.log('Project workflow position:', workflowPosition);
            }

            const userInteractions = project.userInteractions || project.user_interactions;
            if (userInteractions) {
                console.log('Project user interactions summary:', userInteractions);
            }

            const projectMetadata = project.projectMetadata || project.project_metadata;
            if (projectMetadata) {
                console.log('Project metadata loaded:', projectMetadata);
            }

            // Set the current project ID for future saves (so it updates instead of creating new)
            console.log('Setting current project ID for updates:', projectId);
            setCurrentProjectId(projectId);

            // Also restore the project's current step if available
            const projectCurrentStep = project.currentStep || project.current_step;
            if (projectCurrentStep) {
                console.log('Project was at step:', projectCurrentStep);
            }

            toast({
                title: "Project Loaded",
                description: `"${project.projectName || project.project_name}" has been loaded successfully. ${savedSearchTabs.length} search tabs restored.`,
            });
        } catch (error: any) {
            toast({
                title: "Load Failed",
                description: error.message || "Failed to load project",
                variant: "destructive",
            });
        }
    };

    // ✅ Save scroll position before leaving Project tab
    const handleTabChange = (newTab: string) => {
        if (activeTab === 'project' && projectScrollRef.current) {
            setSavedScrollPosition(projectScrollRef.current.scrollTop);
        }
        setPreviousTab(activeTab);
        setActiveTab(newTab);
    };

    // ✅ Restore scroll position when returning to Project tab
    useEffect(() => {
        if (activeTab === 'project' && projectScrollRef.current) {
            // Use setTimeout to ensure the DOM is fully rendered
            setTimeout(() => {
                if (projectScrollRef.current) {
                    projectScrollRef.current.scrollTop = savedScrollPosition;
                }
            }, 0);
        }
    }, [activeTab]);

    // Additional effect to handle scroll position restoration after content changes
    useEffect(() => {
        if (activeTab === 'project' && projectScrollRef.current && savedScrollPosition > 0) {
            const timer = setTimeout(() => {
                if (projectScrollRef.current) {
                    projectScrollRef.current.scrollTop = savedScrollPosition;
                }
            }, 100); // Slightly longer delay to ensure content is loaded

            return () => clearTimeout(timer);
        }
    }, [activeTab, showResults, instruments, accessories]);

    const resetDuplicateDialog = () => {
        setDuplicateNameDialogOpen(false);
        setDuplicateProjectName(null);
        setAutoRenameSuggestion(null);
        setDuplicateDialogError(null);
    };

    const handleDuplicateNameChangeConfirm = () => {
        const trimmed = (duplicateDialogNameInput || '').trim();
        if (!trimmed) {
            setDuplicateDialogError('Project name is required');
            return;
        }

        resetDuplicateDialog();
        handleSaveProject(trimmed);
    };

    const handleDuplicateNameAutoRename = async () => {
        const baseName = (duplicateProjectName || projectName || '').trim() || 'Project';
        let suggested = autoRenameSuggestion || `${baseName} (1)`;
        try {
            // Try to compute next available suggestion based on existing projects
            const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
            if (listResp.ok) {
                const listData = await listResp.json();
                suggested = computeNextDuplicateName(baseName, listData.projects || []);
            }
        } catch (e) {
            // ignore and use fallback
        }

        resetDuplicateDialog();

        // Save immediately with the suggested name, and avoid showing the duplicate dialog again for this attempt
        handleSaveProject(suggested, { skipDuplicateDialog: true });
    };

    return (
        <div className="min-h-screen w-full app-glass-gradient flex flex-col">
            {/* Header */}
            <header className="glass-header px-6 py-4 fixed top-0 w-full z-50">
                <div className="flex items-center justify-between">
                    {/* Left side - Logo and Tabs */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white/50">
                            <video
                                src="/animation.mp4"
                                autoPlay
                                muted
                                playsInline
                                disablePictureInPicture
                                controls={false}
                                onContextMenu={(e) => e.preventDefault()}
                                className="w-full h-full object-cover pointer-events-none"
                            />
                        </div>

                        {searchTabs.length > 0 && (
                            <div className="max-w-[calc(100vw-330px)] min-w-0">
                                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                                    <TabsList className="w-full bg-transparent p-0 h-auto">
                                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <TabsTrigger
                                                    value="project"
                                                    className="rounded-lg px-4 py-2 text-base font-bold text-foreground border-2 border-border data-[state=active]:shadow-md whitespace-nowrap flex-shrink-0"
                                                >
                                                    {!editingProjectName ? (
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className="block">{projectName}</span>
                                                            {currentProjectId && (
                                                                <span className="ml-2 text-xs bg-[#EAF6FB] dark:bg-sky-900 text-[#0F6CBD] dark:text-sky-200 px-2 py-1 rounded-full">
                                                                    Saved
                                                                </span>
                                                            )}
                                                            <span
                                                                onClick={(e) => {
                                                                    // Prevent tab switch when clicking edit
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    setEditingProjectName(true);
                                                                    setTimeout(() => editNameInputRef.current?.focus(), 0);
                                                                }}
                                                                title="Edit project name"
                                                                className="ml-2 text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded cursor-pointer"
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-label="Edit project name"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        setEditingProjectName(true);
                                                                        setTimeout(() => editNameInputRef.current?.focus(), 0);
                                                                    }
                                                                }}
                                                            >
                                                                ✎
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <input
                                                            ref={editNameInputRef}
                                                            value={editProjectNameValue}
                                                            onChange={(e) => setEditProjectNameValue(e.target.value)}
                                                            onBlur={() => {
                                                                const v = (editProjectNameValue || '').trim() || 'Project';
                                                                setProjectName(v);
                                                                setEditingProjectName(false);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const v = (editProjectNameValue || '').trim() || 'Project';
                                                                    setProjectName(v);
                                                                    setEditingProjectName(false);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditProjectNameValue(projectName);
                                                                    setEditingProjectName(false);
                                                                }
                                                            }}
                                                            className="text-sm px-2 py-1 rounded-md border border-border bg-background min-w-[160px]"
                                                            autoFocus
                                                        />
                                                    )}
                                                </TabsTrigger>
                                            </div>
                                            {searchTabs.map((tab, index) => (
                                                <div key={tab.id} className="flex items-center min-w-0 flex-shrink">
                                                    <TabsTrigger
                                                        value={tab.id}
                                                        className="rounded-lg px-3 py-1 text-sm data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground min-w-0"
                                                    >
                                                        <span className="truncate block w-full">{tab.title}</span>
                                                    </TabsTrigger>
                                                    <button
                                                        onClick={() => closeSearchTab(tab.id)}
                                                        className="ml-1 text-muted-foreground hover:text-foreground text-lg flex-shrink-0"
                                                        aria-label={`Close ${tab.title}`}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </TabsList>
                                </Tabs>
                            </div>
                        )}
                    </div>

                    {/* Right side - Action Buttons and Profile */}
                    <div className="flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSaveProject()}
                                    className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                >
                                    <Save className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Save</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handleNewProject} className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]">
                                    <FileText className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>New</p></TooltipContent>
                        </Tooltip>

                        <ProjectListDialog
                            open={isProjectListOpen}
                            onOpenChange={setIsProjectListOpen}
                            onProjectSelect={handleOpenProject}
                            onProjectDelete={handleProjectDelete}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                        onClick={() => setIsProjectListOpen(true)}
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Open</p></TooltipContent>
                            </Tooltip>
                        </ProjectListDialog>

                        {/* Profile */}
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="text-sm font-semibold text-muted-foreground p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-[#0F6CBD] flex items-center justify-center text-white font-bold">
                                                {profileButtonLabel.charAt(0)}
                                            </div>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Profile</p></TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent
                                className="w-56 mt-1 rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl"
                                align="end"
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <button
                                        onClick={() => setIsProfileEditOpen(true)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors text-sm font-semibold rounded-md text-left outline-none cursor-pointer"
                                        title="Click to edit profile"
                                    >
                                        <User className="w-4 h-4" />
                                        {profileFullName}
                                    </button>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {user?.role?.toLowerCase() === "admin" && (
                                    <>
                                        <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={() => navigate("/admin")}>
                                            <Bot className="h-4 w-4" />
                                            Approve Sign Ups
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={() => navigate("/upload")}>
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={logout}>
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <ProfileEditDialog
                open={isProfileEditOpen}
                onOpenChange={setIsProfileEditOpen}
            />

            {/* Duplicate project name dialog */}
            <AlertDialog
                open={duplicateNameDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        resetDuplicateDialog();
                    } else {
                        setDuplicateNameDialogOpen(open);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Project name already exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            {duplicateProjectName
                                ? `"${duplicateProjectName}" is already present. Do you want to change the project name, or save it as "${(autoRenameSuggestion || `${duplicateProjectName} (1)`)}"?`
                                : 'A project with this name is already present. Do you want to change the project name, or save it with a default suffix (1)?'}
                        </AlertDialogDescription>
                        <div className="mt-4 space-y-2">
                            <label htmlFor="duplicate-project-name-input" className="text-sm font-medium">
                                New project name
                            </label>
                            <input
                                id="duplicate-project-name-input"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                value={duplicateDialogNameInput}
                                onChange={(e) => {
                                    setDuplicateDialogNameInput(e.target.value);
                                    if (duplicateDialogError) {
                                        setDuplicateDialogError(null);
                                    }
                                }}
                                autoFocus
                            />
                            {duplicateDialogError && (
                                <p className="text-xs text-destructive">{duplicateDialogError}</p>
                            )}
                        </div>
                    </AlertDialogHeader>
                    <button
                        type="button"
                        onClick={resetDuplicateDialog}
                        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Close duplicate name dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={handleDuplicateNameAutoRename}
                        >
                            Use suggested name
                        </AlertDialogAction>
                        <AlertDialogAction onClick={handleDuplicateNameChangeConfirm}>
                            Save new name
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Main Content */}
            <div className="flex-1">
                <div className="w-full h-full">
                    {activeTab === 'project' && (
                        <div
                            ref={projectScrollRef}
                            className="h-screen overflow-y-auto custom-no-scrollbar pt-28"
                        >
                            <div className="mx-auto max-w-[900px] px-4 md:px-6 min-h-full flex items-center justify-center">
                                <div className={`w-full p-4 md:p-6 glass-card animate-in fade-in duration-500 ${showResults ? 'mt-0' : 'my-6'}`}>
                                    {/* Header */}
                                    <div className="text-center mb-6">
                                        <div className="flex items-center justify-center gap-4 mb-4">
                                            <div className="w-16 h-16 rounded-full overflow-hidden shadow">
                                                <video
                                                    src="/animation.mp4"
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    disablePictureInPicture
                                                    controls={false}
                                                    onContextMenu={(e) => e.preventDefault()}
                                                    className="w-full h-full object-cover pointer-events-none"
                                                />
                                            </div>
                                            <h1 className="text-4xl font-bold text-foreground">
                                                EnGenie
                                            </h1>
                                        </div>
                                    </div>

                                    {!showResults && (
                                        <div className="text-center space-y-4 mb-8">
                                            <h2 className="flex items-center justify-center gap-1">
                                                <span className="text-2xl font-normal text-muted-foreground">Welcome,</span>
                                                <span className="text-primary font-bold text-3xl">{user?.firstName || user?.username || 'User'}</span>
                                                <span className="text-2xl font-normal text-muted-foreground">! what are your requirements</span>
                                            </h2>
                                        </div>
                                    )}

                                    {/* Input Form (always visible) */}
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="relative group">
                                            <div className={`relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent hover:scale-[1.02]`}
                                                style={{
                                                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                                    WebkitBackdropFilter: 'blur(12px)',
                                                    backdropFilter: 'blur(12px)',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                                    color: 'rgba(0, 0, 0, 0.8)'
                                                }}>
                                                <Textarea
                                                    value={requirements}
                                                    onChange={(e) => setRequirements(e.target.value)}
                                                    onKeyDown={handleKeyPress}
                                                    className={`w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 resize-none text-base p-4 md:p-6 text-lg leading-relaxed shadow-none custom-no-scrollbar ${showResults ? 'min-h-[120px]' : 'min-h-[200px]'} pb-16`}
                                                    style={{
                                                        backgroundColor: 'transparent',
                                                        boxShadow: 'none',
                                                        color: 'inherit'
                                                    }}
                                                    placeholder="Describe the product you are looking for..."
                                                    disabled={isLoading}
                                                />

                                                {/* File Display & Buttons Bar */}
                                                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {/* Attached File Badge */}
                                                        {attachedFile && (
                                                            <div className="flex items-center gap-2 p-1.5 px-3 glass-card bg-primary/10 border-0 rounded-full text-xs">
                                                                {isExtracting ? (
                                                                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                                ) : (
                                                                    <FileText className="h-3 w-3 text-primary" />
                                                                )}
                                                                <span className="text-primary truncate max-w-[100px]">{attachedFile.name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleRemoveFile}
                                                                    className="text-primary/70 hover:text-primary"
                                                                    title="Remove file"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Hidden file input */}
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.bmp,.tiff"
                                                            onChange={handleFileSelect}
                                                            className="hidden"
                                                        />

                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-1">
                                                        {/* Attach Button */}
                                                        {/* Attach Button */}
                                                        <Button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={isLoading || isExtracting}
                                                            className="w-8 h-8 rounded-full hover:bg-transparent transition-all duration-300 flex-shrink-0 text-muted-foreground hover:text-primary hover:scale-110"
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Attach file"
                                                        >
                                                            <Upload className="h-4 w-4" />
                                                        </Button>

                                                        {/* Submit Button */}
                                                        <Button
                                                            type="submit"
                                                            disabled={isLoading || isExtracting || (!requirements.trim() && !extractedText.trim())}
                                                            className={`w-8 h-8 p-0 rounded-full transition-all duration-300 flex-shrink-0 hover:bg-transparent ${(!requirements.trim() && !extractedText.trim()) ? 'text-muted-foreground' : 'text-primary hover:scale-110'}`}
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Submit"
                                                        >
                                                            {isLoading || isExtracting ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Send className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </form>

                                    {/* Results container */}
                                    <div className="mt-6">
                                        {/* Response Message Display (for greetings and questions) */}
                                        {responseMessage && (
                                            <div className="mt-6 p-6 glass-card bg-gradient-to-br from-[#F5FAFC]/40 to-[#EAF6FB]/40 border-0 rounded-xl shadow-lg animate-in slide-in-from-bottom-2 duration-500">
                                                <div className="flex items-start gap-3">
                                                    {/* <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                          <Bot className="h-6 w-6 text-white" />
                        </div> */}
                                                    <div className="flex-1">
                                                        {/* <h3 className="text-lg font-semibold text-gray-900 mb-2">Engenie</h3> */}
                                                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{responseMessage}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Results Display (shown below input when available) */}
                                    {showResults && (
                                        <div className="space-y-6 mt-6">
                                            {/* Instruments Section - Only show if there are instruments */}
                                            {instruments.length > 0 && (
                                                <>
                                                    <div className="mb-6">
                                                        <h2 className="text-2xl font-bold">
                                                            Instruments ({instruments.length})
                                                        </h2>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {instruments.map((instrument, index) => (
                                                            <div
                                                                key={index}
                                                                className="rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl transition-all duration-300 ease-in-out hover:scale-[1.01] p-8 space-y-6"
                                                            >
                                                                {/* Category and Product Name */}
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1">
                                                                        <h3 className="text-xl font-semibold">
                                                                            {index + 1}. {instrument.category}{instrument.quantity ? ` (${instrument.quantity})` : ''}
                                                                        </h3>
                                                                        <p className="text-muted-foreground">
                                                                            {instrument.productName}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleRun(instrument, index)}
                                                                        className="rounded-xl w-10 h-10 p-0 flex items-center justify-center bg-primary/40 hover:bg-primary text-primary hover:text-white transition-all duration-300 hover:scale-110"
                                                                        variant="ghost"
                                                                    >
                                                                        <Play className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                {/* Generic Product Type Image - Only show if loaded */}
                                                                {genericImages[instrument.productName] && (
                                                                    <div className="flex justify-center my-4 rounded-lg overflow-hidden">
                                                                        <img
                                                                            src={genericImages[instrument.productName]}
                                                                            alt={`Generic ${instrument.category}`}
                                                                            className="w-48 h-48 object-contain rounded-lg shadow-md mix-blend-multiply"
                                                                            onError={(e) => {
                                                                                // Hide image if it fails to load
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* Specifications */}
                                                                {Object.keys(instrument.specifications).length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-medium text-sm text-muted-foreground">
                                                                            Specifications:
                                                                        </h4>
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {Object.entries(instrument.specifications).map(([key, value]) => (
                                                                                <div key={key} className="text-sm">
                                                                                    <span className="font-medium">{prettifyKey(key)}:</span>{' '}
                                                                                    <span className="text-muted-foreground">{value}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Sample Input Preview */}
                                                                <div className="pt-3 border-t">
                                                                    <p className="text-xs text-muted-foreground mb-2">Sample Input:</p>
                                                                    <p className="text-sm bg-muted p-3 rounded-lg font-mono">
                                                                        {instrument.sampleInput}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}


                                            {/* Accessories Section - Only show if there are accessories */}
                                            {accessories.length > 0 && (
                                                <>
                                                    <h2 className="text-2xl font-bold">
                                                        Accessories ({accessories.length})
                                                    </h2>

                                                    <div className="space-y-4 mt-8">
                                                        {accessories.map((accessory, index) => (
                                                            <div
                                                                key={index}
                                                                className="rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl transition-all duration-300 ease-in-out hover:scale-[1.02] p-6 space-y-4"
                                                            >
                                                                {/* Category and Accessory Name */}
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1">
                                                                        <h3 className="text-xl font-semibold">
                                                                            {index + 1}. {accessory.category}{accessory.quantity ? ` (${accessory.quantity})` : ''}
                                                                        </h3>
                                                                        <p className="text-muted-foreground">
                                                                            {accessory.accessoryName}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleRunAccessory(accessory, index)}
                                                                        className="rounded-xl w-10 h-10 p-0 flex items-center justify-center bg-primary/40 hover:bg-primary text-primary hover:text-white transition-all duration-300 hover:scale-110"
                                                                        variant="ghost"
                                                                    >
                                                                        <Play className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                {/* Generic Product Type Image - Only show if loaded */}
                                                                {genericImages[accessory.accessoryName] && (
                                                                    <div className="flex justify-center my-4 rounded-lg overflow-hidden">
                                                                        <img
                                                                            src={genericImages[accessory.accessoryName]}
                                                                            alt={`Generic ${accessory.category}`}
                                                                            className="w-48 h-48 object-contain rounded-lg shadow-md mix-blend-multiply"
                                                                            onError={(e) => {
                                                                                // Hide image if it fails to load
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* Specifications */}
                                                                {Object.keys(accessory.specifications).length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-medium text-sm text-muted-foreground">
                                                                            Specifications:
                                                                        </h4>
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {Object.entries(accessory.specifications).map(([key, value]) => (
                                                                                <div key={key} className="text-sm">
                                                                                    <span className="font-medium">{prettifyKey(key)}:</span>{' '}
                                                                                    <span className="text-muted-foreground">{value}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Sample Input Preview */}
                                                                <div className="pt-3 border-t">
                                                                    <p className="text-xs text-muted-foreground mb-2">Sample Input:</p>
                                                                    <p className="text-sm bg-muted p-3 rounded-lg font-mono">
                                                                        {accessory.sampleInput}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {searchTabs.map((tab) => {
                        const savedState = tabStates[tab.id];
                        console.log(`Rendering AIRecommender for tab ${tab.id} with saved state:`, savedState);
                        return (
                            <div
                                key={tab.id}
                                className={`h-screen pt-24 ${activeTab === tab.id ? 'block' : 'hidden'}`}
                            >
                                <AIRecommender
                                    key={tab.id}
                                    initialInput={tab.input}
                                    fillParent
                                    onStateChange={(state) => handleTabStateChange(tab.id, state)}
                                    savedMessages={savedState?.messages}
                                    savedCollectedData={savedState?.collectedData}
                                    savedCurrentStep={savedState?.currentStep}
                                    savedAnalysisResult={savedState?.analysisResult}
                                    savedRequirementSchema={savedState?.requirementSchema}
                                    savedValidationResult={savedState?.validationResult}
                                    savedCurrentProductType={savedState?.currentProductType}
                                    savedInputValue={savedState?.inputValue}
                                    savedAdvancedParameters={savedState?.advancedParameters}
                                    savedSelectedAdvancedParams={savedState?.selectedAdvancedParams}
                                    savedFieldDescriptions={savedState?.fieldDescriptions}
                                    savedPricingData={savedState?.pricingData}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Project;
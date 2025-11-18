import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Play, Bot, LogOut, Mail, Upload, Save, FolderOpen, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { identifyInstruments, validateRequirements } from '@/components/AIRecommender/api';
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
  
  // Track conversation states for each search tab
  const [tabStates, setTabStates] = useState<Record<string, any>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  // NEW: For scroll position handling
  const projectScrollRef = useRef<HTMLDivElement | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  const capitalizeFirstLetter = (str?: string): string => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Escape string for use in RegExp
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compute next available duplicate name: e.g., if 'Name' exists, suggest 'Name (1)';
  // if 'Name (1)' exists, suggest 'Name (2)', etc.
  const computeNextDuplicateName = (base: string, projects: any[]) => {
    if (!base) return `${base} (1)`;
    const baseTrim = base.trim();
    const regex = new RegExp(`^${escapeRegExp(baseTrim)}(?:\\s*\\((\\d+)\\))?$`, 'i');
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
      return `${baseTrim} (${maxNum + 1})`;
    }

    if (foundBase) return `${baseTrim} (1)`;

    // fallback
    return `${baseTrim} (1)`;
  };

  useEffect(() => {
    setEditProjectNameValue(projectName);
  }, [projectName]);

  const profileButtonLabel = capitalizeFirstLetter(user?.name || user?.username || "User");
  const profileEmail = user?.email || "No email";

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!requirements.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter your requirements",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await identifyInstruments(requirements);
      setInstruments(response.instruments || []);
      setAccessories(response.accessories || []);
      setShowResults(true);
      
      // Set the project name from the API response, fallback to 'Project' if not provided
      if (response.projectName) {
        setProjectName(response.projectName);
      }

      toast({
        title: "Success",
        description: `Identified ${response.instruments?.length || 0} instruments and ${response.accessories?.length || 0} accessories`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to identify instruments",
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

  const handleRun = (instrument: IdentifiedInstrument, index: number) => {
    const qty = instrument.quantity ? ` (${instrument.quantity})` : '';
    addSearchTab(instrument.sampleInput, `${index + 1}. ${instrument.category}${qty}`);
  };

  const handleRunAccessory = (accessory: IdentifiedAccessory, index: number) => {
    const qty = accessory.quantity ? ` (${accessory.quantity})` : '';
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
      let detectedProductType = tabStates['project']?.currentProductType || '';
      const effectiveProjectName = ((overrideName ?? projectName) || '').trim() || 'Project';

      // Check for duplicate project name on the client by looking at existing projects.
      // This ensures we can prompt even if the backend does not enforce unique names.
      if (!options?.skipDuplicateDialog) {
        try {
          const listResponse = await fetch('/api/projects', {
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
              const data = await listResponse.json();
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

      const projectData: any = {
        project_name: effectiveProjectName,
        project_description: `Project for ${effectiveProjectName} - Created on ${new Date().toLocaleDateString()}`,
        initial_requirements: requirements,
        product_type: detectedProductType,
        detected_product_type: detectedProductType,
        identified_instruments: instruments,
        identified_accessories: accessories,
        search_tabs: searchTabs,
        conversation_histories: conversationHistories,
        collected_data: collectedDataAll,
        current_step: activeTab === 'project' ? (showResults ? 'showSummary' : 'initialInput') : 'search',
        active_tab: activeTab, // Save which tab was currently active
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

      const response = await fetch('/api/projects/save', {
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
                  if (!product || !product.requirementsMatch) return;
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
            const listResp = await fetch('/api/projects', { credentials: 'include' });
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
      
      // If we didn't have a project ID before, set it now for future updates
      if (!currentProjectId && result.project_id) {
        setCurrentProjectId(result.project_id);
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
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project",
        variant: "destructive",
      });
    }
  };

  const handleOpenProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
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
      setAccessories(project.identifiedAccessories || project.identified_accessories || []);
      
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
        setTabStates(restoredTabStates);
        
        // Restore the active tab that was saved
        const savedActiveTab = project.activeTab || project.active_tab;
        if (savedActiveTab) {
          console.log('Restoring saved active tab:', savedActiveTab);
          setActiveTab(savedActiveTab);
          setPreviousTab('project');
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
        });    } catch (error: any) {
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
      const listResp = await fetch('/api/projects', { credentials: 'include' });
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
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background border-b border-border px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and Tabs */}
          <div className="flex items-center gap-4">
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

            {searchTabs.length > 0 && (
              <div className="max-w-[calc(100vw-300px)] min-w-0">
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
                                <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
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
                  className="rounded-lg p-2"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Save</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleNewProject} className="rounded-lg p-2">
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>New</p></TooltipContent>
            </Tooltip>

            <ProjectListDialog onProjectSelect={handleOpenProject}>
              <Button variant="outline" size="sm" className="rounded-lg p-2">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </ProjectListDialog>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="text-sm font-semibold text-muted-foreground hover:bg-secondary/50 p-2"
                >
                  <div className="w-7 h-7 rounded-full bg-ai-primary flex items-center justify-center text-white font-bold">
                    {profileButtonLabel.charAt(0)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-popover rounded-xl shadow-xl border border-border mt-1"
                align="end"
              >
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {profileEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {user?.role?.toLowerCase() === "admin" && (
                  <>
                    <DropdownMenuItem className="flex gap-2" onClick={() => navigate("/admin")}>
                      <Bot className="h-4 w-4" />
                      Approve Sign Ups
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex gap-2" onClick={() => navigate("/upload")}>
                      <Upload className="h-4 w-4" />
                      Upload
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem className="flex gap-2" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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
              className="h-[calc(100vh-120px)] overflow-y-auto custom-no-scrollbar"
            >
              <div className="mx-auto max-w-[800px] px-6 min-h-full flex items-center justify-center">
                <div className="w-full py-6">
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
              <h2 className="text-3xl font-bold">
                What are your requirements?
              </h2>
              {/* <p className="text-muted-foreground text-lg">
                Describe your Industrial Process Control System needs
              </p> */}
           
            </div>
          )}

          {/* Input Form (always visible) */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Example: I need a pressure transmitter for measuring 0-100 bar with 4-20mA output and a temperature sensor for 0-200°C..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                onKeyDown={handleKeyPress}
                className={`text-base resize-none rounded-xl bg-secondary/50 border-2 border-gray-600 focus:border-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none focus:shadow-none hover:border-gray-600 active:border-gray-600 [&:focus]:!border-gray-600 [&:focus]:!ring-0 [&:focus]:!ring-offset-0 [&:focus]:!shadow-none [&:focus]:!outline-none ${showResults ? 'min-h-[160px]' : 'min-h-[400px]'}`}
                disabled={isLoading}
                style={{ boxShadow: 'none' }}
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading || !requirements.trim()}
                  className="btn-primary px-8 py-6 text-lg rounded-xl"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      {showResults ? 'Re-run' : 'Submit'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Results Display (shown below input when available) */}
          {showResults && (
            <div className="space-y-6 mt-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">
                   Instruments ({instruments.length})
                </h2>
              </div>

              {/* Instruments Section */}
              {instruments.length > 0 && (
                <div className="space-y-4">
                  {instruments.map((instrument, index) => (
                    <div
                      key={index}
                      className="border rounded-xl p-6 space-y-4 hover:shadow-lg transition-shadow"
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
                          className="btn-primary rounded-xl px-6"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Search
                        </Button>
                      </div>

                      {/* Specifications */}
                      {Object.keys(instrument.specifications).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-muted-foreground">
                            Specifications:
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(instrument.specifications).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium">{key}:</span>{' '}
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
              )}
              <h2 className="text-2xl font-bold">
                   Accessories ({accessories.length})
                </h2>
              {/* Accessories Section */}
              {accessories.length > 0 && (
                <div className="space-y-4 mt-8">
                  {accessories.map((accessory, index) => (
                    <div
                      key={index}
                      className="border border-dashed rounded-xl p-6 space-y-4 hover:shadow-lg transition-shadow bg-muted/30"
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
                          className="btn-primary rounded-xl px-6"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Search
                        </Button>
                      </div>

                      {/* Specifications */}
                      {Object.keys(accessory.specifications).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-muted-foreground">
                            Specifications:
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(accessory.specifications).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium">{key}:</span>{' '}
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
                className={`h-[calc(100vh-120px)] ${activeTab === tab.id ? 'block' : 'hidden'}`}
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

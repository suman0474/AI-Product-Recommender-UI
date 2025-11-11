import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Play, Bot, LogOut, Mail, Upload, Save, FolderOpen, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { identifyInstruments } from '@/components/AIRecommender/api';
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

interface IdentifiedInstrument {
  category: string;
  productName: string;
  specifications: Record<string, string>;
  sampleInput: string;
}

interface IdentifiedAccessory {
  category: string;
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

  const handleRun = (instrument: IdentifiedInstrument) => {
    addSearchTab(instrument.sampleInput, instrument.category);
  };

  const handleRunAccessory = (accessory: IdentifiedAccessory) => {
    addSearchTab(accessory.sampleInput, accessory.category);
  };

  const handleNewProject = () => {
    setShowResults(false);
    setInstruments([]);
    setAccessories([]);
    setRequirements('');
    setSearchTabs([]);
    setPreviousTab('project');
    setActiveTab('project');
  };

  const handleSaveProject = () => {
    toast({
      title: "Save Project",
      description: "Save functionality will be implemented soon",
    });
  };

  const handleOpenProject = () => {
    toast({
      title: "Open Project",
      description: "Open functionality will be implemented soon",
    });
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
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
                <TabsList className="flex items-center gap-2 bg-transparent p-0">
                  <TabsTrigger
                    value="project"
                    className="rounded-lg px-4 py-2 text-base font-bold text-foreground border-2 border-border data-[state=active]:shadow-md"
                  >
                    Project
                  </TabsTrigger>
                  {searchTabs.map((tab) => (
                    <div key={tab.id} className="flex items-center">
                      <TabsTrigger
                        value={tab.id}
                        className="rounded-lg px-3 py-1 text-sm data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
                      >
                        {tab.title}
                      </TabsTrigger>
                      <button
                        onClick={() => closeSearchTab(tab.id)}
                        className="ml-1 text-muted-foreground hover:text-foreground text-lg"
                        aria-label={`Close ${tab.title}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>

          {/* Right side - Action Buttons and Profile */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleSaveProject} className="rounded-lg p-2">
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleOpenProject} className="rounded-lg p-2">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Open</p></TooltipContent>
            </Tooltip>

            {/* Profile */}
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent><p>{profileButtonLabel}</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

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
          {/* Header - Only show when no search tabs are open */}
          {searchTabs.length === 0 && (
  <div className="text-center mb-6">
    <h1 className="text-4xl font-bold text-foreground">
      Controls Systems Recommender
    </h1>
  </div>
)}
<div>
<h1></h1>
</div>
<div>

</div>
          {searchTabs.length === 0 && !showResults && (
            <div className="text-center space-y-4 mb-8">
              <h2 className="text-3xl font-bold">
                What are your requirements?
              </h2>
              <p className="text-muted-foreground text-lg">
                Describe your Industrial Process Control System needs
              </p>
           
            </div>
          )}

          {!showResults ? (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Textarea
                  placeholder="Example: I need a pressure transmitter for measuring 0-100 bar with 4-20mA output and a temperature sensor for 0-200°C..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="min-h-[400px] text-base resize-none rounded-xl"
                  disabled={isLoading}
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
                        Submit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            /* Results Display */
            <div className="space-y-6">
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
                            {instrument.category}
                          </h3>
                          <p className="text-muted-foreground">
                            {instrument.productName}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleRun(instrument)}
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
                            {accessory.category}
                          </h3>
                          <p className="text-muted-foreground">
                            {accessory.accessoryName}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleRunAccessory(accessory)}
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

          {searchTabs.map((tab) => (
            <div
              key={tab.id}
              className={`h-[calc(100vh-120px)] ${activeTab === tab.id ? 'block' : 'hidden'}`}
            >
              <AIRecommender key={tab.id} initialInput={tab.input} fillParent />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Project;

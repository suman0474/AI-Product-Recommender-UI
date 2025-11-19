import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface Project {
  id: string;
  projectName?: string;
  project_name?: string;
  projectDescription?: string;
  project_description?: string;
  productType?: string;
  product_type?: string;
  instrumentsCount?: number;
  instruments_count?: number;
  accessoriesCount?: number;
  accessories_count?: number;
  searchTabsCount?: number;
  search_tabs_count?: number;
  currentStep?: string;
  current_step?: string;
  activeTab?: string;
  active_tab?: string;
  projectPhase?: string;
  project_phase?: string;
  conversationsCount?: number;
  conversations_count?: number;
  hasAnalysis?: boolean;
  has_analysis?: boolean;
  schemaVersion?: string;
  schema_version?: string;
  fieldDescriptionsAvailable?: boolean;
  field_descriptions_available?: boolean;
  projectStatus?: string;
  project_status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  requirementsPreview?: string;
  requirements_preview?: string;
}

interface ProjectListDialogProps {
  children: React.ReactNode;
  onProjectSelect: (projectId: string) => void;
}

const ProjectListDialog: React.FC<ProjectListDialogProps> = ({ children, onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/projects', {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch projects');
      }

      const data = await response.json();
      console.log('Received projects data:', data);
      setProjects(data.projects || []);
    } catch (error: any) {
      toast({
        title: "Failed to load projects",
        description: error.message || "Could not retrieve your projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    try {
      console.log(`Deleting project ${projectId} (${projectName}) from MongoDB...`);
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      console.log(`Delete response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete failed:', errorData);
        throw new Error(errorData.error || 'Failed to delete project');
      }

      const result = await response.json();
      console.log('Delete successful:', result);

      // Remove from local state
      setProjects(prevProjects => 
        prevProjects.filter(project => project.id !== projectId)
      );

      toast({
        title: "Project Deleted",
        description: `"${projectName}" has been deleted successfully from MongoDB`,
      });

    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const handleProjectOpen = async (projectId: string) => {
    setOpen(false);
    onProjectSelect(projectId);
  };



  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={fetchProjects}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Open Project</DialogTitle>
          <DialogDescription className="sr-only">Select a project from the list to open it.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved projects found</p>
              <p className="text-sm">Create your first project by working on requirements and clicking Save</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{project.projectName || project.project_name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => handleProjectOpen(project.id)}
                          className="btn-primary"
                        >
                          Open
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Project</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{project.projectName || project.project_name}"? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteProject(project.id, project.projectName || project.project_name)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectListDialog;
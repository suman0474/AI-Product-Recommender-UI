import React, { useState, useEffect, useRef } from "react";
import { Bot, LogOut, ChevronLeft, ChevronRight, Mail, Upload } from "lucide-react";
import { RequirementSchema, ValidationResult } from "./types";
import { getFieldDescription } from "./api";
import { Button } from "@/components/ui/button";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// Helper functions
function capitalizeFirstLetter(str?: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function prettify(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function getAllLeafKeys(obj: any, parentKey = ""): string[] {
  if (!obj) return [];
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? getAllLeafKeys(value, parentKey ? `${parentKey}.${key}` : key)
      : [parentKey ? `${parentKey}.${key}` : key]
  );
}

// Helper function to render all fields in a flat structure within one container
function renderFlatFieldsList(
  obj: { [key: string]: any },
  collectedData: { [key: string]: any },
  fieldDescriptions: Record<string, string>,
  parentKey = ""
): JSX.Element[] {
  const fieldsByCategory: { [category: string]: any[] } = {};
  
  function traverseAndCollect(currentObj: any, currentParentKey = "", hierarchyPath: string[] = []) {
    Object.entries(currentObj).forEach(([key, value]) => {
      const fullKey = currentParentKey ? `${currentParentKey}.${key}` : key;
      const newHierarchyPath = [...hierarchyPath, prettify(key)];
      
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        // Recursively traverse nested objects, building the hierarchy path
        traverseAndCollect(value, fullKey, newHierarchyPath);
      } else {
        // This is a leaf field, group it by category
        const valueRaw = getNestedValue(collectedData, fullKey);
        const isFilled = valueRaw !== undefined && valueRaw !== "" && valueRaw !== null;
        const fieldName = prettify(key);
        const hierarchicalLabel = newHierarchyPath.length > 1 
          ? `${newHierarchyPath.slice(0, -1).join(" > ")} > ${fieldName}`
          : fieldName;
        const displayValue = Array.isArray(valueRaw) ? valueRaw.join(", ") : String(valueRaw ?? "");
        const categoryPath = newHierarchyPath.slice(0, -1).join(" ");
        
        // Group fields by category
        const category = categoryPath || "General";
        if (!fieldsByCategory[category]) {
          fieldsByCategory[category] = [];
        }
        
        fieldsByCategory[category].push({
          fullKey,
          fieldName,
          hierarchicalLabel,
          displayValue,
          isFilled,
          fieldDescriptions
        });
      }
    });
  }
  
  traverseAndCollect(obj, parentKey);
  
  // Now render grouped fields
  const fields: JSX.Element[] = [];
  Object.entries(fieldsByCategory).forEach(([category, categoryFields]) => {
    // Add category header
    fields.push(
      <div key={`category-${category}`} className="font-bold text-foreground mb-1 text-xs">
        {category}
      </div>
    );
    
    // Add all fields for this category
    categoryFields.forEach((field) => {
      fields.push(
        <div key={field.fullKey} className="flex items-start gap-x-2 ml-6 text-xs mb-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer font-medium text-muted-foreground hover:underline">
                  {field.fieldName}:
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="w-64 bg-popover p-2 rounded-md shadow-md border"
              >
                <p className="text-sm whitespace-normal mt-1">
                  {field.fieldDescriptions[field.fullKey] || "No description available"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span
            className={`break-words ${field.isFilled ? "text-green-700 font-mono" : "text-red-500 font-mono"}`}
          >
            {field.isFilled ? field.displayValue : "Not specified"}
          </span>
        </div>
      );
    });
  });
  
  return fields;
}


// Props interface
interface LeftSidebarProps {
  validationResult: ValidationResult | null;
  requirementSchema: RequirementSchema | null;
  currentProductType: string | null;
  collectedData: { [key: string]: any };
  logout: () => void;
  isDocked: boolean;
  setIsDocked: React.Dispatch<React.SetStateAction<boolean>>;
  hideProfile?: boolean;
  fieldDescriptions?: Record<string, string>;
  onFieldDescriptionsChange?: (descriptions: Record<string, string>) => void;
}

// Main rendering function


const LeftSidebar = ({
  requirementSchema,
  currentProductType,
  collectedData = {},
  logout,
  isDocked,
  setIsDocked,
  hideProfile = false,
  fieldDescriptions: savedFieldDescriptions,
  onFieldDescriptionsChange,
}: LeftSidebarProps) => {
  const [fieldDescriptions, setFieldDescriptions] = useState<Record<string, string>>(savedFieldDescriptions || {});
  const hasAutoUndocked = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-undock when requirement data becomes available (only once)
  useEffect(() => {
    if (requirementSchema && Object.keys(collectedData).length > 0 && isDocked && !hasAutoUndocked.current) {
      setIsDocked(false);
      hasAutoUndocked.current = true;
    }
  }, [requirementSchema, collectedData, isDocked, setIsDocked]);

  const profileButtonLabel = capitalizeFirstLetter(user?.name || user?.username || "User");
  const profileEmail = user?.email || "No email";

  useEffect(() => {
    // Update fieldDescriptions when savedFieldDescriptions prop changes
    if (savedFieldDescriptions && Object.keys(savedFieldDescriptions).length > 0) {
      console.log('Using saved field descriptions:', Object.keys(savedFieldDescriptions).length, 'fields');
      setFieldDescriptions(savedFieldDescriptions);
      return;
    }

    async function fetchAllDescriptions() {
      if (!requirementSchema || !currentProductType) return;
      const allKeys = [
        ...getAllLeafKeys(requirementSchema.mandatoryRequirements || {}),
        ...getAllLeafKeys(requirementSchema.optionalRequirements || {}),
      ];
      if (allKeys.length === 0) return;

      console.log('No saved descriptions found, fetching from API for', allKeys.length, 'fields');
      try {
        const promises = allKeys.map((key) => getFieldDescription(key, currentProductType));
        const results = await Promise.allSettled(promises);
        const newDescriptions: Record<string, string> = {};
        results.forEach((result, i) => {
          const key = allKeys[i];
          newDescriptions[key] =
            result.status === "fulfilled" ? result.value.description : "No description available";
        });
        setFieldDescriptions(newDescriptions);
        console.log('Field descriptions fetched from API:', Object.keys(newDescriptions).length, 'fields');
        
        // Notify parent component about the new field descriptions
        if (onFieldDescriptionsChange) {
          onFieldDescriptionsChange(newDescriptions);
        }
      } catch (err) {
        console.error("Error fetching field descriptions", err);
      }
    }
    fetchAllDescriptions();
  }, [requirementSchema, currentProductType, savedFieldDescriptions]);


  return (
    <div className="flex flex-col h-full w-full bg-background border-r border-border transition-all duration-300">
      {/* Header - Only show icon if hideProfile is false */}
      {!hideProfile && (
        <div className="flex items-center justify-between py-4 px-3 flex-shrink-0">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow" style={{ background: 'var(--gradient-primary)' }}>
            <Bot className="h-8 w-8 text-white" />
          </div>
          {/* Dock button moved to corner */}
        </div>
      )}
      
      {/* Minimal header for dashboard when hideProfile is true */}
      {hideProfile && (
        <div className="flex items-center justify-end py-4 px-3 flex-shrink-0">
          {/* Dock button moved to corner, this space can be used for other content */}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto custom-no-scrollbar p-4 space-y-4">
        {requirementSchema &&
          (isDocked ? (
            // Docked view
            <div >
               
            </div>
          ) : (
            // Expanded view
            <div>
              <div className="text-center mb-4">
                {/* <h2 className="text-sm font-semibold text-foreground">
                  looking for
                </h2> */}
                <h2 className="text-xl font-semibold">
                  <span className="text-gradient inline-block">
                    {prettify(currentProductType || "")}
                  </span>
                </h2>
              </div>

              {requirementSchema.mandatoryRequirements && (
                <div className="mb-6">
                  <div className="bg-card rounded-lg p-4 shadow border ">
                    <div className="space-y-3">
                      {renderFlatFieldsList(
                        requirementSchema.mandatoryRequirements,
                        collectedData,
                        fieldDescriptions
                      )}
                    </div>
                  </div>
                </div>
              )}
              {requirementSchema.optionalRequirements && (
                <div>
                  <div className="bg-card rounded-lg p-4 shadow border ">
                    <div className="space-y-3">
                      {renderFlatFieldsList(
                        requirementSchema.optionalRequirements,
                        collectedData,
                        fieldDescriptions
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Footer - Only show if hideProfile is false */}
      {!hideProfile && (
        <div className="p-3 border-t border-border flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-sm font-semibold text-muted-foreground hover:bg-secondary/50"
              >
                <div className="w-7 h-7 rounded-full bg-ai-primary flex items-center justify-center text-white font-bold">
                  {profileButtonLabel.charAt(0)}
                </div>
                {!isDocked && <span className="ml-2">{profileButtonLabel}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-popover rounded-xl shadow-xl border border-border mt-1"
              align="end"
              side="top"
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
      )}
    </div>
  );
};

export default LeftSidebar;
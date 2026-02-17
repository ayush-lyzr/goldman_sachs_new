"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface SelectedFile {
  file: File;
  id: string;
  version?: number; // Selected version number (undefined = auto-assign new version)
}

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [availableVersions, setAvailableVersions] = useState<Array<{ version: number; versionName: string }>>([]);
  const [nextVersion, setNextVersion] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch available versions on mount
  useEffect(() => {
    const fetchVersions = async () => {
      if (typeof window !== 'undefined') {
        const customerId = sessionStorage.getItem("currentCustomerId");
        if (customerId) {
          try {
            const response = await fetch(`/api/projects/rulesets?customerId=${customerId}`, {
              cache: "no-store",
            });
            if (response.ok) {
              const data = await response.json();
              const rulesets = data.rulesets || [];
              const versions = rulesets.map((rs: any) => ({
                version: rs.version,
                versionName: rs.versionName || `v${rs.version}`,
              }));
              setAvailableVersions(versions);
              
              // Calculate next version
              if (versions.length > 0) {
                const maxVersion = Math.max(...versions.map((v: any) => v.version));
                setNextVersion(maxVersion + 1);
              } else {
                setNextVersion(1);
              }
            }
          } catch (error) {
            console.error("Error fetching versions:", error);
          }
        }
      }
    };

    fetchVersions();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    return validTypes.includes(file.type);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFilesAdded(droppedFiles);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      handleFilesAdded(newFiles);
    }
  };

  const handleFilesAdded = (newFiles: File[]) => {
    const validFiles = newFiles.filter(validateFile);
    
    if (validFiles.length === 0) {
      alert("Please upload only PDF or DOCX files.");
      return;
    }

    if (validFiles.length !== newFiles.length) {
      alert("Some files were skipped. Please upload only PDF or DOCX files.");
    }

    // Add new files without version (will be auto-assigned based on order)
    const newSelectedFiles: SelectedFile[] = validFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      version: undefined, // undefined = auto-assign new version
    }));
    
    setSelectedFiles(prev => {
      const updated = [...prev, ...newSelectedFiles];
      // Recalculate nextVersion based on current files
      const maxExistingVersion = availableVersions.length > 0 
        ? Math.max(...availableVersions.map(v => v.version))
        : 0;
      setNextVersion(maxExistingVersion + updated.length);
      return updated;
    });
  };

  const handleVersionChange = (fileId: string, versionValue: string) => {
    const newVersion = parseInt(versionValue, 10);
    setSelectedFiles(prev => {
      // Find the file being changed and calculate its current version
      const currentFileIndex = prev.findIndex(f => f.id === fileId);
      const currentFile = prev[currentFileIndex];
      
      // Calculate current version (explicit or auto-assigned) using same logic as render
      const maxExistingVersion = availableVersions.length > 0 
        ? Math.max(...availableVersions.map(v => v.version))
        : 0;
      
      // Calculate max version before this file (considering explicit and auto-assigned)
      let maxVersionBeforeThisFile = maxExistingVersion;
      for (let i = 0; i < currentFileIndex; i++) {
        const file = prev[i];
        if (file.version !== undefined) {
          maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, file.version);
        } else {
          const filesBeforeThis = prev.slice(0, i);
          const undefinedBeforeThis = filesBeforeThis.filter(f => f.version === undefined).length;
          const calculatedVersion = maxExistingVersion + undefinedBeforeThis + 1;
          maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, calculatedVersion);
        }
      }
      
      const currentVersion = currentFile.version !== undefined
        ? currentFile.version
        : maxVersionBeforeThisFile + 1;
      
      // Find if another file already has (or would auto-assign to) the target version
      let fileWithTargetVersion = prev.find(f => {
        if (f.id === fileId) return false;
        // Check explicit version
        if (f.version === newVersion) return true;
        // Check auto-assigned version using same logic
        if (f.version === undefined) {
          const fileIndex = prev.findIndex(p => p.id === f.id);
          let maxVersionBeforeThisFile = maxExistingVersion;
          for (let i = 0; i < fileIndex; i++) {
            const file = prev[i];
            if (file.version !== undefined) {
              maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, file.version);
            } else {
              const filesBeforeThis = prev.slice(0, i);
              const undefinedBeforeThis = filesBeforeThis.filter(p => p.version === undefined).length;
              const calculatedVersion = maxExistingVersion + undefinedBeforeThis + 1;
              maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, calculatedVersion);
            }
          }
          const autoAssigned = maxVersionBeforeThisFile + 1;
          return autoAssigned === newVersion;
        }
        return false;
      });
      
      // If no conflict, just assign the version
      if (!fileWithTargetVersion) {
        return prev.map(f => f.id === fileId ? { ...f, version: newVersion } : f);
      }
      
      // If conflict, swap versions between the two files
      return prev.map(f => {
        if (f.id === fileId) {
          return { ...f, version: newVersion };
        }
        if (f.id === fileWithTargetVersion!.id) {
          return { ...f, version: currentVersion };
        }
        return f;
      });
    });
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartProcessing = () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to process");
      return;
    }

    // Save files to sessionStorage for the processing page
    if (typeof window !== 'undefined') {
      const filesToSave = selectedFiles.map(f => ({
        id: f.id,
        fileName: f.file.name,
        fileType: f.file.type,
        fileSize: f.file.size,
        status: "pending",
      }));
      
      sessionStorage.setItem('processingFiles', JSON.stringify(filesToSave));
      
      // Store actual File objects temporarily (they'll be retrieved on the processing page)
      // Note: We'll need to re-select files on the processing page, or we can use a different approach
      // For now, let's create a simple workaround using FileReader
      
      const filePromises = selectedFiles.map(selectedFile => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: selectedFile.id,
              name: selectedFile.file.name,
              type: selectedFile.file.type,
              size: selectedFile.file.size,
              data: e.target?.result,
              preferredVersion: selectedFile.version, // Store user's version preference
            });
          };
          reader.readAsDataURL(selectedFile.file);
        });
      });

      Promise.all(filePromises).then((filesData) => {
        sessionStorage.setItem('uploadedFilesData', JSON.stringify(filesData));
        router.push('/upload/processing');
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload Guidelines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFileInputChange}
        />
        
        {selectedFiles.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-base font-medium mb-2">Drag & drop PDF or DOCX files here</p>
            <p className="text-sm text-muted-foreground mb-6">or click to browse (multiple files supported)</p>
            <Button variant="default" size="default" onClick={handleFileSelect}>
              Select Files
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium mb-1">Drop more files here</p>
              <p className="text-xs text-muted-foreground mb-3">or</p>
              <Button variant="outline" size="sm" onClick={handleFileSelect}>
                Browse Files
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
              {selectedFiles.map((selectedFile, index) => {
                // Calculate max version from database
                const maxExistingVersion = availableVersions.length > 0 
                  ? Math.max(...availableVersions.map(v => v.version))
                  : 0;
                
                // Calculate what version each file before this one has (or would have)
                // This ensures sequential versioning even when files are added separately
                let maxVersionBeforeThisFile = maxExistingVersion;
                for (let i = 0; i < index; i++) {
                  const file = selectedFiles[i];
                  if (file.version !== undefined) {
                    maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, file.version);
                  } else {
                    // Calculate what version this file would get based on files before it
                    const filesBeforeThis = selectedFiles.slice(0, i);
                    const undefinedBeforeThis = filesBeforeThis.filter(f => f.version === undefined).length;
                    const calculatedVersion = maxExistingVersion + undefinedBeforeThis + 1;
                    maxVersionBeforeThisFile = Math.max(maxVersionBeforeThisFile, calculatedVersion);
                  }
                }
                
                // Calculate the range of new versions for ALL selected files
                // These are the versions that will be assigned (v3, v4, v5, v6 if max is v2 and 4 files)
                const newVersionStart = maxExistingVersion + 1;
                const newVersions = Array.from({ length: selectedFiles.length }, (_, i) => newVersionStart + i);
                
                // Calculate auto-assigned version for this file
                // Use the max version before this file + 1, or count undefined files before
                const autoAssignedVersion = selectedFile.version !== undefined
                  ? selectedFile.version
                  : maxVersionBeforeThisFile + 1;
                
                // Determine version to display
                const displayVersion = selectedFile.version !== undefined 
                  ? selectedFile.version 
                  : autoAssignedVersion;
                
                const versionName = `v${displayVersion}`;
                
                return (
                  <div
                    key={selectedFile.id}
                    className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{selectedFile.file.name}</p>
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                            {versionName}
                          </Badge>
              </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.file.size / 1024).toFixed(2)} KB
                          </p>
                          <span className="text-xs text-muted-foreground">•</span>
              <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Version:</span>
                            <Select
                              value={displayVersion.toString()}
                              onValueChange={(value) => {
                                const versionNum = parseInt(value, 10);
                                // Only allow selecting from new versions being assigned
                                if (newVersions.includes(versionNum)) {
                                  handleVersionChange(selectedFile.id, value);
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue>
                                  {versionName}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {newVersions.map((versionNum) => (
                                  <SelectItem key={versionNum} value={versionNum.toString()}>
                                    v{versionNum}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => removeFile(selectedFile.id)}
                 >
                    <X className="w-4 h-4" />
                 </Button>
              </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleStartProcessing}
              >
                Process {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
              </Button>
            <Button 
                variant="outline"
                onClick={() => {
                  setSelectedFiles([]);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Clear All
            </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

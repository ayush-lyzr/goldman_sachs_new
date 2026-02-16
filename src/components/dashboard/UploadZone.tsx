"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface SelectedFile {
  file: File;
  id: string;
}

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

    const newSelectedFiles: SelectedFile[] = validFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
    }));
    
    setSelectedFiles(prev => [...prev, ...newSelectedFiles]);
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
              {selectedFiles.map((selectedFile) => (
                <div
                  key={selectedFile.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
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
              ))}
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

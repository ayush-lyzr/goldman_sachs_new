import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, Loader2, X } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (validTypes.includes(file.type)) {
      setFile(file);
    } else {
      alert("Please upload a PDF or DOCX file");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      // Step 1: Extract markdown from PDF
      const formData = new FormData();
      formData.append("files", file);

      const extractResponse = await fetch("https://chicago-cubs.onrender.com/extract-markdown", {
        method: "POST",
        headers: {
          'accept': 'application/json',
        },
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error("PDF extraction failed");
      }

      const extractData = await extractResponse.json();
      console.log("Extraction successful:", extractData);
      
      if (!extractData.results || extractData.results.length === 0) {
        throw new Error("No content extracted from PDF");
      }

      const markdown = extractData.results[0].markdown;
      
      // Step 2: Get or create customerId and projectId
      let customerId = "";
      let projectId = "";
      let isNewProject = false;
      
      if (typeof window !== 'undefined') {
        const existingCustomerId = sessionStorage.getItem("currentCustomerId");
        customerId = existingCustomerId || crypto.randomUUID();
        projectId = sessionStorage.getItem("currentProjectId") || crypto.randomUUID();
        
        // If no existing customerId, this is a new project
        isNewProject = !existingCustomerId;
        
        // Store IDs for later use
        sessionStorage.setItem("currentCustomerId", customerId);
        sessionStorage.setItem("currentProjectId", projectId);
      }

      // Step 2.5: Create project in database if new
      if (isNewProject) {
        const projectName = file.name.replace(/\.(pdf|docx)$/i, '');
        
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            customerId: customerId,
          }),
        });

        if (!projectResponse.ok) {
          console.error("Failed to create project, continuing anyway");
        }
      }

      // Step 3: Send markdown to rules-extractor agent
      const rulesResponse = await fetch("/api/agents/rules-extractor", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          customerId: customerId,
          extractorResponse: markdown,
        }),
      });

      if (!rulesResponse.ok) {
        throw new Error("Rules extraction failed");
      }

      const rulesData = await rulesResponse.json();
      console.log("Rules extraction successful:", rulesData);
      
      // Check if there was an error parsing the response
      if (rulesData.error) {
        console.error("Rules extraction error:", rulesData);
        throw new Error(`Rules extraction failed: ${rulesData.error}${rulesData.parseError ? ` (${rulesData.parseError})` : ''}`);
      }
      
      // Extract the rules array
      const parsedRules = rulesData.rules || [];
      
      // Step 4: Store both extraction and rules data
      if (typeof window !== 'undefined') {
        sessionStorage.setItem("extractedPDF", JSON.stringify(extractData.results[0]));
        sessionStorage.setItem("extractedRules", JSON.stringify(parsedRules));
      }
      
      router.push("/constraints");
    } catch (error) {
      console.error("Error during extraction:", error);
      alert(error instanceof Error ? error.message : "Failed to process file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload Guidelines</CardTitle>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileInputChange}
        />
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">Drag & drop PDF or DOCX here</p>
            <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
            <Button variant="outline" size="sm" onClick={handleFileSelect}>
              Select File
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <FileText className="w-8 h-8 text-success" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">Ready for extraction</p>
              </div>
              <div className="flex items-center gap-2">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8 hover:bg-success/20"
                   onClick={() => setFile(null)} 
                   disabled={isUploading}
                 >
                    <X className="w-4 h-4" />
                 </Button>
                 <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                "Extract Constraints"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

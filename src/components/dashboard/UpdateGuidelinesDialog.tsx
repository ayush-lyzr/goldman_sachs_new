import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ArrowRight } from "lucide-react";

interface UpdateGuidelinesDialogProps {
  portfolioName: string;
  children: React.ReactNode;
}

export function UpdateGuidelinesDialog({ portfolioName, children }: UpdateGuidelinesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleProceed = () => {
    setIsOpen(false);
    // Navigate to constraints page with comparison mode enabled
    router.push("/constraints?compare=true");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Investment Guidelines</DialogTitle>
          <DialogDescription>
            Upload updated guidelines for <span className="font-medium">{portfolioName}</span> to compare with existing constraints.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Current file info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Current Guidelines</p>
              <p className="text-xs text-muted-foreground">Investment_Guidelines_Q4_2024.pdf</p>
            </div>
          </div>

          {/* Upload zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-success" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">Ready to compare</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop new guidelines PDF
                </p>
                <label className="cursor-pointer">
                  <span className="text-sm text-primary hover:underline">or browse files</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </>
            )}
          </div>

          <Button 
            className="w-full" 
            disabled={!file}
            onClick={handleProceed}
          >
            Compare Guidelines
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

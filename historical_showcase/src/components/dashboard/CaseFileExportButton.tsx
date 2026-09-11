import { useState } from "react";
import { Download, FileText, CheckCircle2, Loader2, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";
import type { P4Output } from "@/lib/contracts/p4";
import type { P5Output } from "@/lib/contracts/p5";
import { compileCaseFile, triggerCaseFileDownload } from "@/lib/adapters/exportAdapter";

export interface CaseFileExportButtonProps {
  p1Data: P1Output;
  p3Data: P3Output;
  p4Data: P4Output;
  p5Data: P5Output;
  variant?: "header" | "card";
}

export function CaseFileExportButton({
  p1Data,
  p3Data,
  p4Data,
  p5Data,
  variant = "header",
}: CaseFileExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExport = (format: "json" | "txt") => {
    setIsExporting(true);
    setShowDropdown(false);

    setTimeout(() => {
      const caseFile = compileCaseFile({
        p1Data,
        p3Data,
        p4Data,
        p5Data,
      });

      const success = triggerCaseFileDownload(caseFile, format);
      setIsExporting(false);

      if (success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    }, 450);
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        variant={variant === "header" ? "default" : "outline"}
        size="sm"
        disabled={isExporting}
        onClick={() => setShowDropdown(!showDropdown)}
        className={`h-8 gap-1.5 rounded-lg text-xs font-bold shadow-md cursor-pointer transition-all ${
          exportSuccess
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : variant === "header"
            ? "bg-cyan-600 hover:bg-cyan-500 text-white"
            : "border-border bg-card hover:bg-accent text-foreground"
        }`}
        title="Download forensic case-file dossier"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Compiling…</span>
          </>
        ) : exportSuccess ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            <span>Dossier Exported</span>
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            <span>Export Case-File</span>
          </>
        )}
      </Button>

      {/* Export Format Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
            Choose Dossier Format
          </div>

          <button
            type="button"
            onClick={() => handleExport("json")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
          >
            <FileJson className="h-4 w-4 text-cyan-400" />
            <div>
              <span>JSON Case-File</span>
              <span className="block text-[9px] font-normal text-muted-foreground">Full structured pipeline payload</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExport("txt")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            <div>
              <span>Investigation Brief</span>
              <span className="block text-[9px] font-normal text-muted-foreground">Human-readable audit text file</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

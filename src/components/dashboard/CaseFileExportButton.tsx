import { useState } from "react";
import { Download, FileText, CheckCircle2, Loader2, FileJson } from "lucide-react";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";
import type { P4Output } from "@/lib/contracts/p4";
import type { P5Output } from "@/lib/contracts/p5";
import { compileCaseFile, triggerCaseFileDownload } from "@/lib/adapters/exportAdapter";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";

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
    <div className="relative inline-block text-left select-none">
      <button
        type="button"
        disabled={isExporting}
        onClick={() => setShowDropdown(!showDropdown)}
        className="h-8 px-3 gap-1.5 rounded-xs text-[10.5px] font-mono font-bold tracking-wider uppercase cursor-pointer transition-all inline-flex items-center justify-center border"
        style={{
          background: exportSuccess ? "rgba(16, 185, 129, 0.2)" : "#111822",
          borderColor: exportSuccess ? "#10B981" : "#22D3EE",
          color: exportSuccess ? "#10B981" : "#22D3EE",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
        title="Download forensic case-file dossier"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Compiling…</span>
          </>
        ) : exportSuccess ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
            <span>Dossier Exported</span>
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            <span>Export Case-File</span>
          </>
        )}
      </button>

      {/* Export Format Dropdown Modal / Popup */}
      {showDropdown && (
        <div className="absolute right-0 mt-1.5 w-52 z-50">
          <OperationsPanel
            variant="compact"
            borderLeftAccent
            accentColor="cyan"
            showCornerBrackets
            glow
            style={{
              padding: "6px",
              backgroundColor: "#0D1117",
            }}
          >
            <div className="px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-wider text-[#5A7A94] border-b border-[#1C2A38] mb-1">
              Select Dossier Format
            </div>

            <button
              type="button"
              onClick={() => handleExport("json")}
              className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-[11px] font-mono text-[#E2E8F0] hover:bg-[#111822] cursor-pointer transition-colors"
            >
              <FileJson className="h-4 w-4 text-[#22D3EE] flex-shrink-0" />
              <div>
                <span className="font-semibold block">JSON Data Payload</span>
                <span className="block text-[8px] text-[#5A7A94]">Full pipeline telemetry schema</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleExport("txt")}
              className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-[11px] font-mono text-[#E2E8F0] hover:bg-[#111822] cursor-pointer transition-colors"
            >
              <FileText className="h-4 w-4 text-[#10B981] flex-shrink-0" />
              <div>
                <span className="font-semibold block">Forensic Brief (.txt)</span>
                <span className="block text-[8px] text-[#5A7A94]">Official Coast Guard submission</span>
              </div>
            </button>
          </OperationsPanel>
        </div>
      )}
    </div>
  );
}

export default CaseFileExportButton;

import { createFileRoute } from "@tanstack/react-router";
import { MissionController } from "@/components/mission/MissionController";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIH 26143 — Maritime Intelligence" },
      {
        name: "description",
        content:
          "SIH 26143 — Interactive oil spill attribution & containment experience: SAR, AIS backtrack, physics drift, culprit lock, containment ops.",
      },
      { property: "og:title", content: "SIH 26143" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MissionController,
});

/**
 * SIH 26143 — Vessel Search & AIS Indexing Utility
 *
 * Indexes all AIS vessels (synthetic swarm + API tracks + dark vessels)
 * and provides high-speed search by:
 * - MMSI (e.g. 419000101)
 * - Vessel ID / Contact ID (e.g. cand-001, vessel-001, CFAR_DARK_002)
 * - IMO Number (e.g. IMO 9482104, 9482104)
 * - Vessel Name (e.g. MT IND_TANKER_412, MT Chem Pioneer, Container Express)
 * - Callsign (e.g. VTXB)
 * - Flag & Vessel Type
 */

import type { SwarmVessel } from "./swarmData";
import type { VesselTrack } from "../contracts/p5";

export interface SearchableVessel {
  id: string;
  name: string;
  mmsi: string;
  imo: string;
  callsign: string;
  flag: string;
  vesselType: string;
  typeLabel: string;
  position: [number, number]; // [lng, lat]
  speedKnots: number;
  course: number;
  heading: number;
  navStatus: string;
  destination: string;
  eta?: string;
  lengthMeters: number;
  beamMeters: number;
  draughtMeters: number;
  isCandidate: boolean;
  isDarkVessel: boolean;
  threatTag?: string;
  suspicionLevel: "high" | "moderate" | "low" | "none";
  blackoutDurationHours?: number;
  riskScore?: string | number;
  trajectory: [number, number][];
  raw: SwarmVessel | VesselTrack;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash;
}

/**
 * Builds a unified, deduplicated array of SearchableVessels from SwarmVessels and VesselTracks
 */
export function indexAisVessels(
  swarmVessels: SwarmVessel[] = [],
  p5Tracks: VesselTrack[] = []
): SearchableVessel[] {
  const map = new Map<string, SearchableVessel>();

  // 1. Index API Tracks first (primary forensic truth)
  for (const vt of p5Tracks) {
    const key = vt.mmsi || vt.vesselId;
    if (!key) continue;

    const ping = vt.pings?.[0];
    const pos = (ping?.position ?? vt.path?.[0] ?? [71.9, 19.28]) as [number, number];
    const imo = vt.imo || `IMO ${9100000 + Math.abs(simpleHash(vt.vesselId || vt.vesselName)) % 800000}`;

    map.set(key, {
      id: vt.vesselId,
      name: vt.vesselName,
      mmsi: vt.mmsi,
      imo,
      callsign: vt.callsign || "UNKNOWN",
      flag: vt.flag || "International",
      vesselType: vt.vesselType || "tanker",
      typeLabel: vt.vesselType || "Commercial Vessel",
      position: pos,
      speedKnots: ping?.sogKnots ?? 12.5,
      course: ping?.cogDegrees ?? 135,
      heading: ping?.headingDegrees ?? 135,
      navStatus: ping?.navStatus ?? (vt.isDarkVessel ? "AIS Blackout" : "Underway using Engine"),
      destination: vt.destination || "MUMBAI OFFSHORE",
      eta: vt.eta || "2026-05-15 14:00 UTC",
      lengthMeters: vt.lengthMeters || 180,
      beamMeters: vt.beamMeters || 28,
      draughtMeters: vt.draughtMeters || 9.5,
      isCandidate: !!vt.isCandidate,
      isDarkVessel: !!(vt.isDarkVessel || vt.darkAnomaly),
      threatTag: vt.isDarkVessel
        ? "DARK TARGET · RADAR ONLY"
        : vt.isCandidate
        ? "CORRIDOR CANDIDATE"
        : undefined,
      suspicionLevel: vt.isDarkVessel || vt.isCandidate ? "high" : "none",
      blackoutDurationHours: vt.darkAnomaly?.gapDurationHours,
      trajectory: vt.path && vt.path.length > 0 ? vt.path : [pos],
      raw: vt,
    });
  }

  // 2. Index Swarm Vessels (filling in any missing or synthetic vessels)
  for (const sv of swarmVessels) {
    const key = sv.mmsi || sv.id;
    if (map.has(key)) {
      // Merge extra details into existing
      const existing = map.get(key)!;
      if (sv.imo && !existing.imo.startsWith("IMO 9")) existing.imo = sv.imo;
      if (sv.threatTag && !existing.threatTag) existing.threatTag = sv.threatTag;
      continue;
    }

    const imo = sv.imo || `IMO ${9100000 + Math.abs(simpleHash(sv.id || sv.name)) % 800000}`;

    map.set(key, {
      id: sv.id,
      name: sv.name,
      mmsi: sv.mmsi,
      imo,
      callsign: sv.callsign,
      flag: sv.flag,
      vesselType: sv.vesselType,
      typeLabel: sv.typeLabel,
      position: sv.position,
      speedKnots: sv.speedKnots,
      course: sv.course,
      heading: sv.heading,
      navStatus: sv.navStatus,
      destination: sv.destination,
      eta: sv.eta,
      lengthMeters: sv.lengthMeters,
      beamMeters: sv.beamMeters,
      draughtMeters: sv.draughtMeters,
      isCandidate: !!sv.isCandidate,
      isDarkVessel: !!sv.isDarkVessel,
      threatTag: sv.threatTag,
      suspicionLevel: sv.suspicionLevel,
      blackoutDurationHours: sv.blackoutDurationHours,
      riskScore: sv.riskScore,
      trajectory: sv.trajectory,
      raw: sv,
    });
  }

  return Array.from(map.values());
}

export type VesselFilterCategory = "all" | "suspects" | "dark" | "tankers" | "cargo";

/**
 * Searches and ranks vessels by multi-factor score (Name, MMSI, IMO, ID, Callsign, Flag)
 */
export function searchAisVessels(
  vessels: SearchableVessel[],
  rawQuery: string,
  category: VesselFilterCategory = "all"
): SearchableVessel[] {
  // 1. Filter by category
  let filtered = vessels;
  if (category === "suspects") {
    filtered = vessels.filter((v) => v.isCandidate || v.suspicionLevel === "high" || v.mmsi === "419000101");
  } else if (category === "dark") {
    filtered = vessels.filter((v) => v.isDarkVessel || v.threatTag?.includes("DARK") || v.navStatus.includes("Blackout"));
  } else if (category === "tankers") {
    filtered = vessels.filter((v) => v.vesselType === "tanker" || v.typeLabel.toLowerCase().includes("tanker"));
  } else if (category === "cargo") {
    filtered = vessels.filter(
      (v) =>
        v.vesselType === "container" ||
        v.vesselType === "bulk" ||
        v.typeLabel.toLowerCase().includes("cargo") ||
        v.typeLabel.toLowerCase().includes("container") ||
        v.typeLabel.toLowerCase().includes("carrier")
    );
  }

  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    // Return sorted with prioritized suspects first
    return [...filtered].sort((a, b) => {
      if (a.mmsi === "419000101") return -1;
      if (b.mmsi === "419000101") return 1;
      if (a.isCandidate && !b.isCandidate) return -1;
      if (!a.isCandidate && b.isCandidate) return 1;
      if (a.isDarkVessel && !b.isDarkVessel) return -1;
      if (!a.isDarkVessel && b.isDarkVessel) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const cleanNumQuery = query.replace(/[^0-9]/g, "");

  const scored: { vessel: SearchableVessel; score: number }[] = [];

  for (const v of filtered) {
    const nameLower = v.name.toLowerCase();
    const idLower = v.id.toLowerCase();
    const mmsiLower = v.mmsi.toLowerCase();
    const imoLower = v.imo.toLowerCase();
    const cleanImo = imoLower.replace(/[^0-9]/g, "");
    const callsignLower = v.callsign.toLowerCase();
    const flagLower = v.flag.toLowerCase();
    const typeLower = v.typeLabel.toLowerCase();

    let score = 0;

    // Exact matches
    if (mmsiLower === query) score += 120;
    else if (nameLower === query) score += 100;
    else if (idLower === query) score += 90;
    else if (cleanNumQuery && cleanImo === cleanNumQuery) score += 90;

    // Prefix matches
    else if (nameLower.startsWith(query)) score += 75;
    else if (mmsiLower.startsWith(query)) score += 70;
    else if (idLower.startsWith(query)) score += 65;
    else if (cleanNumQuery && cleanImo.startsWith(cleanNumQuery)) score += 60;

    // Substring matches
    else if (nameLower.includes(query)) score += 50;
    else if (mmsiLower.includes(query)) score += 45;
    else if (idLower.includes(query)) score += 40;
    else if (cleanNumQuery && cleanImo.includes(cleanNumQuery)) score += 35;
    else if (callsignLower.includes(query)) score += 30;
    else if (flagLower.includes(query)) score += 20;
    else if (typeLower.includes(query)) score += 15;

    if (score > 0) {
      // Prioritize primary culprits and dark vessels in tie-breakers
      if (v.mmsi === "419000101") score += 15;
      if (v.isCandidate) score += 10;
      if (v.isDarkVessel) score += 8;

      scored.push({ vessel: v, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.vessel);
}

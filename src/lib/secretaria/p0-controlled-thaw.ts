import {
  normalizeRulePackVersion,
  type CanonicalRulePackVersion,
  type RawRulePackVersionRow,
} from "@/lib/rules-engine/rule-resolution";
import { getRulePackSeedTargetsByPriority } from "./fallback-retirement-plan";

export type P0ControlledThawStatus = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";

export interface P0ControlledThawPackReadiness {
  targetPackId: string;
  acceptedPackIds: string[];
  matchedVersions: CanonicalRulePackVersion[];
  selectedVersion: CanonicalRulePackVersion | null;
  status: P0ControlledThawStatus;
  blockingIssues: string[];
  warnings: string[];
}

export interface P0ControlledThawReadiness {
  ok: boolean;
  packs: P0ControlledThawPackReadiness[];
  blockingIssues: string[];
  warnings: string[];
}

function isActiveHashed(version: CanonicalRulePackVersion) {
  return version.lifecycleStatus === "ACTIVE" && Boolean(version.persistedPayloadHash);
}

function compareVersionDesc(a: CanonicalRulePackVersion, b: CanonicalRulePackVersion) {
  const parse = (value: string) => (value.match(/\d+/g) ?? ["0"]).map(Number);
  const aParts = parse(a.version);
  const bParts = parse(b.version);
  const length = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (bParts[index] ?? 0) - (aParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return b.versionId.localeCompare(a.versionId);
}

export function evaluateP0ControlledThawRulePacks(
  rows: RawRulePackVersionRow[],
): P0ControlledThawReadiness {
  const normalized = rows.map(normalizeRulePackVersion);

  const packs = getRulePackSeedTargetsByPriority("P0").map((target): P0ControlledThawPackReadiness => {
    const acceptedPackIds = target.acceptedPackIds ?? [target.packId];
    const matchedVersions = normalized
      .filter((version) => acceptedPackIds.includes(version.packId))
      .sort(compareVersionDesc);
    const activeHashed = matchedVersions.filter(isActiveHashed);
    const selectedVersion = activeHashed[0] ?? null;
    const blockingIssues: string[] = [];
    const warnings = matchedVersions.flatMap((version) => version.warnings);

    if (matchedVersions.length === 0) {
      blockingIssues.push(`No hay rule pack Cloud para ${target.packId}.`);
    }
    if (matchedVersions.length > 0 && activeHashed.length === 0) {
      blockingIssues.push(`No hay version ACTIVE con payload_hash persistido para ${target.packId}.`);
    }
    if (activeHashed.length > 1) {
      warnings.push(`Hay ${activeHashed.length} versiones ACTIVE con hash para ${target.packId}; se usara la semver mas reciente.`);
    }
    if (selectedVersion && selectedVersion.packId !== target.packId) {
      warnings.push(`${target.packId} se satisface mediante alias Cloud ${selectedVersion.packId}.`);
    }

    const status: P0ControlledThawStatus =
      blockingIssues.length > 0 ? "BLOCKED" : warnings.length > 0 ? "READY_WITH_WARNINGS" : "READY";

    return {
      targetPackId: target.packId,
      acceptedPackIds,
      matchedVersions,
      selectedVersion,
      status,
      blockingIssues,
      warnings,
    };
  });

  const blockingIssues = packs.flatMap((pack) => pack.blockingIssues);
  const warnings = packs.flatMap((pack) => pack.warnings);

  return {
    ok: blockingIssues.length === 0,
    packs,
    blockingIssues,
    warnings,
  };
}

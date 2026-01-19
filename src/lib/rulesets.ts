/**
 * Utility functions for managing project rulesets with versioning
 */

export interface Ruleset {
  version: number;
  versionName: string;
  createdAt: Date | string;
  data: {
    mapped_rules?: Array<{
      constraint: string;
      sentinel_allowed_values: string[];
      rules: string[];
    }>;
    raw_rules?: Array<{
      title: string;
      rules: string[];
    }>;
  };
}

export interface RulesetMetadata {
  version: number;
  versionName: string;
  createdAt: Date | string;
  dataPreview: {
    hasMappedRules: boolean;
    hasRawRules: boolean;
    mappedRulesCount: number;
    rawRulesCount: number;
  };
}

/**
 * Fetch all rulesets for a project by customerId
 */
export async function fetchRulesets(customerId: string): Promise<{
  projectName: string;
  rulesets: RulesetMetadata[];
}> {
  const response = await fetch(`/api/projects/rulesets?customerId=${customerId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch rulesets");
  }
  
  return response.json();
}

/**
 * Save a new ruleset for a project
 */
export async function saveRuleset(
  customerId: string,
  data: Ruleset["data"],
  versionName?: string
): Promise<{
  success: boolean;
  version: number;
  versionName: string;
  createdAt: string;
}> {
  const response = await fetch("/api/projects/rulesets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId,
      versionName,
      data,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to save ruleset");
  }
  
  return response.json();
}

/**
 * Format a date string for display
 */
export function formatRulesetDate(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid date";
  
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get the latest ruleset from an array of rulesets
 */
export function getLatestRuleset(rulesets: Ruleset[]): Ruleset | null {
  if (!rulesets || rulesets.length === 0) return null;
  
  return rulesets.reduce((latest, current) => {
    return current.version > latest.version ? current : latest;
  }, rulesets[0]);
}

/**
 * Compare two rulesets to find differences
 */
export function compareRulesets(
  oldRuleset: Ruleset | null,
  newRuleset: Ruleset
): {
  addedRules: number;
  modifiedRules: number;
  removedRules: number;
} {
  if (!oldRuleset) {
    return {
      addedRules: newRuleset.data.mapped_rules?.length || 0,
      modifiedRules: 0,
      removedRules: 0,
    };
  }
  
  const oldRules = oldRuleset.data.mapped_rules || [];
  const newRules = newRuleset.data.mapped_rules || [];
  
  const oldConstraints = new Set(oldRules.map(r => r.constraint));
  const newConstraints = new Set(newRules.map(r => r.constraint));
  
  let addedRules = 0;
  let removedRules = 0;
  let modifiedRules = 0;
  
  // Check for added rules
  for (const constraint of newConstraints) {
    if (!oldConstraints.has(constraint)) {
      addedRules++;
    }
  }
  
  // Check for removed rules
  for (const constraint of oldConstraints) {
    if (!newConstraints.has(constraint)) {
      removedRules++;
    }
  }
  
  // Check for modified rules (exist in both but different)
  for (const constraint of newConstraints) {
    if (oldConstraints.has(constraint)) {
      const oldRule = oldRules.find(r => r.constraint === constraint);
      const newRule = newRules.find(r => r.constraint === constraint);
      
      if (oldRule && newRule) {
        const oldValues = JSON.stringify(oldRule.sentinel_allowed_values);
        const newValues = JSON.stringify(newRule.sentinel_allowed_values);
        
        if (oldValues !== newValues) {
          modifiedRules++;
        }
      }
    }
  }
  
  return { addedRules, modifiedRules, removedRules };
}

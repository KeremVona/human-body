import type { PipelineConfig, PipelineRule } from './config';
import type { InventoryObject } from './types';

/** Matched inventory object paired with its destination bundle and winning rule. */
export type Selection = {
  object: InventoryObject;
  bundleId: string;
  rule: PipelineRule;
};

type CompiledRule = {
  bundleId: string;
  rule: PipelineRule;
  collection?: string;
  nameRe: RegExp | null;
  excludeRes: RegExp[];
};

function matchesCollection(collections: string[], target: string): boolean {
  const prefix = `${target}/`;
  return collections.some((c) => c === target || c.startsWith(prefix));
}

function compileRules(config: PipelineConfig): CompiledRule[] {
  const compiled: CompiledRule[] = [];
  for (const bundle of config.bundles) {
    for (const rule of bundle.rules) {
      compiled.push({
        bundleId: bundle.id,
        rule,
        collection: rule.match.collection,
        nameRe: rule.match.name ? new RegExp(rule.match.name, 'i') : null,
        excludeRes: (rule.exclude ?? []).map((src) => new RegExp(src, 'i')),
      });
    }
  }
  return compiled;
}

function ruleMatches(cr: CompiledRule, obj: InventoryObject): boolean {
  if (cr.collection && !matchesCollection(obj.collections, cr.collection)) {
    return false;
  }
  if (cr.nameRe && !cr.nameRe.test(obj.name)) {
    return false;
  }
  if (cr.excludeRes.some((re) => re.test(obj.name))) {
    return false;
  }
  return true;
}

/** Selects MESH objects using first-match-wins pipeline rules, skipping non-MESH objects. */
export function selectObjects(
  config: PipelineConfig,
  objects: InventoryObject[],
): { selected: Selection[]; unmatched: number } {
  const rules = compileRules(config);
  const selected: Selection[] = [];
  let unmatched = 0;

  for (const object of objects) {
    if (object.type !== 'MESH') continue;
    const hit = rules.find((r) => ruleMatches(r, object));
    if (hit) {
      selected.push({ object, bundleId: hit.bundleId, rule: hit.rule });
    } else {
      unmatched++;
    }
  }

  return { selected, unmatched };
}

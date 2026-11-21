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
  types: Set<string>;
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
        types: new Set(rule.types ?? ['MESH']),
        collection: rule.match.collection,
        nameRe: rule.match.name ? new RegExp(rule.match.name, 'i') : null,
        excludeRes: (rule.exclude ?? []).map((src) => new RegExp(src, 'i')),
      });
    }
  }
  return compiled;
}

function ruleMatches(cr: CompiledRule, obj: InventoryObject): boolean {
  if (!cr.types.has(obj.type)) {
    return false;
  }
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

/** Selects objects matching rule types (default MESH) using first-match-wins pipeline rules. */
export function selectObjects(
  config: PipelineConfig,
  objects: InventoryObject[],
): { selected: Selection[]; unmatched: number } {
  const rules = compileRules(config);
  const candidateTypes = new Set(rules.flatMap((r) => [...r.types]));
  candidateTypes.add('MESH');
  const selected: Selection[] = [];
  let unmatched = 0;

  for (const object of objects) {
    if (!candidateTypes.has(object.type)) continue;
    const hit = rules.find((r) => ruleMatches(r, object));
    if (hit) {
      selected.push({ object, bundleId: hit.bundleId, rule: hit.rule });
    } else {
      unmatched++;
    }
  }

  return { selected, unmatched };
}

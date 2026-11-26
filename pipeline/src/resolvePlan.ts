import {
  isMeshId,
  parseMeshId,
  type MeshId,
  type StructureId,
} from '../../src/data/ids';
import type {
  HexColor,
  Kind,
  RegionId,
  SystemId,
  Tissue,
} from '../../src/data/schema';
import type { PipelineConfig, PipelineRule } from './config';
import type { NameMap } from './nameMap';
import { selectObjects, type Selection } from './select';
import type { Inventory } from './types';

/** Blender export plan mapping source object names to MeshIds per bundle. */
export type ExportPlan = {
  originBundle: string;
  rotateZDeg: number;
  scale: number;
  bundles: {
    id: string;
    objects: { source: string; meshId: MeshId }[];
  }[];
  centerlines?: { id: string; source: string; reverse: boolean }[];
};

/** Metadata stub derived from pipeline rules and name mappings for scaffolding index.json. */
export type StructureStub = {
  id: StructureId;
  displayName: string;
  system: SystemId;
  region: RegionId;
  kind: Kind;
  tissue: Tissue;
  color?: HexColor;
  paired: boolean;
  meshIds: MeshId[];
};

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toDisplayName(sourceName: string): string {
  const cleaned = sourceName
    .replace(/\.\d{3}$/, '')
    .replace(/[._\s](l|r|left|right)$/i, '')
    .trim();
  if (!cleaned) return sourceName;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const CONSISTENT_FIELDS = [
  'system',
  'region',
  'kind',
  'tissue',
  'color',
] as const;

type ResolvedMesh = {
  selection: Selection;
  meshId: MeshId;
  structureId: StructureId;
  paired: boolean;
};

/** Resolves selected inventory objects against the name-map into an ExportPlan and StructureStubs. */
export function resolvePlan(
  config: PipelineConfig,
  inventory: Inventory,
  nameMap: NameMap,
): { plan: ExportPlan; stubs: StructureStub[]; problems: string[] } {
  const problems: string[] = [];
  const { selected } = selectObjects(config, inventory.objects);

  const byBundle = new Map<string, { source: string; meshId: MeshId }[]>();
  for (const bundle of config.bundles) {
    byBundle.set(bundle.id, []);
  }

  const byMeshId = new Map<MeshId, string>();
  const byStructure = new Map<StructureId, ResolvedMesh[]>();

  for (const selection of selected) {
    const sourceName = selection.object.name;
    const meshId = Object.hasOwn(nameMap, sourceName)
      ? nameMap[sourceName]
      : undefined;

    if (!meshId) {
      problems.push(
        `name-map: no id for "${sourceName}" (run npm run assets:namemap)`,
      );
      continue;
    }

    if (!isMeshId(meshId)) {
      problems.push(
        `name-map: invalid mesh id "${meshId}" for "${sourceName}"`,
      );
      continue;
    }

    const existingSource = byMeshId.get(meshId);
    if (existingSource !== undefined) {
      problems.push(
        `name-map: "${existingSource}" and "${sourceName}" both map to "${meshId}"`,
      );
      continue;
    }
    byMeshId.set(meshId, sourceName);

    const { structureId, side } = parseMeshId(meshId);
    byBundle.get(selection.bundleId)!.push({ source: sourceName, meshId });

    let group = byStructure.get(structureId);
    if (!group) {
      group = [];
      byStructure.set(structureId, group);
    }
    group.push({
      selection,
      meshId,
      structureId,
      paired: side !== null,
    });
  }

  const bundles = config.bundles.map((b) => ({
    id: b.id,
    objects: [...byBundle.get(b.id)!].sort((a, c) =>
      compareAscii(a.meshId, c.meshId),
    ),
  }));

  const stubs: StructureStub[] = [];
  for (const structureId of [...byStructure.keys()].sort(compareAscii)) {
    const items = [...byStructure.get(structureId)!].sort((a, b) =>
      compareAscii(a.meshId, b.meshId),
    );
    const first = items[0];
    const firstRule: PipelineRule = first.selection.rule;

    for (const item of items.slice(1)) {
      if (item.paired !== first.paired) {
        problems.push(
          `structure "${structureId}": meshes disagree on pairedness`,
        );
      }
      for (const field of CONSISTENT_FIELDS) {
        if (item.selection.rule[field] !== firstRule[field]) {
          problems.push(
            `structure "${structureId}": meshes disagree on ${field} (${firstRule[field] ?? 'none'} vs ${item.selection.rule[field] ?? 'none'})`,
          );
        }
      }
    }

    const stub: StructureStub = {
      id: structureId,
      displayName: toDisplayName(first.selection.object.name),
      system: firstRule.system,
      region: firstRule.region,
      kind: firstRule.kind,
      tissue: firstRule.tissue,
      ...(firstRule.color !== undefined ? { color: firstRule.color } : {}),
      paired: first.paired,
      meshIds: items.map((i) => i.meshId),
    };
    stubs.push(stub);
  }

  const inventoryByName = new Map(
    inventory.objects.map((o) => [o.name, o] as const),
  );
  const curves = config.centerlines?.curves ?? [];
  const centerlines: Array<{ id: string; source: string; reverse: boolean }> =
    [];
  for (const curve of curves) {
    const invObj = inventoryByName.get(curve.source);
    if (!invObj) {
      problems.push(
        `centerlines: curve "${curve.id}" source "${curve.source}" not found in inventory`,
      );
      continue;
    }
    if (invObj.type !== 'CURVE') {
      problems.push(
        `centerlines: curve "${curve.id}" source "${curve.source}" has type ${invObj.type}, expected CURVE`,
      );
      continue;
    }
    centerlines.push({
      id: curve.id,
      source: curve.source,
      reverse: curve.reverse,
    });
  }

  const plan: ExportPlan = {
    originBundle: config.originBundle,
    rotateZDeg: config.orientation.rotateZDeg,
    scale: config.orientation.scale,
    bundles,
    ...(centerlines.length > 0 ? { centerlines } : {}),
  };

  return { plan, stubs, problems };
}

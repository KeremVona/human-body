import type { MeshId, StructureId } from '../../data/ids';
import type {
  IndexEntry,
  IndexFile,
  Manifest,
  Taxonomy,
} from '../../data/schema';

export type TreeNode = {
  key: string;
  kind: 'system' | 'region' | 'group' | 'structure' | 'mesh';
  label: string;
  meshIds: MeshId[];
  children: TreeNode[];
};

export type TreeRow = {
  key: string;
  depth: number;
  label: string;
  kind: TreeNode['kind'];
  hasChildren: boolean;
  expanded: boolean;
  meshIds: MeshId[];
};

function formatGroupLabel(groupSlug: string): string {
  const words = groupSlug.split('-').filter(Boolean);
  if (words.length === 0) return groupSlug;
  return words
    .map((w, idx) => (idx === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function structureMeshes(
  entry: IndexEntry,
  manifestMeshes: Record<string, unknown>,
): { meshIds: MeshId[]; sideChildren: TreeNode[] } {
  const leftId = `${entry.id}--l` as MeshId;
  const rightId = `${entry.id}--r` as MeshId;
  const hasLeft = Object.hasOwn(manifestMeshes, leftId);
  const hasRight = Object.hasOwn(manifestMeshes, rightId);
  const hasSingle = Object.hasOwn(manifestMeshes, entry.id);

  const meshIds: MeshId[] = [];
  const sideChildren: TreeNode[] = [];

  if (hasLeft) {
    meshIds.push(leftId);
    if (entry.paired) {
      sideChildren.push({
        key: `mesh:${leftId}`,
        kind: 'mesh',
        label: 'Left',
        meshIds: [leftId],
        children: [],
      });
    }
  }
  if (hasRight) {
    meshIds.push(rightId);
    if (entry.paired) {
      sideChildren.push({
        key: `mesh:${rightId}`,
        kind: 'mesh',
        label: 'Right',
        meshIds: [rightId],
        children: [],
      });
    }
  }
  if (meshIds.length === 0 && hasSingle) {
    const singleId = entry.id as MeshId;
    meshIds.push(singleId);
  }

  return {
    meshIds,
    sideChildren: entry.paired ? sideChildren : [],
  };
}

/** Builds a deterministic system > region > group > structure > side tree omitting empty branches. */
export function buildTree(
  taxonomy: Taxonomy,
  index: IndexFile,
  manifest: Manifest,
): TreeNode[] {
  const systemEntries = new Map<string, IndexEntry[]>();
  for (const s of index.structures) {
    let list = systemEntries.get(s.system);
    if (!list) {
      list = [];
      systemEntries.set(s.system, list);
    }
    list.push(s);
  }

  const orderedSystems = taxonomy.systems
    .slice()
    .sort((a, b) => a.order - b.order);

  const tree: TreeNode[] = [];

  for (const sys of orderedSystems) {
    const entries = systemEntries.get(sys.id);
    if (!entries || entries.length === 0) continue;

    const byRegion = new Map<string, IndexEntry[]>();
    for (const entry of entries) {
      let list = byRegion.get(entry.region);
      if (!list) {
        list = [];
        byRegion.set(entry.region, list);
      }
      list.push(entry);
    }

    const regionNodes: TreeNode[] = [];
    for (const reg of taxonomy.regions) {
      const regEntries = byRegion.get(reg.id);
      if (!regEntries || regEntries.length === 0) continue;

      const byGroup = new Map<string, TreeNode[]>();
      const ungrouped: TreeNode[] = [];

      for (const entry of regEntries) {
        const { meshIds, sideChildren } = structureMeshes(
          entry,
          manifest.meshes,
        );
        if (meshIds.length === 0) continue;

        const structNode: TreeNode = {
          key: `str:${entry.id}`,
          kind: 'structure',
          label: entry.names.common,
          meshIds,
          children: sideChildren,
        };

        if (entry.group) {
          let list = byGroup.get(entry.group);
          if (!list) {
            list = [];
            byGroup.set(entry.group, list);
          }
          list.push(structNode);
        } else {
          ungrouped.push(structNode);
        }
      }

      const groupNodes: TreeNode[] = [];
      for (const [groupSlug, children] of byGroup.entries()) {
        children.sort((a, b) => a.label.localeCompare(b.label));
        groupNodes.push({
          key: `grp:${sys.id}/${reg.id}/${groupSlug}`,
          kind: 'group',
          label: formatGroupLabel(groupSlug),
          meshIds: children.flatMap((c) => c.meshIds),
          children,
        });
      }

      const regChildren = [...groupNodes, ...ungrouped].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
      if (regChildren.length === 0) continue;

      regionNodes.push({
        key: `reg:${sys.id}/${reg.id}`,
        kind: 'region',
        label: reg.label,
        meshIds: regChildren.flatMap((c) => c.meshIds),
        children: regChildren,
      });
    }

    if (regionNodes.length === 0) continue;
    tree.push({
      key: `sys:${sys.id}`,
      kind: 'system',
      label: sys.label,
      meshIds: regionNodes.flatMap((r) => r.meshIds),
      children: regionNodes,
    });
  }

  return tree;
}

/** Flattens expanded nodes of a TreeNode forest into visible TreeRow descriptors. */
export function flattenTree(
  nodes: TreeNode[],
  expanded: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];

  function walk(list: TreeNode[], depth: number) {
    for (const node of list) {
      const hasChildren = node.children.length > 0;
      const isExpanded = hasChildren && expanded.has(node.key);
      rows.push({
        key: node.key,
        depth,
        label: node.label,
        kind: node.kind,
        hasChildren,
        expanded: isExpanded,
        meshIds: node.meshIds,
      });
      if (isExpanded) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(nodes, 0);
  return rows;
}

/** Returns ancestor node keys from root to direct parent for a target key, or `[]` if missing. */
export function ancestorsOf(key: string, nodes: TreeNode[]): string[] {
  function find(list: TreeNode[], path: string[]): string[] | null {
    for (const node of list) {
      if (node.key === key) {
        return path;
      }
      if (node.children.length > 0) {
        const hit = find(node.children, [...path, node.key]);
        if (hit) return hit;
      }
    }
    return null;
  }

  return find(nodes, []) ?? [];
}

/** Maps a TreeNode key (`str:<id>` or `mesh:<meshId>`) to `revealAndFocus` arguments. */
export function parseTreeTarget(key: string): {
  structureId: StructureId;
  side: 'left' | 'right' | 'both';
} | null {
  if (key.startsWith('str:')) {
    return {
      structureId: key.slice(4) as StructureId,
      side: 'both',
    };
  }
  if (key.startsWith('mesh:')) {
    const meshId = key.slice(5);
    if (meshId.endsWith('--l')) {
      return {
        structureId: meshId.slice(0, -3) as StructureId,
        side: 'left',
      };
    }
    if (meshId.endsWith('--r')) {
      return {
        structureId: meshId.slice(0, -3) as StructureId,
        side: 'right',
      };
    }
    return {
      structureId: meshId as StructureId,
      side: 'both',
    };
  }
  return null;
}

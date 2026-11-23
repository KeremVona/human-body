import { Color, Material, MeshPhysicalMaterial } from 'three';
import type { ResolvedQuality } from '../features/settings/quality';
import type { SystemId, Tissue } from '../data/schema';
import type { MeshState } from './resolveMeshState';

/** System draw priority from §6.2; ghosted meshes offset +10 on top. */
export const RENDER_ORDER: Record<SystemId, number> = {
  skeletal: 0,
  nervous: 1,
  respiratory: 1,
  digestive: 1,
  urinary: 1,
  lymphatic: 1,
  cardiovascular: 2,
  muscular: 3,
  integumentary: 4,
};

/** Visual state variant used to select cached tissue materials. */
export type MaterialState = 'base' | 'hovered' | 'selected' | 'ghost';

/** PBR look preset per anatomical tissue from §5.2. */
export const TISSUE_LOOKS: Record<
  Tissue,
  { color: string; roughness: number; clearcoat: number; sheen: number }
> = {
  bone: { color: '#e8e0d2', roughness: 0.85, clearcoat: 0, sheen: 0 },
  cartilage: {
    color: '#c8d8e6',
    roughness: 0.45,
    clearcoat: 0.15,
    sheen: 0.45,
  },
  muscle: { color: '#9e3434', roughness: 0.55, clearcoat: 0.1, sheen: 0.4 },
  tendon: { color: '#d8dadf', roughness: 0.55, clearcoat: 0.05, sheen: 0.5 },
  ligament: { color: '#cfcac0', roughness: 0.6, clearcoat: 0.05, sheen: 0.4 },
  artery: { color: '#c92a2a', roughness: 0.3, clearcoat: 0.6, sheen: 0 },
  vein: { color: '#2b5fa8', roughness: 0.3, clearcoat: 0.6, sheen: 0 },
  nerve: { color: '#dfb848', roughness: 0.4, clearcoat: 0.2, sheen: 0.2 },
  organ: { color: '#b55d5b', roughness: 0.4, clearcoat: 0.45, sheen: 0 },
  other: { color: '#8e95a0', roughness: 0.6, clearcoat: 0, sheen: 0 },
};

/** Key identifying a shareable material instance. */
export type MaterialKey = {
  system: SystemId;
  tissue: Tissue;
  color?: string;
  state: MaterialState;
};

/** Maps a resolved MeshState to its material variant: selected > hovered > ghost > base. */
export function materialStateFor(state: MeshState): MaterialState {
  if (state.highlight === 'selected') return 'selected';
  if (state.highlight === 'hovered') return 'hovered';
  if (state.ghost) return 'ghost';
  return 'base';
}

const SELECTED_EMISSIVE = '#6FA8FF';
const defaultOnBeforeCompile = Material.prototype.onBeforeCompile;
const defaultProgramCacheKey = Material.prototype.customProgramCacheKey;

const ghostFresnelOnBeforeCompile: Material['onBeforeCompile'] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    'vec3 viewDir = normalize(vViewPosition);\ndiffuseColor.a = diffuseColor.a * mix(0.35, 1.0, pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), 2.0));\n#include <opaque_fragment>',
  );
};

const ghostFresnelCacheKey = () => 'atlas-ghost-fresnel-high';

/** Creates a cached MeshPhysicalMaterial pool keyed by system|tissue|color|state. */
export function createMaterialLibrary(fadeOpacity: number): {
  get(key: MaterialKey): Material;
  setSystemOpacity(system: SystemId, opacity: number): void;
  setQuality(quality: ResolvedQuality): void;
  fallback(): Material;
  dispose(): void;
} {
  const cache = new Map<string, MeshPhysicalMaterial>();
  const systemOpacities = new Map<SystemId, number>();
  const materialsBySystem = new Map<SystemId, MeshPhysicalMaterial[]>();
  const muscleMaterials: MeshPhysicalMaterial[] = [];
  const ghostMaterials: MeshPhysicalMaterial[] = [];
  let quality: ResolvedQuality = 'high';
  let fallbackMaterial: MeshPhysicalMaterial | null = null;

  function buildMaterial(key: MaterialKey): MeshPhysicalMaterial {
    const look = TISSUE_LOOKS[key.tissue];
    const baseColor = key.color ?? look.color;
    const isGhost = key.state === 'ghost';
    const sysOpacity = systemOpacities.get(key.system) ?? 1;
    const opacity = isGhost ? fadeOpacity : sysOpacity;
    const transparent = opacity < 1;
    const depthWrite = opacity === 1;

    const params: ConstructorParameters<typeof MeshPhysicalMaterial>[0] = {
      color: baseColor,
      roughness: look.roughness,
      metalness: 0,
      clearcoat: look.clearcoat,
      clearcoatRoughness: 0.25,
      sheen:
        key.tissue === 'muscle' ? (quality === 'high' ? 0.4 : 0) : look.sheen,
      sheenRoughness: 0.6,
      sheenColor: new Color('#ffffff'),
      transparent,
      depthWrite,
      opacity,
    };

    if (key.state === 'hovered') {
      params.emissive = new Color(baseColor);
      params.emissiveIntensity = 0.25;
    } else if (key.state === 'selected') {
      params.emissive = new Color(SELECTED_EMISSIVE);
      params.emissiveIntensity = 0.6;
    }

    const material = new MeshPhysicalMaterial(params);
    if (key.tissue === 'muscle') {
      muscleMaterials.push(material);
    }
    if (isGhost) {
      ghostMaterials.push(material);
      if (quality === 'high') {
        material.onBeforeCompile = ghostFresnelOnBeforeCompile;
        material.customProgramCacheKey = ghostFresnelCacheKey;
      }
    } else {
      let list = materialsBySystem.get(key.system);
      if (!list) {
        list = [];
        materialsBySystem.set(key.system, list);
      }
      list.push(material);
    }
    return material;
  }

  return {
    get(key) {
      const cacheKey = `${key.system}|${key.tissue}|${key.color ?? ''}|${key.state}`;
      let mat = cache.get(cacheKey);
      if (!mat) {
        mat = buildMaterial(key);
        cache.set(cacheKey, mat);
      }
      return mat;
    },
    setSystemOpacity(system, opacity) {
      const clamped = Math.min(1, Math.max(0, opacity));
      systemOpacities.set(system, clamped);
      const mats = materialsBySystem.get(system);
      if (!mats) return;
      const nextTransparent = clamped < 1;
      for (const mat of mats) {
        const flipped = mat.transparent !== nextTransparent;
        mat.transparent = nextTransparent;
        mat.depthWrite = clamped === 1;
        mat.opacity = clamped;
        if (flipped) {
          mat.needsUpdate = true;
        }
      }
    },
    setQuality(nextQuality) {
      quality = nextQuality;
      const nextSheen = nextQuality === 'high' ? 0.4 : 0;
      for (const mat of muscleMaterials) {
        if (mat.sheen !== nextSheen) {
          mat.sheen = nextSheen;
          mat.needsUpdate = true;
        }
      }
      const nextCompile =
        nextQuality === 'high'
          ? ghostFresnelOnBeforeCompile
          : defaultOnBeforeCompile;
      const nextCacheKey =
        nextQuality === 'high' ? ghostFresnelCacheKey : defaultProgramCacheKey;
      for (const mat of ghostMaterials) {
        if (mat.onBeforeCompile !== nextCompile) {
          mat.onBeforeCompile = nextCompile;
          mat.customProgramCacheKey = nextCacheKey;
          mat.needsUpdate = true;
        }
      }
    },
    fallback() {
      if (!fallbackMaterial) {
        fallbackMaterial = new MeshPhysicalMaterial({
          color: TISSUE_LOOKS.other.color,
          roughness: TISSUE_LOOKS.other.roughness,
          metalness: 0,
        });
      }
      return fallbackMaterial;
    },
    dispose() {
      for (const mat of cache.values()) {
        mat.dispose();
      }
      cache.clear();
      systemOpacities.clear();
      materialsBySystem.clear();
      muscleMaterials.length = 0;
      ghostMaterials.length = 0;
      fallbackMaterial?.dispose();
      fallbackMaterial = null;
    },
  };
}

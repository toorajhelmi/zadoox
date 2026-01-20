import type { DocumentStyle } from '../types/project';

/**
 * Minimal doc-type profile for SG building.
 *
 * Keep this intentionally tiny: user requested only one doc-type dependent knob for now.
 */
export interface SgDocTypeProfile {
  /**
   * Upper bound on how many blocks we consider in a "section-sized working set".
   * This is used to avoid whole-document sends and keep LLM/embedding costs bounded.
   */
  maxBlocksPerSection: number;
  /**
   * Effective style key ("default" when unknown).
   */
  key: string;
}

/**
 * JS-friendly "inheritance" pattern:
 * - A base profile (default)
 * - A registry of named profiles that can "extend" a base via shallow overrides
 *
 * This makes it easy to introduce new doc types later without rewriting core logic.
 */
// Allow future custom doc types without fighting TypeScript:
// avoid `{}` in intersection (eslint ban-types), but keep the "known keys" union.
export type SgDocTypeKey = DocumentStyle | 'default' | (string & Record<never, never>);

const DEFAULT_PROFILE: SgDocTypeProfile = {
  key: 'default',
  maxBlocksPerSection: 40,
};

const REGISTRY = new Map<string, SgDocTypeProfile>([
  ['default', DEFAULT_PROFILE],
  ['academic', { ...DEFAULT_PROFILE, key: 'academic', maxBlocksPerSection: 12 }],
  ['whitepaper', { ...DEFAULT_PROFILE, key: 'whitepaper', maxBlocksPerSection: 25 }],
  ['technical-docs', { ...DEFAULT_PROFILE, key: 'technical-docs', maxBlocksPerSection: 60 }],
  ['blog', { ...DEFAULT_PROFILE, key: 'blog', maxBlocksPerSection: 40 }],
]);

export function registerSgDocTypeProfile(key: SgDocTypeKey, profile: Omit<SgDocTypeProfile, 'key'>) {
  REGISTRY.set(String(key), { ...DEFAULT_PROFILE, ...profile, key: String(key) });
}

export function extendSgDocTypeProfile(
  key: SgDocTypeKey,
  baseKey: SgDocTypeKey,
  overrides: Partial<Omit<SgDocTypeProfile, 'key'>> = {}
) {
  const base = REGISTRY.get(String(baseKey)) ?? DEFAULT_PROFILE;
  REGISTRY.set(String(key), { ...base, ...overrides, key: String(key) });
}

export function getSgDocTypeProfile(style?: DocumentStyle | null): SgDocTypeProfile {
  const normalized = typeof style === 'string' && style.trim().length > 0 ? style : 'default';
  return REGISTRY.get(normalized) ?? DEFAULT_PROFILE;
}

/**
 * Optional: expose a snapshot for debugging/telemetry.
 */
export function listSgDocTypeProfiles(): SgDocTypeProfile[] {
  return Array.from(REGISTRY.values());
}



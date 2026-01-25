/**
 * SG Template — genre-specific configuration for the SG Interpreter.
 *
 * The graph representation stays constant; only the template changes per Genre:
 * - which primitive types are allowed
 * - which quality Dimensions exist and how they’re scored (rubrics in [-1, 1])
 */

export type SgGenre = string;

/**
 * Template-defined primitive type identifier.
 * Intentionally generic — each template/genre defines its own allowed primitive types.
 */
export type SgPrimitiveType = string;

export type SgRubric = Record<string, string>;

export interface SgDimension {
  id: string;
  definition: string;
  applicable_when?: string;
  rubric?: SgRubric;
}

export interface SgTemplate {
  id: string;      // e.g. "academic_paper:v0"
  version: number; // template version
  genre: SgGenre;  // e.g. "academic_paper"
  primitiveTypes: SgPrimitiveType[];
  dimensions?: SgDimension[];
}



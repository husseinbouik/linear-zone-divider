// in linear-zone-divider/index.ts

import { Scanner } from "./Scanner";
import { Parser } from "./Parser";
import { Evaluator } from "./Evaluator";
import { Calculator } from "./Calculator";
import { EvaluationErrors, Token, Sections } from "./types";

// Type definitions (ensure these are consistent with your project)
export enum DimRef {
  I = "I",
  O = "O",
  M = "M",
}

export type DimRefProps = {
  sizerefout1: DimRef;
  sizerefedg1: DimRef;
  sizerefmid: DimRef;
  sizerefedg2: DimRef;
  sizerefout2: DimRef;
};

export type SideConfig = {
  thickness?: number;
  dimRef?: DimRef;
};

export type SideThicknessConfig = {
  left?: SideConfig;
  right?: SideConfig;
  top?: SideConfig;
  bottom?: SideConfig;
  front?: SideConfig;
  back?: SideConfig;
};

type DivisionDirection = "h" | "v";
type DivisionType = "W" | "D" | "P";

interface EnhancedDivisionConfig {
  input: string;
  totalLength: number;
  dividerThickness?: number;
  variables?: { [key: string]: number };
  dividerDimRef?: DimRefProps;
  sideThickness?: SideThicknessConfig;
  direction?: DivisionDirection;
  divisionType?: DivisionType;
}

// Kept for backward compatibility
export const processLindiv = (
  input: string,
  totalLength: number,
  dividerThickness?: number,
  variables?: { [key: string]: number },
  dimRef?: DimRefProps
): number[] | EvaluationErrors => {
  return processLindivEnhanced({
    input,
    totalLength,
    dividerThickness,
    variables,
    dividerDimRef: dimRef
  });
};


// --- REWRITTEN CORE LOGIC ---

/**
 * Calculates how much a side panel encroaches into the available division space.
 * @param sideConfig The configuration of the side panel.
 * @returns The length adjustment value.
 */
const getSideAdjustment = (sideConfig: SideConfig | undefined): number => {
    if (!sideConfig || !sideConfig.thickness) {
        return 0;
    }
    // Default to 'I' if dimRef is not provided
    const dimRef = sideConfig.dimRef || DimRef.I;

    switch (dimRef) {
        case DimRef.O: // Panel is "outside" the boundary, taking up internal space
            return sideConfig.thickness;
        case DimRef.M: // Panel is centered on the boundary
            return sideConfig.thickness / 2;
        case DimRef.I: // Panel is "inside" the boundary, not affecting division space
        default:
            return 0;
    }
};

/**
 * Calculates the net length available for division after accounting for side panels.
 */
function calculateNetLength(
  totalLength: number,
  sideThickness: SideThicknessConfig | undefined,
  direction: DivisionDirection,
  divisionType: DivisionType
): number {
    if (!sideThickness) {
        return totalLength;
    }

    // Determine which sides are relevant based on division direction and type
    const side1Config = direction === 'h'
        ? sideThickness.top
        : (divisionType === 'D' ? sideThickness.front : sideThickness.left);

    const side2Config = direction === 'h'
        ? sideThickness.bottom
        : (divisionType === 'D' ? sideThickness.back : sideThickness.right);

    const adjustment1 = getSideAdjustment(side1Config);
    const adjustment2 = getSideAdjustment(side2Config);

    const netLength = totalLength - adjustment1 - adjustment2;

    return Math.max(netLength, 0);
}


export const processLindivEnhanced = (
  config: EnhancedDivisionConfig
): number[] | EvaluationErrors => {
  try {
    const scanner = new Scanner();
    const parser = new Parser();
    const evaluator = new Evaluator();

    const direction = config.direction || 'v';
    // For 'P' type, the component logic correctly re-maps it to W or D before calling,
    // but we can keep this for robustness.
    const divisionType = config.divisionType || 'W'; 

    const tokens: Token[] = scanner.scan(config.input);
    const ast = parser.parse(tokens);
    const evaluationResult = evaluator.evaluate(ast, {}, config.variables);

    if (evaluationResult instanceof EvaluationErrors) {
      return evaluationResult;
    }

    // 1. Calculate the TRUE net length available for the internal zones.
    const netLength = calculateNetLength(
      config.totalLength,
      config.sideThickness,
      direction,
      divisionType
    );

    // 2. The calculator now works with the correct, constrained space.
    const calculator = new Calculator();
    const internalSections = calculator.calculateSections(
      evaluationResult as Sections,
      netLength, // Use the correct net length
      config.dividerThickness,
      config.dividerDimRef
    );

    if (internalSections instanceof EvaluationErrors) {
      throw new Error(internalSections.message);
    }
    
    // 3. Return the result directly. No further adjustments are needed.
    return internalSections;

  } catch (err) {
    return new EvaluationErrors((err as Error).message);
  }
};
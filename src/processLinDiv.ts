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
 * This is used to calculate the NET length for the internal calculator.
 */
const getSideAdjustment = (sideConfig: SideConfig | undefined): number => {
    if (!sideConfig || !sideConfig.thickness) {
        return 0;
    }
    const dimRef = sideConfig.dimRef || DimRef.I;

    switch (dimRef) {
        case DimRef.O:
            return sideConfig.thickness;
        case DimRef.M:
            return sideConfig.thickness / 2;
        case DimRef.I:
        default:
            return 0;
    }
};

/**
 * After zones are calculated based on netLength, this function determines
 * how much size to ADD to the outer zones based on their side panel's DimRef.
 */
const getOuterZoneAdjustment = (sideConfig: SideConfig | undefined): number => {
    if (!sideConfig || !sideConfig.thickness) {
        return 0;
    }
    const dimRef = sideConfig.dimRef || DimRef.I;
    
    switch(dimRef) {
        case DimRef.I:
            return sideConfig.thickness;
        case DimRef.M:
            return sideConfig.thickness / 2;
        case DimRef.O:
        default:
            return 0;
    }
}


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
    const divisionType = config.divisionType || 'W'; 
    const { dividerDimRef, sideThickness } = config;

    const tokens: Token[] = scanner.scan(config.input);
    const ast = parser.parse(tokens);
    const evaluationResult = evaluator.evaluate(ast, {}, config.variables);

    if (evaluationResult instanceof EvaluationErrors) {
      return evaluationResult;
    }

    const augmentedSideThickness: SideThicknessConfig = JSON.parse(JSON.stringify(sideThickness || {}));

    let startSideKey: keyof SideThicknessConfig | undefined;
    let endSideKey: keyof SideThicknessConfig | undefined;

    if (direction === 'h') {
        startSideKey = 'top';
        endSideKey = 'bottom';
    } else {
        if (divisionType === 'D') {
            startSideKey = 'front';
            endSideKey = 'back';
        } else {
            startSideKey = 'left';
            endSideKey = 'right';
        }
    }

    // --- FIX START: Robustly apply DimRef from UI ---
    if (dividerDimRef) {
        if (startSideKey) {
            // Ensure the object exists before assigning to it.
            if (!augmentedSideThickness[startSideKey]) {
                augmentedSideThickness[startSideKey] = {};
            }
            augmentedSideThickness[startSideKey]!.dimRef = dividerDimRef.sizerefout1;
        }

        if (endSideKey) {
            // Ensure the object exists before assigning to it.
            if (!augmentedSideThickness[endSideKey]) {
                augmentedSideThickness[endSideKey] = {};
            }
            augmentedSideThickness[endSideKey]!.dimRef = dividerDimRef.sizerefout2;
        }
    }
    // --- FIX END ---

    const netLength = calculateNetLength(
      config.totalLength,
      augmentedSideThickness,
      direction,
      divisionType
    );

    const calculator = new Calculator();
    const internalSections = calculator.calculateSections(
      evaluationResult as Sections,
      netLength,
      config.dividerThickness,
      config.dividerDimRef
    );

    if (internalSections instanceof EvaluationErrors) {
      return internalSections;
    }
    
    // --- RESTORED LOGIC ---
    // Adjust outer zones to account for side panels that are 'Inside' or 'Middle'.
    if (internalSections.length > 0) {
        const startSideConfig = startSideKey ? augmentedSideThickness[startSideKey] : undefined;
        const endSideConfig = endSideKey ? augmentedSideThickness[endSideKey] : undefined;

        const startAdjustment = getOuterZoneAdjustment(startSideConfig);
        const endAdjustment = getOuterZoneAdjustment(endSideConfig);

        internalSections[0] += startAdjustment;
        
        if (internalSections.length > 1) {
            internalSections[internalSections.length - 1] += endAdjustment;
        } else {
            internalSections[0] += endAdjustment;
        }
    }
    
    return internalSections;

  } catch (err) {
    return new EvaluationErrors((err as Error).message);
  }
};
// in linear-zone-divider/src/Calculator.ts

import {
  Section,
  Sections,
  NumberLiteral,
  EvaluationErrors,
  BinaryExpression,
  ASTNode,
} from './types';

// Define a type for the dimension reference properties
type DimRefProps = {
  sizerefout1: 'O' | 'M' | 'I';
  sizerefedg1: 'O' | 'M' | 'I';
  sizerefmid: 'O' | 'M' | 'I';
  sizerefedg2: 'O' | 'M' | 'I';
  sizerefout2: 'O' | 'M' | 'I';
};

export class Calculator {
  public calculateSections(
    ast: Sections,
    availableLength: number,
    dividerThickness: number = 0,
    dimRef?: DimRefProps
  ): number[] | EvaluationErrors {
    if (!(ast.type === 'Sections' || ast.type === 'Section')) {
      return new EvaluationErrors(
        'Evaluation result is not a valid section structure.'
      );
    }

    const sections = Array.isArray((ast as Sections).sections)
      ? (ast as Sections).sections
      : [ast as Section];
      
    if (sections.length === 0) {
        return [];
    }

    let absoluteLengthSum = 0;
    let relativeRatioSum = 0;
    const relativeSections: Section[] = [];
    const absoluteSections: Map<number, number> = new Map();

    // 1. First pass: Separate absolute and relative zones
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const node = section.nodes;

      if (node.type === 'NumberLiteral' && node.hasMillimeterSuffix) {
        // This is an absolute length zone, like <100mm>
        const value = (node as NumberLiteral).value;
        absoluteLengthSum += value;
        absoluteSections.set(i, value);
      } else if (node.type === 'NumberLiteral' && !node.hasMillimeterSuffix) {
        // This is a relative ratio zone, like <1> or <2.5>
        const value = (node as NumberLiteral).value;
        if (value <= 0) {
          return new EvaluationErrors('Relative ratio must be greater than zero.');
        }
        relativeRatioSum += value;
        relativeSections.push(section);
      } else {
        // Handle other simple expressions that resolve to a number for ratios
        // For now, we assume simple NumberLiterals as per common usage
         return new EvaluationErrors(`Unsupported section content type: ${node.type}. Sections must be a number or a number with 'mm'.`);
      }
    }

    // 2. Calculate the total thickness of all internal dividers
    const numberOfDividers = sections.length > 1 ? sections.length - 1 : 0;
    const totalDividerThickness = numberOfDividers * dividerThickness;

    // 3. *** THE CORE FIX IS HERE ***
    // Calculate the remaining space for relative zones by SUBTRACTING
    // the sum of absolute zones AND the total thickness of all dividers.
    const remainingLengthForRelatives =
      availableLength - absoluteLengthSum - totalDividerThickness;

    if (remainingLengthForRelatives < 0) {
      return new EvaluationErrors(
        `The sum of absolute lengths and divider thicknesses (${absoluteLengthSum}mm + ${totalDividerThickness}mm) exceeds the available space of ${availableLength.toFixed(2)}mm.`
      );
    }
    
    // 4. Calculate the size of a single ratio unit
    let lengthPerRatioUnit = 0;
    if (relativeRatioSum > 0) {
      if (remainingLengthForRelatives > 0) {
        lengthPerRatioUnit = remainingLengthForRelatives / relativeRatioSum;
      }
    } else if (remainingLengthForRelatives > 0.01) { // Check for leftover space
        return new EvaluationErrors(`There is ${remainingLengthForRelatives.toFixed(2)}mm of space left over, but no relative zones to distribute it to.`);
    }


    // 5. Second pass: Build the final array of zone lengths
    const finalZones: number[] = [];
    for (let i = 0; i < sections.length; i++) {
        if (absoluteSections.has(i)) {
            // It's an absolute section, use its stored value
            finalZones.push(absoluteSections.get(i)!);
        } else {
            // It's a relative section, calculate its size
            const node = sections[i].nodes as NumberLiteral;
            finalZones.push(node.value * lengthPerRatioUnit);
        }
    }

    // Sanity check
    const finalSum = finalZones.reduce((sum, val) => sum + val, 0) + totalDividerThickness;
    if (Math.abs(finalSum - availableLength) > 0.01) { // Allow for small floating point inaccuracies
       console.warn(`Calculator sanity check failed: Final sum (${finalSum.toFixed(2)}) does not match available length (${availableLength.toFixed(2)}).`);
    }

    return finalZones;
  }
}
import {
  Section,
  Sections,
  NumberLiteral,
  EvaluationErrors,
} from './types';

// These types are used internally but not exported as part of the public API
type DimRef = 'O' | 'M' | 'I';

type DimRefProps = {
  sizerefout1: DimRef;
  sizerefedg1: DimRef;
  sizerefmid: DimRef;
  sizerefedg2: DimRef;
  sizerefout2: DimRef;
};

export class Calculator {
  public calculateSections(
    ast: Sections | Section,
    availableLength: number,
    dividerThickness: number = 0,
    // dimRef is passed but its properties (sizerefedg1, etc.) are positional
    // and do not affect the calculated size of the clear openings.
    // They are kept for API compatibility but are not used in this function.
    dimRef?: Partial<DimRefProps>
  ): number[] | EvaluationErrors {
    let sections: Section[];
    if (ast.type === 'Sections') {
      sections = ast.sections;
    } else if (ast.type === 'Section') {
      sections = [ast];
    } else {
      return new EvaluationErrors('Evaluation result is not a valid section structure.');
    }
      
    if (sections.length === 0) {
        return [];
    }

    // No need for defaultRefs as divider refs don't affect size calculation.
    // const defaultRefs: DimRefProps = { ... };
    // const refs = { ...defaultRefs, ...dimRef };

    let absoluteClearOpeningSum = 0;
    let relativeRatioSum = 0;
    const isAbsolute = sections.map(s => s.nodes.type === 'NumberLiteral' && s.nodes.hasMillimeterSuffix);

    // 1. First Pass: Get sums of absolute clear openings and relative ratios
    for (let i = 0; i < sections.length; i++) {
      const node = sections[i].nodes as NumberLiteral;
      if (isAbsolute[i]) {
        absoluteClearOpeningSum += node.value;
      } else {
        if (node.value <= 0) {
          return new EvaluationErrors('Relative ratio must be greater than zero.');
        }
        relativeRatioSum += node.value;
      }
    }

    // 2. Calculate the total space consumed by dividers
    const numberOfDividers = sections.length > 1 ? sections.length - 1 : 0;
    const totalDividerThickness = numberOfDividers * dividerThickness;

    // 3. Calculate the total pool of clear opening space available for all zones
    const totalClearSpace = availableLength - totalDividerThickness;
    const remainingClearSpaceForRelatives = totalClearSpace - absoluteClearOpeningSum;
    
    if (remainingClearSpaceForRelatives < -0.01) {
      return new EvaluationErrors(`The sum of absolute clear openings (${absoluteClearOpeningSum}mm) and dividers (${totalDividerThickness}mm) exceeds available space of ${availableLength.toFixed(2)}mm.`);
    }

    // 4. Determine the value of a single ratio unit in mm of clear opening
    let lengthPerRatioUnit = 0;
    if (relativeRatioSum > 0) {
      lengthPerRatioUnit = Math.max(0, remainingClearSpaceForRelatives) / relativeRatioSum;
    } else if (Math.abs(remainingClearSpaceForRelatives) > 0.01) {
      const verb = remainingClearSpaceForRelatives > 0 ? "left over" : "short";
      return new EvaluationErrors(`There is ${Math.abs(remainingClearSpaceForRelatives).toFixed(2)}mm of space ${verb}, but no relative zones to distribute it to.`);
    }

    // 5. Final Pass: Build the final zone sizes (which are the clear openings)
    const finalZones: number[] = [];
    for (let i = 0; i < sections.length; i++) {
      const node = sections[i].nodes as NumberLiteral;
      
      // The size of the zone component IS the calculated clear opening.
      // The space for the divider has already been accounted for.
      const zoneClearOpening = isAbsolute[i] ? node.value : node.value * lengthPerRatioUnit;
      
      // --- NO ADJUSTMENT NEEDED ---
      // The properties like sizerefedg1, sizerefmid determine the *position*
      // of the divider, which is handled by the rendering logic, not the sizing logic.
      // Adding back half the thickness here was the error.
      
      finalZones.push(zoneClearOpening);
    }
    
    return finalZones;
  }
}
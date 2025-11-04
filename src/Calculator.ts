// in linear-zone-divider/src/Calculator.ts

import {
  Section,
  Sections,
  NumberLiteral,
  EvaluationErrors,
} from './types';

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

  const defaultRefs: DimRefProps = {
        sizerefedg1: 'M',
        sizerefmid: 'M',
        sizerefedg2: 'M',
        sizerefout1: 'O',
        sizerefout2: 'O',
     };
     const refs = { ...defaultRefs, ...dimRef };

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

    // 3. Calculate the total pool of clear opening space available for relative zones
    const totalClearSpace = availableLength - totalDividerThickness;
    const remainingClearSpaceForRelatives = totalClearSpace - absoluteClearOpeningSum;
    
    if (remainingClearSpaceForRelatives < -0.01) {
      return new EvaluationErrors(`The sum of absolute clear openings (${absoluteClearOpeningSum}mm) and dividers (${totalDividerThickness}mm) exceeds available space of ${availableLength.toFixed(2)}mm.`);
    }

    // 4. Determine the value of a single ratio unit in mm of clear opening
    let lengthPerRatioUnit = 0;
    if (relativeRatioSum > 0) {
      lengthPerRatioUnit = Math.max(0, remainingClearSpaceForRelatives) / relativeRatioSum;
    } else if (remainingClearSpaceForRelatives > 0.01) {
      return new EvaluationErrors(`There is ${remainingClearSpaceForRelatives.toFixed(2)}mm of space left over, but no relative zones to distribute it to.`);
    }

    // 5. Final Pass: Build the final zone sizes
    const finalZones: number[] = [];
    for (let i = 0; i < sections.length; i++) {
      const node = sections[i].nodes as NumberLiteral;
      let zoneClearOpening = isAbsolute[i] ? node.value : node.value * lengthPerRatioUnit;
      
      let adjustedZoneSize = zoneClearOpening;

      // Helper to get the DimRef for a specific divider index
      const getDividerRef = (index: number): DimRef => {
        if (index === 0) return refs.sizerefedg1;
        if (index === numberOfDividers - 1) return refs.sizerefedg2;
        return refs.sizerefmid;
      };

      // Add contribution from the left divider (if it exists and is 'M')
      if (i > 0) {
        if (getDividerRef(i - 1) === 'M') {
          adjustedZoneSize += dividerThickness / 2;
        }
      }

      // Add contribution from the right divider (if it exists and is 'M')
      if (i < sections.length - 1) {
        if (getDividerRef(i) === 'M') {
          adjustedZoneSize += dividerThickness / 2;
        }
      }
      
      finalZones.push(adjustedZoneSize);
    }
    
    return finalZones;
  }
}
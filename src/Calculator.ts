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
    dimRef?: Partial<DimRefProps> // dimRef is kept for signature consistency but not used in this corrected version
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
    
    // This logic remains unchanged
    let absoluteClearOpeningSum = 0;
    let relativeRatioSum = 0;
    const isAbsolute = sections.map(s => s.nodes.type === 'NumberLiteral' && s.nodes.hasMillimeterSuffix);

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

    // This logic remains unchanged
    const numberOfDividers = sections.length > 1 ? sections.length - 1 : 0;
    const totalDividerThickness = numberOfDividers * dividerThickness;
    const totalClearSpace = availableLength - totalDividerThickness;
    const remainingClearSpaceForRelatives = totalClearSpace - absoluteClearOpeningSum;
    
    if (remainingClearSpaceForRelatives < -0.01) {
      return new EvaluationErrors(`The sum of absolute clear openings (${absoluteClearOpeningSum}mm) and dividers (${totalDividerThickness}mm) exceeds available space of ${availableLength.toFixed(2)}mm.`);
    }

    // This logic remains unchanged
    let lengthPerRatioUnit = 0;
    if (relativeRatioSum > 0) {
      lengthPerRatioUnit = Math.max(0, remainingClearSpaceForRelatives) / relativeRatioSum;
    } else if (Math.abs(remainingClearSpaceForRelatives) > 0.01) {
      const verb = remainingClearSpaceForRelatives > 0 ? "left over" : "short";
      return new EvaluationErrors(`There is ${Math.abs(remainingClearSpaceForRelatives).toFixed(2)}mm of space ${verb}, but no relative zones to distribute it to.`);
    }

    // --- FIX ---
    // The calculated clear openings are now the final, correct values.
    // The final step that added divider thickness back has been removed.
    const zoneClearOpenings = sections.map((s, i) => {
        const node = s.nodes as NumberLiteral;
        return isAbsolute[i] ? node.value : node.value * lengthPerRatioUnit;
    });
    
    return zoneClearOpenings;
  }
}
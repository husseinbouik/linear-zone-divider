import { BinaryExpression, NumberLiteral, ASTNode } from "./types";
import { logger } from "./utils/logger";

export class SectionCalculation {
  /**
   * Calculates the final dimension for a single section.
   * This method is now stateless and returns a single number.
   */
  public calculateSection(
    node: NumberLiteral | BinaryExpression,
    accumulatedDRFromMmUnit: number,
    ratioUnitValue: number
  ): number {
    
    // Helper function to calculate the value of a single NumberLiteral node
    const getNodeValue = (numNode: NumberLiteral): number => {
      if (numNode.hasMillimeterSuffix) {
        // It's an absolute value, just return it.
        return numNode.value;
      }
      
      // It's a ratio value, calculate its total size
      const baseRatioSize = numNode.value * ratioUnitValue;
      const mmAdjustment = numNode.value * accumulatedDRFromMmUnit;
      const drAdjustment = numNode.drAdjustmentValue ?? 0;

      return baseRatioSize + mmAdjustment + drAdjustment;
    };

    let finalValue = 0;

    if (node.type === "NumberLiteral") {
      finalValue = getNodeValue(node);
    } else if (node.type === "BinaryExpression") {
      // For a binary expression, calculate the value of each part and add them up.
      const leftValue = getNodeValue(node.left as NumberLiteral);
      const rightValue = getNodeValue(node.right as NumberLiteral);
      finalValue = leftValue + rightValue;
    }

    logger.log(`[SectionCalculation] Final calculated value for section: ${finalValue.toFixed(2)}`, node);
    
    // Return the final calculated value, rounded to 2 decimal places.
    return Number(finalValue.toFixed(2));
  }
}
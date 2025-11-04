import { BinaryExpression, NumberLiteral, Sections } from "./types";
import { traverseTree } from "./traverseTree";
import { logger } from "./utils/logger";

enum DimRef {
  I = "I",
  O = "O",
  M = "M",
}

type DimRefProps = {
  sizerefout1: DimRef;
  sizerefedg1: DimRef;
  sizerefmid: DimRef;
  sizerefedg2: DimRef;
  sizerefout2: DimRef;
};

export class SectionRatiosDR {
  public adjustRatiosDR(
    node: NumberLiteral | BinaryExpression,
    index: number,
    totalRatios: number,
    dimRefProps: DimRefProps | undefined,
    dividerThickness: number,
    sections: Sections,
  ): Sections | undefined {
    // This function will now be called for each section, but we only need to run the calculation once.
    // We can check if adjustments have already been made.
    if ((node as any).drAdjustmentValue !== undefined) {
      return;
    }

    if (totalRatios === 0) return;

    const numSections = sections.sections.length;
    const numDividers = numSections > 1 ? numSections - 1 : 0;
    if (numDividers === 0) return;

    logger.log("\n--- Starting Dimension Reference Adjustment for All Sections ---");
    logger.log(`Total Ratios: ${totalRatios}, Divider Thickness: ${dividerThickness}`);
    logger.log(`DimRef Props:`, dimRefProps);

    const adjustments = new Array(numSections).fill(0);

    // Loop through each DIVIDER and decide how to distribute its thickness
    for (let i = 0; i < numDividers; i++) {
      const leftZoneIndex = i;
      const rightZoneIndex = i + 1;
      let ref: DimRef = DimRef.M; // Default to Middle

      // Determine which DimRef to use for this divider
      if (i === 0) { // First divider
        ref = dimRefProps?.sizerefedg1 || DimRef.M;
      } else if (i === numDividers - 1 && numDividers > 1) { // Last divider
        ref = dimRefProps?.sizerefedg2 || DimRef.M;
      } else { // Middle divider
        ref = dimRefProps?.sizerefmid || DimRef.M;
      }

      logger.log(`Processing Divider ${i + 1} (between Zone ${leftZoneIndex} and ${rightZoneIndex}) with Ref: '${ref}'`);

      // Distribute the divider's thickness based on its DimRef
      switch (ref) {
        case DimRef.M: // Middle: Split thickness between the two zones
          adjustments[leftZoneIndex] += dividerThickness / 2;
          adjustments[rightZoneIndex] += dividerThickness / 2;
          logger.log(`  -> Distributing +${dividerThickness / 2} to Zone ${leftZoneIndex} and +${dividerThickness / 2} to Zone ${rightZoneIndex}`);
          break;
        case DimRef.O: // Outside: Give full thickness to the LEFT zone
          adjustments[leftZoneIndex] += dividerThickness;
          logger.log(`  -> Distributing +${dividerThickness} to Zone ${leftZoneIndex}`);
          break;
        case DimRef.I: // Inside: Thickness is already accounted for, no adjustment needed
        default:
          logger.log(`  -> No distribution needed for 'I'`);
          break;
      }
    }

    // Now apply the calculated adjustments to each section's nodes
    sections.sections.forEach((section, idx) => {
      // The total adjustment for this section is the sum we calculated
      const totalAdjustment = adjustments[idx];
      logger.log(`Total adjustment for Zone ${idx}: ${totalAdjustment}`);

      // We need to subtract this from the "rest" space, so the adjustment value is negative
      const drAdjustmentValue = totalAdjustment;

      traverseTree(section, (node: BinaryExpression | NumberLiteral) => {
        // We only care about ratio-based nodes
        if (node.hasMillimeterSuffix) return;
        
        // Use a simple property to store the final adjustment value
        // This will be used later in the SectionCalculation step
        if (node.type === "NumberLiteral") {
          node.drAdjustmentValue = (node.drAdjustmentValue || 0) + drAdjustmentValue;
        } else if (node.type === "BinaryExpression" && node.left.type === "NumberLiteral") {
          // In a binary expression, apply the full adjustment to the left node for simplicity
          node.left.drAdjustmentValue = (node.left.drAdjustmentValue || 0) + drAdjustmentValue;
        }
      });
    });
    
    logger.log("--- Finished Dimension Reference Adjustment ---");
    return sections;
  }
}
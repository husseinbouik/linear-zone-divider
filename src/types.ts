export interface ASTNode {
  type: string;
  hasMillimeterSuffix?: boolean;
}

export interface NumberLiteral extends ASTNode {
  type: 'NumberLiteral';
  value: number;
  spreadMm?: boolean;
  drAdjustmentValue?: number;
}

export interface Variable extends ASTNode {
  type: 'Variable';
  name: string;
}

export interface SpecialVariable extends ASTNode {
  type: 'SpecialVariable';
  name: string;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  right: Expression; // Also updated for consistency
}

export interface FunctionCall extends ASTNode {
  type: 'FunctionCall';
  name: string;
  arg: Expression; // Also updated for consistency
}

export interface Grouping extends ASTNode {
  type: 'Grouping';
  expression: Expression; // Also updated for consistency
}

// --- NEW, MORE SPECIFIC TYPE ---
// This represents any node that can be an operand in a mathematical expression.
export type Expression =
  | NumberLiteral
  | Variable
  | SpecialVariable
  | BinaryExpression
  | UnaryExpression
  | FunctionCall
  | Grouping
  | Reduction;

  
// --- UPDATED INTERFACE ---
// Now, `left` and `right` are correctly typed as `Expression` instead of the generic `ASTNode`.
export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  left: Expression;
  operator: string;
  right: Expression;
  inGroup?: boolean;
  drAdjustmentValue?: number;
}

export interface Reduction extends ASTNode {
  type: 'Reduction';
  expression: ASTNode;
}

export interface Section extends ASTNode {
  type: 'Section';
  nodes: ASTNode;
  isAbsolute?: boolean;
}

export interface Repeated extends ASTNode {
  type: 'Repeated';
  toRepeat: ASTNode;
  times?: number;
  inGroup?: boolean;
}

export interface Sections extends ASTNode {
  type: 'Sections';
  sections: Section[];
}

export interface LinearDivision extends ASTNode {
  type: 'LinearDivision';
  body: Sections;
}

export class EvaluationErrors extends Error {
  constructor(message: string) {
    super(`Evaluation Error: ${message}`);
    this.name = 'EvaluationError';
  }
}

export type Node =
  | Expression // Use the new Expression type here
  | Section
  | Sections
  | Repeated
  | Reduction
  | LinearDivision;

export interface INodeEvaluator {
  evaluate(node: Node): Node | EvaluationErrors;
}

export enum TokenType {
  NUMBER = 'NUMBER',
  VARIABLE = 'VARIABLE',
  UNIT = 'UNIT',
  OPERATOR = 'OPERATOR',
  COLON = 'COLON',
  BRACKET_OPEN = 'BRACKET_OPEN',
  BRACKET_CLOSE = 'BRACKET_CLOSE',
  BRACE_OPEN = 'BRACE_OPEN',
  BRACE_CLOSE = 'BRACE_CLOSE',
  PAREN_OPEN = 'PAREN_OPEN',
  PAREN_CLOSE = 'PAREN_CLOSE',
  FUNCTION = 'FUNCTION',
  SPECIAL_VARIABLE = 'SPECIAL_VARIABLE',
  RELATIVE_RATIO = 'RELATIVE_RATIO',
  ANGLE_BRACKET_OPEN = 'LEFT_ANGLE_BRACKET',
  ANGLE_BRACKET_CLOSE = 'RIGHT_ANGLE_BRACKET',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  lexeme: string;
  position?: number;
}
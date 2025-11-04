import { Token } from './types';
import { TokenType } from './types';
import {
  Expression, // Import the Expression type explicitly
  NumberLiteral,
  Variable,
  SpecialVariable,
  UnaryExpression,
  FunctionCall,
  Grouping,
  BinaryExpression,
  Section,
  Sections,
  Repeated,
  Node, // Import the correct, complete Node type
} from './types';

// REMOVED: The local 'Node' type alias is redundant and less complete than the imported one.

export class Parser {
  private cache = new Map<Token[], Node>();
  private tokens: Token[] = [];
  private current: number = 0;

  parse(tokens: Token[]): Node {
    if (this.cache.has(tokens)) {
      const ast = this.cache.get(tokens)!;
      this.cache.delete(tokens);
      this.cache.set(tokens, ast);
      return ast;
    }
    try {
      this.tokens = tokens;
      const ast = this.performParse(tokens);
      this.cache.set(tokens, ast);
      if (this.cache.size > 3) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey!);
      }
      return ast;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  public performParse(tokens: Token[]): Node {
    this.resetCurrent();
    if (this.tokens.length === 0) {
      throw new Error('No tokens to parse.');
    }
    try {
      // CHANGE: Call the new top-level parsing method instead of expression() directly.
      return this.parseStructureOrExpression();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private resetCurrent = () => {
    this.current = 0;
  };

  private checkMillimeterSuffix(): boolean {
    if (this.isAtEnd()) return false;
    const nextToken = this.peek();
    return nextToken.type === TokenType.UNIT && nextToken.lexeme === 'mm';
  }

  private consumeMillimeterSuffix(): boolean {
    if (this.checkMillimeterSuffix()) {
      this.advance();
      return true;
    }
    return false;
  }
  
  // NEW: Top-level parser to handle structural nodes vs expressions.
  private parseStructureOrExpression(): Node {
    if (this.check(TokenType.ANGLE_BRACKET_OPEN)) {
      return this.sections();
    }
    if (this.check(TokenType.BRACE_OPEN)) {
      return this.repeated();
    }
    // If it's not a structure, it must be a mathematical expression.
    return this.expression();
  }

  // REFACTORED: This method now ONLY parses section blocks.
  private sections(): Sections | Section {
    const sections: Section[] = [];
    
    // It's guaranteed to start with '<' because of how it's called.
    while (!this.isAtEnd() && this.check(TokenType.ANGLE_BRACKET_OPEN)) {
      this.advance(); // Consume '<'
      let expr = this.expression(); // A section contains an expression.
      this.consume(
        TokenType.ANGLE_BRACKET_CLOSE,
        "Expected '>' after section expression."
      );

      sections.push({
        type: 'Section',
        nodes: expr,
        hasMillimeterSuffix: this.consumeMillimeterSuffix(),
      });
    }

    if (sections.length === 0) {
        // This should not happen if called correctly, but as a safeguard:
        throw new Error("Expected one or more sections starting with '<'.");
    }

    if (sections.length === 1) {
      return sections[0];
    }

    return {
      type: 'Sections',
      sections: sections,
    };
  }

  // NEW: Dedicated method for parsing a Repeated block.
  private repeated(): Repeated {
    this.advance(); // Consume '{'
    // A repeated block can contain another structure or a simple expression.
    let content = this.parseStructureOrExpression();
    this.consume(TokenType.BRACE_CLOSE, "Expected '}' after repeated content.");
    
    return {
      type: 'Repeated',
      toRepeat: content,
      hasMillimeterSuffix: this.consumeMillimeterSuffix(),
    };
  }


  // --- EXPRESSION PARSING METHODS ---
  // The following methods are now correctly typed to only return `Expression`.

  private expression(): Expression { // CHANGE: Return type is now Expression
    try {
      let expr: Expression = this.term(); // Ensure expr is typed as Expression

      while (
        !this.isAtEnd() &&
        this.check(TokenType.OPERATOR) &&
        ['+', '-'].includes(this.peek().lexeme)
      ) {
        this.advance();
        const operator = this.previous().lexeme;
        const right: Expression = this.term(); // right is an Expression
        expr = {
          type: 'BinaryExpression',
          left: expr, // This is now guaranteed to be an Expression
          operator,
          right, // This is also guaranteed to be an Expression
        };
      }

      return expr;
    } catch (error) {
      throw new Error(
        `Failed to parse expression: ${(error as Error).message}`
      );
    }
  }

  private term(): Expression { // CHANGE: Return type is now Expression
    try {
      let expr: Expression = this.factor(); // Ensure expr is typed as Expression

      while (
        !this.isAtEnd() &&
        this.check(TokenType.OPERATOR) &&
        ['*', '/', '~'].includes(this.peek().lexeme)
      ) {
        this.advance();
        const operator = this.previous().lexeme;
        const right: Expression = this.factor(); // right is an Expression

        if (right.type === 'SpecialVariable' && right.name === 'n') {
          throw new Error(
            'Invalid usage: "n" cannot appear on the right-hand side of an operator'
          );
        }

        expr = {
          type: 'BinaryExpression',
          left: expr, // Guaranteed to be an Expression
          operator,
          right,      // Guaranteed to be an Expression
        };
      }

      return expr;
    } catch (error) {
      throw new Error(`Failed to parse term: ${(error as Error).message}`);
    }
  }

  private factor(): Expression { // CHANGE: Return type is now Expression
    try {
      if (
        this.check(TokenType.OPERATOR) &&
        ['-', '+'].includes(this.peek().lexeme)
      ) {
        this.advance(); // Consume the operator
        const operator = this.previous().lexeme;
        const right: Expression = this.factor(); // right is an Expression
        return {
          type: 'UnaryExpression',
          operator,
          right, // Guaranteed to be an Expression
        };
      }

      return this.primary();
    } catch (error) {
      throw new Error(`Failed to parse factor: ${(error as Error).message}`);
    }
  }

  private primary(): Expression { // CHANGE: Return type is now Expression
    try {
      if (this.check(TokenType.NUMBER)) {
        this.advance();
        return {
          type: 'NumberLiteral',
          value: parseFloat(this.previous().lexeme),
          hasMillimeterSuffix: this.consumeMillimeterSuffix(),
        };
      }

      if (this.check(TokenType.VARIABLE)) {
        this.advance();
        return {
          type: 'Variable',
          name: this.previous().lexeme,
          hasMillimeterSuffix: this.consumeMillimeterSuffix(),
        };
      }

      if (this.check(TokenType.SPECIAL_VARIABLE)) {
        this.advance();
        return {
          type: 'SpecialVariable',
          name: this.previous().lexeme,
          hasMillimeterSuffix: this.previous().lexeme === 'n',
        };
      }

      if (this.check(TokenType.FUNCTION)) {
        this.advance();
        const functionName = this.previous().lexeme;
        this.consume(
          TokenType.PAREN_OPEN,
          `Expected '(' after function name '${functionName}'.`
        );
        const arg: Expression = this.expression(); // arg is an Expression
        this.consume(
          TokenType.PAREN_CLOSE,
          `Expected ')' after function arguments.`
        );
        return {
          type: 'FunctionCall',
          name: functionName,
          arg, // Guaranteed to be an Expression
          hasMillimeterSuffix: this.consumeMillimeterSuffix(),
        };
      }

      if (this.check(TokenType.PAREN_OPEN)) {
        this.advance();
        const expr: Expression = this.expression(); // expr is an Expression
        if (!expr) {
          throw new Error('Expected expression inside parentheses.');
        }
        this.consume(TokenType.PAREN_CLOSE, "Expected ')' after expression.");
        return {
          type: 'Grouping',
          expression: expr, // Guaranteed to be an Expression
          hasMillimeterSuffix: this.consumeMillimeterSuffix(),
        };
      }

      // REMOVED: The logic for BRACE_OPEN and ANGLE_BRACKET_OPEN has been
      // moved to the new top-level parse method where it belongs.

      if (this.check(TokenType.PAREN_CLOSE)) {
        throw new Error(`Unexpected ')' without a matching '('.`);
      }
      
      throw new Error(`Unexpected token: ${this.peek().lexeme}`);
    } catch (err) {
      throw new Error(`Failed to parse primary: ${(err as Error).message}`);
    }
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(errorMessage);
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}
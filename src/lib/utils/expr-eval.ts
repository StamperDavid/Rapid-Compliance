/**
 * Safe Expression Evaluator
 *
 * A recursive-descent parser and evaluator for a restricted expression language.
 * Supports the operators and constructs needed by FormulaEngine and the
 * distillation-engine condition evaluator without resorting to `new Function`
 * or `eval`.
 *
 * Supported grammar (simplified BNF):
 *   expr        := ternary
 *   ternary     := logical ('?' expr ':' expr)?
 *   logical     := comparison (('&&' | '||') comparison)*
 *   comparison  := additive (('==' | '!=' | '<=' | '>=' | '<' | '>') additive)?
 *   additive    := multiplicative (('+' | '-') multiplicative)*
 *   multiplicative := unary (('*' | '/' | '%') unary)*
 *   unary       := ('!' | '-') unary | primary
 *   primary     := NUMBER | STRING | 'true' | 'false' | 'null' |
 *                  IDENT ('(' argList ')')? |
 *                  '(' expr ')'
 *   argList     := (expr (',' expr)*)?
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type TokenKind =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'QUESTION'
  | 'COLON'
  | 'DOT'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'BANG'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'GT'
  | 'LTE'
  | 'GTE'
  | 'AND'
  | 'OR'
  | 'EOF';

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    // Skip whitespace
    if (/\s/.test(src[i])) { i++; continue; }

    const start = i;

    // Two-character operators first
    const two = src.slice(i, i + 2);
    if (two === '==') { tokens.push({ kind: 'EQ',  value: two, pos: start }); i += 2; continue; }
    if (two === '!=') { tokens.push({ kind: 'NEQ', value: two, pos: start }); i += 2; continue; }
    if (two === '<=') { tokens.push({ kind: 'LTE', value: two, pos: start }); i += 2; continue; }
    if (two === '>=') { tokens.push({ kind: 'GTE', value: two, pos: start }); i += 2; continue; }
    if (two === '&&') { tokens.push({ kind: 'AND', value: two, pos: start }); i += 2; continue; }
    if (two === '||') { tokens.push({ kind: 'OR',  value: two, pos: start }); i += 2; continue; }

    const ch = src[i];

    // Single-character operators / punctuation
    switch (ch) {
      case '+': tokens.push({ kind: 'PLUS',    value: ch, pos: start }); i++; continue;
      case '-': tokens.push({ kind: 'MINUS',   value: ch, pos: start }); i++; continue;
      case '*': tokens.push({ kind: 'STAR',    value: ch, pos: start }); i++; continue;
      case '/': tokens.push({ kind: 'SLASH',   value: ch, pos: start }); i++; continue;
      case '%': tokens.push({ kind: 'PERCENT', value: ch, pos: start }); i++; continue;
      case '!': tokens.push({ kind: 'BANG',    value: ch, pos: start }); i++; continue;
      case '<': tokens.push({ kind: 'LT',      value: ch, pos: start }); i++; continue;
      case '>': tokens.push({ kind: 'GT',      value: ch, pos: start }); i++; continue;
      case '(': tokens.push({ kind: 'LPAREN',  value: ch, pos: start }); i++; continue;
      case ')': tokens.push({ kind: 'RPAREN',  value: ch, pos: start }); i++; continue;
      case ',': tokens.push({ kind: 'COMMA',   value: ch, pos: start }); i++; continue;
      case '?': tokens.push({ kind: 'QUESTION',value: ch, pos: start }); i++; continue;
      case ':': tokens.push({ kind: 'COLON',   value: ch, pos: start }); i++; continue;
    }

    // Dot (member access) — must check before number literal
    if (ch === '.' && !/[0-9]/.test(src[i + 1] ?? '')) {
      tokens.push({ kind: 'DOT', value: ch, pos: start }); i++; continue;
    }

    // Number literal
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) { num += src[i++]; }
      tokens.push({ kind: 'NUMBER', value: num, pos: start });
      continue;
    }

    // String literal (single or double quote)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') { i++; str += src[i] ?? ''; i++; }
        else { str += src[i++]; }
      }
      i++; // consume closing quote
      tokens.push({ kind: 'STRING', value: str, pos: start });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = '';
      while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) { id += src[i++]; }
      if (id === 'true')  { tokens.push({ kind: 'TRUE',  value: id, pos: start }); continue; }
      if (id === 'false') { tokens.push({ kind: 'FALSE', value: id, pos: start }); continue; }
      if (id === 'null')  { tokens.push({ kind: 'NULL',  value: id, pos: start }); continue; }
      tokens.push({ kind: 'IDENT', value: id, pos: start });
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ kind: 'EOF', value: '', pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type-coercing equality that mirrors JavaScript's `==` semantics without
 * using the `==` operator (which is banned by the eqeqeq lint rule).
 *
 * Rules implemented (covering all cases used in field formulas):
 *   - null vs undefined  → true
 *   - number vs string   → compare after Number() coercion
 *   - boolean vs any     → compare after Number() coercion
 *   - otherwise          → strict equality
 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) { return true; }
  if (a === null || a === undefined) { return b === null || b === undefined; }
  if (b === null || b === undefined) { return false; }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(a) === Number(b);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

// ---------------------------------------------------------------------------
// Parser / Evaluator (single-pass recursive descent)
// ---------------------------------------------------------------------------

class Evaluator {
  private tokens: Token[];
  private pos = 0;
  private context: Record<string, unknown>;

  constructor(tokens: Token[], context: Record<string, unknown>) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }
  private check(kind: TokenKind): boolean { return this.peek().kind === kind; }
  private match(...kinds: TokenKind[]): boolean {
    if (kinds.includes(this.peek().kind)) { this.consume(); return true; }
    return false;
  }
  private expect(kind: TokenKind): Token {
    if (!this.check(kind)) {
      throw new Error(`Expected ${kind} but got ${this.peek().kind} at position ${this.peek().pos}`);
    }
    return this.consume();
  }

  evaluate(): unknown {
    const result = this.parseTernary();
    if (!this.check('EOF')) {
      throw new Error(`Unexpected token '${this.peek().value}' at position ${this.peek().pos}`);
    }
    return result;
  }

  private parseTernary(): unknown {
    const cond = this.parseLogical();
    if (this.match('QUESTION')) {
      const then = this.parseTernary();
      this.expect('COLON');
      const otherwise = this.parseTernary();
      return cond ? then : otherwise;
    }
    return cond;
  }

  private parseLogical(): unknown {
    let left = this.parseComparison();
    while (this.check('AND') || this.check('OR')) {
      const op = this.consume().kind;
      const right = this.parseComparison();
      left = op === 'AND' ? (Boolean(left) && Boolean(right)) : (Boolean(left) || Boolean(right));
    }
    return left;
  }

  private parseComparison(): unknown {
    const left = this.parseAdditive();
    const compOps: TokenKind[] = ['EQ', 'NEQ', 'LT', 'GT', 'LTE', 'GTE'];
    if (compOps.includes(this.peek().kind)) {
      const op = this.consume().kind;
      const right = this.parseAdditive();
      switch (op) {
        case 'EQ':  return looseEqual(left, right);
        case 'NEQ': return !looseEqual(left, right);
        case 'LT':  return (left as number) <  (right as number);
        case 'GT':  return (left as number) >  (right as number);
        case 'LTE': return (left as number) <= (right as number);
        case 'GTE': return (left as number) >= (right as number);
      }
    }
    return left;
  }

  private parseAdditive(): unknown {
    let left = this.parseMultiplicative();
    while (this.check('PLUS') || this.check('MINUS')) {
      const op = this.consume().kind;
      const right = this.parseMultiplicative();
      if (op === 'PLUS') {
        // Support string concatenation just like JS `+`
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right);
        } else {
          left = (left as number) + (right as number);
        }
      } else {
        left = (left as number) - (right as number);
      }
    }
    return left;
  }

  private parseMultiplicative(): unknown {
    let left = this.parseUnary();
    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      const op = this.consume().kind;
      const right = this.parseUnary();
      switch (op) {
        case 'STAR':    left = (left as number) * (right as number); break;
        case 'SLASH':   left = (left as number) / (right as number); break;
        case 'PERCENT': left = (left as number) % (right as number); break;
      }
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.match('BANG'))  { return !this.parseUnary(); }
    if (this.match('MINUS')) { return -(this.parseUnary() as number); }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const tok = this.peek();

    if (this.match('NUMBER')) { return parseFloat(tok.value); }
    if (this.match('STRING')) { return tok.value; }
    if (this.match('TRUE'))   { return true; }
    if (this.match('FALSE'))  { return false; }
    if (this.match('NULL'))   { return null; }

    if (this.match('LPAREN')) {
      const val = this.parseTernary();
      this.expect('RPAREN');
      return val;
    }

    if (this.check('IDENT')) {
      const name = this.consume().value;

      // Start with the variable value from context
      let value: unknown = (name in this.context) ? this.context[name] : undefined;

      // Handle dot-notation member access chain: obj.prop.method(...)
      while (this.check('DOT')) {
        this.consume(); // eat the DOT
        const prop = this.expect('IDENT').value;
        if (value !== null && value !== undefined && typeof value === 'object') {
          value = (value as Record<string, unknown>)[prop];
        } else {
          value = undefined;
        }
      }

      // Function call (either direct IDENT() or after member access obj.method())
      if (this.match('LPAREN')) {
        const args: unknown[] = [];
        if (!this.check('RPAREN')) {
          args.push(this.parseTernary());
          while (this.match('COMMA')) {
            args.push(this.parseTernary());
          }
        }
        this.expect('RPAREN');

        if (typeof value !== 'function') {
          throw new Error(`'${name}' is not callable`);
        }
        return (value as (...a: unknown[]) => unknown)(...args);
      }

      return value;
    }

    throw new Error(`Unexpected token '${tok.value}' (${tok.kind}) at position ${tok.pos}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a restricted expression string against a context object.
 *
 * @param expression - The expression to evaluate (e.g. `"price * quantity"`)
 * @param context    - Variables and functions available to the expression
 * @returns The evaluated result
 * @throws  If the expression is syntactically invalid or references unknown functions
 */
export function evaluateExpression(
  expression: string,
  context: Record<string, unknown> = {}
): unknown {
  const tokens = tokenize(expression);
  const evaluator = new Evaluator(tokens, context);
  return evaluator.evaluate();
}

const logger = require("../API/logger");

const MAX_EXPRESSION_LENGTH = 2048;

// Band-math tokens: identifiers (b1, asset_b1, red), numbers, operators,
// parentheses, commas and `;` between bands. Everything else is rejected.
const TOKEN_RE =
  /\s+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|!=|[+\-*/%<>&|~^(),;]/y;
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_IDENTIFIERS = new Set([
  "eval",
  "exec",
  "compile",
  "open",
  "import",
  "__import__",
  "getattr",
  "setattr",
  "delattr",
  "globals",
  "locals",
  "vars",
  "breakpoint",
  "input",
  "help",
  "exit",
  "quit",
]);

/**
 * Returns true when `expression` only contains tokens that are valid in a
 * rio-tiler band-math expression.
 * @param {*} expression
 * @returns {boolean}
 */
function isSafeExpression(expression) {
  if (typeof expression !== "string") return false;
  if (expression.length === 0 || expression.length > MAX_EXPRESSION_LENGTH)
    return false;

  TOKEN_RE.lastIndex = 0;
  let pos = 0;
  while (pos < expression.length) {
    TOKEN_RE.lastIndex = pos;
    const match = TOKEN_RE.exec(expression);
    if (!match || match.index !== pos || match[0].length === 0) return false;

    const token = match[0];
    if (IDENTIFIER_RE.test(token)) {
      if (token.includes("__") || FORBIDDEN_IDENTIFIERS.has(token.toLowerCase()))
        return false;
    }
    pos += token.length;
  }
  return true;
}

/**
 * Creates middleware that rejects TiTiler requests whose `expression`
 * parameter (query for GET, body otherwise) is not plain band math.
 *
 * @returns {Function} Express middleware function
 */
function createTitilerExpressionValidator() {
  return function validateTitilerExpression(req, res, next) {
    const expression =
      req.method === "GET" ? req.query.expression : req.body?.expression;

    if (expression === undefined || expression === null) {
      return next();
    }

    if (!isSafeExpression(expression)) {
      logger(
        "warn",
        `Blocked TiTiler request with disallowed expression: ${String(
          expression
        ).slice(0, 200)}`,
        "validateTitilerExpression",
        req
      );

      return res.status(400).json({
        error: "Bad Request",
        message: "The expression parameter contains disallowed content",
        detail:
          "Only band identifiers, numbers, arithmetic/comparison operators, parentheses, commas and ';' are permitted in expression",
      });
    }

    next();
  };
}

module.exports = createTitilerExpressionValidator;
module.exports.isSafeExpression = isSafeExpression;
module.exports.MAX_EXPRESSION_LENGTH = MAX_EXPRESSION_LENGTH;

const express = require("express");
const { planWithProvider } = require("../provider");

const router = express.Router();

function getToolNames(req) {
  return req.app?.locals?.agentToolNames || new Set();
}

function getValidators(req) {
  return req.app?.locals?.agentToolValidators || {};
}

function repr(v) {
  try {
    if (typeof v === "string") return `"${v}"`;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function validateAction(action, req) {
  if (!action || typeof action !== "object") {
    throw new TypeError(
      `Action must be an object; received ${repr(action)} instead`,
    );
  }
  const toolNames = getToolNames(req);
  if (!toolNames.has(action.tool)) {
    const expected = [...toolNames].join(", ") || "(none)";
    throw new Error(
      `Unknown tool '${action.tool}'. Expected one of ${expected}; received ${repr(action.tool)} instead`,
    );
  }
  const validators = getValidators(req);
  const validate = validators[action.tool];
  const args = action.args || {};
  if (typeof validate !== "function") {
    throw new Error(`No validator for tool ${action.tool}`);
  }
  const valid = validate(args);
  if (!valid) {
    const errors =
      (validate.errors || [])
        .map((e) => `${e.instancePath || ""} ${e.message}`)
        .join("; ") || "validation failed";
    const err = new Error(`${action.tool} args invalid: ${errors}`);
    err.validationErrors = validate.errors || [];
    throw err;
  }
  return { tool: action.tool, args };
}

router.post("/", express.json(), async function (req, res) {
  try {
    const message = req.body?.message ?? "";
    if (typeof message !== "string") {
      const err = new Error("Message must be a string.");
      err.status = 400;
      throw err;
    }
    if (message.length > 2000) {
      const err = new Error("Message too long (max 2000 chars).");
      err.status = 400;
      throw err;
    }

    const result = await planWithProvider(message);
    if (!result || !Array.isArray(result.actions)) {
      throw new Error(
        "Provider returned malformed response (missing actions array).",
      );
    }

    const reply = typeof result.reply === "string" ? result.reply.trim() : "";
    const citations = Array.isArray(result.citations) ? result.citations : [];
    const actions = result.actions.map((action) => validateAction(action, req));

    const planList = actions.map((a) => a.tool).join(", ") || "(none)";
    const planText = `Planned: ${planList}.`;

    const segments = [];
    if (reply) segments.push(reply);
    if (planText) segments.push(planText);
    const text = segments.join("\n\n");

    const debug = {
      providerAttempted: true,
      providerReturnedActions: actions.length > 0,
      providerFailureReason: null,
    };
    if (result.debug) {
      debug.azure = result.debug;
    }

    res.status(200).json({
      text,
      reply,
      citations,
      actions,
      source: "provider",
      debug,
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const response = {
      error: error.message || "Agent planning failed",
      stack: typeof error.stack === "string" ? error.stack.split(/\r?\n/) : [],
    };
    if (error.debug) response.debug = error.debug;
    if (error.validationErrors)
      response.validationErrors = error.validationErrors;
    res.status(status).json(response);
  }
});

module.exports = router;

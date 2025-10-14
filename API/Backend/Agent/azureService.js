"use strict";

/**
 * Azure AI Agent Service helpers.
 *
 * This module mirrors the GA JavaScript samples:
 * https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/ai/ai-agents/samples/v1-beta
 *
 * Quick primer for newcomers:
 *   1. Authenticate with `DefaultAzureCredential` (run `az login` beforehand).
 *   2. Use strongly-typed helpers from `@azure/ai-agents` such as `ToolSet`.
 *   3. Keep threads short-lived to avoid cluttering the Azure AI project.
 */

const { AgentsClient, ToolSet, isOutputOfType } = require("@azure/ai-agents");
const { DefaultAzureCredential } = require("@azure/identity");

const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
let sharedClient = null;

function createMissingEnvError(missing) {
  const missingList = Array.isArray(missing)
    ? missing.join(", ")
    : String(missing || "");
  const err = new Error(
    `Azure Agent Service environment is incomplete. Missing: ${missingList || "unknown values"}`,
  );
  err.code = "MissingAzureAgentEnv";
  err.missing = missing;
  return err;
}

function readEnv(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

/**
 * Surface the minimum configuration the service needs.
 * The doc set now calls these values PROJECT_ENDPOINT and Agent Id.
 */
function haveFasEnv() {
  const endpoint = readEnv("PROJECT_ENDPOINT");
  const agentId = readEnv("AZURE_AI_FOUNDRY_AGENT_ID");
  const bingConnectionId = readEnv("AZURE_BING_CONNECTION_ID");
  const missing = [];
  if (!endpoint) missing.push("PROJECT_ENDPOINT");
  if (!agentId) missing.push("AZURE_AI_FOUNDRY_AGENT_ID");
  return {
    ok: missing.length === 0,
    missing,
    endpoint,
    agentId,
    bingConnectionId,
    apiVersion: "v1-beta",
  };
}

function getClient(endpoint) {
  if (!sharedClient) {
    sharedClient = new AgentsClient(endpoint, new DefaultAzureCredential());
  }
  return sharedClient;
}

function buildBingToolSet(connectionId) {
  if (!connectionId) return null;
  const toolSet = new ToolSet();
  toolSet.addBingGroundingTool([{ connectionId }]);
  return toolSet;
}

async function collectMessages(client, threadId) {
  const messages = [];
  for await (const msg of client.messages.list(threadId)) {
    // list() yields newest-first; unshift keeps chronological order for easy reading.
    messages.unshift(msg);
  }
  return messages;
}

function findLatestAssistantMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") return messages[i];
  }
  return messages[0] || {};
}

function getTextContent(message) {
  const parts = Array.isArray(message?.content) ? message.content : [];
  for (const part of parts) {
    if (isOutputOfType(part, "text")) {
      const textValue = part?.text?.value ?? part?.text;
      if (typeof textValue === "string" && textValue.trim().length > 0) {
        return textValue.trim();
      }
    }
  }
  return "";
}

function extractLinksFromMessage(message) {
  const links = [];
  const citations = [];
  const parts = Array.isArray(message?.content) ? message.content : [];
  for (const part of parts) {
    if (isOutputOfType(part, "text")) {
      const annotations = Array.isArray(part?.text?.annotations)
        ? part.text.annotations
        : [];
      for (const annotation of annotations) {
        const url =
          annotation?.url || annotation?.source?.url || annotation?.source;
        if (url && typeof url === "string") {
          citations.push(url);
          if (!links.some((existing) => existing.url === url)) {
            links.push({ title: annotation?.title || url, url });
          }
        }
      }
    }
    if (Array.isArray(part?.citations)) {
      for (const citation of part.citations) {
        const url = citation?.url || citation?.source?.url || citation?.source;
        if (url && typeof url === "string") {
          citations.push(url);
          if (!links.some((existing) => existing.url === url)) {
            links.push({ title: citation?.title || url, url });
          }
        }
      }
    }
  }
  return { links, citations };
}

async function executeAgentRun(messageText, { toolSet } = {}) {
  const cfg = haveFasEnv();
  if (!cfg.ok) {
    throw createMissingEnvError(cfg.missing);
  }

  const client = getClient(cfg.endpoint);
  const activeToolSet = toolSet || buildBingToolSet(cfg.bingConnectionId);
  let thread = null;
  let run = null;
  try {
    thread = await client.threads.create();
    await client.messages.create(thread.id, "user", messageText);

    const runOptions = {};
    const resources = activeToolSet?.toolResources;
    if (resources && Object.keys(resources).length > 0) {
      runOptions.toolResources = resources;
    }

    run = await client.runs.createAndPoll(thread.id, cfg.agentId, runOptions);
    if (!SUCCESS_STATUSES.has(run.status)) {
      const failureReason =
        run?.lastError?.message ||
        run?.lastError?.code ||
        (run?.status && run.status !== "failed"
          ? run.status
          : "AgentRunFailed");
      const err = new Error(`Azure Agent Service run failed: ${failureReason}`);
      err.code = "AzureAgentRunFailed";
      err.run = run;
      throw err;
    }

    const messages = await collectMessages(client, thread.id);
    const assistant = findLatestAssistantMessage(messages);
    return { run, message: assistant, messages };
  } catch (error) {
    if (run && !error.run) {
      error.run = run;
    }
    throw error;
  } finally {
    if (thread?.id) {
      try {
        await client.threads.delete(thread.id);
      } catch (_) {
        // A best-effort cleanup; stale threads can always be inspected later via the Azure portal.
      }
    }
  }
}

async function runAgentMessage(messageText) {
  return executeAgentRun(messageText);
}

module.exports = { haveFasEnv, runAgentMessage };

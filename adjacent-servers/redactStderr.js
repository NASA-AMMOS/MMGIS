// Child tracebacks may include database credentials or signed asset URLs.
function redactStderr(text) {
  let redacted = text.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s'"<>]+/gi, (value) => {
    try {
      const url = new URL(value);
      if (url.username || url.password) {
        url.username = "REDACTED";
        url.password = "";
      }
      if (url.search) url.search = "?REDACTED";
      if (url.hash) url.hash = "#REDACTED";
      return url.toString();
    } catch {
      return "[REDACTED URL]";
    }
  }).replace(
    /\b(password|passwd|pwd|token|secret|secret_access_key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    "$1=[REDACTED]"
  );
  for (const [key, value] of Object.entries(process.env)) {
    if (value && /PASS|SECRET|TOKEN|KEY|CREDENTIAL/i.test(key)) {
      redacted = redacted.split(value).join("[REDACTED]");
    }
  }
  return redacted;
}

module.exports = redactStderr;

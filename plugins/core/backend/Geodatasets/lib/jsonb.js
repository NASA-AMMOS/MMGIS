/**
 * PostgreSQL JSONB accessors for geodataset `properties` keys.
 *
 * Extracted from routes/geodatasets.js so the SQL-building helpers that use them
 * can be unit tested without standing up a server.
 */

// Build a PostgreSQL JSONB accessor for a possibly nested key.
// For a flat key like "name", returns { text: "properties->>:placeholder", replacements: { placeholder: "name" } }
// For a dotted key like "metadata.author", returns:
//   { text: "properties->'metadata'->>'author'", replacements: {} }
// (nested keys are single-quoted inline since parameterized -> chains are awkward)
function jsonbAccessor(key, placeholder) {
  const parts = key.split(".");
  // Cap nesting depth to prevent excessively long SQL expressions
  if (parts.length > 10) {
    return {
      text: `properties->>:${placeholder}`,
      replacements: { [placeholder]: key },
    };
  }
  if (parts.length === 1) {
    return {
      text: `properties->>:${placeholder}`,
      replacements: { [placeholder]: key },
    };
  }
  // Validate each part: only allow alphanumeric, underscores, hyphens, spaces
  for (const p of parts) {
    if (!/^[\w\s\-]+$/.test(p)) {
      return {
        text: `properties->>:${placeholder}`,
        replacements: { [placeholder]: key },
      };
    }
  }
  // Nested: properties->'a'->'b'->>'c'
  const path = parts
    .map((p, i) => {
      const safeP = p.replace(/'/g, "''");
      return i < parts.length - 1 ? `->'${safeP}'` : `->>'${safeP}'`;
    })
    .join("");
  return { text: `properties${path}`, replacements: {} };
}

module.exports = { jsonbAccessor };

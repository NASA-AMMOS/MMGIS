function parseTilesetTimeDir(name) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}[:_]\d{2}[:_]\d{2}(?:\.\d+)?Z?)/.exec(name);
  if (!match) return null;

  const t = `${match[1].replace(/_/g, ":").replace(/Z$/, "")}Z`;
  const date = new Date(t);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})[:_](\d{2})[:_](\d{2})/.exec(
    match[1]
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(parts[1]) ||
    date.getUTCMonth() + 1 !== Number(parts[2]) ||
    date.getUTCDate() !== Number(parts[3]) ||
    date.getUTCHours() !== Number(parts[4]) ||
    date.getUTCMinutes() !== Number(parts[5]) ||
    date.getUTCSeconds() !== Number(parts[6])
  )
    return null;

  return {
    t,
    n: name.slice(match[1].length).replace(/^(?:-{1,2}|_)/, ""),
  };
}

module.exports = { parseTilesetTimeDir };

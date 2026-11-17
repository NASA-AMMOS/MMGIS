function buildEntriesResponse(sets) {
  const entries = (sets || []).map((set) => ({
    config: set.config,
    updated: set.updatedAt,
  }));

  return {
    status: "success",
    body: { entries },
  };
}

module.exports = buildEntriesResponse;

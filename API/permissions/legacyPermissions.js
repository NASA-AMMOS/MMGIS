// The pre-role-bindings users.permission values. Only the one-time legacy
// import reads them; nothing writes them anymore.
const LEGACY_SUPERADMIN = "111";
const LEGACY_ADMIN = "110";
const LEGACY_NONE = "000";
const LEGACY_PERMISSION_VALUES = ["000", "001", "010", "011", "100", "101", "110", "111"];

module.exports = { LEGACY_SUPERADMIN, LEGACY_ADMIN, LEGACY_NONE, LEGACY_PERMISSION_VALUES };

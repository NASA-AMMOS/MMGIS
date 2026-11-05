import { useRef, useEffect, useState, useCallback } from "react";
import { api } from "./shared";

// Data and state shared by the Users & Access tabs

// The page's roles, missions, accounts, groups, grants, tokens and new-account default, and a refresh() that reloads them all
export function useAccessData(notify) {
  const [roles, setRoles] = useState({});
  const [missions, setMissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [defaults, setDefaults] = useState(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    api("access_roles").then((r) => setRoles(r.body.roles)).catch(() => {});
    api("access_missions").then((r) => setMissions(r.body || [])).catch(() => {});
    api("account_entries").then((r) => setUsers((r.body && r.body.entries) || [])).catch(() => {});
    api("access_groups").then((r) => setGroups(r.body || [])).catch((res) => notify(res.message || "Failed to get groups.", "error"));
    api("access_bindings").then((r) => setBindings(r.body || [])).catch(() => {});
    api("longtermtoken_get").then((r) => setTokens(r.tokens || [])).catch(() => {});
    api("account_defaults").then((r) => setDefaults(r.body ? r.body.missions_viewing : null)).catch(() => {});
  }, [notify]);
  useEffect(refresh, [refresh]);

  return { roles, missions, users, groups, bindings, tokens, defaults, version, refresh };
}

// useState whose value outlives the tab, so switching tabs keeps searches, sorting and pages
export function useRemembered(store, key, initial) {
  const [value, setValue] = useState(() => (key in store ? store[key] : initial));
  useEffect(() => {
    store[key] = value;
  }, [store, key, value]);
  return [value, setValue];
}

// Runs effect when deps change, but not on mount
export function useOnChange(effect, deps) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) effect();
    else mounted.current = true;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

import React, { useMemo } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import TablePagination from "@mui/material/TablePagination";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import { useStyles } from "./styles";
import { AUDIENCE_LABEL, whereText, GroupedGrantsTable, sourceText } from "./shared";
import { useRemembered } from "./hooks";

// Every grant, one collapsible section per user, group or audience
export default function AllGrantsTab({ ctx }) {
  const { roles, users, groups, bindings, askRemove, openGrant, allLayerPaths, remember } = ctx;
  const c = useStyles();
  const [grantSearch, setGrantSearch] = useRemembered(remember, "grantSearch", "");
  const [grantPage, setGrantPage] = useRemembered(remember, "grantPage", 0);
  const [grantsPerPage, setGrantsPerPage] = useRemembered(remember, "grantsPerPage", 50);
  const [openGrantSections, setOpenGrantSections] = useRemembered(remember, "openGrantSections", {});
  // Sorted once per change
  const allGrantRows = useMemo(() => {
    const userNames = new Map(users.map((u) => [String(u.id), u.username]));
    const groupNames = new Map(groups.map((g) => [String(g.id), g.name]));
    const subjectText = (b) => {
      const id = String(b.subject_id);
      if (b.subject_type === "user") return userNames.get(id) || `user ${id}`;
      if (b.subject_type === "group") return groupNames.get(id) || id;
      return AUDIENCE_LABEL[b.subject_id] || id;
    };
    const q = grantSearch.trim().toLowerCase();
    return bindings
      .map((b) => ({ b, removable: true, via: sourceText(b), who: subjectText(b) }))
      .filter(({ b, who }) =>
        !q ||
        [who, (roles[b.role] && roles[b.role].label) || b.role, whereText(b, allLayerPaths)].some((t) => String(t).toLowerCase().includes(q))
      )
      .sort((x, y) => x.who.localeCompare(y.who));
  }, [bindings, users, groups, roles, allLayerPaths, grantSearch]);
  const grantSections = useMemo(() => {
    const byKey = new Map();
    for (const r of allGrantRows) {
      const key = `${r.b.subject_type}:${r.b.subject_id}`;
      if (!byKey.has(key))
        byKey.set(key, { key, type: r.b.subject_type, tagType: r.b.subject_type === "audience" ? r.b.subject_id : r.b.subject_type, who: r.who, rows: [] });
      byKey.get(key).rows.push(r);
    }
    const order = { audience: 0, group: 1, user: 2 };
    return [...byKey.values()].sort((x, y) => (order[x.type] ?? 9) - (order[y.type] ?? 9) || x.who.localeCompare(y.who));
  }, [allGrantRows]);
  // While filtering every matching section is open, so matches aren't hidden
  const grantExpanded = (key) => !!grantSearch.trim() || !!openGrantSections[key];
  const allGrantSectionsOpen = grantSections.length > 0 && grantSections.every((sec) => grantExpanded(sec.key));
  const grantPageIndex = Math.min(grantPage, Math.max(0, Math.ceil(grantSections.length / grantsPerPage) - 1));

  return (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField
                size="small"
                className={`${c.field} ${c.search}`}
                placeholder="Filter by who, role or where"
                value={grantSearch}
                onChange={(e) => { setGrantSearch(e.target.value); setGrantPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <span className={c.barHint}>Everyone who has access, one row each. Click a row to see its grants.</span>
              <span className={c.grow} />
              {!grantSearch.trim() && grantSections.length > 0 && (
                <Button className={c.barButton} startIcon={allGrantSectionsOpen ? <UnfoldLessIcon /> : <UnfoldMoreIcon />} onClick={() =>
                  setOpenGrantSections(allGrantSectionsOpen ? {} : Object.fromEntries(grantSections.map((sec) => [sec.key, true])))
                }>{allGrantSectionsOpen ? "Collapse all" : "Expand all"}</Button>
              )}
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => openGrant({})}>Add access</Button>
            </div>
            <GroupedGrantsTable
              sections={grantSections.slice(grantPageIndex * grantsPerPage, (grantPageIndex + 1) * grantsPerPage)}
              expanded={grantExpanded}
              onToggle={(key) => setOpenGrantSections((o) => ({ ...o, [key]: !grantExpanded(key) }))}
              roles={roles}
              layerPaths={allLayerPaths}
              onRemove={(b) => askRemove(b)}
              emptyText={grantSearch ? "No grants match." : "No access granted yet."}
            />
            {grantSections.length > 0 && (
              <TablePagination
                className={c.bottomBar}
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={grantSections.length}
                rowsPerPage={grantsPerPage}
                page={grantPageIndex}
                onPageChange={(e, p) => setGrantPage(p)}
                onRowsPerPageChange={(e) => { setGrantsPerPage(parseInt(e.target.value, 10)); setGrantPage(0); }}
              />
            )}
          </div>
  );
}

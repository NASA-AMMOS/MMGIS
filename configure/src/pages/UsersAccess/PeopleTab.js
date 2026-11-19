import React, { useMemo } from "react";
import { setModal } from "../../core/ConfigureStore";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TablePagination from "@mui/material/TablePagination";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { useStyles } from "./styles";
import { api, SubjectTag, indexBindings, summarizeUser, PEOPLE_COLUMNS, dateText, signInText, needsRelink, relinkPending, lastProviderLogin, SiteRoleBadges, MissionList, rowActivate } from "./shared";
import { useRemembered, useOnChange } from "./hooks";

// Every account, with its site role and what it can view and edit
export default function PeopleTab({ ctx }) {
  const { roles, users, groups, bindings, dispatch, setPanel, remember, notify, refresh } = ctx;
  const linkedProviders = String(window.mmgisglobal.AUTH_PROVIDERS || "").split(",").filter((p) => p && p !== "local");
  const recheckLinked = () =>
    api("account_recheck_linked", {})
      .then((res) => {
        const r = (res && res.body) || {};
        notify(
          r.failed
            ? `Couldn't check ${r.failed} of ${r.checked} provider-linked accounts: the login provider is unreachable or refused its service account (see the server log). ${r.missing} not found.`
            : `Checked ${r.checked} provider-linked accounts: ${r.missing} not found.${r.unsupported ? ` ${r.unsupported} can't be checked between logins (the provider can't look them up with its current settings; see its setup guide).` : ""}${r.staleRelinks ? ` ${r.staleRelinks} pending relinks can't take effect (their entry is gone, or they were allowed under an old subject setting); allow them again.` : ""}`,
          r.missing || r.failed || r.staleRelinks ? "warning" : "success"
        );
        refresh();
      })
      .catch((res) => notify(res.message || "Failed to check the linked accounts.", "error"));
  const c = useStyles();
  const [search, setSearch] = useRemembered(remember, "peopleSearch", "");
  const [onlyRelink, setOnlyRelink] = useRemembered(remember, "peopleOnlyRelink", false);
  const relinkCount = useMemo(() => users.filter(needsRelink).length, [users]);
  const pendingCount = useMemo(() => users.filter(relinkPending).length, [users]);
  const [peopleSort, setPeopleSort] = useRemembered(remember, "peopleSort", { by: "username", dir: "asc" });
  const [peoplePage, setPeoplePage] = useRemembered(remember, "peoplePage", 0);
  const [peoplePerPage, setPeoplePerPage] = useRemembered(remember, "peoplePerPage", 25);
  const bindingIndex = useMemo(() => indexBindings(bindings, groups), [bindings, groups]);
  const summaries = useMemo(() => users.map((u) => ({ u, s: summarizeUser(u, bindingIndex) })), [users, bindingIndex]);
  const peopleRows = useMemo(() => {
    const q = search.toLowerCase();
    const key = (PEOPLE_COLUMNS.find((col) => col[0] === peopleSort.by) || PEOPLE_COLUMNS[0])[2];
    return summaries
      .filter(({ u }) => !onlyRelink || needsRelink(u) || relinkPending(u))
      .filter(({ u, s }) => !q || [u.username, u.email || "", signInText(u), ...s.groupNames].some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const cmp = ka < kb ? -1 : ka > kb ? 1 : a.u.username.localeCompare(b.u.username);
        return peopleSort.dir === "asc" ? cmp : -cmp;
      });
  }, [summaries, search, peopleSort, onlyRelink]);
  useOnChange(() => setPeoplePage(0), [search, peopleSort, peoplePerPage, onlyRelink]);
  const pageIndex = Math.min(peoplePage, Math.max(0, Math.ceil(peopleRows.length / peoplePerPage) - 1));
  const pageRows = peopleRows.slice(pageIndex * peoplePerPage, (pageIndex + 1) * peoplePerPage);
  return (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField
                size="small"
                className={`${c.field} ${c.search}`}
                placeholder="Search username, email or sign-in (e.g. not found)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <span className={c.barHint}>Every account, its site role and what it can view and edit. Click a row for details.</span>
              <span className={c.grow} />
              {(relinkCount > 0 || pendingCount > 0 || onlyRelink) && (
                <Button variant={onlyRelink ? "contained" : "outlined"} disableElevation className={c.barButton} onClick={() => setOnlyRelink(!onlyRelink)} title="Only linked accounts that can't sign in: their provider entry is gone (people who left, or entries moved or renamed) or they were linked under an old subject setting. Those with a relink allowed stay listed, as pending, until the person signs in">
                  Not found / needs relink ({relinkCount}{pendingCount ? `, ${pendingCount} pending` : ""})
                </Button>
              )}
              {linkedProviders.length > 0 && (
                <Button variant="outlined" className={c.barButton} onClick={recheckLinked} title="Ask the login providers about every linked account now, e.g. after a directory migration">
                  Check linked accounts
                </Button>
              )}
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => dispatch(setModal({ name: "newUser" }))}>New user</Button>
            </div>
            <Table size="small" className={c.table} stickyHeader>
              <TableHead>
                <TableRow>
                  {PEOPLE_COLUMNS.map(([k, label]) => (
                    <TableCell key={k} sortDirection={peopleSort.by === k ? peopleSort.dir : false}>
                      <TableSortLabel
                        active={peopleSort.by === k}
                        direction={peopleSort.by === k ? peopleSort.dir : "asc"}
                        onClick={() => setPeopleSort({ by: k, dir: peopleSort.by === k && peopleSort.dir === "asc" ? "desc" : "asc" })}
                      >
                        {label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map(({ u, s }) => {
                  return (
                    <TableRow key={u.id} className={c.clickRow} {...rowActivate(() => setPanel({ type: "user", id: u.id }))}>
                      <TableCell className={c.roleText}>{u.username}</TableCell>
                      <TableCell className={u.email ? "" : c.muted}>{u.email || "No email"}</TableCell>
                      <TableCell><SiteRoleBadges siteRoles={s.siteRoles} siteRoleFrom={s.siteRoleFrom} roles={roles} /></TableCell>
                      <TableCell>{s.viewAll ? <b>All</b> : s.viewList.length ? <MissionList items={s.viewList} /> : <span className={c.muted}>None</span>}</TableCell>
                      <TableCell>{s.missionAdmin.length ? <MissionList items={s.missionAdmin} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.layerEditor.length ? <MissionList items={s.layerEditor} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.groupNames.length ? s.groupNames.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<SubjectTag type="group" name={n} showKind={false} /></React.Fragment>) : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell className={(u.sign_ins || []).length ? "" : c.muted}>{signInText(u)}</TableCell>
                      <TableCell className={c.muted}>{dateText(lastProviderLogin(u))}</TableCell>
                      <TableCell className={c.muted}>{dateText(u.createdAt)}</TableCell>
                      <TableCell className={c.muted}>{dateText(u.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              className={c.bottomBar}
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={peopleRows.length}
              rowsPerPage={peoplePerPage}
              page={pageIndex}
              onPageChange={(e, p) => setPeoplePage(p)}
              onRowsPerPageChange={(e) => setPeoplePerPage(parseInt(e.target.value, 10))}
            />
          </div>
  );
}

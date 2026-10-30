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
import { SubjectTag, indexBindings, summarizeUser, PEOPLE_COLUMNS, dateText, SiteRoleBadges, MissionList } from "./shared";
import { useRemembered, useOnChange } from "./hooks";

// Every account, with its site role and what it can view and edit
export default function PeopleTab({ ctx }) {
  const { roles, users, groups, bindings, dispatch, setPanel, remember } = ctx;
  const c = useStyles();
  const [search, setSearch] = useRemembered(remember, "peopleSearch", "");
  const [peopleSort, setPeopleSort] = useRemembered(remember, "peopleSort", { by: "username", dir: "asc" });
  const [peoplePage, setPeoplePage] = useRemembered(remember, "peoplePage", 0);
  const [peoplePerPage, setPeoplePerPage] = useRemembered(remember, "peoplePerPage", 25);
  const bindingIndex = useMemo(() => indexBindings(bindings, groups), [bindings, groups]);
  const summaries = useMemo(() => users.map((u) => ({ u, s: summarizeUser(u, bindingIndex) })), [users, bindingIndex]);
  const peopleRows = useMemo(() => {
    const q = search.toLowerCase();
    const key = (PEOPLE_COLUMNS.find((col) => col[0] === peopleSort.by) || PEOPLE_COLUMNS[0])[2];
    return summaries
      .filter(({ u }) => !q || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const cmp = ka < kb ? -1 : ka > kb ? 1 : a.u.username.localeCompare(b.u.username);
        return peopleSort.dir === "asc" ? cmp : -cmp;
      });
  }, [summaries, search, peopleSort]);
  useOnChange(() => setPeoplePage(0), [search, peopleSort, peoplePerPage]);
  const pageIndex = Math.min(peoplePage, Math.max(0, Math.ceil(peopleRows.length / peoplePerPage) - 1));
  const pageRows = peopleRows.slice(pageIndex * peoplePerPage, (pageIndex + 1) * peoplePerPage);
  return (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField
                size="small"
                className={`${c.field} ${c.search}`}
                placeholder="Search by username or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <span className={c.barHint}>Every account, its site role and what it can view and edit. Click a row for details.</span>
              <span className={c.grow} />
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
                    <TableRow key={u.id} className={c.clickRow} onClick={() => setPanel({ type: "user", id: u.id })}>
                      <TableCell className={c.roleText}>{u.username}</TableCell>
                      <TableCell className={u.email ? "" : c.muted}>{u.email || "No email"}</TableCell>
                      <TableCell><SiteRoleBadges siteRoles={s.siteRoles} roles={roles} /></TableCell>
                      <TableCell>{s.viewAll ? <b>All</b> : s.viewList.length ? <MissionList items={s.viewList} /> : <span className={c.muted}>None</span>}</TableCell>
                      <TableCell>{s.missionAdmin.length ? <MissionList items={s.missionAdmin} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.layerEditor.length ? <MissionList items={s.layerEditor} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.groupNames.length ? s.groupNames.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<SubjectTag type="group" name={n} showKind={false} /></React.Fragment>) : <span className={c.muted}>—</span>}</TableCell>
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

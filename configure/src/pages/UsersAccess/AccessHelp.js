// Access Help page: how grants, roles and scopes fit together
import React, { useEffect, useState } from "react";
import { makeStyles } from "@mui/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

import { calls } from "../../core/calls";
import { SubjectTag, RoleBadge } from "./UsersAccess";

const ROLES = [
  ["viewer", "See a mission and its layers."],
  ["layer_editor", "Edit layers in one folder, one mission or every mission."],
  ["mission_admin", "Edit a mission's whole configuration."],
  ["data_admin", "Manage geodatasets, datasets and STAC."],
  ["superadmin", "Everything, including accounts and site options."],
];

const ACCESS_COLUMNS = ["Their own grants", "Their groups", "Logged-in users", "Everyone"];

export default function AccessHelp() {
  const c = useStyles();
  const [roles, setRoles] = useState({});
  useEffect(() => {
    calls.api("access_roles", {}, (r) => setRoles((r.body && r.body.roles) || {}), () => {});
  }, []);
  return (
    <div className={c.page}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <HelpOutlineIcon />
          <Typography style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }} variant="h6" component="div">
            Access Help
          </Typography>
        </div>
      </Toolbar>
      <div className={c.content}>
        <AccessGuide roles={roles} />
      </div>
    </div>
  );
}

function AccessGuide({ roles }) {
  const c = useStyles();
  const yes = <CheckIcon className={c.yes} fontSize="small" />;
  const no = <span className={c.no}>—</span>;
  return (
    <div className={c.help}>
      <div className={c.title}>How access works</div>
      <div className={c.lead}>
        Every bit of access is a <b>grant</b>: <b>who</b> gets a <b>role</b>, <b>where</b>.
      </div>

      <div className={c.row}>
        <div className={c.card}>
          <div className={c.step}>1 · Who</div>
          <div className={c.q}>Who gets it?</div>
          <div className={c.item}>
            <SubjectTag type="user" name="jdoe" />
            <div>One account.</div>
          </div>
          <div className={c.item}>
            <SubjectTag type="group" name="Science team" />
            <div>Everyone in the group. Members are added here or come from CSSO groups.</div>
          </div>
          <div className={c.item}>
            <SubjectTag type="everyone" name="Everyone" />
            <SubjectTag type="authenticated" name="Logged-in users" />
            <div>Built in. Can only be given Viewer.</div>
          </div>
        </div>
        <div className={c.op}>+</div>
        <div className={`${c.card} ${c.roleCard}`}>
          <div className={c.step}>2 · Role</div>
          <div className={c.q}>What can they do?</div>
          <div className={c.roles}>
            {ROLES.map(([role, text]) => (
              <React.Fragment key={role}>
                <div><RoleBadge role={role} roles={roles} /></div>
                <div className={c.roleText}>{text}</div>
              </React.Fragment>
            ))}
          </div>
          <div className={c.note}>Data Admin and SuperAdmin are always site-wide.</div>
        </div>
        <div className={c.op}>+</div>
        <div className={c.card}>
          <div className={c.step}>3 · Where</div>
          <div className={c.q}>On what?</div>
          <div className={c.nest}>
            <b>Site-wide</b> <span className={c.muted}>every mission</span>
            <div className={c.nest}>
              <b>Mission</b> <span className={c.muted}>all of its layers</span>
              <div className={c.nest}>
                <b>Layer folder</b> <span className={c.muted}>the folder and everything inside it</span>
              </div>
            </div>
          </div>
          <div className={c.note}>A grant covers everything inside the place it's given.</div>
        </div>
        <div className={c.op}>=</div>
        <div className={`${c.card} ${c.grantCard}`}>
          <div className={c.step}>Grant</div>
          <div className={c.q}>Examples</div>
          <div className={c.example}>
            <div className={c.exampleLine}>
              <SubjectTag type="everyone" name="Everyone" showKind={false} />
              <RoleBadge role="viewer" roles={roles} />
              <span>on <b>Mars2020</b></span>
            </div>
            <div className={c.muted}>Mars2020 is public.</div>
          </div>
          <div className={c.example}>
            <div className={c.exampleLine}>
              <SubjectTag type="group" name="Science team" showKind={false} />
              <RoleBadge role="layer_editor" roles={roles} />
              <span>on <b>Mars2020 / Science</b></span>
            </div>
            <div className={c.muted}>The team edits only that folder.</div>
          </div>
          <div className={c.example}>
            <div className={c.exampleLine}>
              <SubjectTag type="user" name="jdoe" showKind={false} />
              <RoleBadge role="mission_admin" roles={roles} />
              <span>on <b>Mars2020</b></span>
            </div>
            <div className={c.muted}>jdoe runs that mission.</div>
          </div>
        </div>
      </div>

      <div className={c.section}>How they get access</div>
      <div className={c.lead}>
        Give access to a person directly, to a group they're in, or to an audience. Each person gets every grant that reaches them:
      </div>
      <table className={c.matrix}>
        <thead>
          <tr>
            <th>Who's asking</th>
            {ACCESS_COLUMNS.map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Guest</b> <span className={c.muted}>not logged in</span></td>
            <td>{no}</td><td>{no}</td><td>{no}</td><td>{yes}</td>
          </tr>
          <tr>
            <td><b>Logged-in account</b></td>
            <td>{yes}</td><td>{yes}</td><td>{yes}</td><td>{yes}</td>
          </tr>
          <tr>
            <td><b>CSSO user</b> <span className={c.muted}>no MMGIS account</span></td>
            <td>{no}</td>
            <td>{yes} <span className={c.muted}>matched by CSSO group name; when CSSO_GROUPS is set, they also need one of those groups to open the site</span></td>
            <td>{yes}</td><td>{yes}</td>
          </tr>
          <tr>
            <td><b>Script with a token</b></td>
            <td colSpan={4}>The same as the account that made it, limited to the token's scopes and missions. Never more.</td>
          </tr>
        </tbody>
      </table>
      <div className={c.note}>On sites that require login, guests get nothing, whatever Everyone has.</div>
      <div className={c.note}>Draw files belong to a username. A CSSO user and a local account with the same username share the same Draw files, so only reuse a CSSO username for a local account that belongs to the same person.</div>

      <div className={c.rules}>
        <div className={c.rule}>
          <b>Access adds up</b>
          A person gets everything from all the grants that reach them. Removing one grant doesn't remove access they also get from another.
        </div>
        <div className={c.rule}>
          <b>Changes apply right away</b>
          Including to people who are already logged in, and to their tokens.
        </div>
        <div className={c.rule}>
          <b>Check one person</b>
          In Users & Access, click someone on the People tab to see what they can view and edit, and where each grant comes from.
        </div>
      </div>
    </div>
  );
}

const useStyles = makeStyles((theme) => ({
  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  topbar: {
    width: "calc(100% - 100px)",
    height: "44px",
    minHeight: "44px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: "0px 20px",
    boxSizing: "border-box !important",
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": { color: theme.palette.swatches.grey[150], margin: "3px 10px 0px 2px" },
  },
  content: { flex: 1, overflowY: "auto", padding: "16px 32px 64px 32px" },
  help: { maxWidth: "1400px", margin: "0 auto", paddingBottom: "24px" },
  title: { fontSize: "20px", fontWeight: "bold", marginBottom: "4px" },
  lead: { fontSize: "14px", marginBottom: "16px", opacity: 0.85 },
  row: { display: "flex", alignItems: "stretch" },
  card: {
    flex: 1,
    minWidth: 0,
    padding: "14px 16px",
    borderRadius: "4px",
    background: theme.palette.swatches.grey[850],
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
  },
  roleCard: { flex: 1.5 },
  grantCard: {
    flex: 1.15,
    background: theme.palette.swatches.grey[1000],
    boxShadow: `inset 0px 0px 0px 2px ${theme.palette.swatches.p[0]}, 0px 1px 7px 0px rgba(0, 0, 0, 0.2)`,
  },
  op: {
    width: "40px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "bold",
    color: theme.palette.swatches.grey[500],
  },
  step: {
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: theme.palette.swatches.grey[500],
  },
  q: { fontSize: "16px", fontWeight: "bold", margin: "4px 0px 12px 0px" },
  item: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 12px",
    padding: "8px 10px",
    marginBottom: "8px",
    borderRadius: "4px",
    fontSize: "13px",
    background: theme.palette.swatches.grey[1000],
    "& > div": { width: "100%" },
  },
  roles: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    alignItems: "center",
    gap: "8px 12px",
    padding: "10px",
    borderRadius: "4px",
    background: theme.palette.swatches.grey[1000],
  },
  roleText: { fontSize: "13px", lineHeight: "17px" },
  nest: {
    padding: "8px 10px 10px 10px",
    borderRadius: "4px",
    fontSize: "13px",
    background: theme.palette.swatches.grey[1000],
    border: `2px solid ${theme.palette.swatches.grey[500]}`,
    "& $nest": { marginTop: "8px", borderColor: theme.palette.swatches.grey[700] },
  },
  example: {
    padding: "8px 10px",
    marginBottom: "8px",
    borderRadius: "4px",
    fontSize: "13px",
    background: theme.palette.swatches.grey[850],
  },
  exampleLine: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    marginBottom: "2px",
    "& > span:last-child": { whiteSpace: "nowrap" },
  },
  muted: { opacity: 0.7, fontSize: "13px" },
  note: { fontSize: "13px", opacity: 0.8, marginTop: "10px" },
  section: {
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: theme.palette.swatches.grey[500],
    margin: "28px 0px 6px 0px",
  },
  matrix: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    background: theme.palette.swatches.grey[1000],
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
    "& th": {
      textAlign: "left",
      padding: "8px 12px",
      fontSize: "12px",
      letterSpacing: "1px",
      textTransform: "uppercase",
      borderBottom: `1px solid ${theme.palette.swatches.grey[700]}`,
    },
    "& td": {
      padding: "8px 12px",
      background: theme.palette.swatches.grey[850],
      borderBottom: `1px solid ${theme.palette.swatches.grey[1000]}`,
    },
  },
  yes: { verticalAlign: "middle", color: theme.palette.swatches.p[11] },
  no: { opacity: 0.5 },
  rules: { display: "flex", gap: "12px", marginTop: "28px" },
  rule: {
    flex: 1,
    padding: "10px 12px",
    fontSize: "13px",
    lineHeight: "18px",
    background: theme.palette.swatches.grey[850],
    borderLeft: `4px solid ${theme.palette.swatches.p[0]}`,
    "& b": { display: "block", fontSize: "14px", marginBottom: "2px" },
  },
}));

import React, { useMemo } from "react";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import { useStyles } from "./styles";
import { ROLE_RANK, AUDIENCE_LABEL, AUDIENCE_ORDER, SubjectTag, GrantsTable, sourceText } from "./shared";
import { useRemembered } from "./hooks";

// Everyone with access to one mission
export default function MissionsTab({ ctx }) {
  const { roles, missions, users, groups, bindings, askRemove, openGrant, allLayerPaths, remember } = ctx;
  const c = useStyles();
  const [missionPick, setMissionPick] = useRemembered(remember, "missionPick", "");
  const subjectName = (b) => {
    if (b.subject_type === "user") return <SubjectTag type="user" name={(users.find((u) => String(u.id) === String(b.subject_id)) || {}).username || `user ${b.subject_id}`} />;
    if (b.subject_type === "group") return <SubjectTag type="group" name={(groups.find((g) => String(g.id) === String(b.subject_id)) || {}).name || b.subject_id} />;
    return <SubjectTag type={b.subject_id} name={AUDIENCE_LABEL[b.subject_id] || b.subject_id} />;
  };

  const pickedMission = missions.find((m) => m.name === missionPick);
  const missionRows = useMemo(() => {
    if (!pickedMission) return [];
    const userNames = new Map(users.map((u) => [String(u.id), u.username]));
    const groupNames = new Map(groups.map((g) => [String(g.id), g.name]));
    const who = (b) =>
      b.subject_type === "user" ? userNames.get(String(b.subject_id)) || "" : b.subject_type === "group" ? groupNames.get(String(b.subject_id)) || "" : "";
    // Audiences (Everyone first), then groups, then users; by name, then least to most access
    const rank = (b) => (b.subject_type === "audience" ? Math.max(0, AUDIENCE_ORDER.indexOf(b.subject_id)) : b.subject_type === "group" ? 10 : 20);
    return bindings
      .filter((b) => (b.scope_type === "global" ? b.role !== "data_admin" : b.mission_uuid === pickedMission.uuid))
      .map((b) => ({ b, removable: true, via: b.scope_type === "global" ? "Site-wide grant" : sourceText(b), who: who(b) }))
      .sort((x, y) => rank(x.b) - rank(y.b) || x.who.localeCompare(y.who) || ROLE_RANK.indexOf(x.b.role) - ROLE_RANK.indexOf(y.b.role));
  }, [pickedMission, bindings, users, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <Select size="small" displayEmpty className={`${c.input} ${c.field}`} value={missionPick} onChange={(e) => setMissionPick(e.target.value)}>
                <MenuItem value=""><em>Choose a mission…</em></MenuItem>
                {missions.map((m) => <MenuItem key={m.uuid} value={m.name}>{m.name}</MenuItem>)}
              </Select>
              <span className={c.barHint}>Everyone with access to the chosen mission, including site-wide grants that cover every mission.</span>
              <span className={c.grow} />
              {pickedMission && (
                <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => openGrant({ mission: pickedMission.name })}>Add access</Button>
              )}
            </div>
            {pickedMission ? (
              <>
                <GrantsTable rows={missionRows} roles={roles} layerPaths={allLayerPaths} viaText={subjectName} onRemove={(b) => askRemove(b)} emptyText="Nobody has access to this mission yet." />
              </>
            ) : null}
          </div>
  );
}

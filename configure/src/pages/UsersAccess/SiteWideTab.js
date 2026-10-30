import React, { useState } from "react";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import { useStyles } from "./styles";
import { AUDIENCE_LABEL, SubjectTag, api, MissionMultiSelect } from "./shared";

// Site access, login methods, and what Everyone, Logged-in users and new accounts can view
export default function SiteWideTab({ ctx }) {
  const { missions, bindings, notify, refresh, defaults } = ctx;
  const c = useStyles();
  const audienceState = (a) => {
    const own = bindings.filter((b) => b.subject_type === "audience" && b.subject_id === a && b.role === "viewer");
    if (own.some((b) => b.scope_type === "global")) return { mode: "all", list: [], own };
    if (own.length) return { mode: "selected", list: own.map((b) => b.mission).filter(Boolean), own };
    return { mode: "none", list: [], own };
  };
  const setAudience = async (a, mode, list) => {
    const { own } = audienceState(a);
    try {
      const keepGlobal = mode === "all";
      const wanted = new Set(mode === "selected" ? list : []);
      for (const b of own)
        if ((b.scope_type === "global" && !keepGlobal) || (b.scope_type === "mission" && !wanted.has(b.mission)))
          await api("access_bindings_remove", { id: b.id });
      if (keepGlobal && !own.some((b) => b.scope_type === "global"))
        await api("access_bindings_add", { subject_type: "audience", subject_id: a, role: "viewer", scope_type: "global" });
      for (const m of wanted)
        if (!own.some((b) => b.scope_type === "mission" && b.mission === m))
          await api("access_bindings_add", { subject_type: "audience", subject_id: a, role: "viewer", scope_type: "mission", mission: m });
      notify("Updated.", "success");
    } catch (res) {
      notify(res.message || "Failed to update.", "error");
    }
    refresh();
  };

  return (
          <div className={c.pane}>
            <SiteSetupCard />
            {["everyone", "authenticated"].map((a) => {
              const st = audienceState(a);
              return (
                <AudienceCard key={`${a}-${st.mode}-${st.list.slice().sort().join(",")}`} title={<SubjectTag type={a} name={AUDIENCE_LABEL[a]} showKind={false} />} state={st} missions={missions}
                  hint={a === "everyone" ? "Every logged-in user (including proxy users), plus guests when SITE_ACCESS is public or optional. Logged-in users always get at least this access, whatever is set below. \"No access\" here only means this grant adds nothing: people keep any access from their own grants, their groups and their mission or layer roles." : "Every logged-in user, including CSSO users. Adds to what Everyone gets. \"No access\" here only means this grant adds nothing: logged-in users still get what Everyone allows, plus any access from their own grants, their groups and their mission or layer roles (see the People, Groups and Missions tabs)."}
                  onSave={(mode, list) => setAudience(a, mode, list)} />
              );
            })}
            <AudienceCard key={`defaults-${defaults == null ? "all" : defaults.slice().sort().join(",")}`} title="Default for new accounts" missions={missions}
              hint="What a newly created account can view. Doesn't change existing accounts."
              state={{ mode: defaults == null ? "all" : defaults.length === 0 ? "none" : "selected", list: defaults || [] }}
              onSave={(mode, list) =>
                api("account_update_defaults", { missions_viewing: mode === "all" ? null : mode === "none" ? [] : list })
                  .then(() => { notify("Default updated.", "success"); refresh(); })
                  .catch((res) => notify(res.message || "Failed to update default.", "error"))
              } />
          </div>
  );
}

const SITE_ACCESS_SUMMARY = {
  public: {
    value: "Public: open to everyone",
    desc: "Anyone can view. There's no login on the main site; only admins log in here. Everyone below is what visitors see.",
  },
  optional: {
    value: "Optional: log in if you like",
    desc: "Anyone can view, and people can log in for features such as saving Draw files. Everyone below includes guests.",
  },
  required: {
    value: "Required: log in first",
    desc: "Visitors must log in to see anything. Guests only see the login page, so Everyone below works like Logged-in users.",
  },
};
const PROVIDER_LABEL = { local: "Local accounts", proxy: "Proxy" };
const PROVIDER_DESC = {
  local: "MMGIS usernames and passwords.",
  proxy: "An authenticating proxy in front of MMGIS sends who is signed in.",
};

function SiteSetupCard() {
  const c = useStyles();
  const g = window.mmgisglobal || {};
  const access = SITE_ACCESS_SUMMARY[g.SITE_ACCESS] || { value: g.SITE_ACCESS || "Unknown", desc: "" };
  const providers = g.authProviders || [];
  const adminsOnly = g.AUTH_LOCAL_LOGIN === "admins";
  const selfSignup = g.SELF_SIGNUP === "true";
  const loginDesc = [
    ...providers.map((p) => PROVIDER_DESC[p] || `The ${p} provider.`),
    providers.includes("local") && !providers.includes("proxy") ? "Proxy sign-in is off." : null,
    adminsOnly ? "Only accounts with an editing or admin role may log in with a local password." : null,
  ].filter(Boolean).join(" ");
  const accounts = selfSignup
    ? { value: "Admins and visitors", desc: "Admins add people with New user, and visitors can sign up from the login page." }
    : { value: "Admins only", desc: `Admins add people with New user. There's no sign-up on the main site${g.SITE_ACCESS === "required" ? "" : " login"}.` };
  const cols = [
    { label: "Who can open the site", ...access, env: `SITE_ACCESS=${g.SITE_ACCESS}` },
    {
      label: "How people log in",
      value: providers.map((p) => PROVIDER_LABEL[p] || p).join(" and ") || "None",
      desc: loginDesc,
      env: `AUTH_PROVIDERS=${JSON.stringify(providers)}`,
    },
    {
      label: "Who can create accounts",
      ...accounts,
      env: `AUTH_LOCAL_ALLOW_SIGNUP=${g.AUTH_LOCAL_ALLOW_SIGNUP} · AUTH_LOCAL_LOGIN=${g.AUTH_LOCAL_LOGIN}`,
    },
  ];
  return (
    <div className={c.audience}>
      <Typography className={c.audienceTitle}>How this site is set up</Typography>
      <div className={c.audienceHint} style={{ marginBottom: 0 }}>
        Read-only. These come from the server's environment; change them in .env and restart.{" "}
        <Link href="https://nasa-ammos.github.io/MMGIS/setup/envs" target="_blank" underline="always">ENV docs</Link>
      </div>
      <div className={c.setupCols}>
        {cols.map((col) => (
          <div key={col.label} className={c.setupCol}>
            <div className={c.setupLabel}>{col.label}</div>
            <div className={c.setupValue}>{col.value}</div>
            <div className={c.setupDesc}>{col.desc}</div>
            <div className={c.setupEnv}>{col.env}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceCard({ title, hint, state, missions, onSave, noneLabel = "No access" }) {
  const c = useStyles();
  const [mode, setMode] = useState(state.mode);
  const [list, setList] = useState(state.list);
  return (
    <div className={c.audience}>
      <Typography className={c.audienceTitle}>{title}</Typography>
      <div className={c.audienceHint}>{hint}</div>
      <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value)}>
        {noneLabel && <FormControlLabel value="none" control={<Radio size="small" />} label={noneLabel} />}
        <FormControlLabel value="all" control={<Radio size="small" />} label="View all missions" />
        <FormControlLabel value="selected" control={<Radio size="small" />} label="View selected missions" />
      </RadioGroup>
      {mode === "selected" && <MissionMultiSelect missions={missions} value={list} onChange={setList} />}
      <div style={{ marginTop: "14px" }}>
        <Button size="small" variant="contained" disableElevation
          disabled={mode === state.mode && JSON.stringify(list.slice().sort()) === JSON.stringify(state.list.slice().sort())}
          onClick={() => onSave(mode, list)}>Save</Button>
      </div>
    </div>
  );
}

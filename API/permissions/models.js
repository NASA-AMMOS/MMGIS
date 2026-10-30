/***********************************************************
 * Missions (stable UUIDs), groups, group members and role bindings
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../connection");
const logger = require("../logger");

// A mission's UUID survives renames; clones get a new one
const AuthMission = sequelize.define(
  "auth_missions",
  {
    uuid: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: { type: Sequelize.STRING, allowNull: false, unique: true },
  },
  { timestamps: true }
);

const AuthGroup = sequelize.define(
  "auth_groups",
  {
    name: { type: Sequelize.STRING, allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },
    // local: managed in /configure; proxy: membership comes from the proxy's groups header
    source: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "local",
    },
    // Group name as known by the external provider (e.g. proxy group)
    external_name: { type: Sequelize.STRING, allowNull: true },
  },
  { timestamps: true }
);

const AuthGroupMember = sequelize.define(
  "auth_group_members",
  {
    group_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "auth_groups", key: "id" },
      onDelete: "CASCADE",
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    indexes: [{ unique: true, fields: ["group_id", "user_id"] }],
  }
);

const RoleBinding = sequelize.define(
  "role_bindings",
  {
    // user | group | audience
    subject_type: { type: Sequelize.STRING, allowNull: false },
    // users.id, auth_groups.id, or anonymous|authenticated|everyone
    subject_id: { type: Sequelize.STRING, allowNull: false },
    role: { type: Sequelize.STRING, allowNull: false },
    // global | mission | layer
    scope_type: { type: Sequelize.STRING, allowNull: false },
    mission_uuid: { type: Sequelize.UUID, allowNull: true },
    layer_uuid: { type: Sequelize.STRING, allowNull: true },
    // local | import | env
    source: { type: Sequelize.STRING, allowNull: false, defaultValue: "local" },
    created_by_user_id: { type: Sequelize.INTEGER, allowNull: true },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["subject_type", "subject_id"] },
      {
        unique: true,
        name: "role_bindings_unique",
        fields: [
          "subject_type",
          "subject_id",
          "role",
          "scope_type",
          "mission_uuid",
          "layer_uuid",
        ],
      },
    ],
  }
);

// Links an account to its identity at an external login provider
const AuthIdentity = sequelize.define(
  "auth_identities",
  {
    provider: { type: Sequelize.STRING, allowNull: false },
    // The provider's stable user id (e.g. the OIDC "sub" claim)
    subject: { type: Sequelize.STRING, allowNull: false },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    indexes: [{ unique: true, fields: ["provider", "subject"] }],
  }
);

const AuthMeta = sequelize.define(
  "auth_meta",
  {
    key: { type: Sequelize.STRING, primaryKey: true },
    value: { type: Sequelize.JSON, allowNull: true },
  },
  { timestamps: true, freezeTableName: true }
);

async function runQuery(sql, what) {
  try {
    await sequelize.query(sql);
  } catch (err) {
    logger(
      "error",
      `Failed to ${what}. DB tables may be out of sync!`,
      "permissions",
      null,
      err
    );
  }
}

// Adds to tables, never removes
const up = async () => {
  const tokenColumns = [
    "token_hash varchar(128) NULL",
    "token_prefix varchar(64) NULL",
    "name varchar(255) NULL",
    "scopes TEXT[] NULL",
    "missions TEXT[] NULL",
    "expires_at TIMESTAMPTZ NULL",
    "revoked_at TIMESTAMPTZ NULL",
    "last_used_at TIMESTAMPTZ NULL",
  ];
  for (const col of tokenColumns)
    await runQuery(
      `ALTER TABLE long_term_tokens ADD COLUMN IF NOT EXISTS ${col};`,
      `add long_term_tokens.${col.split(" ")[0]} column`
    );
  await runQuery(
    `CREATE UNIQUE INDEX IF NOT EXISTS long_term_tokens_token_hash ON long_term_tokens (token_hash);`,
    "index long_term_tokens.token_hash"
  );
  // Owning mission for data resources (null = global, SuperAdmin/Data Admin managed)
  await runQuery(
    `ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS owner_mission_uuid UUID NULL;`,
    "add geodatasets.owner_mission_uuid column"
  );
  await runQuery(
    `ALTER TABLE IF EXISTS datasets ADD COLUMN IF NOT EXISTS owner_mission_uuid UUID NULL;`,
    "add datasets.owner_mission_uuid column"
  );
};

module.exports = {
  AuthMission,
  AuthGroup,
  AuthGroupMember,
  RoleBinding,
  AuthIdentity,
  AuthMeta,
  up,
};

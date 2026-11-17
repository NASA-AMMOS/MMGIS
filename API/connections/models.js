// A user's stored credential for an external service (e.g. Earthdata).
// The tokens are kept encrypted in `data` (see ./secretBox.js).
const Sequelize = require("sequelize");
const { sequelize } = require("../connection");

const AuthConnection = sequelize.define(
  "auth_connections",
  {
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    // The connection plugin's id
    connection: { type: Sequelize.STRING, allowNull: false },
    // The account name at the service, shown to the user
    account: { type: Sequelize.STRING, allowNull: true },
    data: { type: Sequelize.TEXT, allowNull: false },
    expires_at: { type: Sequelize.DATE, allowNull: true },
  },
  {
    timestamps: true,
    indexes: [{ unique: true, fields: ["user_id", "connection"] }],
  }
);

module.exports = { AuthConnection };

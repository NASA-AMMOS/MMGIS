/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const bcrypt = require("bcryptjs");

// setup User model and its fields.
var User = sequelize.define(
  "users",
  {
    username: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
      validate: {
        isEmail: true,
        isUnique: function (value, next) {
          var self = this;
          User.findOne({ where: { email: value } })
            .then(function (user) {
              // reject if a different user wants to use the same email
              if (user && self.id !== user.id) {
                return next("User exists!");
              }
              return next();
            })
            .catch(function (err) {
              return next(err);
            });
        },
      },
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    permission: {
      type: Sequelize.ENUM,
      values: ["000", "001", "010", "011", "100", "101", "110", "111"],
      allowNull: false,
      defaultValue: "000",
    },
    token: {
      type: Sequelize.DataTypes.STRING(2048),
      allowNull: true,
    },
  },
  {
    hooks: {
      beforeCreate: (user) => {
        const salt = bcrypt.genSaltSync();
        user.password = bcrypt.hashSync(user.password, salt);
      },
    },
  },
  {
    timestamps: true,
  }
);

// Instance Method for validating user's password
User.prototype.validPassword = function (password, user) {
  return bcrypt.compareSync(password, user.password);
};

// export User model for use in other files.
module.exports = User;

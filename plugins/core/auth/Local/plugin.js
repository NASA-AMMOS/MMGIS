// MMGIS username/password accounts. Its routes are served at /api/auth/local/*
// and, for existing clients, at /api/users/*.
const { mountLocalRoutes } = require("./routes");
module.exports = {
  routes(router) {
    mountLocalRoutes(router);
  },
};

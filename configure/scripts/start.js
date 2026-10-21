const path = require("path");
const fs = require("fs");

// Backend PORT/HTTPS settings must not change CRA's development server.
const envPath = path.join(__dirname, "../../.env");
const rootEnv = fs.existsSync(envPath)
  ? require("dotenv").parse(fs.readFileSync(envPath))
  : {};
if (process.env.ADJACENT_SERVERS_MODE === undefined && rootEnv.ADJACENT_SERVERS_MODE !== undefined) {
  process.env.ADJACENT_SERVERS_MODE = rootEnv.ADJACENT_SERVERS_MODE;
}
process.env.REACT_APP_ADJACENT_SERVERS_MODE = require("../../adjacent-servers/mode")();
require("react-scripts/scripts/start");

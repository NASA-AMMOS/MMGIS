const fs = require("fs");

const MODES = ["embedded", "external"];

/**
 * True when this process runs inside a container: Docker, Podman or
 * Kubernetes. Podman leaves /run/.containerenv instead of /.dockerenv and its
 * cgroup paths say "libpod", so checking for Docker alone misses it.
 * Kubernetes on containerd with cgroup v2 leaves neither a marker file nor a
 * telling cgroup path, but the kubelet always gives a pod
 * KUBERNETES_SERVICE_HOST.
 */
function isContainer(env = process.env) {
  if (env.KUBERNETES_SERVICE_HOST) return true;
  for (const marker of ["/.dockerenv", "/run/.containerenv"]) {
    try {
      fs.statSync(marker);
      return true;
    } catch {
      // not there
    }
  }
  try {
    return /docker|libpod|kubepods|containerd/.test(
      fs.readFileSync("/proc/self/cgroup", "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Decides where the adjacent servers (STAC, TiTiler, ...) run.
 *
 *   embedded: MMGIS starts them as child processes and proxies to localhost.
 *   external: something else runs them (compose services, quadlet units, ...)
 *             and MMGIS proxies to them by service name.
 *
 * ADJACENT_SERVERS_MODE picks one. Unset, it is external inside a container
 * and embedded otherwise.
 *
 * @param {string} [value] ADJACENT_SERVERS_MODE
 * @param {boolean} [inContainer]
 * @returns {{mode: string, source: string, invalid?: string}}
 */
function resolveAdjacentServersMode(
  value = process.env.ADJACENT_SERVERS_MODE,
  inContainer = isContainer()
) {
  const requested = String(value || "")
    .trim()
    .toLowerCase();
  if (MODES.includes(requested)) return { mode: requested, source: "env" };

  const resolved = {
    mode: inContainer ? "external" : "embedded",
    source: inContainer ? "container" : "host",
  };
  if (requested !== "") resolved.invalid = requested;
  return resolved;
}

module.exports = { MODES, isContainer, resolveAdjacentServersMode };

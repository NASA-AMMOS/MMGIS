---
layout: page
title: Podman
permalink: /setup/podman
parent: Setup
nav_order: 5
---

# Running MMGIS with Podman

MMGIS's container image runs under Podman as it does under Docker. This guide runs it rootless, as a regular user, with [quadlets](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html): unit files that have systemd start and restart the containers. It uses the units in [`examples/podman-quadlet/`](https://github.com/NASA-AMMOS/MMGIS/tree/development/examples/podman-quadlet), which run MMGIS, PostGIS, TiTiler and STAC each in their own container. That directory's `README.md` covers the rootful (system-wide) install and how to change the units.

## Requirements

- Podman 4.5 or newer with the netavark network backend, which lets the containers reach each other by name. Check with `podman info --format '{{.Host.NetworkBackend}}'`.
- A host that uses systemd.

## Install

1. Clone the repo and enter the example directory.

   ```bash
   git clone https://github.com/NASA-AMMOS/MMGIS
   ```

   ```bash
   cd MMGIS/examples/podman-quadlet
   ```

1. Create the settings, data and unit directories.

   ```bash
   mkdir -p ~/mmgis/env ~/mmgis/Missions ~/mmgis/resources ~/.config/containers/systemd
   ```

1. Copy the env files, then edit them in `~/mmgis/env/`. Set `SECRET` in `mmgis.env`, and use the same database user and password in all three files. More settings from [ENVs](/MMGIS/setup/envs) can go in `mmgis.env`; write values without the quotes `sample.env` uses.

   ```bash
   install -m 600 env/*.env ~/mmgis/env/
   ```

1. Copy the tile matrix sets TiTiler uses for planetary projections out of the MMGIS image. Rootless, `--user 0` is your own user on the host.

   ```bash
   podman run --rm --user 0 -v ~/mmgis/resources:/out:Z ghcr.io/nasa-ammos/mmgis:development cp -r /usr/src/app/adjacent-servers/resources/. /out/
   ```

1. Install the units.

   ```bash
   cp *.container *.network *.volume ~/.config/containers/systemd/
   ```

1. Point the units at your directories and have MMGIS write `Missions` as your user. `%h` is your home directory.

   ```bash
   sed -i -e 's#/etc/mmgis#%h/mmgis/env#' -e 's#/var/lib/mmgis#%h/mmgis#' -e 's/^# UserNS=/UserNS=/' ~/.config/containers/systemd/mmgis*.container
   ```

1. Start MMGIS. Starting `mmgis.service` starts the other three. On first start, `mmgis.service` and `mmgis-stac.service` may restart a few times while the database comes up.

   ```bash
   systemctl --user daemon-reload
   ```

   ```bash
   systemctl --user start mmgis.service
   ```

1. Let the services start at boot without you logging in.

   ```bash
   loginctl enable-linger $USER
   ```

1. Open `http://<host>:8888/configure` and create the first SuperAdmin account. The one-time setup code is in the log:

   ```bash
   journalctl --user -u mmgis.service | grep "setup code"
   ```

## Check

```bash
curl -s http://localhost:8888/titiler/healthz
```

```bash
curl -s http://localhost:8888/stac/_mgmt/ping
```

If a unit does not appear after `daemon-reload`, the generator prints why:

```bash
/usr/libexec/podman/quadlet -dryrun -user
```

## Adjacent servers

The example sets [`ADJACENT_SERVERS_MODE=external`](/MMGIS/setup/envs): MMGIS starts no adjacent servers itself and proxies to the TiTiler and STAC containers by their network aliases (`titiler`, `stac-fastapi`). Only MMGIS publishes a port. Keep it that way, because TiTiler and STAC do no access checks of their own. See [Adjacent Servers](/MMGIS/setup/adjacent-servers) for the modes.

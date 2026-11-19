# MMGIS with Podman quadlets

Example [quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) units that run MMGIS under systemd with Podman, with PostGIS, TiTiler and STAC each in their own container. tipg, titiler-pgstac and Veloserver are left out.

| Unit | Image | Reached as |
| --- | --- | --- |
| `mmgis.container` | `ghcr.io/nasa-ammos/mmgis` | host port `8888` |
| `mmgis-db.container` | `postgis/postgis` | `db:5432` |
| `mmgis-titiler.container` | `developmentseed/titiler` | `titiler:8883`, through MMGIS at `/titiler` |
| `mmgis-stac.container` | `stac-utils/stac-fastapi-pgstac` | `stac-fastapi:8881`, through MMGIS at `/stac` |
| `mmgis.network`, `mmgis-db.volume` | | |

MMGIS runs with `ADJACENT_SERVERS_MODE=external`: it starts no adjacent servers itself and proxies to the TiTiler and STAC containers by name. Only MMGIS publishes a port; keep it that way, because TiTiler and STAC do no access checks of their own.

Requires Podman 4.5 or newer with the netavark network backend (`podman info --format '{{.Host.NetworkBackend}}'`), which provides name resolution between containers.

## Install (rootful)

Run from this directory.

1. Create the settings and data directories. MMGIS runs as uid/gid `10001` and must be able to write `Missions`.

   ```bash
   sudo mkdir -p /etc/mmgis /var/lib/mmgis/Missions /var/lib/mmgis/resources
   ```

   ```bash
   sudo chown -R 10001:10001 /var/lib/mmgis/Missions
   ```

2. Copy the env files and fill them in. Set `SECRET`, and use the same database user and password in all three files.

   ```bash
   sudo install -m 600 env/*.env /etc/mmgis/
   ```

3. Copy the tile matrix sets TiTiler uses for planetary projections out of the MMGIS image.

   ```bash
   sudo podman run --rm --user 0 -v /var/lib/mmgis/resources:/out:Z ghcr.io/nasa-ammos/mmgis:development cp -r /usr/src/app/adjacent-servers/resources/. /out/
   ```

4. Install the units and start MMGIS. Starting `mmgis.service` starts the other three.

   ```bash
   sudo cp *.container *.network *.volume /etc/containers/systemd/
   ```

   ```bash
   sudo systemctl daemon-reload
   ```

   ```bash
   sudo systemctl start mmgis.service
   ```

5. Open `http://<host>:8888/configure` and create the first SuperAdmin account. The one-time setup code is in the log:

   ```bash
   sudo journalctl -u mmgis.service | grep "setup code"
   ```

Quadlet units are generated at `daemon-reload` and have no `systemctl enable`; the `[Install]` section in each file starts them at boot.

On first start, `mmgis.service` and `mmgis-stac.service` may restart a few times while the database comes up and MMGIS creates the `mmgis-stac` database.

## Check

```bash
curl -s http://localhost:8888/titiler/healthz
```

```bash
curl -s http://localhost:8888/stac/_mgmt/ping
```

The MMGIS log states the mode it runs in (`Adjacent servers mode: external (from ADJACENT_SERVERS_MODE).`).

If a unit does not appear after `daemon-reload`, the generator prints why:

```bash
/usr/libexec/podman/quadlet -dryrun
```

## Rootless

The [Podman guide](https://nasa-ammos.github.io/MMGIS/setup/podman) has these steps as commands. To run as a regular user instead:

- Put the units in `~/.config/containers/systemd/` and use `systemctl --user` (and `journalctl --user`).
- Replace `/etc/mmgis` and `/var/lib/mmgis` in the units with directories you own. `%h` is your home directory, for example `EnvironmentFile=%h/mmgis/env/mmgis.env` and `Volume=%h/mmgis/Missions:/usr/src/app/Missions:z`.
- Uncomment `UserNS=keep-id:uid=10001,gid=10001` in `mmgis.container` so MMGIS writes `Missions` as your user. Skip the `chown` step and drop `sudo` elsewhere. Keep `--user 0` when copying the tile matrix sets: rootless, it is your own user on the host.
- Run `loginctl enable-linger $USER` so the services start at boot without a login.

## Changing it

- Pin `Image=` in `mmgis.container` to a release tag rather than `development` for production.
- More MMGIS settings go in `mmgis.env`; see [ENVs](https://nasa-ammos.github.io/MMGIS/setup/envs). Podman env files are literal, so write values without the quotes `sample.env` uses.
- To add tipg or titiler-pgstac, copy `mmgis-stac.container`, take the image, environment and command from `docker-compose.sample.yml`, give it the network alias MMGIS expects (`tipg`, `titiler-pgstac`), and set the matching `WITH_*=true`.

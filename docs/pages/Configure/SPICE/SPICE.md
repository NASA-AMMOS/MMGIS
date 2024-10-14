---
layout: page
title: SPICE
permalink: /configure/spice
parent: Configure
nav_order: 3
---

# SPICE

> SPICE (Spacecraft Planet Instrument C-matrix Events) is a NASA ancillary information system used to compute geometric information used in planning and analyzing science observations obtained from robotic spacecraft. It is also used in planning missions and conducting numerous engineering functions needed to carry out those missions.

[Link to NAIF SPICE](https://naif.jpl.nasa.gov/naif/)

MMGIS utilizes SPICE through [spiceypy](https://github.com/AndrewAnnex/SpiceyPy). Some of MMGIS' tools may need to be configured properly with regards to SPICE. The following tools require relevant SPICE kernels (mission-specific files that SPICE needs to perform certain computations and transformations) to be set:

- ShadeTool

## Configuring

MMGIS has a SPICE kernel download scheduler that, when configured, periodically downloads all the latest specified kernels (because they are regularly updated).

- To begin, set the ENV `SPICE_SCHEDULED_KERNEL_DOWNLOAD=true`.
- Next there is a sample SPICE kernel configuration file under the `/Missions/` directory called `spice-kernels-conf.example.json`.
- Copy `spice-kernels-conf.example.json` to `spice-kernels-conf.json` in the same directory.

### ENVs

#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD=`

If true, then at every other midnight, MMGIS will read /Missions/spice-kernels-conf.json and re/download all the specified kernels. See /Missions/spice-kernels-conf.example.json | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START=`

If true, then also triggers the kernel download when MMGIS starts | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_CRON_EXPR=`

A cron schedule expression for use in the [node-schedule npm library](https://www.npmjs.com/package/node-schedule) | string | default `"0 0 */2 * *"` (every other day)

### spice-kernels-conf.json

- If the MMGIS ENV 'SPICE_SCHEDULED_KERNEL_DOWNLOAD=true' MMGIS will read /Missions/spice-kernels-conf.json and re/download all the specified kernels to `/spice/kernels`.

- 'body' names and 'targets' names must be valid NAIF SPICE names/ids. Meta-kernels (.tm) can also be set for download by using an object instead of a string.

The schema works as follows:

```json
{
  "body": {
    "{NAIF_BODY_NAME_OR_ID}": {
      "description": "If a function uses this BODY, it will furnsh() all these direct kernels.",
      "kernels": [
        "Full URL to kernel to download",
        "Or an object that indicates a meta-kernel (a kernel that lists out other kernels to download):",
        {
          "url": "Full URL to a meta-kernel to download (file extension .tm)",
          "mkRoot": "Root path to replace the meta-kernel's '$KERNELS' prefixes with.",
          "mkRegex": "A JavaScript regular expression to filter down which meta-kernel kernels to download. For instance '.*/spk/.*.bsp'"
        }
      ],
      "targets": {
        "{NAIF_TARGET_NAME_OR_ID}": {
          "description": "If a function uses this BODY and TARGET, it will also furnsh() all these kernels.",
          "kernels": [
            "Full URL to kernel to download",
            "Or an object that indicates a meta-kernel (a kernel that lists out other kernels to download):",
            {
              "url": "Full URL to a meta-kernel to download (file extension .tm)",
              "mkRoot": "Root path to replace the meta-kernel's '$KERNELS' prefixes with.",
              "mkRegex": "A JavaScript regular expression to filter down which meta-kernel kernels to download. For instance '.*/spk/.*.bsp'"
            }
          ]
        }
      }
    }
  }
}
```

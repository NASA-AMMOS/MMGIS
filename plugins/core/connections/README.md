# Core connections

Connection plugins let tools use an outside service with each person's own account there. They never sign anyone in to MMGIS.

Core ships none yet. A core connection goes in `plugins/core/connections/<Name>/` with a `plugin.json` (`"type": "connection"`) and a `plugin.js`. Connections can also live in any other container.

Guide, contract and a worked Earthdata example: [docs/pages/Contributing/Connections/Connections.md](../../../docs/pages/Contributing/Connections/Connections.md).

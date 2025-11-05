#!/bin/bash
source ~/.bashrc

micromamba activate mmgis

if [ -z "$MMGIS_PYTHON" ]; then
    export MMGIS_PYTHON="$(which python)"
fi

# exec the final command:
exec npm run start:prod-docker

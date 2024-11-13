#!/bin/bash
source ~/.bashrc

micromamba activate mmgis

# exec the final command:
exec npm run start:prod-docker
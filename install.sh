rsync --ignore-existing ./prepare/base/config/configconfig.json ./config/configconfig.json
rsync --ignore-existing --recursive ./prepare/base/config/db/ ./config/db
rsync --ignore-existing --recursive ./prepare/base/db/ ./db
rsync --ignore-existing --recursive ./prepare/base/Missions/ ./Missions
chmod 666 ./config/configconfig.json
chmod 777 ./config/db
chmod 666 ./config/db/config.sqlite3
chmod 777 ./db
chmod 777 ./db/mmgismaster.sqlite3
chmod 777 ./Missions
chmod 666 ./Missions/Test/config.json
chmod 777 ./Missions/Test/Database
chmod 666 ./Missions/Test/Database/mmgis.sqlite3
chmod 666 ./Missions/Test/Drawn/S1_speDrawings.geojson
chmod 666 ./Missions/Test/Drawn/S2_speDrawings.geojson
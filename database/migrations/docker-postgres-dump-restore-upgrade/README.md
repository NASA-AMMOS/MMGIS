## Upgrade postgres versions when running with data stored in a docker volume

Basically we'll dump the existing mmgis db volume, restore it to a new volume and then use that volume for the mmgis db going forward

1. Start MMGIS via docker
1. Then run:

```
docker exec -i mmgis-db-1 /bin/bash -c "PGPASSWORD=pg_password pg_dump --username postgres -F c -b -v mmgis" > ./mmgis-db.backup
```

1. Then bring MMGIS down
1. Then, in this directory, rename `docker-compose-pg.new.sample.yml` to `docker-compose-pg.new.yml` and update:
   - password
   - postgis image version
   - volume names
1. Start this container
1. Then run:

```

docker exec -i mmgis-db-new-1 /bin/bash -c "PGPASSWORD=pg_password psql --username postgres" < ./create-mmgis-db.sql

```

1. And then:

```

docker exec -i mmgis-db-new-1 /bin/bash -c "PGPASSWORD=pg_password pg_restore --clean --username postgres -v -d mmgis" < ./mmgis-db.backup

```

1. Update the `db` volume in the main MMGIS docker-compose.
1. Restart MMGIS

#### Misc:

```

docker-compose -f docker-compose-pg-old.yml up

```

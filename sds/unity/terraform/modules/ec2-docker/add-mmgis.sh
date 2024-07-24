#!/bin/bash
# From https://gist.github.com/jamesmishra/18ee5d7d053db9958d0e4ccbb37f8e1d
set -Eeuxo pipefail
# Filesystem code is adapted from:
# https://github.com/GSA/devsecops-example/blob/03067f68ee2765f8477ae84235f7faa1d2f2cb70/terraform/files/attach-data-volume.sh
DEVICE=${local.block_device_path}
DEST=${var.persistent_volume_mount_path}
devpath=$(readlink -f $DEVICE)

if [[ $(file -s $devpath) != *ext4* && -b $devpath ]]; then
    # Filesystem has not been created. Create it!
    mkfs -t ext4 $devpath
fi
# add to fstab if not present
if ! egrep "^$devpath" /etc/fstab; then
  echo "$devpath $DEST ext4 defaults,nofail,noatime,nodiratime,barrier=0,data=writeback 0 2" | tee -a /etc/fstab > /dev/null
fi
mkdir -p $DEST
mount $DEST
chown ec2-user:ec2-user $DEST
chmod 0755 $DEST

# Filesystem code is over
# Now we install docker and docker-compose.
# Adapted from:
# https://gist.github.com/npearce/6f3c7826c7499587f00957fee62f8ee9
yum update -y
amazon-linux-extras install docker
systemctl start docker.service
usermod -a -G docker ec2-user
chkconfig docker on
yum install -y python3-pip
python3 -m pip install docker-compose

# Put the docker-compose.yml file at the root of our persistent volume
cat > $DEST/docker-compose.yml <<-TEMPLATE
${var.docker_compose_str}
TEMPLATE

# Write the systemd service that manages us bringing up the service
cat > /etc/systemd/system/mmgis.service <<-TEMPLATE
[Unit]
Description=${var.description}
After=${var.systemd_after_stage}
[Service]
Type=simple
User=${var.user}
ExecStart=/usr/local/bin/docker-compose -f $DEST/docker-compose.yml up
Restart=on-failure
[Install]
WantedBy=multi-user.target
TEMPLATE

# Start the service.
systemctl start mmgis
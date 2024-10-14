locals {
    block_device_path = "/dev/sdh"
}

resource "aws_iam_instance_profile" "unity_mmgis_instance_profile" {
  name = "unity-mmgis-instance-profile-tf"

  role = var.role

  tags = {
    Name = "unity_mmgis_instance_profile"
  }
}

resource "aws_ebs_volume" "persistent" {
    availability_zone = aws_instance.unity_mmgis_instance.availability_zone
    size = var.persistent_volume_size_gb
}

resource "aws_volume_attachment" "persistent" {
    device_name = local.block_device_path
    volume_id = aws_ebs_volume.persistent.id
    instance_id = aws_instance.unity_mmgis_instance.id
}


resource "aws_instance" "unity_mmgis_instance" {
  ami           = var.ami
  instance_type = var.instance_type

  tags = {
    Name = "unity-mmgis-instance-tf"
  }

  key_name = var.key_name

  vpc_security_group_ids = [var.sg_id]

  subnet_id = var.subnet_id

  iam_instance_profile = aws_iam_instance_profile.unity_mmgis_instance_profile.name

  user_data = file("./modules/ec2-docker/add-mmgis.sh")
}
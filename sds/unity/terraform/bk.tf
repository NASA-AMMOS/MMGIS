resource "aws_iam_instance_profile" "unity_mmgis_instance_profile" {
  name = "unity-mmgis-instance-profile-tf"

  role = var.role

  tags = {
    Name = "unity_mmgis_instance_profile"
  }
}

resource "aws_instance" "unity_mmgis_instance" {
  ami           = var.ami
  instance_type = "t3.large"

  tags = {
    Name = "unity-mmgis-instance-tf"
  }

  #key_name = var.key_name

  vpc_security_group_ids = [var.sg_id]

  subnet_id = var.subnet_id

  iam_instance_profile = aws_iam_instance_profile.unity_mmgis_instance_profile.name

  block_device_path = "/dev/sdh"
  user_data = file("./add-mmgis.sh")
}

resource "aws_ebs_volume" "persistent" {
    availability_zone = aws_instance.this.availability_zone
    size = var.persistent_volume_size_gb
}

resource "aws_volume_attachment" "persistent" {
    device_name = local.block_device_path
    volume_id = aws_ebs_volume.persistent.id
    instance_id = aws_instance.this.id
}

resource "aws_instance" "this" {
    ami = data.aws_ami.latest_amazon_linux.id
    availability_zone = var.availability_zone
    instance_type = var.instance_type
    key_name = var.key_name
    associate_public_ip_address = var.associate_public_ip_address
    vpc_security_group_ids = var.vpc_security_group_ids
    subnet_id = var.subnet_id
    iam_instance_profile = var.iam_instance_profile
    user_data = local.user_data
    tags = merge (
        {
            Name = var.name
        },
        var.tags
    )
}
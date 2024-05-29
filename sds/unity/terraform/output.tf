# We try to match the API contract that `aws_instance` has.
# Descriptions for these outputs are copied from:
# https://www.terraform.io/docs/providers/aws/r/instance.html
output "id" {
    description = "The instance ID"
    value = aws_instance.this.id
}

output "arn" {
    description = "The ARN of the instance"
    value = aws_instance.this.arn
}

output "availability_zone" {
    description = "The availability zone of the instance"
    value = aws_instance.this.availability_zone
}

output "placement_group" {
    description = "The placement group of the instance"
    value = aws_instance.this.placement_group
}

output "public_dns" {
    description = "The public DNS name assigned to the instance. For EC2-VPC, this is only available if you've enabled DNS hostnames for your VPC"
    value = aws_instance.this.public_dns
}

output "public_ip" {
    description  = "The public IP address assigned to the instance, if applicable. NOTE: If you are using an aws_eip with your instance, you should refer to the EIP's address directly and not use public_ip, as this field will change after the EIP is attached."
    value = aws_instance.this.public_ip
}

output "ipv6_addresses" {
    description = "A list of assigned IPv6 addresses, if any"
    value = aws_instance.this.ipv6_addresses
}

output "primary_network_interface_id" {
    description = "The ID of the instance's primary network interface"
    value = aws_instance.this.primary_network_interface_id
}

output "private_dns" {
    description = " The private DNS name assigned to the instance. Can only be used inside the Amazon EC2, and only available if you've enabled DNS hostnames for your VPC"
    value = aws_instance.this.private_dns
}

output "private_ip" {
    description = "The private IP address assigned to the instance"
    value = aws_instance.this.private_ip
}

output "security_groups" {
    description = " The associated security groups."
    value = aws_instance.this.security_groups
}

output "vpc_security_group_ids" {
    description = "The associated security groups in non-default VPC."
    value = aws_instance.this.vpc_security_group_ids
}

output "subnet_id" {
    description = "The VPC subnet ID."
    value = aws_instance.this.subnet_id
}

output "credit_specification" {
    description = " Credit specification of instance."
    value = aws_instance.this.credit_specification
}

output "instance_state" {
    description = "The state of the instance. One of: pending, running, shutting-down, terminated, stopping, stopped. See Instance Lifecycle for more information."
    value = aws_instance.this.instance_state
}

# TODO: This is a list with the `aws_instance` resource and we are just
# returning a string. I know there is an obvious solution for this...
output "ebs_block_device_id" {
    description = "The persistent block device that we are storing information on."
    value = aws_ebs_volume.persistent.id
}
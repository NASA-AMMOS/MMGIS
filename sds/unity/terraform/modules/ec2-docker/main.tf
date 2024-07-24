data "aws_ssm_parameter" "vpc_id" {
  name = "/unity/account/network/vpc_id"
}

data "aws_ssm_parameter" "subnet_list" {
  name = "/unity/account/network/subnet_list"
}

#data "aws_ssm_parameter" "u-cs-ecs" {
#  name = "/unity/account/ecs/execution_role_arn"
#}


locals {
  subnet_map = jsondecode(data.aws_ssm_parameter.subnet_list.value)
  subnet_ids = nonsensitive(local.subnet_map["private"])
  public_subnet_ids = nonsensitive(local.subnet_map["public"])
}
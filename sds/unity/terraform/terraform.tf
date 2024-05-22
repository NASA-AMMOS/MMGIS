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


module "base" {
  source                   = "git::ssh://git@github.jpl.nasa.gov/terraform/base?ref=6.0.0"
  project                  = var.project
  venue                    = var.venue
  subsystem                = var.subsystem
  capability               = var.capability
  custom_url               = var.custom_url
  groups                   = var.groups
  api                      = var.api
  component                = var.component
  desired_count            = var.desired_count
  app_protocol             = var.app_protocol
  app_listening_port       = var.app_listening_port
  environment              = local.environment_vars
  ecr_uri                  = var.ecr_uri
  docker_image_name        = var.docker_image_name
  docker_image_tag         = var.docker_image_tag
  max_capacity             = var.max_capacity
  app_one_ecs              = var.app_one_ecs
  instance_type            = var.instance_type
  ebs_block_device_size    = var.ebs_block_device_size
  root_block_device_size   = var.root_block_device_size
  ebs_mount_directory      = var.ebs_mount_directory
  csso_proxy_only          = var.csso_proxy_only
  application_endpoint_url = var.application_endpoint_url
  terraform_app_commit     = var.terraform_app_commit
  deployment_method        = var.deployment_method
  secrets                  = local.secrets
  stickiness_enabled       = var.stickiness_enabled
  docker_volume_path       = var.docker_volume_path
  efs_config = {
    efs_id             = var.efs_id
    efs_root_directory = var.efs_root_directory
  }
}

# Application environment variables
locals {
  environment_vars = {
    AWS_DEFAULT_REGION      = module.base.aws_region
    CS3_GET_PARAMETERS      = module.base.ps_path
    DOMAIN                  = module.base.cname
    SERVER                  = var.server
    AUTH                    = var.auth
    NODE_ENV                = var.node_env
    CSSO_LEAD_GROUP         = var.csso_lead_group
    SESSION_USER            = var.session_user
    INGEST_RATE             = var.ingest_rate
    SECRET                  = module.base.auto_generated_password
    DB_HOST                 = var.db_host
    DB_PORT                 = var.db_port
    DB_NAME                 = var.db_name
    DB_USER                 = var.db_user
    CSSO_GROUPS             = "[${join(", ", formatlist("\"%s\"", var.groups))}]"
    SESSION_HOST            = module.base.csso_login_url
    TACTICAL_HOST           = var.tactical_host
    PLACES_HOST             = var.places_host
    SCIENCE_INTENT_HOST     = var.science_intent_host
    MTTTT_HOST              = var.mtttt_host
    ENABLE_MMGIS_WEBSOCKETS = var.enable_mmgis_websockets
    PORT                    = var.app_listening_port
    VERBOSE_LOGGING         = var.verbose_logging
    HIDE_CONFIG             = var.hide_config
    CONFIGCONFIG_PATH       = var.configconfig_path
    FORCE_CONFIG_PATH       = var.force_config_path
    LEADS                   = "[${join(", ", formatlist("\"%s\"", var.leads))}]"
  }
}

locals {
  secrets = {
    DB_PASS      = var.db_password
    SESSION_PASS = var.session_pass
  }
}
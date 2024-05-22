data "aws_ssm_parameter" "vpc_id" {
  name = "/unity/account/network/vpc_id"
}

data "aws_ssm_parameter" "subnet_list" {
  name = "/unity/account/network/subnet_list"
}

#data "aws_ssm_parameter" "u-cs-ecs" {
#  name = "/unity/account/ecs/execution_role_arn"
#}

module "base" {
  source                   = ""
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
  application_endpoint_url = var.application_endpoint_url
  terraform_app_commit     = var.terraform_app_commit
  deployment_method        = var.deployment_method
  secrets                  = local.secrets
  docker_volume_path       = var.docker_volume_path
  efs_config = {
    efs_id             = var.efs_id
    efs_root_directory = var.efs_root_directory
  }
}

locals {
  subnet_map = jsondecode(data.aws_ssm_parameter.subnet_list.value)
  subnet_ids = nonsensitive(local.subnet_map["private"])
  public_subnet_ids = nonsensitive(local.subnet_map["public"])
}


# Application environment variables
locals {
  environment_vars = {
    AWS_DEFAULT_REGION      = module.base.aws_region
    DOMAIN                  = module.base.cname
    SERVER                  = var.server
    AUTH                    = var.auth
    NODE_ENV                = var.node_env
    DB_HOST                 = var.db_host
    DB_PORT                 = var.db_port
    DB_NAME                 = var.db_name
    DB_USER                 = var.db_user
    PORT                    = var.app_listening_port
    DB_POOL_MAX             = var.db_pool_max
    DB_POOL_TIMEOUT         = var.db_pool_timeout
    DB_POOL_IDLE            = var.db_pool_idle
    CSSO_GROUPS             = var.csso_groups
    VERBOSE_LOGGING         = var.verbose_logging
    FRAME_ANCESTORS         = var.frame_ancestors
    FRAME_SRC               = var.frame_src
    THIRD_PARTY_COOKIES     = var.third_party_cookies
    ROOT_PATH               = var.root_path
    WEBSOCKET_ROOT_PATH     = var.websocket_root_path
    CLEARANCE_NUMBER        = var.clearance_number
    DISABLE_LINK_SHORTENER  = var.disable_link_shortener
    HIDE_CONFIG             = var.hide_config
    FORCE_CONFIG_PATH       = var.force_config_path
    LEADS                   = "[${join(", ", formatlist("\"%s\"", var.leads))}]"
    ENABLE_MMGIS_WEBSOCKETS = var.enable_mmgis_websockets
    ENABLE_CONFIG_WEBSOCKETS = var.enable_config_websockets
    ENABLE_CONFIG_OVERRIDE  = var.enable_config_override
    MAIN_MISSION            = var.main_mission
    SKIP_CLIENT_INITIAL_LOGIN = var.skip_client_initial_login
    GENERATE_SOURCEMAP      = var.generate_sourcemap
    SPICE_SCHEDULED_KERNEL_DOWNLOAD = var.spice_scheduled_kernel_download
    SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START = var.spice_scheduled_kernel_download_on_start
    SPICE_SCHEDULED_KERNEL_cron_expr = var.spice_scheduled_kernel_cron_expr
  }
}

locals {
  secrets = {
    SECRET       = var.secret
    DB_PASS      = var.db_pass
  }
}
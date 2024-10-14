provider "aws" {
  region = var.region
  profile = var.profile

  default_tags {
    tags = var.common_tags
  }
}

# ===== OUR MAGIC DOCKER-COMPOSE.YML FILE HERE =====
# It is also possible to get Terraform to read an external `docker-compose.yml`
# file and load it into this variable.
# We'll be showing off a demo nginx page.
variable "docker-compose" {
    type = string
    default =  <<EOF
version: "3"
services:
  mmgis:
    image: ghcr.io/nasa-ammos/mmgis:development
    depends_on:
      - mmgis.db
    environment:
    volumes:
      - /var/www/html/Missions/:/usr/src/app/Missions
  mmgis.db:
    image: postgis/postgis:10-2.5-alpine
    environment:
      - POSTGRES_PASSWORD         = var.db_pass
      - SERVER                    = var.server
      - AUTH                      = var.auth
      - NODE_ENV                  = var.node_env
      - DB_HOST                   = var.db_host
      - DB_PORT                   = var.db_port
      - DB_NAME                   = var.db_name
      - DB_USER                   = var.db_user
      - PORT                      = var.app_listening_port
      - DB_POOL_MAX               = var.db_pool_max
      - DB_POOL_TIMEOUT           = var.db_pool_timeout
      - DB_POOL_IDLE              = var.db_pool_idle
      - CSSO_GROUPS               = var.csso_groups
      - VERBOSE_LOGGING           = var.verbose_logging
      - FRAME_ANCESTORS           = var.frame_ancestors
      - FRAME_SRC                 = var.frame_src
      - THIRD_PARTY_COOKIES       = var.third_party_cookies
      - ROOT_PATH                 = var.root_path
      - WEBSOCKET_ROOT_PATH       = var.websocket_root_path
      - CLEARANCE_NUMBER          = var.clearance_number
      - DISABLE_LINK_SHORTENER    = var.disable_link_shortener
      - HIDE_CONFIG               = var.hide_config
      - FORCE_CONFIG_PATH         = var.force_config_path
      - LEADS                     = var.leads
      - ENABLE_MMGIS_WEBSOCKETS   = var.enable_mmgis_websockets
      - ENABLE_CONFIG_WEBSOCKETS  = var.enable_config_websockets
      - ENABLE_CONFIG_OVERRIDE    = var.enable_config_override
      - MAIN_MISSION              = var.main_mission
      - SKIP_CLIENT_INITIAL_LOGIN = var.skip_client_initial_login
      - GENERATE_SOURCEMAP        = var.generate_sourcemap
      - SPICE_SCHEDULED_KERNEL_DOWNLOAD = var.spice_scheduled_kernel_download
      - SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START = var.spice_scheduled_kernel_download_on_start
      - SPICE_SCHEDULED_KERNEL_cron_expr = var.spice_scheduled_kernel_cron_expr
      - SECRET                    = var.secret
      - DB_PASS                   = var.db_pass
    ports:
      - 5432:5432
    restart: on-failure
    volumes:
      - mmgis-db:/var/lib/postgresql/data
EOF
}

# Configure the VPC that we will use.
resource "aws_vpc" "prod" {
  cidr_block = "10.0.0.0/16"
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "prod" {
  vpc_id = aws_vpc.prod.id
}

resource "aws_route" "prod__to_internet" {
  route_table_id = aws_vpc.prod.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id = aws_internet_gateway.prod.id
}

resource "aws_subnet" "prod" {
  vpc_id = aws_vpc.prod.id
  availability_zone = var.region
  cidr_block = "10.0.0.0/18"
  map_public_ip_on_launch = true
  depends_on = [aws_internet_gateway.prod]
}

# Allow port 80 so we can connect to the container.
resource "aws_security_group" "allow_http" {
    name = "allow_http"
    description = "Show off how we run a docker-compose file."

    ingress {
        from_port = 80
        to_port = 80
        protocol = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
    egress {
        from_port = 0
        to_port = 0
        protocol = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }
}

# Make sure to download the other files into the `modules/ec2-docker`
# directory
module "run-mmgis-ec2-docker" {
    source =  "./modules/ec2-docker"
    name = "mmgis-ec2-docker"
    key_name = var.key_name
    instance_type = "t3.medium"
    docker_compose_str = var.docker-compose
    subnet_id = aws_subnet.prod.id
    availability_zone = aws_subnet.prod.availability_zone
    vpc_security_group_ids = [aws_security_group.allow_http.id]
    associate_public_ip_address = true
    persistent_volume_size_gb = 20 
}
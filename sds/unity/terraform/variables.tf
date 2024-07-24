# UNITY
variable "region" {
  description = "AWS region"
  type = string
  default = "us-gov-west-1"
}

variable "profile" {
  description = "AWS profile"
  type = string
  default = "unset"
}

variable "common_tags" {
  description = "Common AWS Tags"
  type = map(string)
  default = {}
}

variable "tags" {
  description = "AWS Tags"
  type = map(string)
  default = {}
}

variable "deployment_name" {
  description = "The deployment name"
  type        = string
  default = "mmgis"
}

variable "mgmt_dns" {
  description = "The DNS or IP of the ALB or EC2 instance"
  type = string
}

variable "project"{
  description = "The unity project its installed into"
  type = string
  default = "UnknownProject"
}

variable "venue" {
  description = "The unity venue its installed into"
  type = string
  default = "UnknownVenue"
}

variable "installprefix" {
  description = "The management console install prefix"
  type = string
  default = "UnknownPrefix"
}

# INFRASTRUCTURE

variable "key_name" {
    description = "Name of the SSH key to log in with"
    type = string
    default = "mmgis-sds.ssh"
}

# MMGIS

variable "server" {
  default = "node"
}
variable "auth" {
  default = "none"
}
variable "node_env" {
  default = "production"
}
variable "secret" {
  description = "Some random string"
  sensitive = true
}
variable "db_host" {
  description = "postgres db endpoint"
  default = "db"
}
variable "db_port" {
  description = "postgres db port"
  default     = 5432
}
variable "db_name" {
  description = "postgres db name"
  default = "db"
}
variable "db_user" {
  description = "postgres db user"
}
variable "db_pass" {
  description = "postgres db password"
  sensitive = true
}
variable "port" {
  description = "Port to run on"
  default = 3000
}
variable "db_pool_max" {
  description = "Max number connections in the database's pool. CPUs * 4 is a good number"
  default = 10
}
variable "db_pool_timeout" {
  description = "How many milliseconds until a DB connection times out"
  default = 30000
}
variable "db_pool_idle" {
  description = "How many milliseconds for an incoming connection to wait for a DB connection before getting kicked away"
  default = 10000
}
variable "csso_groups" {
  description = "A list of CSSO LDAP groups that have access"
  type        = list(string)
  default = []
}
variable "verbose_logging" {
  description = "logs a bunch of extra stuff for development purposes"
  default     = false
}
variable "frame_ancestors" {
  description = "Sets the Content-Security-Policy: frame-ancestors header to allow the embedding of MMGIS in the specified external sites"
  default = false
}
variable "frame_src" {
  description = "Sets the Content-Security-Policy: frame-src header to allow the embedding iframes from external origins into MMGIS"
  default = false
}
variable "third_party_cookies" {
  description = "Sets 'SameSite=None; Secure' on the login cookie. Useful when using AUTH=local as an iframe within a cross-origin page."
  default     = false
}
variable "root_path" {
  description = "Set MMGIS to be deployed under a subpath. For example if serving at the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set ROOT_PATH=/path/where/I/serve/mmgis. If no subpath, leave blank."
  default     = ""
}
variable "websocket_root_path" {
  description = "Overrides ROOT_PATH's use when the client connects via websocket. Websocket url: {ws_protocol}://{window.location.host}{WEBSOCKET_ROOT_PATH || ROOT_PATH || ''}/"
  default     = ""
}
variable "clearance_number" {
  description = "Sets a clearance number for the website"
  default     = "CL##-####"
}
variable "disable_link_shortener" {
  description = "If true, users that use the 'Copy Link' feature will receive a full-length deep link. Writing new short links will be disabled but expanding existing ones will still work."
  default     = false
}
variable "hide_config" {
  description = "make the configure page inaccessible to everyone"
  default     = false
}
variable "force_config_path" {
  description = "the path to a json config file that acts as the only configured mission for the instance"
  default     = ""
}
variable "leads" {
  description = "array of strings - default [] - when not using AUTH=csso, this is a list of usernames to be treated as leads (users with elevated permissions)"
  type        = list(string)
  default     = []
}
variable "enable_mmgis_websockets" {
  description = "enables websockets so that clients can immediately respond to backend configuration changes"
  default     = false
}
variable "enable_config_websockets" {
  description = "If true, notifications are sent to /configure users whenever the current mission's configuration object changes out from under them and then puts (overridable) limits on saving"
  default     = false
}
variable "enable_config_override" {
  description = "For use when ENABLE_CONFIG_WEBSOCKETS=true (if ENABLE_CONFIG_WEBSOCKETS=false, all saves will freely overwrite already). If true, gives /configure users the ability to override changes made to the configuration while they were working on it with their own."
  default     = false
}
variable "main_mission" {
  description = "If the new MAIN_MISSION ENV is set to a valid mission, skip the landing page and go straight to that mission. Other missions will still be accessible by either forcing the landing page (clicking the top-left M logo) or by going to a link directly."
  default     = ""
}
variable "skip_client_initial_login" {
  description = "If true, MMGIS will not auto-login returning users. This can be useful when login is managed someplace else. The initial login process can be manually triggered with mmgisAPI.initialLogin()"
  default     = false
}
variable "generate_sourcemap" {
  description = "If true at build-time, JavaScript source maps will also be built"
  default     = false
}
variable "spice_scheduled_kernel_download" {
  description = "If true, then at every other midnight, MMGIS will read /Missions/spice-kernels-conf.json and re/download all the specified kernels. See /Missions/spice-kernels-conf.example.json"
  default     = false
}
variable "spice_scheduled_kernel_download_on_start" {
  description = "If true, then also triggers the kernel download when MMGIS starts"
  default     = false
}
variable "spice_scheduled_kernel_cron_expr" {
  description = "A cron schedule expression for use in the node-schedule npm library"
  default     = "0 0 */2 * *"
}
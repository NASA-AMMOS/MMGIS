variable "tags" {
  description = "AWS Tags"
  type = map(string)
}

variable "deployment_name" {
  description = "The deployment name"
  type        = string
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

variable "server" {
  default = "node"
}
variable "auth" {
  default = "csso"
}
variable "node_env" {
  default = "production"
}
variable "csso_lead_group" {
}
variable "session_user" {
  description = "application account for authorization to other services"
}
variable "session_pass" {
  description = "application account for authorization to other services"
}
variable "ingest_rate" {
  default = "0 7 * * *"
}
variable "db_host" {
  description = "postgres db endpoint"
}
variable "db_port" {
  description = "need more info"
  default     = 5432
}
variable "db_name" {
  description = "postgres db name"
}
variable "db_user" {
  description = "postgres db user"
}
variable "db_password" {
  description = "postgres db password"
}
variable "tactical_host" {
  description = "url to tactical target db"
}
variable "places_host" {
  description = "url to PLACES"
}
variable "science_intent_host" {
  description = "url to science intent api"
}
variable "mtttt_host" {
  description = "url to mtttt api"
}
variable "enable_mmgis_websockets" {
  description = "enables websockets so that clients can immediately respond to backend configuration changes"
  default     = false
}
variable "verbose_logging" {
  description = "logs a bunch of extra stuff for development purposes"
  default     = false
}
variable "hide_config" {
  description = "make the configure page inaccessible to everyone"
  default     = false
}
variable "configconfig_path" {
  description = "the path to a json file that sets up the configure page that overrides the database's recor"
  default     = ""
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
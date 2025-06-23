/**
 * Test Infrastructure Setup for MMGIS BDD Testing
 * 
 * This module handles the automatic setup and verification of required services
 * for BDD testing, including PostgreSQL database, TiTiler, STAC, and other services.
 * It can work both inside and outside Docker environments.
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

class TestInfrastructureSetup {
  constructor(options = {}) {
    this.config = {
      postgres: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'mmgis_test',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'password',
        timeout: options.dbTimeout || 30000
      },
      titiler: {
        url: process.env.TITILER_ENDPOINT || 'http://localhost:8081',
        timeout: options.titilerTimeout || 10000
      },
      stac: {
        url: process.env.STAC_ENDPOINT || 'http://localhost:8082',
        timeout: options.stacTimeout || 10000
      },
      mmgis: {
        url: process.env.MMGIS_URL || 'http://localhost:8888',
        configUrl: process.env.MMGIS_CONFIG_URL || 'http://localhost:8888/configure',
        timeout: options.mmgisTimeout || 15000
      },
      docker: {
        network: process.env.DOCKER_NETWORK || 'mmgis_default',
        composeFile: options.composeFile || 'docker-compose.yml'
      }
    };
    
    this.isInContainer = this.detectContainerEnvironment();
    this.services = new Map();
  }

  /**
   * Detect if we're running inside a Docker container
   */
  detectContainerEnvironment() {
    try {
      // Check for .dockerenv file
      require('fs').statSync('/.dockerenv');
      return true;
    } catch (e) {
      // Check for docker in cgroup
      try {
        const cgroup = require('fs').readFileSync('/proc/1/cgroup', 'utf8');
        return cgroup.includes('docker') || cgroup.includes('containerd');
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Check if a service is available by making a health check request
   */
  async checkServiceHealth(serviceName, url, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const fetch = require('node-fetch');
      const response = await fetch(url, {
        signal: controller.signal,
        timeout: timeout
      });
      
      clearTimeout(timeoutId);
      
      const isHealthy = response.ok || response.status < 500;
      this.services.set(serviceName, {
        available: isHealthy,
        url: url,
        status: response.status,
        timestamp: new Date()
      });
      
      return isHealthy;
    } catch (error) {
      this.services.set(serviceName, {
        available: false,
        url: url,
        error: error.message,
        timestamp: new Date()
      });
      return false;
    }
  }

  /**
   * Check PostgreSQL database availability
   */
  async checkPostgreSQL() {
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: 'postgres', // Connect to default db first
        user: this.config.postgres.user,
        password: this.config.postgres.password,
        connectionTimeoutMillis: this.config.postgres.timeout
      });

      await client.connect();
      
      // Check if test database exists, create if not
      const dbResult = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.postgres.database]
      );
      
      if (dbResult.rows.length === 0) {
        await client.query(`CREATE DATABASE "${this.config.postgres.database}"`);
        console.log(`✓ Created test database: ${this.config.postgres.database}`);
      }
      
      await client.end();
      
      // Now connect to the test database and ensure PostGIS is available
      const testClient = new Client({
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: this.config.postgres.database,
        user: this.config.postgres.user,
        password: this.config.postgres.password
      });
      
      await testClient.connect();
      
      // Enable PostGIS extension
      try {
        await testClient.query('CREATE EXTENSION IF NOT EXISTS postgis');
        console.log('✓ PostGIS extension enabled');
      } catch (e) {
        console.warn('⚠ Could not enable PostGIS extension:', e.message);
      }
      
      await testClient.end();
      
      this.services.set('postgresql', {
        available: true,
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: this.config.postgres.database,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      this.services.set('postgresql', {
        available: false,
        error: error.message,
        timestamp: new Date()
      });
      return false;
    }
  }

  /**
   * Launch PostgreSQL using Docker if not available
   */
  async launchPostgreSQL() {
    if (this.isInContainer) {
      console.log('⚠ Running inside container - cannot launch PostgreSQL directly');
      console.log('Please ensure PostgreSQL service is available in the Docker network');
      return false;
    }

    try {
      console.log('🚀 Launching PostgreSQL container for testing...');
      
      const dockerCommand = [
        'docker', 'run', '-d',
        '--name', 'mmgis-test-postgres',
        '--rm',
        '-e', `POSTGRES_DB=${this.config.postgres.database}`,
        '-e', `POSTGRES_USER=${this.config.postgres.user}`,
        '-e', `POSTGRES_PASSWORD=${this.config.postgres.password}`,
        '-p', `${this.config.postgres.port}:5432`,
        'postgis/postgis:16-3.4'
      ];
      
      const { stdout, stderr } = await execAsync(dockerCommand.join(' '));
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr);
      }
      
      // Wait for PostgreSQL to be ready
      console.log('⏳ Waiting for PostgreSQL to be ready...');
      for (let i = 0; i < 30; i++) {
        if (await this.checkPostgreSQL()) {
          console.log('✓ PostgreSQL is ready');
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      throw new Error('PostgreSQL failed to start within timeout');
    } catch (error) {
      console.error('❌ Failed to launch PostgreSQL:', error.message);
      return false;
    }
  }

  /**
   * Launch supporting services using Docker Compose
   */
  async launchSupportingServices() {
    if (this.isInContainer) {
      console.log('⚠ Running inside container - supporting services should be in docker-compose');
      return true;
    }

    try {
      const composeFile = path.join(process.cwd(), this.config.docker.composeFile);
      
      // Check if docker-compose.yml exists
      try {
        await fs.access(composeFile);
      } catch (e) {
        console.log('⚠ No docker-compose.yml found, skipping supporting services');
        return true;
      }

      console.log('🚀 Starting supporting services with Docker Compose...');
      
      // Start only specific services for testing
      const services = ['titiler', 'stac', 'pgstac'];
      for (const service of services) {
        try {
          const { stdout, stderr } = await execAsync(
            `docker-compose up -d ${service}`,
            { cwd: process.cwd() }
          );
          console.log(`✓ Started ${service} service`);
        } catch (e) {
          console.log(`⚠ Could not start ${service} service: ${e.message}`);
        }
      }
      
      return true;
    } catch (error) {
      console.warn('⚠ Could not launch supporting services:', error.message);
      return false;
    }
  }

  /**
   * Verify all services are available and launch missing ones
   */
  async setupTestInfrastructure() {
    console.log('🔧 Setting up test infrastructure...');
    console.log(`📍 Container environment: ${this.isInContainer ? 'Yes' : 'No'}`);
    
    const results = {
      postgresql: false,
      titiler: false,
      stac: false,
      mmgis: false
    };

    // Check PostgreSQL
    console.log('🔍 Checking PostgreSQL availability...');
    results.postgresql = await this.checkPostgreSQL();
    
    if (!results.postgresql) {
      console.log('❌ PostgreSQL not available, attempting to launch...');
      results.postgresql = await this.launchPostgreSQL();
    } else {
      console.log('✓ PostgreSQL is available');
    }

    // Launch supporting services
    await this.launchSupportingServices();
    
    // Wait a moment for services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check TiTiler
    console.log('🔍 Checking TiTiler availability...');
    results.titiler = await this.checkServiceHealth(
      'titiler',
      `${this.config.titiler.url}/docs`,
      this.config.titiler.timeout
    );
    
    if (results.titiler) {
      console.log('✓ TiTiler is available');
    } else {
      console.log('⚠ TiTiler not available - some tests may be skipped');
    }

    // Check STAC
    console.log('🔍 Checking STAC availability...');
    results.stac = await this.checkServiceHealth(
      'stac',
      `${this.config.stac.url}/`,
      this.config.stac.timeout
    );
    
    if (results.stac) {
      console.log('✓ STAC is available');
    } else {
      console.log('⚠ STAC not available - some tests may be skipped');
    }

    // Check MMGIS (if needed for integration tests)
    console.log('🔍 Checking MMGIS availability...');
    results.mmgis = await this.checkServiceHealth(
      'mmgis',
      `${this.config.mmgis.url}/api/health`,
      this.config.mmgis.timeout
    );
    
    if (results.mmgis) {
      console.log('✓ MMGIS is available');
    } else {
      console.log('⚠ MMGIS not available - will use mock implementations');
    }

    // Summary
    console.log('\n📊 Infrastructure Setup Summary:');
    console.log(`   PostgreSQL: ${results.postgresql ? '✓' : '❌'}`);
    console.log(`   TiTiler: ${results.titiler ? '✓' : '⚠'}`);
    console.log(`   STAC: ${results.stac ? '✓' : '⚠'}`);
    console.log(`   MMGIS: ${results.mmgis ? '✓' : '⚠'}`);
    
    if (!results.postgresql) {
      throw new Error('PostgreSQL is required for testing but could not be started');
    }
    
    return results;
  }

  /**
   * Cleanup test infrastructure
   */
  async cleanup() {
    if (!this.isInContainer) {
      try {
        // Stop test PostgreSQL container
        await execAsync('docker stop mmgis-test-postgres');
        console.log('🧹 Cleaned up test PostgreSQL container');
      } catch (e) {
        // Container might not exist, ignore
      }
    }
  }

  /**
   * Get service status for test configuration
   */
  getServiceStatus() {
    const status = {};
    for (const [name, info] of this.services) {
      status[name] = {
        available: info.available,
        url: info.url || info.host,
        error: info.error
      };
    }
    return status;
  }
}

module.exports = { TestInfrastructureSetup };
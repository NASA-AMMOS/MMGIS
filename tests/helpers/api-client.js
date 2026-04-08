/**
 * API client wrapper around Playwright's APIRequestContext.
 *
 * Handles automatic authentication and provides convenience methods for
 * common MMGIS API operations used in tests (mission CRUD, draw files, etc.).
 */

import { loginAsUser } from './auth.js';

/**
 * Authenticated API client for MMGIS.
 */
export class ApiClient {
  /**
   * @param {import('@playwright/test').APIRequestContext} request
   *   Playwright request context.
   * @param {string} [sessionCookie=''] - Pre-fetched session cookie string.
   */
  constructor(request, sessionCookie = '') {
    /** @type {import('@playwright/test').APIRequestContext} */
    this.request = request;

    /** @type {string} */
    this.sessionCookie = sessionCookie;
  }

  /**
   * Factory: create an ApiClient already authenticated as the given user.
   *
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {object}  credentials
   * @param {string}  credentials.username
   * @param {string}  credentials.password
   * @returns {Promise<ApiClient>}
   */
  static async authenticated(request, { username, password }) {
    const cookie = await loginAsUser(request, { username, password });
    return new ApiClient(request, cookie);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Build common request headers (including the session cookie).
   *
   * @returns {Record<string, string>}
   */
  _headers() {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }
    return headers;
  }

  // ---------------------------------------------------------------------------
  // Mission operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new mission via the config API.
   *
   * @param {string} name    - Mission name.
   * @param {object} [config] - Optional mission config JSON to POST.
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async createMission(name, config = {}) {
    return this.request.post('/api/configure/add', {
      headers: this._headers(),
      data: { mission: name, config },
    });
  }

  /**
   * Delete a mission by name.
   *
   * @param {string} name - Mission name.
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async deleteMission(name) {
    return this.request.post('/api/configure/destroy', {
      headers: this._headers(),
      data: { mission: name },
    });
  }

  // ---------------------------------------------------------------------------
  // Draw file operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new draw file for a mission.
   *
   * @param {object}  opts
   * @param {string}  opts.mission  - Mission name.
   * @param {string}  opts.filename - Draw file name.
   * @param {string}  [opts.intent] - Draw intent (e.g. "ROI").
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async createDrawFile({ mission, filename, intent = 'ROI' }) {
    return this.request.post('/api/draw/new', {
      headers: this._headers(),
      data: { mission, filename, intent },
    });
  }

  /**
   * Delete a draw file.
   *
   * @param {object}  opts
   * @param {string}  opts.mission  - Mission name.
   * @param {string}  opts.filename - Draw file name to delete.
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async deleteDrawFile({ mission, filename }) {
    return this.request.post('/api/draw/remove', {
      headers: this._headers(),
      data: { mission, filename },
    });
  }

  // ---------------------------------------------------------------------------
  // Geodataset operations
  // ---------------------------------------------------------------------------

  /**
   * Query a geodataset by name.
   *
   * @param {string} name  - Geodataset name.
   * @param {object} [params] - Additional query parameters (e.g. extent).
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async queryGeodataset(name, params = {}) {
    return this.request.post('/api/geodatasets/get', {
      headers: this._headers(),
      data: { layer: name, ...params },
    });
  }

  // ---------------------------------------------------------------------------
  // Health / utility
  // ---------------------------------------------------------------------------

  /**
   * Hit the healthcheck endpoint.
   *
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async healthcheck() {
    return this.request.get('/api/utils/healthcheck');
  }
}

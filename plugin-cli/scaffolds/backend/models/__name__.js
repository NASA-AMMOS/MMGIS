/**
 * __Name__ — a Sequelize model plus its migration.
 *
 * `sequelize.sync()` creates a missing table but never alters an existing one,
 * so every schema change after the first release goes in `up()`, which
 * `plugin.js` calls from `onceSynced`. Core does not await it.
 */
const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')
const logger = require('../../../../../API/logger')

const attributes = {
    // Sequelize adds `id`, `createdAt` and `updatedAt` for you.
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    payload: {
        type: Sequelize.JSONB,
        allowNull: true,
    },
}

const options = {
    timestamps: true,
}

// A table name is global to the database — prefix it with your plugin so two
// containers cannot collide.
const __Name__ = sequelize.define('__snake_name__', attributes, options)

/** Schema changes for an existing installation. Idempotent, always. */
const up = async () => {
    await sequelize
        .query(
            `ALTER TABLE __snake_name__ ADD COLUMN IF NOT EXISTS payload jsonb NULL;`
        )
        .catch((err) => {
            logger(
                'error',
                'Failed to add __snake_name__.payload. DB tables may be out of sync!',
                '__snake_name__',
                null,
                err
            )
        })
}

module.exports = { __Name__, up }

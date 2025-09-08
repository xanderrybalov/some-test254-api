/* eslint-disable camelcase */

/**
 * @typedef {import('node-pg-migrate').ColumnDefinitions} ColumnDefinitions
 * @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder
 */

exports.shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('movies', {
    poster: {
      type: 'text',
      notNull: false
    }
  });
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropColumn('movies', 'poster');
};
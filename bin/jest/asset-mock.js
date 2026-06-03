/**
 * Jest stub for webpack-only asset imports (`*.svg`, `*.png`, `*.jpg`, …).
 *
 * In the real build webpack's loaders turn these into URLs / React components;
 * Jest has no such loaders, so importing a layer-type icon (transitively, via
 * constants/layerTypes.js) would otherwise crash the module graph. Unit tests
 * never render the icons, so a plain stub is enough.
 */
module.exports = 'asset-mock';

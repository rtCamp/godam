/**
 * Jest stub for webpack-only asset imports (`*.svg`, `*.png`, `*.jpg`, …).
 *
 * In the real build webpack's loaders turn these into URLs / React components;
 * Jest has no such loaders, so importing a layer-type icon (transitively, via
 * constants/layerTypes.js) would otherwise crash the module graph. The stub is
 * URL-shaped like the build's output, so code that tells an image URL from a
 * Dashicon name (the layer registry's icon handling) treats it as an image.
 */
module.exports = '/asset-mock.svg';

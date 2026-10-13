/**
 * Standalone layer-analytics entry.
 *
 * For pages that carry hotspot layers but no video player, chiefly the GoDAM Image
 * block with product hotspots. It registers the layer buffer API and the page-hide
 * flush without loading the video-player analytics bundle. Video pages keep using
 * `godam-player-analytics.min.js`, which registers the same API for themselves.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { initLayerAnalytics } from './layer-analytics-runtime';

initLayerAnalytics();

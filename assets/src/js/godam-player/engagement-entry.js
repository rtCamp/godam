/**
 * Video engagement (likes, views, comments) as its own script.
 *
 * The server enqueues this only when a video's engagement bar renders (see
 * `Video_Engagement::add_engagement_to_video()`), so pages without one never
 * load React or the WordPress data packages it needs.
 */

/**
 * Internal dependencies
 */
import { engagement } from './engagement';

/**
 * Public hook so markup rendered later (e.g. by a page builder, through
 * `window.GODAMPlayer()`) can load its engagement data too. Safe to call again.
 */
window.godamEngagement = {
	init: engagement,
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => engagement() );
} else {
	engagement();
}

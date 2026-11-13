/**
 * External dependencies
 */
import axios from 'axios';

/**
 * Load a media item from the core `wp/v2/media` route as the logged-in user.
 *
 * Sends the REST nonce: without it WordPress treats the request as logged out,
 * so a site that closes `wp/v2/media` to logged-out visitors answers 401
 * `rest_not_logged_in` and the Single Video Analytics page has no video to show.
 *
 * @since 2.9.1
 *
 * @param {number} id Attachment ID.
 * @return {Promise} The axios request.
 */
const fetchMediaItem = ( id ) => {
	const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

	return axios.get( window.pathJoin( [ restURL, `/wp/v2/media/${ id }` ] ), {
		headers: { 'X-WP-Nonce': window.videoData?.nonce || window.wpApiSettings?.nonce },
	} );
};

export default fetchMediaItem;

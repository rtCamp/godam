/**
 * External dependencies
 */
import videojs from 'video.js';

document.addEventListener( 'DOMContentLoaded', () => playerAnalytics() );

function playerAnalytics() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	videos.forEach( ( video ) => {
		// read the data-setup attribute.

		const videoSetupOptions = video.dataset.setup
			? JSON.parse( video.dataset.setup )
			: {
				controls: true,
				autoplay: false,
				preload: 'auto',
				fluid: true,
			};

		const player = videojs( video, videoSetupOptions );

		const existingRanges = [];
		let lastTime = 0;

		player.on( 'timeupdate', function() {
			const currentTime = player.currentTime();
			const played = player.played();

			// Check if we've jumped backwards (replay)
			if ( currentTime < lastTime ) {
				// Add new range entry when user jumps back
				existingRanges.push( copyRanges( played ) );
			} else if ( existingRanges.length === 0 ) {
				existingRanges.push( copyRanges( played ) );
			} else {
				existingRanges[ existingRanges.length - 1 ] = copyRanges( played );
			}

			updateHeatmap( existingRanges );
			lastTime = currentTime;
		} );

		function copyRanges( timeRanges ) {
			const copy = [];

			for ( let i = 0; i < timeRanges.length; i++ ) {
				copy.push( [ timeRanges.start( i ), timeRanges.end( i ) ] );
			}

			return copy;
		}

		let licenseKey = null;

		async function getLicenseKey() {
			if ( licenseKey ) {
				return licenseKey; //prevents multiple requests
			}

			const licenseResponse = await fetch(
				'/wp-json/easydam/v1/settings/get-license-key',
				{
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.nonceData.nonce,
					},
				},
			);

			const licenseData = await licenseResponse.json();

			return licenseData.license_key || '';
		}

		async function updateHeatmap( ranges ) {
			const videoId = video.getAttribute( 'data-id' );
			const url = `/wp-json/wp/v2/media/${ videoId }`;

			licenseKey = await getLicenseKey();

			const data = JSON.stringify( {
				easydam_analytics: {
					ranges,
					license: licenseKey, // to associate range with the user
				},
			} );

			fetch( url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.nonceData.nonce,
				},
				body: data,
			} ).then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( `HTTP error! Status: ${ response.status }` );
				}
				return response.json();
			} );
		}
	} );
}

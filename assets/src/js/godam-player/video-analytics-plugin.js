/**
 * Internal dependencies
 */
import { isAnalyticsOffPage, buildAnalyticsRequestBody } from './analytics-helpers';
import { hasStatisticsConsent, holdUntilConsent } from './utils/consent';

const videoAnalyticsPlugin = () => {
	return {
		name: 'video-analytics-plugin',
		track: async ( { payload } ) => {
			if ( isAnalyticsOffPage() ) {
				return;
			}

			// No consent yet: keep the event in memory. It is sent if the visitor
			// accepts on this page, discarded if they refuse.
			if ( ! hasStatisticsConsent() ) {
				holdUntilConsent( () => sendTrackPayload( payload, true ) );
				return;
			}

			return sendTrackPayload( payload, false );
		},
	};
};

/**
 * POST one tracked event to the analytics service.
 *
 * An event that waited for consent is sent with the visitor id in use now, which
 * can differ from the one in memory when it was tracked: a returning visitor's
 * stored id replaces it once consent is confirmed.
 *
 * @param {Object}  payload The analytics library's track payload.
 * @param {boolean} held    True when the event waited for consent.
 */
async function sendTrackPayload( payload, held ) {
	const { properties, meta } = payload;
	const anonymousId = ( held && window.analytics?.user?.()?.anonymousId ) || payload.anonymousId;

	try {
		const { ranges = [], videoId, type, videoLength, videoIds, jobId, layers = [], reelPopId, blockSource = '', hostPostId = 0 } = properties;

		if ( ! type || ( type === 1 && ( ! videoIds || videoIds.length === 0 ) ) ) {
			return;
		}

		// type=3 needs at least one layer event to be worth sending.
		if ( type === 3 && ( ! Array.isArray( layers ) || layers.length === 0 ) ) {
			return;
		}

		const { endpoint, body } = buildAnalyticsRequestBody( {
			type,
			userToken: anonymousId,
			visitorTimestamp: meta?.ts || Date.now(),
			videoId,
			jobId,
			videoIds,
			ranges,
			videoLength,
			layers,
			reelPopId,
			blockSource,
			hostPostId,
		} );

		if ( ! endpoint ) {
			return;
		}

		const response = await fetch( endpoint + '/analytics/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( body ),
			keepalive: true,
		} );

		if ( ! response.ok ) {
			throw new Error(
				`Video analytics POST failed with status ${ response.status }`,
			);
		}
	} catch ( err ) {
		// Error is silently ignored, not console logged.
	}
}

export default videoAnalyticsPlugin;

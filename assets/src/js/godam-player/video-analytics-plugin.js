/**
 * Internal dependencies
 */
import { shouldSkipAnalytics, buildAnalyticsRequestBody } from './analytics-helpers';

const videoAnalyticsPlugin = () => {
	return {
		name: 'video-analytics-plugin',
		track: async ( { payload } ) => {
			if ( shouldSkipAnalytics() ) {
				return;
			}

			const { properties, meta, anonymousId } = payload;

			try {
				const { ranges = [], videoId, type, videoLength, videoIds, jobId, reelPopId } = properties;

				if ( ! type || ( type === 1 && ( ! videoIds || videoIds.length === 0 ) ) ) {
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
					reelPopId,
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
		},
	};
};

export default videoAnalyticsPlugin;

const videoAnalyticsPlugin = ( userConfig = {} ) => {
	return {
		name: 'video-analytics-plugin',

		// The 'page' method is invoked by analytics.page(properties)
		page: async ( { payload } ) => {
			const { properties, meta, anonymousId } = payload;
			try {
				// Example: We’ll POST the data to userConfig.endpoint + 'page_view_log/'
				const response = await fetch( userConfig.endpoint + 'page_view_log/', {
					method: 'POST',
					headers: {
						Authorization: 'Token ' + ( userConfig.token || '' ),
						'Content-Type': 'application/json',
					},
					body: JSON.stringify( {
						// Below are various columns for "Page Analytics"
						site_url: window.location.origin,
						user_token: anonymousId,
						account_token: userConfig.token || '',
						email: '', // Fill in if you have an email
						visitor_timestamp: meta && meta.ts ? meta.ts : Date.now(),
						visit_entry_action_url: properties.url || window.location.href,
						visit_entry_action_name: properties.title || document.title,
						referrer: properties.referrer || document.referrer || '',
						screen_width: properties.width || window.innerWidth,
						screen_height: properties.height || window.innerHeight,
						campaign_data: properties.campaign_data || {}, // Pass campaign data
					} ),
				} );

				if ( ! response.ok ) {
					throw new Error( `Page view POST failed with status ${ response.status }` );
				}
				// Handle response if needed:
				// const data = await response.json();
			} catch ( err ) {
				console.error( 'Video analytics plugin page error:', err );
			}
		},

		track: async ( { payload } ) => {
			const { event, properties, meta, anonymousId } = payload;

			// Only handle events of type "video_heatmap"
			if ( event !== 'video_heatmap' ) {
				return;
			}

			try {
				// Destructure the ranges array from properties
				const { ranges = [], videoId, license, type } = properties;

				// Iterate over each range and send a POST request for it
				const response = await fetch( userConfig.endpoint + 'video_log/', {
					method: 'POST',
					headers: {
						Authorization: 'Token ' + ( userConfig.token || '' ),
						'Content-Type': 'application/json',
					},
					body: JSON.stringify( {
						// Below are the columns from your “Video Analytics” table structure
						site_url: window.location.origin,
						user_token: anonymousId,
						account_token: userConfig.token || '',
						email: '', // Fill in if you have an email
						visitor_timestamp: meta?.ts || Date.now(), // Use meta.ts or current timestamp
						visit_entry_action_url: window.location.href,
						visit_entry_action_name: document.title,
						type: type || 'Heatmap',
						video_id: videoId,
						ranges,
						license: license || '',
					} ),
				} );

				if ( ! response.ok ) {
					throw new Error(
						`Video analytics POST failed with status ${ response.status }`,
					);
				}
			} catch ( err ) {
				console.error( 'Video analytics plugin track error:', err );
			}
		},
	};
};

export default videoAnalyticsPlugin;

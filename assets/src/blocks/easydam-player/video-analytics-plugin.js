const {
	userId,
	emailId,
	isPost,
	isPage,
	isArchive,
	postType,
	postId,
	postTitle,
	categories,
	tags,
	author,
	endpoint,
	locationIP,
} = window.videoAnalyticsParams || {};

const videoAnalyticsPlugin = ( userConfig = {} ) => {
	return {
		name: 'video-analytics-plugin',
		track: async ( { payload } ) => {
			let { event, properties, meta, anonymousId } = payload;

			properties = {
				...properties,
				url: window.location.href,
				title: document.title,
				referrer: document.referrer || '', // Include referrer
				width: window.innerWidth, // Screen width
				height: window.innerHeight, // Screen height
				campaign_data: window.campaign_data || {}, // Include campaign data if available
			};

			// Only handle events of type "video_heatmap"
			if ( event !== 'video_heatmap' ) {
				return;
			}

			try {
				// Destructure the ranges array from properties
				const { ranges = [], videoId, license, type } = properties;
				const userAgentData = getUserAgent( window.navigator.userAgent );
				// Iterate over each range and send a POST request for it
				const response = await fetch( endpoint + 'analytics/', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify( {
						site_url: window.location.origin,
						user_token: anonymousId,
						wp_user_id: userId || '',
						account_token: userConfig.token || '',
						email: emailId || '',
						visitor_timestamp: meta?.ts || Date.now(),
						visit_entry_action_url: window.location.href,
						visit_entry_action_name: document.title,
						referer_type: '',
						referer_name: properties.referrer,
						referer_url: properties.referrer,
						referer_keyword: '',
						campaign_keyword: ( undefined !== window.campaign_data && undefined !== window.campaign_data.keyword ) ? window.campaign_data.keyword : '',
						campaign_medium: ( undefined !== window.campaign_data && undefined !== window.campaign_data.medium ) ? window.campaign_data.medium : '',
						campaign_name: ( undefined !== window.campaign_data && undefined !== window.campaign_data.name ) ? window.campaign_data.name : '',
						campaign_source: ( undefined !== window.campaign_data && undefined !== window.campaign_data.source ) ? window.campaign_data.source : '',
						campaign_content: ( undefined !== window.campaign_data && undefined !== window.campaign_data.content ) ? window.campaign_data.content : '',
						campaign_token: ( undefined !== window.campaign_data && undefined !== window.campaign_data.id ) ? window.campaign_data.id : '',
						config_token: userAgentData.userAgent,
						config_os: userAgentData.platform,
						config_browser_name: userAgentData.name,
						config_browser_version: userAgentData.version,
						config_resolution: properties.width + 'x' + properties.height,
						location_browser_lang: navigator.language,
						location_ip: locationIP || '',
						config_cookie: navigator.cookieEnabled,
						param_vars: '',
						is_post: isPost === '1',
						is_page: isPage === '1',
						is_archive: isArchive === '1',
						post_type: postType,
						post_id: parseInt( postId, 0 ),
						post_title: postTitle,
						categories,
						tags,
						author,
						type: type || 0,
						video_id: videoId ? parseInt( videoId, 0 ) : 0,
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

function getUserAgent( userAgent ) {
	const uAgent = userAgent;
	let bname = 'Unknown';
	let platform = 'Unknown';
	let version = '';
	let ub = '';

	// First get the platform
	if ( /(linux)/i.test( uAgent ) ) {
		platform = 'Linux';
	} else if ( /(macintosh|mac os x)/i.test( uAgent ) ) {
		platform = 'Macintosh';
	} else if ( /(windows|win32)/i.test( uAgent ) ) {
		platform = 'Windows';
	}

	// Next get the name of the useragent separately
	if ( /(MSIE)/i.test( uAgent ) && ! /(Opera)/i.test( uAgent ) ) {
		bname = 'Internet Explorer';
		ub = 'MSIE';
	} else if ( /(Firefox)/i.test( uAgent ) ) {
		bname = 'Mozilla Firefox';
		ub = 'Firefox';
	} else if ( /(Chrome)/i.test( uAgent ) ) {
		bname = 'Google Chrome';
		ub = 'Chrome';
	} else if ( /(Safari)/i.test( uAgent ) ) {
		bname = 'Apple Safari';
		ub = 'Safari';
	} else if ( /(Opera)/i.test( uAgent ) ) {
		bname = 'Opera';
		ub = 'Opera';
	} else if ( /(Netscape)/i.test( uAgent ) ) {
		bname = 'Netscape';
		ub = 'Netscape';
	}

	// Finally get the correct version number
	const known = [ 'Version', ub, 'other' ];
	const pattern = new RegExp( '(?<browser>' + known.join( '|' ) + ')[/ ]+(?<version>[0-9.|a-zA-Z.]*)', 'g' );
	const matches = uAgent.matchAll( pattern );
	const matchArray = Array.from( matches );
	const i = matchArray.length;

	if ( i !== 1 ) {
		if ( uAgent.lastIndexOf( 'Version' ) < uAgent.lastIndexOf( ub ) ) {
			version = matchArray[ 0 ].groups.version;
		} else {
			version = matchArray[ 1 ].groups.version;
		}
	} else {
		version = matchArray[ 0 ].groups.version;
	}

	// Check if we have a version number
	if ( version === null || version === '' ) {
		version = '?';
	}

	return {
		userAgent: uAgent,
		name: bname,
		version,
		platform,
		pattern,
	};
}

export default videoAnalyticsPlugin;

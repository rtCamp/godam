export async function fetchAnalyticsData( videoId, siteUrl ) {
	try {
		const params = new URLSearchParams( {
			video_id: videoId,
			site_url: siteUrl,
		} );

		const url = `${ window.godamRestRoute.url }godam/v1/analytics/fetch?${ params.toString() }`;

		const sampleCountryData = {
			USA: 120,
			India: 95,
			'United Kingdom': 45,
			Germany: 30,
			Canada: 25,
			Australia: 20,
			France: 18,
			Brazil: 15,
			Japan: 10,
			'South Africa': 8,
		};

		const response = await fetch(
			// url,
			`/wp-json/godam/v1/analytics/fetch?${ params.toString() }`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			},
		);

		const result = await response.json();

		if (
			result.status === 'error' &&
      result.message.includes( 'Invalid or unverified API key' )
		) {
			showAPIActivationMessage();
			return null;
		}

		if ( result.status !== 'success' ) {
			throw new Error( result.message );
		}

		result.data.country_views = sampleCountryData;

		return result.data;
	} catch ( error ) {
		return null;
	}
}

function showAPIActivationMessage() {
	// Remove loading animation
	const loadingElement = document.getElementById( 'loading-analytics-animation' );
	if ( loadingElement ) {
		loadingElement.style.display = 'none';
	}

	// Show analytics container
	const analyticsContainer = document.getElementById(
		'video-analytics-container',
	);
	if ( analyticsContainer ) {
		analyticsContainer.classList.remove( 'hidden' );
		analyticsContainer.classList.add( 'blurred' ); // Apply blur effect
	}

	// Add a message overlay
	const licenseOverlay = document.getElementById( 'license-overlay' );
	if ( licenseOverlay ) {
		licenseOverlay.classList.remove( 'hidden' );
	}
}

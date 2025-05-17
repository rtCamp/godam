
function renderChange( changeValue ) {
	const rounded = Math.abs( changeValue ).toFixed( 2 );
	const prefix = changeValue >= 0 ? '+' : '-';
	return `${ prefix }${ rounded }%`;
}

function setChange( id, value ) {
	const el = document.getElementById( id );
	if ( ! el ) {
		return;
	}
	el.innerHTML = renderChange( value );
	el.classList.add( value >= 0 ? 'change-rise' : 'change-drop' );
}

function main() {
	const dashboardMetrics = window.dashboardMetrics;

	if ( ! dashboardMetrics ) {
		return;
	}

	const {
		plays,
		page_load: pageLoad,
		play_time: playTime,
		avg_engagement: avgEngagement,
		views_change: viewsChange,
		watch_time_change: watchTimeChange,
		play_rate_change: playRateChange,
		avg_engagement_change: avgEngagementChange,
		total_videos: totalVideos,
	} = dashboardMetrics;

	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0;

	const playRateEl = document.getElementById( 'play-rate' );
	if ( playRateEl ) {
		playRateEl.innerText = `${ playRate.toFixed( 2 ) }%`;
	}

	const playsEl = document.getElementById( 'plays' );
	if ( playsEl ) {
		playsEl.innerText = plays;
	}

	const engagementRateEl = document.getElementById( 'engagement-rate' );
	if ( engagementRateEl ) {
		engagementRateEl.innerText = `${ avgEngagement.toFixed( 2 ) }%`;
	}

	const watchTimeEl = document.getElementById( 'watch-time' );
	if ( watchTimeEl ) {
		watchTimeEl.innerText = `${ playTime.toFixed( 2 ) }s`;
	}

	setChange( 'plays-change', viewsChange );
	setChange( 'watch-time-change', watchTimeChange );
	setChange( 'play-rate-change', playRateChange );
	setChange( 'engagement-rate-change', avgEngagementChange );

	const analyticsContainer = document.getElementById( 'video-analytics-container' );
	if ( analyticsContainer ) {
		analyticsContainer.classList.remove( 'hidden' );
	}

	const analyticsContent = document.getElementById( 'analytics-content' );
	if ( analyticsContent ) {
		analyticsContent.classList.remove( 'hidden' );
	}

	const loadingElement = document.getElementById( 'loading-analytics-animation' );
	if ( loadingElement ) {
		loadingElement.style.display = 'none';
	}
}

document.addEventListener( 'DOMContentLoaded', () => {
	const checkInterval = setInterval( () => {
		const dashboardMetrics = window.dashboardMetrics;

		const requiredIds = [
			'play-rate',
			'plays',
			'engagement-rate',
			'watch-time',
		];

		const allElementsExist = requiredIds.every( ( id ) =>
			document.getElementById( id ),
		);

		if ( dashboardMetrics && allElementsExist ) {
			clearInterval( checkInterval );
			main();
		}
	}, 500 );
} );

/**
 * GoDAM WP Dashboard Widget - Fetches analytics data and renders it.
 *
 * @package
 */

( function() {
	'use strict';

	const config = window.godamDashboardWidget || {};
	const restUrl = config.restUrl || '';
	const nonce = config.nonce || '';
	const siteUrl = config.siteUrl || window.location.origin;

	const loadingEl = document.getElementById( 'godam-dw-loading' );
	const errorEl = document.getElementById( 'godam-dw-error' );
	const errorMsgEl = document.getElementById( 'godam-dw-error-message' );
	const contentEl = document.getElementById( 'godam-dw-content' );

	/**
	 * Make a GET request to a GoDAM REST API endpoint.
	 *
	 * @param {string} endpoint The relative endpoint path.
	 * @param {Object} params   Query parameters.
	 * @return {Promise<Object>} Parsed JSON response.
	 */
	function apiFetch( endpoint, params = {} ) {
		const url = new URL( restUrl + endpoint );
		Object.entries( params ).forEach( ( [ key, value ] ) => {
			url.searchParams.append( key, value );
		} );

		return fetch( url.toString(), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			credentials: 'same-origin',
		} ).then( ( response ) => {
			if ( ! response.ok ) {
				throw new Error( `HTTP ${ response.status }` );
			}
			return response.json();
		} );
	}

	/**
	 * Format seconds into a human-readable watch time string.
	 *
	 * @param {number} seconds Total seconds.
	 * @return {string} Formatted string like "2h 15m" or "45s".
	 */
	function formatWatchTime( seconds ) {
		if ( ! seconds || seconds <= 0 ) {
			return '0s';
		}

		const hrs = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const secs = Math.floor( seconds % 60 );

		if ( hrs > 0 ) {
			return mins > 0 ? `${ hrs }h ${ mins }m` : `${ hrs }h`;
		}
		if ( mins > 0 ) {
			return secs > 0 ? `${ mins }m ${ secs }s` : `${ mins }m`;
		}
		return `${ secs }s`;
	}

	/**
	 * Format a large number with compact notation.
	 *
	 * @param {number} num The number to format.
	 * @return {string} Formatted number string.
	 */
	function formatNumber( num ) {
		if ( num === null || num === undefined ) {
			return '0';
		}
		if ( num >= 1000000 ) {
			return ( num / 1000000 ).toFixed( 1 ) + 'M';
		}
		if ( num >= 1000 ) {
			return ( num / 1000 ).toFixed( 1 ) + 'K';
		}
		return num.toLocaleString();
	}

	/**
	 * Populate the dashboard metrics section.
	 *
	 * @param {Object} metrics The dashboard_metrics object from the API.
	 */
	function renderMetrics( metrics ) {
		const plays = metrics.plays || 0;
		const playTime = metrics.play_time || 0;
		const pageLoad = metrics.page_load || 0;
		const avgEngagement = metrics.avg_engagement || 0;
		const totalVideos = metrics.total_videos || 0;

		const playRate = pageLoad > 0 ? ( plays / pageLoad ) * 100 : 0;

		document.getElementById( 'godam-dw-plays' ).textContent = formatNumber( plays );
		document.getElementById( 'godam-dw-watch-time' ).textContent = formatWatchTime( playTime );
		document.getElementById( 'godam-dw-play-rate' ).textContent = playRate.toFixed( 2 ) + '%';
		document.getElementById( 'godam-dw-avg-engagement' ).textContent = avgEngagement.toFixed( 2 ) + '%';
		document.getElementById( 'godam-dw-total-videos' ).textContent = formatNumber( totalVideos );
	}

	/**
	 * Draw a simple sparkline on a canvas element from history data.
	 *
	 * @param {Array} history Array of daily history records.
	 */
	function renderSparkline( history ) {
		const canvas = document.getElementById( 'godam-dw-sparkline' );
		if ( ! canvas || ! canvas.getContext ) {
			return;
		}

		if ( ! history || history.length === 0 ) {
			const ctx = canvas.getContext( '2d' );
			ctx.fillStyle = '#9ca3af';
			ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText( 'No data available', canvas.width / 2, canvas.height / 2 );
			return;
		}

		// Sort history by date ascending.
		const sorted = [ ...history ].sort( ( a, b ) => new Date( a.date ) - new Date( b.date ) );
		const dataPoints = sorted.map( ( item ) => item.plays || 0 );

		const ctx = canvas.getContext( '2d' );
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();

		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale( dpr, dpr );

		const width = rect.width;
		const height = rect.height;
		const padding = 4;
		const chartWidth = width - ( padding * 2 );
		const chartHeight = height - ( padding * 2 );

		const maxVal = Math.max( ...dataPoints, 1 );
		const stepX = chartWidth / Math.max( dataPoints.length - 1, 1 );

		// Draw fill.
		ctx.beginPath();
		ctx.moveTo( padding, height - padding );
		dataPoints.forEach( ( val, i ) => {
			const x = padding + ( i * stepX );
			const y = padding + ( chartHeight - ( ( val / maxVal ) * chartHeight ) );

			ctx.lineTo( x, y );
		} );
		ctx.lineTo( padding + ( ( dataPoints.length - 1 ) * stepX ), height - padding );
		ctx.closePath();
		ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
		ctx.fill();

		// Draw line.
		ctx.beginPath();
		dataPoints.forEach( ( val, i ) => {
			const x = padding + ( i * stepX );
			const y = padding + ( chartHeight - ( ( val / maxVal ) * chartHeight ) );
			if ( i === 0 ) {
				ctx.moveTo( x, y );
			} else {
				ctx.lineTo( x, y );
			}
		} );
		ctx.strokeStyle = '#6366f1';
		ctx.lineWidth = 1.5;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.stroke();
	}

	/**
	 * Render the top videos table.
	 *
	 * @param {Array} videos Array of top video objects.
	 */
	function renderTopVideos( videos ) {
		const tbody = document.getElementById( 'godam-dw-top-videos-body' );
		if ( ! tbody ) {
			return;
		}

		if ( ! videos || videos.length === 0 ) {
			tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#6b7280;">' +
				'No video data available.' +
				'</td></tr>';
			return;
		}

		// Show max 5 videos in the widget.
		const displayVideos = videos.slice( 0, 5 );
		let html = '';

		displayVideos.forEach( ( video ) => {
			const title = video.title || 'Untitled';
			const thumbUrl = video.thumbnail_url || '';
			const plays = video.plays || 0;
			const playTime = video.play_time || 0;

			const thumbImg = thumbUrl
				? `<img class="godam-dw-video-thumb" src="${ escapeHtml( thumbUrl ) }" alt="" loading="lazy" />`
				: '<span class="godam-dw-video-thumb" style="display:inline-block;background:#d1d5db;"></span>';

			html += `<tr>
				<td>
					<div class="godam-dw-video-title">
						${ thumbImg }
						<span class="godam-dw-video-name" title="${ escapeHtml( title ) }">${ escapeHtml( title ) }</span>
					</div>
				</td>
				<td>${ formatNumber( plays ) }</td>
				<td>${ formatWatchTime( playTime ) }</td>
			</tr>`;
		} );

		tbody.innerHTML = html;
	}

	/**
	 * Escape HTML entities in a string.
	 *
	 * @param {string} str The string to escape.
	 * @return {string} Escaped string.
	 */
	function escapeHtml( str ) {
		const div = document.createElement( 'div' );
		div.appendChild( document.createTextNode( str ) );
		return div.innerHTML;
	}

	/**
	 * Show an error state in the widget.
	 *
	 * @param {string} message The error message to display.
	 */
	function showError( message ) {
		if ( loadingEl ) {
			loadingEl.style.display = 'none';
		}
		if ( errorMsgEl ) {
			errorMsgEl.textContent = message;
		}
		if ( errorEl ) {
			errorEl.style.display = 'block';
		}
	}

	/**
	 * Initialize the widget by fetching all 3 API endpoints.
	 */
	function init() {
		if ( ! restUrl || ! document.getElementById( 'godam-dashboard-widget' ) ) {
			return;
		}

		const params = { site_url: siteUrl };

		const metricsPromise = apiFetch( 'godam/v1/analytics/dashboard-metrics', params );
		const historyPromise = apiFetch( 'godam/v1/analytics/dashboard-history', { ...params, days: 60 } );
		const topVideosPromise = apiFetch( 'godam/v1/analytics/top-videos', { ...params, page: 1, limit: 10 } );

		Promise.allSettled( [ metricsPromise, historyPromise, topVideosPromise ] )
			.then( ( results ) => {
				const [ metricsResult, historyResult, topVideosResult ] = results;

				// Check if all requests failed.
				const allFailed = results.every( ( r ) => r.status === 'rejected' );
				if ( allFailed ) {
					showError( 'Unable to load GoDAM analytics data. Please check your API key configuration.' );
					return;
				}

				// Check if metrics returned an error status (missing API key etc.).
				if (
					metricsResult.status === 'fulfilled' &&
					metricsResult.value &&
					metricsResult.value.status === 'error'
				) {
					showError(
						metricsResult.value.message ||
						'Unable to fetch analytics. Please verify your GoDAM API key.',
					);
					return;
				}

				// Hide loading, show content.
				if ( loadingEl ) {
					loadingEl.style.display = 'none';
				}
				if ( contentEl ) {
					contentEl.style.display = 'block';
				}

				// Render metrics.
				if ( metricsResult.status === 'fulfilled' && metricsResult.value.dashboard_metrics ) {
					renderMetrics( metricsResult.value.dashboard_metrics );
				}

				// Render sparkline.
				if ( historyResult.status === 'fulfilled' && historyResult.value.dashboard_metrics_history ) {
					renderSparkline( historyResult.value.dashboard_metrics_history );
				} else {
					renderSparkline( [] );
				}

				// Render top videos.
				if ( topVideosResult.status === 'fulfilled' && topVideosResult.value.top_videos ) {
					renderTopVideos( topVideosResult.value.top_videos );
				} else {
					renderTopVideos( [] );
				}
			} )
			.catch( () => {
				showError( 'An unexpected error occurred while loading GoDAM data.' );
			} );
	}

	// Run when DOM is ready.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );

/* global d3 */
export function generateUsageDonutChart( selector, usedRaw, totalRaw, type = 'bandwidth', label = 'Used' ) {
	const used = parseFloat( usedRaw ) || 0;
	const total = parseFloat( totalRaw ) || 0;
	const width = 300;
	const height = 300;
	const margin = 20;
	const radius = ( Math.min( width, height ) / 2 ) - margin;
	const innerRadius = radius * 0.7;

	const data = total > 0
		? [
			{ label, value: used },
			{ label: 'Remaining', value: Math.max( total - used, 0 ) },
		]
		: [ { label: 'No Data', value: 1 } ];

	const svg = d3
		.select( selector )
		.html( '' )
		.append( 'svg' )
		.attr( 'width', width )
		.attr( 'height', height )
		.append( 'g' )
		.attr( 'transform', `translate(${ width / 2 }, ${ height / 2 })` );

	const pie = d3
		.pie()
		.value( ( d ) => d.value )
		.sort( null );

	const arc = d3.arc().innerRadius( innerRadius ).outerRadius( radius );

	// Gradient fill for storage
	if ( type === 'storage' ) {
		const defs = svg.append( 'defs' );
		const gradient = defs.append( 'linearGradient' )
			.attr( 'id', 'storageGradient' )
			.attr( 'x1', '0%' )
			.attr( 'y1', '0%' )
			.attr( 'x2', '100%' )
			.attr( 'y2', '0%' );

		gradient.append( 'stop' )
			.attr( 'offset', '0%' )
			.attr( 'stop-color', '#AB3A6C' );

		gradient.append( 'stop' )
			.attr( 'offset', '100%' )
			.attr( 'stop-color', '#E6533A' );
	}

	const fillColor = ( d ) => {
		if ( d.data.label === 'Remaining' ) {
			return '#F5F5F5';
		}
		if ( type === 'bandwidth' ) {
			return '#1D4A4F';
		}
		if ( type === 'storage' ) {
			return 'url(#storageGradient)';
		}
		return '#3b82f6';
	};

	// Draw donut slices
	svg
		.selectAll( 'path' )
		.data( pie( data ) )
		.enter()
		.append( 'path' )
		.attr( 'd', arc )
		.attr( 'fill', fillColor )
		.attr( 'stroke', 'white' )
		.style( 'stroke-width', '2px' );

	const percent = total > 0 ? ( used / total ) * 100 : 0;
	const usedText = `${ formatGBToTB( used, false ) }`;
	const totalText = formatGBToTB( total );
	const availableText = `${ formatGBToTB( total - used ) } available of ${ totalText }`;

	if ( type === 'bandwidth' ) {
		svg
			.append( 'text' )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '-0.25em' )
			.style( 'font-size', '12px' )
			.text( total === 0 ? 'No Data' : 'Total' )
			.style( 'fill', '#8E8E93' );

		svg
			.append( 'text' )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '1.1em' )
			.style( 'font-size', '14px' )
			.style( 'font-weight', 'bold' )
			.text( total === 0 ? '0 GB' : totalText );

		if ( total > 0 ) {
			const arcData = pie( data )[ 0 ];
			const centroid = arc.centroid( arcData );
			svg
				.append( 'text' )
				.attr( 'text-anchor', 'middle' )
				.attr( 'x', centroid[ 0 ] )
				.attr( 'y', centroid[ 1 ] )
				.style( 'font-size', '12px' )
				.style( 'font-weight', 'bold' )
				.style( 'fill', 'white' )
				.text( usedText );
		}
	} else if ( type === 'storage' ) {
		svg
			.append( 'text' )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '-0.25em' )
			.style( 'font-size', '14px' )
			.style( 'font-weight', 'bold' )
			.text( total === 0 ? '0%' : `${ percent?.toFixed( 1 ) }%` );

		svg
			.append( 'text' )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '1.25em' )
			.style( 'font-size', '12px' )
			.style( 'fill', '#555' )
			.text( total === 0 ? 'No storage data available' : availableText );
	}
}

function formatWatchTime( seconds ) {
	const hrs = Math.floor( seconds / 3600 );
	const mins = Math.floor( ( seconds % 3600 ) / 60 );
	const secs = Math.floor( seconds % 60 );

	const parts = [];
	if ( hrs > 0 ) {
		parts.push( `${ hrs }h` );
	}
	if ( mins > 0 ) {
		parts.push( `${ mins }m` );
	}
	if ( secs > 0 || parts.length === 0 ) {
		parts.push( `${ secs }s` );
	}

	return parts.join( ' ' );
}

function formatGBToTB( gb, unit = true ) {
	if ( gb >= 1000 ) {
		return ( gb / 1000 ).toFixed( 1 ) + ( unit ? ' TB' : '' );
	}
	return gb.toFixed( 1 ) + ( unit ? ' GB' : '' );
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
		total_videos: totalVideos,
	} = dashboardMetrics;

	const totalVideosEl = document.getElementById( 'total-videos' );
	if ( totalVideosEl ) {
		totalVideosEl.innerText = totalVideos ?? 0;
	}

	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0;

	const playRateEl = document.getElementById( 'play-rate' );
	if ( playRateEl ) {
		playRateEl.innerText = `${ playRate?.toFixed( 2 ) }%`;
	}

	const playsEl = document.getElementById( 'plays' );
	if ( playsEl ) {
		playsEl.innerText = plays;
	}

	const watchTimeEl = document.getElementById( 'watch-time' );
	if ( watchTimeEl ) {
		watchTimeEl.innerText = `${ formatWatchTime( playTime?.toFixed( 2 ) ) }`;
	}

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

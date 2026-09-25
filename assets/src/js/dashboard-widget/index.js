/**
 * GoDAM Dashboard widget: fills in the Watching section from GoDAM analytics.
 *
 * The widget's shell, the library and ready sections, and placeholders for the
 * Watching tiles this site has shown before all render in PHP. This script
 * loads the Watching numbers (watch time, plays, viewers, countries, times
 * shown, the 30-day plays chart and top videos) after the page renders, so a
 * slow analytics service never holds up the Dashboard. The summary endpoint
 * says which of them to show: a tile appears once its number is worth showing
 * and then stays. Values are written with textContent only.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { playsMilestone, roundWatchTime, scaleBars } from './utils';

const config = window.godamDashboardWidget || {};
const locale = document.documentElement.lang || undefined;
const wholeNumber = new Intl.NumberFormat( locale );
const oneDecimal = new Intl.NumberFormat( locale, { maximumFractionDigits: 1 } );
// History dates are UTC days, so format them in UTC to keep each bar on its own date.
const shortDate = new Intl.DateTimeFormat( locale, { month: 'short', day: 'numeric', timeZone: 'UTC' } );
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Find an element in the widget by its data-rtgodam-dw hook.
 *
 * @param {HTMLElement} root Widget root.
 * @param {string}      name Hook name.
 * @return {HTMLElement|null} The element, if present.
 */
const part = ( root, name ) => root.querySelector( `[data-rtgodam-dw="${ name }"]` );

/**
 * Watch time, rounded and formatted, with its label.
 *
 * @param {number} seconds Watch time in seconds.
 * @return {{amount: number, unit: string, value: string, label: string}} Formatted watch time.
 */
function formatWatchTime( seconds ) {
	const time = roundWatchTime( seconds );
	const hours = 'hours' === time.unit;

	return {
		...time,
		value: hours ? oneDecimal.format( time.amount ) : wholeNumber.format( time.amount ),
		label: hours
			? _n( 'hour watched', 'hours watched', time.amount, 'godam' )
			: _n( 'minute watched', 'minutes watched', time.amount, 'godam' ),
	};
}

/**
 * A count tile: the formatted number, its label and its tooltip.
 *
 * @param {number} count Count.
 * @param {string} label Label, already pluralised for count.
 * @param {string} title Tooltip saying exactly what the number counts.
 * @return {{value: string, label: string, title: string}} Tile content.
 */
const countTile = ( count, label, title ) => ( { value: wholeNumber.format( count ), label, title } );

/**
 * Content for each Watching tile, in display order.
 */
const TILES = {
	watch_seconds: ( receipts ) => {
		const time = formatWatchTime( receipts.watch_seconds || 0 );

		return {
			value: time.value,
			label: time.label,
			title: __( 'Time people actually spent watching. Pauses, buffering and skipped parts are not counted.', 'godam' ),
		};
	},
	plays: ( { plays = 0 } ) => countTile(
		plays,
		_n( 'play', 'plays', plays, 'godam' ),
		__( 'A play is one viewer watching a video on a given day.', 'godam' ),
	),
	viewers: ( { unique_viewers: viewers = 0 } ) => countTile(
		viewers,
		_n( 'viewer', 'viewers', viewers, 'godam' ),
		__( 'Counted once per browser that played a video.', 'godam' ),
	),
	countries: ( { countries = 0 } ) => countTile(
		countries,
		_n( 'country reached', 'countries reached', countries, 'godam' ),
		__( 'Countries your videos were watched in.', 'godam' ),
	),
	times_shown: ( { times_shown: shown = 0 } ) => countTile(
		shown,
		_n( 'time shown on a page', 'times shown on pages', shown, 'godam' ),
		__( 'Times one of your videos came into view on a page, played or not.', 'godam' ),
	),
};

/**
 * Fill in the Watching tiles the summary says to show, and hide the rest.
 *
 * @param {HTMLElement} root     Widget root.
 * @param {Object}      receipts Receipts from the summary endpoint.
 * @param {string[]}    show     Tile IDs to show.
 * @return {number} How many tiles are showing.
 */
function renderTiles( root, receipts, show ) {
	let shown = 0;

	Object.keys( TILES ).forEach( ( id ) => {
		const tile = part( root, `tile-${ id }` );
		if ( ! tile ) {
			return;
		}

		tile.classList.remove( 'is-loading' );

		if ( ! show.includes( id ) ) {
			tile.hidden = true;
			return;
		}

		const content = TILES[ id ]( receipts );
		tile.querySelector( '.rtgodam-dw__value' ).textContent = content.value;
		tile.querySelector( '.rtgodam-dw__label' ).textContent = content.label;
		// A clickable tile carries its tooltip on the link, so it describes the link.
		( tile.querySelector( 'a' ) || tile ).title = content.title;
		tile.hidden = false;
		shown++;
	} );

	// The stylesheet balances the rows by how many tiles there are.
	const list = part( root, 'tiles' );
	if ( list ) {
		list.dataset.count = String( shown );
	}

	return shown;
}

/**
 * Draw plays per day for the last 30 days. Once the chart has been shown, it
 * stays, and a quiet month shows as a row of empty days.
 *
 * @param {HTMLElement} root    Widget root.
 * @param {Array}       history Rows of { date, plays }, oldest first, from the summary endpoint.
 * @param {boolean}     visible Whether the chart is showing.
 * @return {boolean} Whether the chart is showing.
 */
function renderChart( root, history, visible ) {
	const box = part( root, 'chart' );
	const svg = part( root, 'chart-svg' );
	if ( ! box || ! svg ) {
		return false;
	}

	box.classList.remove( 'is-loading' );

	if ( ! visible || ! history.length ) {
		box.hidden = true;
		return false;
	}

	const plays = history.map( ( day ) => Math.max( 0, day.plays || 0 ) );
	const sum = plays.reduce( ( running, value ) => running + value, 0 );

	// Coordinates are in the SVG's 300 x 64 viewBox, which stretches to the widget's width.
	const heights = scaleBars( plays );
	const slot = 300 / history.length;
	const barWidth = slot * 0.7;

	svg.replaceChildren();

	history.forEach( ( day, index ) => {
		const height = Math.max( 1, heights[ index ] * 62 );
		const bar = document.createElementNS( SVG_NS, 'rect' );
		const title = document.createElementNS( SVG_NS, 'title' );

		bar.setAttribute( 'x', ( ( index * slot ) + ( ( slot - barWidth ) / 2 ) ).toFixed( 2 ) );
		bar.setAttribute( 'y', ( 64 - height ).toFixed( 2 ) );
		bar.setAttribute( 'width', barWidth.toFixed( 2 ) );
		bar.setAttribute( 'height', height.toFixed( 2 ) );
		bar.setAttribute( 'class', plays[ index ] > 0 ? 'rtgodam-dw__bar' : 'rtgodam-dw__bar is-empty' );

		title.textContent = sprintf(
			/* translators: 1: a date such as "Sep 12", 2: number of plays. */
			_n( '%1$s: %2$s play', '%1$s: %2$s plays', plays[ index ], 'godam' ),
			shortDate.format( new Date( `${ day.date }T00:00:00Z` ) ),
			wholeNumber.format( plays[ index ] ),
		);

		bar.append( title );
		svg.append( bar );
	} );

	svg.setAttribute(
		'aria-label',
		sprintf(
			/* translators: %s: number of plays. */
			_n( '%s play in the last 30 days', '%s plays in the last 30 days', sum, 'godam' ),
			wholeNumber.format( sum ),
		),
	);

	const total = part( root, 'chart-total' );
	if ( total ) {
		total.textContent = wholeNumber.format( sum );
	}

	box.hidden = false;
	return true;
}

/**
 * Render the top videos list. Once the list has been shown, it stays, and a
 * month without plays says so.
 *
 * @param {HTMLElement} root    Widget root.
 * @param {Array}       videos  Top videos from the summary endpoint.
 * @param {boolean}     visible Whether the list is showing.
 * @return {boolean} Whether the list is showing.
 */
function renderTopVideos( root, videos, visible ) {
	const box = part( root, 'top' );
	const list = part( root, 'top-list' );
	if ( ! box || ! list ) {
		return false;
	}

	box.classList.remove( 'is-loading' );
	list.replaceChildren();

	if ( ! visible ) {
		box.hidden = true;
		return false;
	}

	if ( ! videos.length ) {
		const item = document.createElement( 'li' );
		item.className = 'rtgodam-dw__top-empty';
		item.textContent = __( 'No plays in the last 30 days.', 'godam' );
		list.append( item );
	}

	videos.forEach( ( video ) => {
		const item = document.createElement( 'li' );
		const link = document.createElement( 'a' );
		const meta = document.createElement( 'span' );
		const details = [
			sprintf(
				/* translators: %s: number of plays. */
				_n( '%s play', '%s plays', video.plays, 'godam' ),
				wholeNumber.format( video.plays ),
			),
		];

		if ( video.watch_seconds > 0 ) {
			const time = formatWatchTime( video.watch_seconds );
			details.push( `${ time.value } ${ time.label }` );
		}

		link.href = video.url;
		link.textContent = video.title || sprintf(
			/* translators: %d: attachment ID. */
			__( 'Video %d', 'godam' ),
			video.id,
		);
		meta.className = 'rtgodam-dw__top-meta';
		meta.textContent = details.join( ' · ' );

		item.append( link, meta );
		list.append( item );
	} );

	box.hidden = false;
	return true;
}

/**
 * Show or hide the Watching section.
 *
 * @param {HTMLElement} root    Widget root.
 * @param {boolean}     visible Whether it shows.
 */
function showWatching( root, visible ) {
	const section = part( root, 'section-watching' );
	if ( section ) {
		section.hidden = ! visible;
	}
}

/**
 * Show how fresh the numbers are.
 *
 * @param {HTMLElement} root      Widget root.
 * @param {number}      fetchedAt Unix time the numbers were fetched.
 */
function renderUpdated( root, fetchedAt ) {
	const updated = part( root, 'updated' );
	if ( ! updated || ! fetchedAt ) {
		return;
	}

	const minutes = Math.max( 0, Math.round( ( ( Date.now() / 1000 ) - fetchedAt ) / 60 ) );

	updated.textContent = minutes < 1
		? __( 'Updated just now', 'godam' )
		: sprintf(
			/* translators: %s: minutes since the numbers were fetched. */
			_n( 'Updated %s minute ago', 'Updated %s minutes ago', minutes, 'godam' ),
			wholeNumber.format( minutes ),
		);
}

/**
 * Ask for a review once the site has passed a plays milestone, quoting it.
 *
 * The server decides whether this admin may be asked at all (never while
 * something is failing, and not again after "No thanks"). Choices are saved,
 * except in preview.
 *
 * @param {HTMLElement} root     Widget root.
 * @param {Object}      receipts Receipts from the summary endpoint.
 */
function renderReviewAsk( root, receipts ) {
	const box = part( root, 'review' );
	const text = part( root, 'review-text' );
	const milestone = playsMilestone( receipts.plays || 0 );

	if ( ! box || ! text || ! config.reviewAsk || ! milestone ) {
		return;
	}

	text.textContent = sprintf(
		/* translators: %s: a round number of plays the site has passed, e.g. "2,500". */
		__( 'Your videos have passed %s plays. If GoDAM has earned it, a quick review on WordPress.org helps other site owners find it.', 'godam' ),
		wholeNumber.format( milestone ),
	);
	box.hidden = false;

	box.addEventListener( 'click', ( event ) => {
		const button = event.target.closest( '[data-rtgodam-dw-review]' );
		if ( ! button ) {
			return;
		}

		box.hidden = true;

		if ( ! config.preview && config.reviewPath ) {
			apiFetch( {
				path: config.reviewPath,
				method: 'POST',
				data: { choice: button.dataset.rtgodamDwReview },
			} ).catch( () => {} );
		}
	} );
}

/**
 * Show a message in the status line, or clear it.
 *
 * @param {HTMLElement|null} status  Status element.
 * @param {string}           message Message, or '' to clear.
 */
function showStatus( status, message ) {
	if ( ! status ) {
		return;
	}

	status.textContent = message;
	status.classList.toggle( 'screen-reader-text', ! message );
}

/**
 * Load the summary and fill in the Watching section.
 *
 * @param {HTMLElement} root Widget root.
 */
async function load( root ) {
	const status = part( root, 'status' );
	const path = config.preview
		? `${ config.path }?preview=${ encodeURIComponent( config.preview ) }`
		: config.path;

	root.setAttribute( 'aria-busy', 'true' );

	let summary;
	try {
		summary = await apiFetch( { path } );
	} catch ( error ) {
		summary = null;
	}

	root.setAttribute( 'aria-busy', 'false' );

	if ( ! summary || 'success' !== summary.status ) {
		// Only an analytics outage (or no response) is known not to affect playback.
		const serviceDown = ! summary || 'microservice_error' === summary.errorType;

		// The section stays, with the placeholders cleared, to say what happened.
		renderTiles( root, {}, [] );
		renderChart( root, [], false );
		renderTopVideos( root, [], false );
		showStatus(
			status,
			serviceDown
				? __( 'GoDAM analytics is unavailable right now. Your videos keep playing as usual.', 'godam' )
				: __( 'GoDAM analytics could not load right now.', 'godam' ),
		);
		showWatching( root, true );
		return;
	}

	const receipts = summary.receipts || {};
	const show = Array.isArray( summary.show ) ? summary.show : [];
	const tiles = renderTiles( root, receipts, show );
	const chart = renderChart( root, summary.history || [], show.includes( 'chart_plays' ) );
	const top = renderTopVideos( root, summary.top_videos || [], show.includes( 'top_videos' ) );
	const empty = ! tiles && ! chart && ! top;

	// Only a site with no plays yet gets the hint; a few plays just wait for their floor.
	const hint = empty && ! receipts.plays;

	showStatus(
		status,
		hint ? __( 'Add a GoDAM video to a page. Plays and watch time show up here once people start watching.', 'godam' ) : '',
	);
	showWatching( root, ! empty || hint );
	renderUpdated( root, summary.fetched_at );
	renderReviewAsk( root, receipts );
}

document.addEventListener( 'DOMContentLoaded', () => {
	const root = document.getElementById( 'rtgodam-dashboard-widget' );

	// Only the active state has remote numbers to load.
	if ( ! root || 'active' !== root.dataset.state || ! config.path ) {
		return;
	}

	load( root );
} );

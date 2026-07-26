/**
 * External dependencies
 */
import React, { useEffect, useMemo, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { external } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { useFetchAnalyticsDataQuery } from '../../redux/api/analyticsApi';
import DateRangePicker from '../DateRangePicker';
import { formatWatchTime } from '../../../utils/formatters';

/**
 * Known placement slugs and their display labels. Anything else (including
 * the empty string) is bucketed into the catch-all "Other" section.
 */
const BLOCK_SOURCE_LABELS = {
	'video-block': __( 'Video Block', 'godam' ),
	'video-gallery': __( 'Video Gallery', 'godam' ),
	'shoppable-video': __( 'Shoppable Video', 'godam' ),
	'wc-product-gallery': __( 'WooCommerce Product Gallery', 'godam' ),
	'product-reels': __( 'Product Reels', 'godam' ),
	'reel-pop': __( 'Reel Pop', 'godam' ),
};

// Canonical section order for the left-hand list; 'other' always sinks last.
const SECTION_ORDER = [
	'video-block',
	'video-gallery',
	'shoppable-video',
	'wc-product-gallery',
	'product-reels',
	'reel-pop',
	'other',
];

/**
 * Display label for a block_source slug. '' and unknown slugs read "Other".
 *
 * @param {string} blockSource Placement slug from the microservice.
 * @return {string} Human-readable section label.
 */
export function getBlockSourceLabel( blockSource ) {
	// hasOwnProperty, not a bare lookup: block_source is untrusted free text and
	// an inherited Object.prototype member name ('toString', 'valueOf', …) would
	// otherwise resolve to a function and be treated as a known label.
	return isKnownBlockSource( blockSource )
		? BLOCK_SOURCE_LABELS[ blockSource ]
		: __( 'Other', 'godam' );
}

/**
 * Whether a block_source is one of the labelled placements. Own-property check
 * only, so inherited Object.prototype names never count as known.
 *
 * @param {string} blockSource Raw block_source value.
 * @return {boolean} True when the value has a defined label.
 */
function isKnownBlockSource( blockSource ) {
	return Object.prototype.hasOwnProperty.call( BLOCK_SOURCE_LABELS, blockSource );
}

/**
 * Group placement rows into ordered sections by block_source.
 *
 * Rows with an empty or unknown block_source merge into one 'other' section.
 * Section order follows SECTION_ORDER; row order inside a section keeps the
 * server's sort (plays desc). Only sections that have rows are returned.
 *
 * @param {Array} placements Placement rows ({ post_id, block_source, … }).
 * @return {Array<{key: string, label: string, rows: Array}>} Ordered sections.
 */
export function groupPlacementsByBlockSource( placements ) {
	// Null-prototype map: block_source is untrusted free text (the microservice
	// normalizes but deliberately never rejects it, and the public embed page
	// accepts it from a query arg), so a value like 'toString' or 'constructor'
	// would otherwise hit an inherited Object.prototype member — making the
	// label lookup truthy and `buckets[ key ]` a function, so the push threw a
	// TypeError during render and took the whole Analytics page down.
	const buckets = Object.create( null );

	( Array.isArray( placements ) ? placements : [] ).forEach( ( row ) => {
		const raw = typeof row?.block_source === 'string' ? row.block_source : '';
		const key = isKnownBlockSource( raw ) ? raw : 'other';
		if ( ! buckets[ key ] ) {
			buckets[ key ] = [];
		}
		buckets[ key ].push( row );
	} );

	return SECTION_ORDER.filter( ( key ) => buckets[ key ] ).map( ( key ) => ( {
		key,
		label: key === 'other' ? __( 'Other', 'godam' ) : getBlockSourceLabel( key ),
		rows: buckets[ key ],
	} ) );
}

/**
 * Play rate as a percentage (plays / page loads * 100), guarded against
 * division by zero.
 *
 * @param {number} plays    Play count.
 * @param {number} pageLoad Page-load count.
 * @return {number} Percentage (0 when there are no page loads).
 */
export function getPlayRate( plays, pageLoad ) {
	const loads = Number( pageLoad ) || 0;
	if ( loads <= 0 ) {
		return 0;
	}
	return ( ( Number( plays ) || 0 ) / loads ) * 100;
}

/**
 * Average watch time in seconds (play_time / plays), guarded against
 * division by zero.
 *
 * @param {number} playTime Total played seconds.
 * @param {number} plays    Play count.
 * @return {number} Seconds per play (0 when there are no plays).
 */
export function getAvgWatchTime( playTime, plays ) {
	const playCount = Number( plays ) || 0;
	if ( playCount <= 0 ) {
		return 0;
	}
	return ( Number( playTime ) || 0 ) / playCount;
}

/**
 * Display title for a placement row. The proxy always enriches a title, but
 * this guards the edge where an older/absent enrichment leaves it blank (e.g.
 * rows past the proxy's lookup cap, or an old plugin build) so the row is still
 * attributable instead of rendering a blank name line.
 *
 * @param {Object} row Enriched placement entry.
 * @return {string} A non-empty title.
 */
export function getPlacementTitle( row ) {
	if ( row && row.title ) {
		return row.title;
	}
	const postId = row && Number( row.post_id );
	return postId
		? sprintf( /* translators: %d: WordPress post ID. */ __( 'Post #%d', 'godam' ), postId )
		: __( 'Unknown page', 'godam' );
}

/**
 * Path shown under a row title ("Displayed on: /slug"). Falls back to the
 * raw permalink when it isn't parseable as a URL.
 *
 * @param {string|null} permalink The placement page's permalink.
 * @return {string} Path portion of the permalink, or ''.
 */
function getDisplayPath( permalink ) {
	if ( ! permalink ) {
		return '';
	}
	try {
		const url = new URL( permalink );
		return url.pathname || '/';
	} catch ( e ) {
		return permalink;
	}
}

/**
 * Loading skeleton mirroring the master-detail shape.
 *
 * @return {JSX.Element} Skeleton element.
 */
function PlacementsSkeleton() {
	return (
		<div className="grid gap-4 grid-cols-1 md:grid-cols-[minmax(200px,260px)_minmax(0,1fr)]">
			<div className="flex flex-col gap-2">
				{ [ 0, 1, 2 ].map( ( i ) => (
					<div key={ i } className="h-10 rounded-lg animate-pulse bg-zinc-100" />
				) ) }
			</div>
			<div className="h-48 rounded-xl animate-pulse bg-zinc-100" />
		</div>
	);
}

/**
 * One placement row: page title + path, Edit Page action, and four metrics.
 *
 * @param {Object} props
 * @param {Object} props.row Enriched placement entry.
 * @return {JSX.Element} The row.
 */
function PlacementRow( { row } ) {
	const path = getDisplayPath( row.permalink );
	const playRate = getPlayRate( row.plays, row.page_load );
	const avgWatchTime = getAvgWatchTime( row.play_time, row.plays );
	const title = getPlacementTitle( row );

	const metrics = [
		{ label: __( 'Views', 'godam' ), value: Number( row.views ?? 0 ).toLocaleString() },
		{ label: __( 'Plays', 'godam' ), value: Number( row.plays ?? 0 ).toLocaleString() },
		{ label: __( 'Play Rate', 'godam' ), value: `${ playRate.toFixed( 2 ) }%` },
		{ label: __( 'Avg Watch Time', 'godam' ), value: formatWatchTime( avgWatchTime ) },
	];

	return (
		<div
			className="rounded-xl border border-zinc-200 bg-white px-5 py-4"
			data-test-id="godam-placements-row"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-zinc-900 m-0 truncate">
						{ row.permalink ? (
							<a
								href={ row.permalink }
								target="_blank"
								rel="noopener noreferrer"
								className="text-zinc-900 no-underline hover:underline"
							>
								{ title }
							</a>
						) : (
							title
						) }
					</p>
					{ path && (
						<p className="text-xs text-zinc-500 m-0 mt-0.5 truncate">
							{ __( 'Displayed on:', 'godam' ) }{ ' ' }
							<span className="tabular-nums">{ path }</span>
						</p>
					) }
				</div>
				{ row.is_deleted ? (
					<span className="text-xs text-zinc-400 flex-shrink-0">
						{ __( 'Deleted page', 'godam' ) }
					</span>
				) : (
					row.edit_url && (
						<Button
							variant="secondary"
							size="small"
							href={ row.edit_url }
							target="_blank"
							icon={ external }
							iconPosition="right"
							iconSize={ 14 }
							className="flex-shrink-0"
						>
							{ __( 'Edit Page', 'godam' ) }
						</Button>
					)
				) }
			</div>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
				{ metrics.map( ( metric ) => (
					<div key={ metric.label } className="min-w-0">
						<p className="text-xs text-zinc-500 m-0">{ metric.label }</p>
						<p className="text-sm font-semibold text-zinc-900 m-0 mt-0.5 tabular-nums">
							{ metric.value }
						</p>
					</div>
				) ) }
			</div>
		</div>
	);
}

/**
 * Placements
 *
 * "Where is this video placed, and how does each placement perform?" card on
 * the per-video analytics page. Groups the microservice's placement rows by
 * block_source into a master (section list) / detail (per-page rows) layout,
 * with its own date-range scope independent of the page-level metrics.
 *
 * @param {Object}        props
 * @param {number|string} props.videoId    WP attachment ID of the video.
 * @param {string}        props.siteUrl    Current site URL.
 * @param {boolean}       props.shouldSkip Skip the query (missing/invalid API key).
 * @return {JSX.Element} The placements card.
 */
const Placements = ( { videoId, siteUrl, shouldSkip } ) => {
	// Own range state, defaulting to All Time (both null).
	const [ range, setRange ] = useState( { startDate: null, endDate: null } );
	const [ selectedKey, setSelectedKey ] = useState( null );

	const { data, isLoading, isFetching, isError } = useFetchAnalyticsDataQuery(
		{
			videoId,
			siteUrl,
			// Conditional spread: at All Time no date keys are present, so the
			// cache key matches the page's primary query exactly and RTK Query
			// serves both from one request.
			...( range.startDate ? { startDate: range.startDate } : {} ),
			...( range.endDate ? { endDate: range.endDate } : {} ),
		},
		{ skip: ! videoId || shouldSkip },
	);

	const hasError = isError || !! data?.errorType;

	// Missing key (old microservice) and empty array render the same
	// "collecting data" state; either way there is nothing to show yet.
	const sections = useMemo(
		() => groupPlacementsByBlockSource( Array.isArray( data?.placements ) ? data.placements : [] ),
		[ data ],
	);

	// Auto-select the first section with data; re-resolve when the current
	// selection disappears (e.g. after a range change).
	useEffect( () => {
		if ( sections.length === 0 ) {
			setSelectedKey( null );
			return;
		}
		if ( ! selectedKey || ! sections.find( ( s ) => s.key === selectedKey ) ) {
			setSelectedKey( sections[ 0 ].key );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ sections ] );

	const selectedSection = sections.find( ( s ) => s.key === selectedKey ) || null;
	const showSkeleton = isLoading || isFetching;
	const hasRange = Boolean( range.startDate || range.endDate );

	return (
		<div className="godam-card godam-placements-card" data-test-id="godam-placements-section">
			<div className="godam-card__head">
				<h2>{ __( 'Placements', 'godam' ) }</h2>
				<DateRangePicker
					value={ range }
					onChange={ setRange }
					testIdPrefix="godam-placements-daterange"
				/>
			</div>

			{ showSkeleton && <PlacementsSkeleton /> }

			{ ! showSkeleton && hasError && (
				<div className="px-6 py-10 text-center text-sm text-zinc-500">
					{ __( 'Unable to load placement analytics. Please try again.', 'godam' ) }
				</div>
			) }

			{ ! showSkeleton && ! hasError && sections.length === 0 && (
				<div className="px-6 py-10 text-center">
					{ hasRange ? (
						/* A range is active: this is "nothing in this window", not
						   "the feature hasn't started collecting" — and the empty
						   state offers the action that resolves it. */
						<>
							<p className="text-sm font-semibold text-zinc-700 m-0">
								{ __( 'No placements in this date range', 'godam' ) }
							</p>
							<p className="text-sm text-zinc-500 m-0 mt-1">
								{ __(
									'This video had no placement activity in the selected range.',
									'godam',
								) }
							</p>
							<Button
								variant="secondary"
								size="small"
								className="mt-3"
								onClick={ () => setRange( { startDate: null, endDate: null } ) }
								data-test-id="godam-placements-reset-range"
							>
								{ __( 'View all time', 'godam' ) }
							</Button>
						</>
					) : (
						<>
							<p className="text-sm font-semibold text-zinc-700 m-0">
								{ __( 'Collecting placement data', 'godam' ) }
							</p>
							<p className="text-sm text-zinc-500 m-0 mt-1">
								{ __(
									'Placement analytics starts collecting after this update. Data appears as new plays come in.',
									'godam',
								) }
							</p>
						</>
					) }
				</div>
			) }

			{ ! showSkeleton && ! hasError && sections.length > 0 && (
				<div className="grid gap-4 grid-cols-1 md:grid-cols-[minmax(200px,260px)_minmax(0,1fr)]">
					{ /* Master: placement-type sections. */ }
					<ul className="m-0 p-0 list-none flex flex-col gap-1">
						{ sections.map( ( section ) => (
							<li key={ section.key } className="m-0">
								<button
									type="button"
									onClick={ () => setSelectedKey( section.key ) }
									data-test-id={ `godam-placements-list-item-${ section.key }` }
									aria-pressed={ section.key === selectedKey }
									className={ `w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm cursor-pointer transition-colors ${
										section.key === selectedKey
											? 'border-zinc-300 bg-zinc-50 font-semibold text-zinc-900'
											: 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-50'
									}` }
								>
									<span className="truncate">{ section.label }</span>
									<span className="text-xs text-zinc-400 tabular-nums flex-shrink-0">
										{ section.rows.length.toLocaleString() }
									</span>
								</button>
							</li>
						) ) }
					</ul>

					{ /* Detail: the selected section's per-page rows. */ }
					<div className="flex flex-col gap-3 min-w-0">
						{ selectedSection &&
							selectedSection.rows.map( ( row, index ) => (
								<PlacementRow
									key={ `${ row.post_id }-${ row.block_source }-${ index }` }
									row={ row }
								/>
							) ) }
					</div>
				</div>
			) }
		</div>
	);
};

export default Placements;

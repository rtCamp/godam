/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { SearchControl, ToggleControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useFetchTopVideosQuery, useLazyFetchTopVideosQuery } from '../redux/api/dashboardAnalyticsApi';
import DateRangePicker from '../../analytics/components/DateRangePicker';
import Tooltip from '../../analytics/Tooltip';
import { formatWatchTime } from '../../utils/formatters';
import DefaultThumbnail from '../../../assets/src/images/video-thumbnail-default.png';
import ExportBtn from '../../../assets/src/images/export.svg';
import chevronLeft from '../../../assets/src/images/chevron-left.svg';
import chevronRight from '../../../assets/src/images/chevron-right.svg';

const PER_PAGE = 10;
// The analytics microservice caps `limit` at 100 per request, so a full-set
// export pages through it 100 at a time rather than asking for everything at once.
const EXPORT_PAGE_SIZE = 100;
const ANALYTICS_LINK = ( id ) => `admin.php?page=rtgodam_analytics&id=${ id }`;

/**
 * Escape a value for a CSV cell.
 *
 * Guards against CSV formula injection: a cell beginning with =, +, -, @, tab or
 * CR is executed as a formula by Excel/Sheets, and video titles are user-settable.
 * Such values are prefixed with a single quote. The value is then quote-wrapped
 * when it contains a double quote, comma, or newline.
 *
 * @param {*} value Raw cell value.
 * @return {string} CSV-safe field.
 */
function escapeCsvCell( value ) {
	let str = String( value );
	if ( /^[=+\-@\t\r]/.test( str ) ) {
		str = `'${ str }`;
	}
	return /["\n,]/.test( str ) ? `"${ str.replace( /"/g, '""' ) }"` : str;
}

/**
 * Compact page list with ellipses, e.g. [ 1, '…', 4, 5, 6, '…', 12 ].
 *
 * @param {number} current Current page (1-based).
 * @param {number} total   Total number of pages.
 * @return {Array} Page numbers interleaved with '…' for gaps.
 */
function getPageList( current, total ) {
	const wanted = new Set( [ 1, total, current, current - 1, current + 1 ] );
	const pages = [ ...wanted ]
		.filter( ( p ) => p >= 1 && p <= total )
		.sort( ( a, b ) => a - b );

	const list = [];
	let prev = 0;
	for ( const p of pages ) {
		if ( p - prev > 1 ) {
			list.push( '…' );
		}
		list.push( p );
		prev = p;
	}
	return list;
}

/**
 * Dashboard "Top Videos" table.
 *
 * Metrics (and pagination) come from the analytics microservice; title, size and
 * deletion state come from WordPress. Search (by title) and the "Show deleted
 * videos" toggle are resolved WP-side into the microservice's `video_ids`
 * include-filter by the REST proxy, so server pagination stays correct.
 *
 * @param {Object}  props
 * @param {string}  props.siteUrl       Current site URL.
 * @param {boolean} props.skip          Skip the query while the dashboard is gated.
 * @param {Object}  [props.tabSwitcher] Optional switcher node rendered in the table head in place of the title.
 */
export default function TopVideosTable( { siteUrl, skip = false, tabSwitcher = null } ) {
	const [ page, setPage ] = useState( 1 );
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	// Off by default: hide rows whose media was deleted. Toggle on to also show
	// deleted-media videos that still have analytics.
	const [ showDeleted, setShowDeleted ] = useState( false );
	const [ isExporting, setIsExporting ] = useState( false );
	// Date range for the table. Empty = all-time (unchanged default behaviour).
	const [ dateRange, setDateRange ] = useState( { startDate: null, endDate: null } );

	const onChangeRange = ( next ) => {
		setDateRange( next );
		setPage( 1 );
	};

	// Debounce the search box and reset to the first page on a new term.
	useEffect( () => {
		const timer = setTimeout( () => {
			setSearch( searchInput.trim() );
			setPage( 1 );
		}, 400 );
		return () => clearTimeout( timer );
	}, [ searchInput ] );

	const { data, isFetching } = useFetchTopVideosQuery(
		{
			siteUrl,
			page,
			limit: PER_PAGE,
			search,
			hideDeleted: ! showDeleted,
			startDate: dateRange.startDate,
			endDate: dateRange.endDate,
		},
		{ skip },
	);

	const videos = data?.videos || [];
	const totalPages = data?.totalPages || 1;
	const totalItems = data?.totalItems || 0;

	// Lazy trigger reused to page through the full result set for CSV export.
	const [ fetchForExport ] = useLazyFetchTopVideosQuery();

	// Scroll the table back into view when paging (skip the initial render).
	const firstLoad = useRef( true );
	useEffect( () => {
		if ( firstLoad.current ) {
			firstLoad.current = false;
			return;
		}
		document
			.querySelector( '.top-media-container' )
			?.scrollIntoView( { behavior: 'smooth' } );
	}, [ page ] );

	const onToggleDeleted = ( value ) => {
		setShowDeleted( value );
		setPage( 1 );
	};

	const playRate = ( item ) =>
		item.plays > 0 && item.page_load > 0
			? ( ( item.plays / item.page_load ) * 100 ).toFixed( 2 ) + '%'
			: '0%';

	const engagement = ( item ) =>
		item.plays > 0 && item.video_length > 0
			? ( ( item.play_time / ( item.plays * item.video_length ) ) * 100 ).toFixed( 2 ) + '%'
			: '-';

	const buildCsvRow = ( item ) => [
		item.title || item.video_id,
		`ID: ${ item.video_id }`,
		( item.video_size ? item.video_size.toFixed( 2 ) : 0 ) + ' MB',
		playRate( item ),
		item.plays || 0,
		formatWatchTime( item.play_time || 0 ),
		engagement( item ),
		item.video_conversion_rate !== undefined && item.video_conversion_rate !== null
			? Number( item.video_conversion_rate ).toFixed( 2 ) + '%'
			: '-',
		Number( item.placements_count ?? 0 ),
	];

	const handleExportCSV = async () => {
		setIsExporting( true );

		// Export the full result set for the current search/filter — not just the
		// page on screen. The microservice caps `limit` at 100, so page through it.
		// A failed page resolves to empty rather than rejecting the whole export.
		const pageCount = Math.max( 1, Math.ceil( ( totalItems || videos.length ) / EXPORT_PAGE_SIZE ) );
		const results = await Promise.all(
			Array.from( { length: pageCount }, ( _, i ) =>
				fetchForExport( {
					siteUrl,
					page: i + 1,
					limit: EXPORT_PAGE_SIZE,
					search,
					hideDeleted: ! showDeleted,
					startDate: dateRange.startDate,
					endDate: dateRange.endDate,
				} ).unwrap().catch( () => ( { videos: [] } ) ),
			),
		);
		const fetched = results.flatMap( ( result ) => result?.videos || [] );
		// Fall back to the rows already on screen if the full fetch returned nothing.
		const exportVideos = fetched.length ? fetched : videos;

		const headers = [
			__( 'Title', 'godam' ),
			__( 'Media ID', 'godam' ),
			__( 'Size', 'godam' ),
			__( 'Play Rate', 'godam' ),
			__( 'Total Plays', 'godam' ),
			__( 'Watch Time', 'godam' ),
			__( 'Engagement Rate', 'godam' ),
			__( 'Conversion Rate', 'godam' ),
			__( 'Placements', 'godam' ),
		];

		const csvContent = [ headers, ...exportVideos.map( buildCsvRow ) ]
			.map( ( row ) => row.map( escapeCsvCell ).join( ',' ) )
			.join( '\n' );

		const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } );
		const url = URL.createObjectURL( blob );
		const link = document.createElement( 'a' );
		link.setAttribute( 'href', url );
		link.setAttribute( 'download', 'godam-video-analytics.csv' );
		link.style.display = 'none';
		document.body.appendChild( link );
		link.click();
		document.body.removeChild( link );
		URL.revokeObjectURL( url );

		setIsExporting( false );
	};

	return (
		<div className="top-media-container">
			<div className="top-media-container__head">
				{ tabSwitcher || (
					<h2>
						{ __( 'Top Videos', 'godam' ) }
						{ totalItems > 0 && (
							<span className="ml-2 text-sm font-normal text-zinc-400">
								{ sprintf(
									/* translators: %s: number of videos (already locale-formatted). */
									_n( '%s video', '%s videos', totalItems, 'godam' ),
									totalItems.toLocaleString(),
								) }
							</span>
						) }
					</h2>
				) }
				<div className="top-media-container__tools">
					<SearchControl
						__nextHasNoMarginBottom
						className="top-media-container__search"
						data-test-id="godam-top-videos-search"
						value={ searchInput }
						onChange={ setSearchInput }
						placeholder={ __( 'Search videos', 'godam' ) }
						label={ __( 'Search videos', 'godam' ) }
						hideLabelFromVision
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						data-test-id="godam-top-videos-toggle-deleted"
						label={ __( 'Show deleted videos', 'godam' ) }
						checked={ showDeleted }
						onChange={ onToggleDeleted }
					/>
					<DateRangePicker
						value={ dateRange }
						onChange={ onChangeRange }
						testIdPrefix="godam-top-videos-daterange"
					/>
					<button onClick={ handleExportCSV } disabled={ isExporting } className="export-button" data-test-id="godam-top-videos-export">
						<img src={ ExportBtn } alt="" className="export-icon" />
						{ isExporting ? __( 'Exporting…', 'godam' ) : __( 'Export', 'godam' ) }
					</button>
				</div>
			</div>

			<div className="table-container overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Name', 'godam' ) }
									<Tooltip
										text={ __(
											'The video\'s title. Open it to see this video\'s own analytics.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Size', 'godam' ) }
									<Tooltip
										text={ __(
											'The video file\'s size.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Play Rate', 'godam' ) }
									<Tooltip
										text={ __(
											'The share of people who, after the video loaded, actually pressed play.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Total Plays', 'godam' ) }
									<Tooltip
										text={ __(
											'How many times this video was played.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Total Watch Time', 'godam' ) }
									<Tooltip
										text={ __(
											'The total time everyone spent watching this video.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Average Engagement', 'godam' ) }
									<Tooltip
										text={ __(
											'On average, how much of the video people watch before leaving.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Conversion Rate', 'godam' ) }
									<Tooltip
										text={ __(
											'The share of viewing sessions that acted on an interactive layer: clicked a hotspot or CTA, submitted a form, voted in a poll, or added to cart. Hovers are not counted.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Placements', 'godam' ) }
									<Tooltip
										text={ __(
											'How many different pages this video appears on.',
											'godam',
										) }
									/>
								</span>
							</th>
						</tr>
					</thead>
					<tbody>

						{ isFetching ? (
							<tr>
								<td colSpan="8">
									<div className="space-y-4 mt-3">
										<div className="skeleton h-4 w-full"></div>
										<div className="skeleton h-4 w-full"></div>
										<div className="skeleton h-4 w-full"></div>
									</div>
								</td>
							</tr>
						) : (
							videos.map( ( item ) => (
								<tr key={ item.video_id }>
									<td>
										<div className="video-info">
											{ item.exists ? (
												<>
													<a className="thumbnail-link" href={ ANALYTICS_LINK( item.video_id ) }>
														<img
															src={ item.thumbnail_url || DefaultThumbnail }
															alt={ item.title || __( 'Video thumbnail', 'godam' ) }
														/>
													</a>
													<a className="title-link" href={ ANALYTICS_LINK( item.video_id ) }>
														<div className="w-full max-w-40 text-left flex-1">
															<p className="font-semibold">{ item.title || `Video ID: ${ item.video_id }` }</p>
														</div>
													</a>
												</>
											) : (
												<>
													<div className="thumbnail-link">
														<img src={ DefaultThumbnail } alt={ item.title || __( 'Video thumbnail', 'godam' ) } />
													</div>
													<div className="title-link">
														<div className="w-full max-w-40 text-left flex-1">
															<p className="font-semibold">{ item.title }</p>
														</div>
													</div>
												</>
											) }
										</div>
									</td>
									<td>{ item.video_size ? `${ item.video_size.toFixed( 2 ) } MB` : '' }</td>
									<td>{ playRate( item ) }</td>
									<td>{ item.plays ? Number( item.plays ).toLocaleString() : '-' }</td>
									<td>{ item.play_time ? formatWatchTime( item.play_time ) : '-' }</td>
									<td>{ engagement( item ) }</td>
									<td
										title={
											item.total_converting_sessions > 0
												? sprintf(
													/* translators: 1: converting sessions, 2: total plays. */
													__( '%1$s of %2$s sessions converted', 'godam' ),
													Number( item.total_converting_sessions ).toLocaleString(),
													Number( item.plays ).toLocaleString(),
												)
												: __( 'No layer conversions in this period', 'godam' )
										}
									>
										{ item.video_conversion_rate !== undefined && item.video_conversion_rate !== null
											? `${ Number( item.video_conversion_rate ).toFixed( 2 ) }%`
											: '-' }
									</td>
									<td>{ Number( item.placements_count ?? 0 ).toLocaleString() }</td>
								</tr>
							) )
						) }

						{ ! isFetching && videos.length === 0 && (
							<tr>
								<td colSpan="8">
									<div className="godam-empty-state">
										<p className="godam-empty-state__title">
											{ search
												? __( 'No videos match your search', 'godam' )
												: __( 'No video plays yet', 'godam' ) }
										</p>
										<p className="godam-empty-state__hint">
											{ search
												? __( 'Try a different title, or clear the search to see all videos.', 'godam' )
												: __( 'Once your videos start getting views, your top performers will show up here.', 'godam' ) }
										</p>
									</div>
								</td>
							</tr>
						) }
					</tbody>
				</table>
			</div>

			{ totalPages > 1 && (
				<nav className="godam-pagination" data-test-id="godam-top-videos-pagination" aria-label={ __( 'Top videos pagination', 'godam' ) }>
					<button
						className="godam-pagination__nav"
						data-test-id="godam-top-videos-prev"
						disabled={ page === 1 }
						onClick={ () => setPage( ( prev ) => Math.max( prev - 1, 1 ) ) }
						aria-label={ __( 'Previous page', 'godam' ) }
					>
						<img src={ chevronLeft } alt="" className="w-4 h-4 chevron-icon" />
					</button>

					{ getPageList( page, totalPages ).map( ( entry, index ) =>
						entry === '…' ? (
							<span key={ `gap-${ index }` } className="godam-pagination__gap">…</span>
						) : (
							<button
								key={ entry }
								className={ `godam-pagination__page${ entry === page ? ' is-current' : '' }` }
								data-test-id={ `godam-top-videos-page-${ entry }` }
								aria-current={ entry === page ? 'page' : undefined }
								onClick={ () => setPage( entry ) }
							>
								{ entry }
							</button>
						),
					) }

					<button
						className="godam-pagination__nav"
						data-test-id="godam-top-videos-next"
						disabled={ page >= totalPages }
						onClick={ () => setPage( ( prev ) => Math.min( prev + 1, totalPages ) ) }
						aria-label={ __( 'Next page', 'godam' ) }
					>
						<img src={ chevronRight } alt="" className="w-4 h-4 chevron-icon" />
					</button>
				</nav>
			) }
		</div>
	);
}

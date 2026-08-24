/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { SearchControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useFetchTopProductsQuery, useLazyFetchTopProductsQuery } from '../redux/api/dashboardAnalyticsApi';
import DateRangePicker from '../../analytics/components/DateRangePicker';
import DefaultThumbnail from '../../../assets/src/images/video-thumbnail-default.png';
import ExportBtn from '../../../assets/src/images/export.svg';
import chevronLeft from '../../../assets/src/images/chevron-left.svg';
import chevronRight from '../../../assets/src/images/chevron-right.svg';

const PER_PAGE = 10;
// The analytics microservice caps `limit` at 100 per request, so a full-set
// export pages through it 100 at a time rather than asking for everything at once.
const EXPORT_PAGE_SIZE = 100;

// block_source value -> human label for the Source chips. Phase 1 only ever emits
// 'woo-layer' (and 'shoppable-video' once that emit ships); the rest are here so the
// chips read correctly when later surfaces start contributing. Unknown values fall
// back to the raw string.
const SOURCE_LABELS = {
	'woo-layer': __( 'Woo Layer', 'godam' ),
	'shoppable-video': __( 'Shoppable Video', 'godam' ),
	'reel-pop': __( 'Reel Pop', 'godam' ),
	'wc-product-gallery': __( 'Product Gallery', 'godam' ),
	'godam-image': __( 'Image', 'godam' ),
};

export const sourceLabel = ( value ) => SOURCE_LABELS[ value ] || value;

/**
 * Escape a value for a CSV cell (guards against CSV formula injection; product
 * names are user-settable). See TopVideosTable for the rationale.
 *
 * @param {*} value Raw cell value.
 * @return {string} CSV-safe field.
 */
export function escapeCsvCell( value ) {
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

// Add-to-Cart rate = adds / times shown, clamped so it can never read over 100%
// in transient states (mirrors the server-side CTR clamp for product views).
const cartRate = ( item ) => {
	const impressions = Number( item.impressions || 0 );
	if ( impressions <= 0 ) {
		return 0;
	}
	const adds = Number( item.added_to_cart || 0 );
	return ( Math.min( adds, impressions ) / impressions ) * 100;
};

// "N layers · M videos" reach subtitle.
const reachLabel = ( item ) => {
	const layers = Number( item.layer_count || 0 );
	const videos = Number( item.video_count || 0 );
	/* translators: %d: number of layers the product appears in. */
	const layersText = sprintf( _n( '%d layer', '%d layers', layers, 'godam' ), layers );
	/* translators: %d: number of videos the product appears in. */
	const videosText = sprintf( _n( '%d video', '%d videos', videos, 'godam' ), videos );
	return `${ layersText } · ${ videosText }`;
};

// Whether a product can be added to cart from inside a video. Variable, grouped
// and external products cannot, so their in-video (Direct) count is always 0 and
// the UI greys it with a helper. Defaults to true when the proxy did not say
// (e.g. a deleted product), so nothing is greyed without cause.
const supportsDirect = ( item ) => item.supports_direct_add_to_cart !== false;

// Whether this row carries real revenue data. `revenue_minor` (and its sibling
// `orders`/`currency`) are only present once the analytics microservice has
// shipped order-attribution; an older service build simply omits them. Treated
// as absent rather than zero so a not-yet-instrumented row never shows a
// misleading "£0" - it keeps the pre-existing empty placeholder instead.
const hasRevenue = ( item ) => item.revenue_minor !== undefined && item.revenue_minor !== null;

/**
 * Number of minor-unit digits for an ISO 4217 currency, taken from Intl itself
 * rather than assumed. Most currencies use 2 (GBP, USD), but JPY uses 0 and KWD
 * uses 3, so a hardcoded /100 would misplace the decimal for those. Falls back
 * to 2 when the code is unknown or Intl has no currency data.
 *
 * @param {string} currency ISO 4217 currency code.
 * @return {number} Fraction digits for the currency (e.g. 2 for GBP, 0 for JPY, 3 for KWD).
 */
function currencyFractionDigits( currency ) {
	try {
		return new Intl.NumberFormat( undefined, {
			style: 'currency',
			currency,
		} ).resolvedOptions().maximumFractionDigits;
	} catch ( e ) {
		return 2;
	}
}

/**
 * Convert integer minor currency units to a major-unit amount using the
 * currency's own fraction digits (10 ** digits), so 1234 is 12.34 for GBP,
 * 1234 for JPY, and 1.234 for KWD.
 *
 * @param {number} minor    Integer minor currency units.
 * @param {string} currency ISO 4217 currency code.
 * @return {number} Amount in major units.
 */
function revenueMajorUnits( minor, currency ) {
	return Number( minor || 0 ) / ( 10 ** currencyFractionDigits( currency ) );
}

/**
 * Format `revenue_minor` (integer minor currency units, e.g. pence) as a
 * currency amount using the row's own ISO 4217 `currency` code. The minor units
 * are scaled by the currency's own fraction digits (not a fixed /100), so JPY
 * (0 digits) and KWD (3 digits) render correctly. Assumes a single currency per
 * response - no conversion is attempted; multi-currency handling is out of scope.
 *
 * @param {number} minor    Integer minor currency units.
 * @param {string} currency ISO 4217 currency code (e.g. 'GBP', 'USD').
 * @return {string} Formatted amount, e.g. "£12.34".
 */
export function formatRevenue( minor, currency ) {
	const amount = revenueMajorUnits( minor, currency );
	try {
		return new Intl.NumberFormat( undefined, {
			style: 'currency',
			currency,
		} ).format( amount );
	} catch ( e ) {
		// Missing/invalid ISO code (or no Intl currency support) - fall back to a
		// plain number so the cell never throws.
		return currency ? `${ amount.toFixed( 2 ) } ${ currency }` : amount.toFixed( 2 );
	}
}

/**
 * Revenue as a plain, locale-independent number in major units for CSV export:
 * a dot decimal separator, no thousands grouping, no currency symbol (the
 * currency code travels in its own column). Uses the currency's own fraction
 * digits so JPY has none and KWD has three.
 *
 * @param {number} minor    Integer minor currency units.
 * @param {string} currency ISO 4217 currency code.
 * @return {string} Plain number string, e.g. "12.34".
 */
export function formatRevenueNumeric( minor, currency ) {
	return revenueMajorUnits( minor, currency ).toFixed( currencyFractionDigits( currency ) );
}

// "N orders" secondary label for the Revenue cell, mirroring how
// product_views_ctr is shown as secondary text next to product_views.
const ordersLabel = ( item ) => {
	const orders = Number( item.orders || 0 );
	/* translators: %d: number of distinct orders contributing to this product's revenue. */
	return sprintf( _n( '%d order', '%d orders', orders, 'godam' ), orders );
};

// Whether this row carries a real Influenced-revenue match (the third tier:
// a product-page play matched to a later purchase of the same product). Shown
// only when > 0 - an absent or zero match renders nothing, never a misleading
// "£0", and Influenced is never folded into the product's own revenue total.
export const hasInfluenced = ( item ) =>
	item.influenced_revenue_minor !== undefined &&
	item.influenced_revenue_minor !== null &&
	Number( item.influenced_revenue_minor ) > 0;

// "N orders" label for the Influenced sub-line.
export const influencedOrdersLabel = ( item ) => {
	const orders = Number( item.influenced_orders || 0 );
	/* translators: %d: number of distinct orders influenced by a product-page view of a video. */
	return sprintf( _n( '%d order', '%d orders', orders, 'godam' ), orders );
};

/**
 * Dashboard "Top Products" table.
 *
 * One row per product, with numbers gathered across every video and layer it
 * appears in. Metrics and pagination come from the analytics microservice; the
 * product name, image and link come from WooCommerce (hydrated by the REST proxy).
 * Search (by product name) is resolved WP-side into the microservice's
 * `product_ids` include-filter, so server pagination stays correct.
 *
 * @param {Object}  props
 * @param {string}  props.siteUrl       Current site URL.
 * @param {boolean} props.skip          Skip the query while the dashboard is gated.
 * @param {Object}  [props.tabSwitcher] Optional switcher node rendered in the table head in place of the title.
 */
export default function TopProductsTable( { siteUrl, skip = false, tabSwitcher = null } ) {
	const [ page, setPage ] = useState( 1 );
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	const [ isExporting, setIsExporting ] = useState( false );
	// Date range for the table. Empty = all-time.
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

	const { data, isFetching } = useFetchTopProductsQuery(
		{
			siteUrl,
			page,
			limit: PER_PAGE,
			search,
			startDate: dateRange.startDate,
			endDate: dateRange.endDate,
		},
		{ skip },
	);

	const products = data?.products || [];
	const totalPages = data?.totalPages || 1;
	const totalItems = data?.totalItems || 0;

	const [ fetchForExport ] = useLazyFetchTopProductsQuery();

	// Scroll the table back into view when paging (skip the initial render).
	const firstLoad = useRef( true );
	useEffect( () => {
		if ( firstLoad.current ) {
			firstLoad.current = false;
			return;
		}
		document
			.querySelector( '.top-products-container' )
			?.scrollIntoView( { behavior: 'smooth' } );
	}, [ page ] );

	const buildCsvRow = ( item ) => [
		item.title || item.product_id,
		`ID: ${ item.product_id }`,
		( item.sources || [] ).map( sourceLabel ).join( ' | ' ),
		Number( item.product_views || 0 ),
		Number( item.product_views_ctr || 0 ).toFixed( 2 ) + '%',
		Number( item.added_to_cart || 0 ),
		Number( item.added_to_cart_direct || 0 ),
		Number( item.added_to_cart_assisted || 0 ),
		hasRevenue( item ) ? formatRevenueNumeric( item.revenue_minor, item.currency ) : '',
		hasRevenue( item ) ? ( item.currency || '' ) : '',
		hasRevenue( item ) ? Number( item.orders || 0 ) : '',
	];

	const handleExportCSV = async () => {
		setIsExporting( true );

		const pageCount = Math.max( 1, Math.ceil( ( totalItems || products.length ) / EXPORT_PAGE_SIZE ) );
		const results = await Promise.all(
			Array.from( { length: pageCount }, ( _, i ) =>
				fetchForExport( {
					siteUrl,
					page: i + 1,
					limit: EXPORT_PAGE_SIZE,
					search,
					startDate: dateRange.startDate,
					endDate: dateRange.endDate,
				} ).unwrap().catch( () => ( { products: [] } ) ),
			),
		);
		const fetched = results.flatMap( ( result ) => result?.products || [] );
		const exportProducts = fetched.length ? fetched : products;

		const headers = [
			__( 'Product', 'godam' ),
			__( 'Product ID', 'godam' ),
			__( 'Source', 'godam' ),
			__( 'Product Views', 'godam' ),
			__( 'Product Views Rate', 'godam' ),
			__( 'Add to Cart', 'godam' ),
			__( 'Add to Cart (in-video)', 'godam' ),
			__( 'Add to Cart (assisted)', 'godam' ),
			__( 'Revenue', 'godam' ),
			__( 'Currency', 'godam' ),
			__( 'Orders', 'godam' ),
		];

		const csvContent = [ headers, ...exportProducts.map( buildCsvRow ) ]
			.map( ( row ) => row.map( escapeCsvCell ).join( ',' ) )
			.join( '\n' );

		const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } );
		const url = URL.createObjectURL( blob );
		const link = document.createElement( 'a' );
		link.setAttribute( 'href', url );
		link.setAttribute( 'download', 'godam-top-products.csv' );
		link.style.display = 'none';
		document.body.appendChild( link );
		link.click();
		document.body.removeChild( link );
		URL.revokeObjectURL( url );

		setIsExporting( false );
	};

	return (
		<div className="top-media-container top-products-container">
			<div className="top-media-container__head">
				{ tabSwitcher || (
					<h2>
						{ __( 'Top Products', 'godam' ) }
						{ totalItems > 0 && (
							<span className="ml-2 text-sm font-normal text-zinc-400">
								{ sprintf(
									/* translators: %s: number of products (already locale-formatted). */
									_n( '%s product', '%s products', totalItems, 'godam' ),
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
						data-test-id="godam-top-products-search"
						value={ searchInput }
						onChange={ setSearchInput }
						placeholder={ __( 'Search products', 'godam' ) }
						label={ __( 'Search products', 'godam' ) }
						hideLabelFromVision
					/>
					<DateRangePicker
						value={ dateRange }
						onChange={ onChangeRange }
						testIdPrefix="godam-top-products-daterange"
					/>
					<button onClick={ handleExportCSV } disabled={ isExporting } className="export-button" data-test-id="godam-top-products-export">
						<img src={ ExportBtn } alt="" className="export-icon" />
						{ isExporting ? __( 'Exporting…', 'godam' ) : __( 'Export', 'godam' ) }
					</button>
				</div>
			</div>

			<div className="table-container overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr>
							<th scope="col">{ __( 'Product', 'godam' ) }</th>
							<th scope="col">{ __( 'Source', 'godam' ) }</th>
							<th scope="col">{ __( 'Product Views', 'godam' ) }</th>
							<th scope="col">{ __( 'Add to Cart', 'godam' ) }</th>
							<th scope="col">{ __( 'Revenue', 'godam' ) }</th>
						</tr>
					</thead>
					<tbody>

						{ isFetching ? (
							<tr>
								<td colSpan="5">
									<div className="space-y-4 mt-3">
										<div className="skeleton h-4 w-full"></div>
										<div className="skeleton h-4 w-full"></div>
										<div className="skeleton h-4 w-full"></div>
									</div>
								</td>
							</tr>
						) : (
							products.map( ( item ) => (
								<tr key={ item.product_id }>
									<td>
										<div className="video-info">
											<a
												className="thumbnail-link"
												href={ item.permalink || undefined }
												target={ item.permalink ? '_blank' : undefined }
												rel={ item.permalink ? 'noreferrer' : undefined }
											>
												<img
													src={ item.thumbnail_url || DefaultThumbnail }
													alt={ item.title || __( 'Product image', 'godam' ) }
												/>
											</a>
											<div className="title-link">
												<div className="w-full max-w-40 text-left flex-1">
													<p className="font-semibold">
														<a
															className="product-title-link text-inherit no-underline hover:underline"
															href={ item.permalink || undefined }
															target={ item.permalink ? '_blank' : undefined }
															rel={ item.permalink ? 'noreferrer' : undefined }
															data-test-id="godam-top-products-title-link"
														>
															{ item.title || sprintf(
																/* translators: %d: WooCommerce product ID, shown when the product name is unavailable. */
																__( 'Product ID: %d', 'godam' ),
																item.product_id,
															) }
														</a>
													</p>
													<p className="text-xs text-zinc-400">{ reachLabel( item ) }</p>
												</div>
											</div>
										</div>
									</td>
									<td>
										<div className="godam-source-chips">
											{ ( item.sources || [] ).length
												? item.sources.map( ( src ) => (
													<span key={ src } className="godam-chip">{ sourceLabel( src ) }</span>
												) )
												: '-' }
										</div>
									</td>
									<td>
										<span className="font-semibold">{ Number( item.product_views || 0 ).toLocaleString() }</span>
										{ ' ' }
										<span className="text-zinc-400">{ Number( item.product_views_ctr || 0 ).toFixed( 1 ) }%</span>
									</td>
									<td
										title={ sprintf(
											/* translators: 1: in-video adds, 2: assisted adds. */
											__( '%1$s in-video, %2$s via product page', 'godam' ),
											Number( item.added_to_cart_direct || 0 ).toLocaleString(),
											Number( item.added_to_cart_assisted || 0 ).toLocaleString(),
										) }
									>
										<span className="font-semibold">{ Number( item.added_to_cart || 0 ).toLocaleString() }</span>
										{ ' ' }
										<span className="text-zinc-400">{ cartRate( item ).toFixed( 1 ) }%</span>
										<p className="text-xs text-zinc-400">
											<span
												className={ supportsDirect( item ) ? undefined : 'godam-direct-na' }
												title={ supportsDirect( item )
													? undefined
													: __( 'Variable, grouped and external products cannot be added to cart inside a video, so in-video (Direct) is always 0; they convert on the product page (Assisted).', 'godam' ) }
											>
												{ sprintf(
													/* translators: %s: in-video (Direct) add-to-cart count. */
													__( '%s in-video', 'godam' ),
													Number( item.added_to_cart_direct || 0 ).toLocaleString(),
												) }
											</span>
											{ ' · ' }
											{ sprintf(
												/* translators: %s: assisted (via product page) add-to-cart count. */
												__( '%s via product page', 'godam' ),
												Number( item.added_to_cart_assisted || 0 ).toLocaleString(),
											) }
										</p>
									</td>
									<td data-test-id="godam-top-products-revenue">
										{ hasRevenue( item ) ? (
											<>
												<span className="font-semibold">{ formatRevenue( item.revenue_minor, item.currency ) }</span>
												{ ' ' }
												<span className="text-zinc-400">{ ordersLabel( item ) }</span>
											</>
										) : (
											// null-not-zero: the service sends null revenue for a
											// product with no orders yet; say so rather than "0".
											<span className="text-zinc-400" data-test-id="godam-top-products-revenue-empty">{ __( 'No data', 'godam' ) }</span>
										) }
										{ /* Influenced revenue (third tier): a separate sub-line,
										    shown only when there is a real match, never added into
										    the product's own revenue above. */ }
										{ hasInfluenced( item ) && (
											<div
												className="mt-1 text-xs text-zinc-500"
												data-test-id="godam-top-products-influenced"
											>
												{ sprintf(
													/* translators: 1: formatted influenced revenue amount, 2: order count phrase (e.g. "3 orders"). */
													__( 'Influenced %1$s · %2$s', 'godam' ),
													formatRevenue( item.influenced_revenue_minor, item.influenced_currency ),
													influencedOrdersLabel( item ),
												) }
												{ item.influenced_provisional && (
													<span className="text-zinc-400">
														{ ' ' }
														{ __( '(provisional)', 'godam' ) }
													</span>
												) }
											</div>
										) }
									</td>
								</tr>
							) )
						) }

						{ ! isFetching && products.length === 0 && (
							<tr>
								<td colSpan="5">
									<div className="godam-empty-state">
										<p className="godam-empty-state__title">
											{ search
												? __( 'No products match your search', 'godam' )
												: __( 'No product activity yet', 'godam' ) }
										</p>
										<p className="godam-empty-state__hint">
											{ search
												? __( 'Try a different name, or clear the search to see all products.', 'godam' )
												: __( 'Once shoppers interact with products in your videos, your top products will show up here.', 'godam' ) }
										</p>
									</div>
								</td>
							</tr>
						) }
					</tbody>
				</table>
			</div>

			{ totalPages > 1 && (
				<nav className="godam-pagination" data-test-id="godam-top-products-pagination" aria-label={ __( 'Top products pagination', 'godam' ) }>
					<button
						className="godam-pagination__nav"
						data-test-id="godam-top-products-prev"
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
								data-test-id={ `godam-top-products-page-${ entry }` }
								aria-current={ entry === page ? 'page' : undefined }
								onClick={ () => setPage( entry ) }
							>
								{ entry }
							</button>
						),
					) }

					<button
						className="godam-pagination__nav"
						data-test-id="godam-top-products-next"
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

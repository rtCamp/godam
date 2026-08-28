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
import Tooltip from '../../analytics/Tooltip';
import DefaultThumbnail from '../../../assets/src/images/video-thumbnail-default.png';
import ExportBtn from '../../../assets/src/images/export.svg';
import chevronLeft from '../../../assets/src/images/chevron-left.svg';
import chevronRight from '../../../assets/src/images/chevron-right.svg';

const PER_PAGE = 10;
// The analytics microservice caps `limit` at 100 per request, so a full-set
// export pages through it 100 at a time rather than asking for everything at once.
const EXPORT_PAGE_SIZE = 100;

// block_source value -> human label for the Source chips. The Woo hotspot layer
// ships on two media, so the labels name the medium ('Video Woo Layer' vs 'Image
// Woo Layer') rather than a bare 'Woo Layer' / 'Image': an image can carry other
// layer types later, so the label says which layer, not just which medium. Unknown
// values fall back to the raw string.
const SOURCE_LABELS = {
	'woo-layer': __( 'Video Woo Layer', 'godam' ),
	'shoppable-video': __( 'Shoppable Video', 'godam' ),
	'reel-pop': __( 'Reel Pop', 'godam' ),
	'wc-product-gallery': __( 'Product Gallery', 'godam' ),
	'godam-image': __( 'Image Woo Layer', 'godam' ),
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
// ISO 4217 minor-unit exponents, kept in lockstep with the EMIT side
// (godam-for-woo Order_Revenue_Emission::currency_minor_unit_exponent). The store
// encodes revenue_minor with THIS table, and the analytics service stores the
// integer untouched, so the UI must decode with the SAME table. Intl/ICU's own
// currency data disagrees for a handful of codes (e.g. IQD 3 vs 0, AFN/ALL/MGA 2
// vs 0, CLF 2 vs 4), which would misplace the decimal by 10x-1000x.
const ZERO_DECIMAL_CURRENCIES = new Set( [
	'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
] );
const THREE_DECIMAL_CURRENCIES = new Set( [ 'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND' ] );

function currencyFractionDigits( currency ) {
	const code = String( currency || '' ).toUpperCase();
	if ( ZERO_DECIMAL_CURRENCIES.has( code ) ) {
		return 0;
	}
	if ( THREE_DECIMAL_CURRENCIES.has( code ) ) {
		return 3;
	}
	return 2;
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
	const digits = currencyFractionDigits( currency );
	const amount = revenueMajorUnits( minor, currency );
	try {
		// Force the fraction digits from our own table so the DISPLAY matches the
		// SCALE we decoded with; Intl's default digits for a currency can differ.
		return new Intl.NumberFormat( undefined, {
			style: 'currency',
			currency,
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		} ).format( amount );
	} catch ( e ) {
		// Missing/invalid ISO code (or no Intl currency support) - fall back to a
		// plain number so the cell never throws.
		return currency ? `${ amount.toFixed( digits ) } ${ currency }` : amount.toFixed( digits );
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

// Per-placement revenue breakdown (EASY WIN A): the placements (block_source)
// that drove this product's revenue, high-to-low, with revenue > 0. The service
// splits revenue by the block_source it already stores.
export const revenuePlacements = ( item ) =>
	Object.entries( item.revenue_by_placement || {} )
		.map( ( [ source, v ] ) => ( { source, revenue_minor: Number( v?.revenue_minor || 0 ) } ) )
		.filter( ( p ) => p.revenue_minor > 0 )
		.sort( ( a, b ) => b.revenue_minor - a.revenue_minor );

// Whether this row carries a Direct/Assisted revenue split. The service sends
// `revenue_direct_minor` / `revenue_assisted_minor` only for a WooCommerce store
// (a base currency) once a product has at least one attributed order line; an
// older service build, or a product with no orders, omits both. Treated as
// absent rather than zero so a row without the split shows nothing, never a
// misleading "£0 direct · £0 assisted".
export const hasRevenueTierSplit = ( item ) =>
	item.revenue_direct_minor !== undefined &&
	item.revenue_direct_minor !== null &&
	item.revenue_assisted_minor !== undefined &&
	item.revenue_assisted_minor !== null;

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
// Export column headers, matched 1:1 with buildCsvRow below, mirroring every
// column and sub-line shown in the on-screen Top Products table.
export const CSV_HEADERS = [
	__( 'Product', 'godam' ),
	__( 'Product ID', 'godam' ),
	__( 'Layers', 'godam' ),
	__( 'Videos', 'godam' ),
	__( 'Source', 'godam' ),
	__( 'Product Views', 'godam' ),
	__( 'Product Views Rate', 'godam' ),
	__( 'Add to Cart', 'godam' ),
	__( 'Add to Cart (in-video)', 'godam' ),
	__( 'Add to Cart (assisted)', 'godam' ),
	__( 'Revenue', 'godam' ),
	__( 'Revenue (direct)', 'godam' ),
	__( 'Revenue (assisted)', 'godam' ),
	__( 'Currency', 'godam' ),
	__( 'Orders', 'godam' ),
	__( 'Influenced Revenue', 'godam' ),
	__( 'Influenced Currency', 'godam' ),
	__( 'Influenced Orders', 'godam' ),
	__( 'Influenced Provisional', 'godam' ),
	__( 'Revenue by Placement', 'godam' ),
];

// One CSV cell per column, in CSV_HEADERS order. Mirrors every value the table
// renders so an export reconciles cell-for-cell with what the merchant sees.
export const buildCsvRow = ( item ) => {
	const placements = revenuePlacements( item );
	let influencedProvisional = '';
	if ( hasInfluenced( item ) ) {
		influencedProvisional = item.influenced_provisional ? __( 'Yes', 'godam' ) : __( 'No', 'godam' );
	}
	return [
		item.title || item.product_id,
		`ID: ${ item.product_id }`,
		Number( item.layer_count || 0 ),
		Number( item.video_count || 0 ),
		( item.sources || [] ).map( sourceLabel ).join( ' | ' ),
		Number( item.product_views || 0 ),
		Number( item.product_views_ctr || 0 ).toFixed( 2 ) + '%',
		Number( item.added_to_cart || 0 ),
		Number( item.added_to_cart_direct || 0 ),
		Number( item.added_to_cart_assisted || 0 ),
		hasRevenue( item ) ? formatRevenueNumeric( item.revenue_minor, item.currency ) : '',
		hasRevenueTierSplit( item ) ? formatRevenueNumeric( item.revenue_direct_minor, item.currency ) : '',
		hasRevenueTierSplit( item ) ? formatRevenueNumeric( item.revenue_assisted_minor, item.currency ) : '',
		hasRevenue( item ) ? ( item.currency || '' ) : '',
		hasRevenue( item ) ? Number( item.orders || 0 ) : '',
		hasInfluenced( item ) ? formatRevenueNumeric( item.influenced_revenue_minor, item.influenced_currency ) : '',
		hasInfluenced( item ) ? ( item.influenced_currency || '' ) : '',
		hasInfluenced( item ) ? Number( item.influenced_orders || 0 ) : '',
		influencedProvisional,
		// Per-placement split mirrors the on-screen sub-line: shown only when 2+
		// surfaces drove revenue (a single placement just repeats the total).
		placements.length >= 2
			? placements
				.map( ( pl ) => `${ sourceLabel( pl.source ) }: ${ formatRevenueNumeric( pl.revenue_minor, item.currency ) }` )
				.join( ' | ' )
			: '',
	];
};

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

	const handleExportCSV = async () => {
		setIsExporting( true );
		// try/finally so the button never sticks on "Exporting…" if anything below
		// (a fetch, Blob/URL creation, DOM ops) throws.
		try {
			const pageCount = Math.max( 1, Math.ceil( ( totalItems || products.length ) / EXPORT_PAGE_SIZE ) );

			// Fetch export pages with a small, BOUNDED concurrency rather than one
			// unbounded Promise.all: a large catalog (e.g. 50k products -> 500 pages)
			// would otherwise fire hundreds of simultaneous /top-products requests,
			// each opening an upstream HTTP call and risking a self-DoS of the proxy
			// and analytics service.
			const CONCURRENCY = 4;
			const pageProducts = new Array( pageCount );
			let failedPages = 0;
			let cursor = 0;
			const worker = async () => {
				while ( cursor < pageCount ) {
					const i = cursor++;
					try {
						const res = await fetchForExport( {
							siteUrl,
							page: i + 1,
							limit: EXPORT_PAGE_SIZE,
							search,
							startDate: dateRange.startDate,
							endDate: dateRange.endDate,
						} ).unwrap();
						pageProducts[ i ] = res?.products || [];
					} catch ( e ) {
						// Record the failure instead of silently dropping the page, so
						// the user is told the CSV is incomplete rather than getting a
						// short file with no indication.
						failedPages++;
						pageProducts[ i ] = [];
					}
				}
			};
			await Promise.all(
				Array.from( { length: Math.min( CONCURRENCY, pageCount ) }, () => worker() ),
			);

			const fetched = pageProducts.flat();
			const exportProducts = fetched.length ? fetched : products;

			const csvContent = [ CSV_HEADERS, ...exportProducts.map( buildCsvRow ) ]
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

			if ( failedPages > 0 ) {
				// eslint-disable-next-line no-alert
				window.alert(
					sprintf(
						/* translators: %d: number of export pages that failed to load. */
						__( 'Export is incomplete: %d page(s) could not be loaded, so some products are missing from the CSV.', 'godam' ),
						failedPages,
					),
				);
			}
		} finally {
			setIsExporting( false );
		}
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
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Source', 'godam' ) }
									<Tooltip
										text={ __(
											'Where in your videos this product appeared: a Woo layer, a shoppable video, a reel pop, and so on.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Product Views', 'godam' ) }
									<Tooltip
										text={ __(
											'How many times shoppers opened this product from a video, with the click-through rate beside it (product opens / times the product was shown).',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Add to Cart', 'godam' ) }
									<Tooltip
										text={ __(
											'How many times the product was added to cart from a video, with the add-to-cart rate. In-video means added inside the player; via product page means added after clicking through.',
											'godam',
										) }
									/>
								</span>
							</th>
							<th scope="col">
								<span className="inline-flex items-center gap-1">
									{ __( 'Revenue', 'godam' ) }
									<Tooltip
										text={ __(
											'Order value traced to this product\'s videos, in the store\'s base currency, before refunds. Direct means added to cart in-video; Assisted means bought after clicking through to the product page.',
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
										{ /* Direct/Assisted split of this product's revenue,
										    mirroring the dashboard revenue card. Shown only when
										    the service sent the split (WooCommerce store, product
										    with orders); never a "£0 direct · £0 assisted". */ }
										{ hasRevenue( item ) && hasRevenueTierSplit( item ) && (
											<div
												className="mt-1 text-xs text-zinc-500"
												data-test-id="godam-top-products-tier-split"
											>
												{ sprintf(
													/* translators: 1: direct (in-video) revenue amount, 2: assisted (via product page) revenue amount. */
													__( '%1$s direct · %2$s assisted', 'godam' ),
													formatRevenue( item.revenue_direct_minor, item.currency ),
													formatRevenue( item.revenue_assisted_minor, item.currency ),
												) }
											</div>
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
										{ /* Per-placement revenue split — only when 2+ surfaces
										    drove revenue (a single placement just repeats the
										    total above). */ }
										{ hasRevenue( item ) && revenuePlacements( item ).length >= 2 && (
											<div
												className="mt-1 text-xs text-zinc-400"
												data-test-id="godam-top-products-placement-split"
											>
												{ revenuePlacements( item ).map( ( p, i ) => (
													<span key={ p.source }>
														{ i > 0 && ' · ' }
														{ sourceLabel( p.source ) }{ ' ' }
														{ formatRevenue( p.revenue_minor, item.currency ) }
													</span>
												) ) }
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

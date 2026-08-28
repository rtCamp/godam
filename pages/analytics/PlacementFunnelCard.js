/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useFetchPlacementFunnelsQuery } from '../dashboard/redux/api/dashboardAnalyticsApi';

const fmt = ( n ) => Number( n || 0 ).toLocaleString();
const pct = ( n ) => `${ Number( n || 0 ).toFixed( 1 ) }%`;

/**
 * One Played / Added / Purchased number box.
 *
 * @param {Object} props
 * @param {string} props.label The stat name.
 * @param {number} props.count The count.
 * @param {string} [props.sub] A sub-label (e.g. the % of players).
 */
function StatBox( { label, count, sub } ) {
	return (
		<div className="flex-1 min-w-[120px] border border-[#e4e4e7] rounded-lg px-4 py-3 bg-white">
			<div className="text-[13px] text-zinc-500 mb-1">{ label }</div>
			<div className="flex items-baseline gap-2">
				<span className="text-[26px] font-bold text-[#1e1e1e] tabular-nums leading-none">{ fmt( count ) }</span>
				{ sub && <span className="text-[13px] text-zinc-500">{ sub }</span> }
			</div>
		</div>
	);
}

/**
 * One placement's funnel: a header (name, reach, play-to-purchase rate) and the
 * three Played -> Added -> Purchased number boxes.
 *
 * @param {Object} props
 * @param {Object} props.placement A placement_funnels entry.
 */
function PlacementRow( { placement } ) {
	const reach = [];
	if ( placement.units !== null && placement.units !== undefined && placement.unit_label ) {
		reach.push( `${ fmt( placement.units ) } ${ placement.unit_label }` );
	}
	reach.push( sprintf(
		/* translators: %s: number of videos. */
		_n( '%s video', '%s videos', placement.videos, 'godam' ),
		fmt( placement.videos ),
	) );

	return (
		<div
			className="border border-[#e4e4e7] rounded-xl p-4 bg-[#fbfbfc]"
			data-test-id={ `godam-placement-funnel-${ placement.block_source }` }
		>
			<div className="flex items-center justify-between flex-wrap gap-2 mb-3">
				<div className="flex items-baseline gap-2.5">
					<span className="text-[15px] font-semibold text-[#1e1e1e]">{ placement.label }</span>
					<span className="text-[13px] text-zinc-500">{ reach.join( ' · ' ) }</span>
				</div>
				<span className="text-[13px] text-zinc-600">
					{ sprintf(
						/* translators: %s: play-to-purchase conversion rate. */
						__( 'Play to purchase %s', 'godam' ),
						pct( placement.purchase_rate ),
					) }
				</span>
			</div>
			<div className="flex flex-wrap gap-3">
				<StatBox label={ __( 'Played', 'godam' ) } count={ placement.played } />
				<StatBox label={ __( 'Added to cart', 'godam' ) } count={ placement.added } sub={ pct( placement.add_rate ) } />
				<StatBox label={ __( 'Purchased', 'godam' ) } count={ placement.purchased } sub={ pct( placement.purchase_rate ) } />
			</div>
		</div>
	);
}

/**
 * Funnel by placement.
 *
 * A Play-to-Cart-to-Purchase funnel broken out per commerce placement (Shoppable
 * Video block / Woo hotspot layer / Reel Pop), so a strong placement is not
 * hidden by a weak one in the account-wide average. Fetches its own data (the
 * per-placement queries are heavier, so they don't block the main dashboard).
 *
 * @param {Object} props
 * @param {string} props.siteUrl     The site URL.
 * @param {string} [props.startDate] ISO range start.
 * @param {string} [props.endDate]   ISO range end.
 * @param {string} [props.dataLabel] The active range label (e.g. "Last 30 days").
 */
export default function PlacementFunnelCard( { siteUrl, startDate, endDate, dataLabel } ) {
	const { data, isFetching } = useFetchPlacementFunnelsQuery( { siteUrl, startDate, endDate } );
	const placements = Array.isArray( data ) ? data : [];
	// A microservice error comes back as an { error, message } object, which is
	// NOT the same as "no placement activity" -- surface it rather than hiding.
	const isError = !! ( data && ! Array.isArray( data ) && data.error );

	// Once loaded, a store with genuinely no placement activity shows nothing; an
	// error is not "empty", so keep the card to show the message below.
	if ( ! isFetching && ! isError && placements.length === 0 ) {
		return null;
	}

	let body;
	if ( isError ) {
		body = (
			<div className="text-[13px] text-[#B91C1C] py-6 text-center" data-test-id="godam-placement-funnel-error">
				{ __( 'Could not load placement data. Please try again.', 'godam' ) }
			</div>
		);
	} else if ( isFetching && placements.length === 0 ) {
		body = (
			<div className="text-[13px] text-zinc-400 py-6 text-center" data-test-id="godam-placement-funnel-loading">
				{ __( 'Loading placements…', 'godam' ) }
			</div>
		);
	} else {
		body = (
			<div className="flex flex-col gap-4">
				{ placements.map( ( placement ) => (
					<PlacementRow key={ placement.block_source } placement={ placement } />
				) ) }
			</div>
		);
	}

	return (
		<div className="godam-card godam-placement-funnel-card" data-test-id="godam-placement-funnel-card">
			<div className="godam-card__head">
				<div className="flex items-center gap-2.5">
					<h2>{ __( 'Funnel by placement', 'godam' ) }</h2>
					<span className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">Woo</span>
					<span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] tracking-wide">{ __( 'NEW', 'godam' ) }</span>
				</div>
				{ dataLabel && (
					<span className="text-[13px] text-[#50575e] border border-[#e2e4e7] rounded-md px-3 py-1">{ dataLabel }</span>
				) }
			</div>

			<p className="text-[13px] text-zinc-500 -mt-1 mb-5">
				{ __( 'Different placements do different jobs, so averaging them hides both winners and losers.', 'godam' ) }
			</p>

			{ body }
		</div>
	);
}

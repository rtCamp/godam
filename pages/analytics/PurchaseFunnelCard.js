/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

// Direct = added in-video (dark blue); Assisted = clicked out then added (light
// blue); the rest of each track stays grey ("did not reach this stage").
const COLOR_DIRECT = '#2563eb';
const COLOR_ASSISTED = '#93c5fd';

const fmt = ( n ) => Number( n || 0 ).toLocaleString();
const pct = ( n ) => `${ Number( n || 0 ).toFixed( 1 ) }%`;

/**
 * A single funnel row: label + descriptor on the left, a proportional bar in a
 * grey track (split into coloured segments), and the count + sub-label on the right.
 *
 * @param {Object} props
 * @param {string} props.label      Stage name.
 * @param {string} props.descriptor Grey sub-label under the stage name.
 * @param {Array}  props.segments   [{ color, frac }] left-aligned bar segments (frac of the track).
 * @param {number} props.count      The stage count.
 * @param {string} props.rightSub   The sub-label under the count (e.g. "4.5% of players").
 * @param {string} props.testId     data-test-id for the bar.
 */
function FunnelRow( { label, descriptor, segments, count, rightSub, testId } ) {
	return (
		<div className="grid grid-cols-[minmax(150px,210px)_1fr_minmax(88px,auto)] items-center gap-x-5">
			<div>
				<div className="text-[15px] font-semibold text-[#1e1e1e] leading-tight">{ label }</div>
				<div className="text-[13px] text-zinc-500 leading-tight">{ descriptor }</div>
			</div>
			<div className="h-14 rounded-md overflow-hidden flex" style={ { background: '#eef0f3' } } data-test-id={ testId }>
				{ segments.map( ( seg, i ) => (
					<div
						key={ i }
						style={ { width: `${ Math.max( 0, Math.min( 100, seg.frac * 100 ) ) }%`, background: seg.color } }
					/>
				) ) }
			</div>
			<div className="text-right">
				<div className="text-[28px] font-bold text-[#1e1e1e] leading-none tabular-nums">{ fmt( count ) }</div>
				<div className="text-[13px] text-zinc-500 mt-1">{ rightSub }</div>
			</div>
		</div>
	);
}

/**
 * The drop-off annotation between two stages: "X% advanced" plus how many were
 * lost, indented to sit under the bar.
 *
 * @param {Object}  props
 * @param {string}  props.advanced        The "X% advanced" percentage string.
 * @param {string}  props.lostLabel       Text for how many were lost at this step.
 * @param {boolean} [props.lostIsWarning] Render the lost label as a red pill.
 */
function DropRow( { advanced, lostLabel, lostIsWarning } ) {
	return (
		<div className="grid grid-cols-[minmax(150px,210px)_1fr_minmax(88px,auto)] gap-x-5">
			<div />
			<div className="flex items-center gap-3 py-2 text-[13px]">
				<span className="font-semibold text-[#1e1e1e]">
					{ sprintf(
						/* translators: %s: percentage of visitors that advanced to the next stage. */
						__( '↓ %s advanced', 'godam' ),
						advanced,
					) }
				</span>
				{ lostIsWarning ? (
					<span className="text-[13px] font-semibold text-[#dc2626] bg-[#fef2f2] rounded-md px-2 py-0.5">{ lostLabel }</span>
				) : (
					<span className="text-zinc-500">{ lostLabel }</span>
				) }
			</div>
			<div />
		</div>
	);
}

/**
 * Play-to-Cart-to-Purchase funnel.
 *
 * Three distinct-visitor stages — Played a video -> Added to cart -> Purchased.
 * Each bar is left-aligned in a grey track and sized to its share of players;
 * the "Added to cart" bar is split into Direct (added in-video) and Assisted
 * (clicked out then added). A "still counting" note appears when the backend
 * flags the range as recent enough that purchase attribution is still settling.
 *
 * @param {Object} props
 * @param {Object} [props.funnel]    The video_funnel payload { stages, still_counting }.
 * @param {string} [props.dataLabel] The active range label (e.g. "Last 30 days").
 * @param {string} [props.scope]     'account' (default) or 'video' — sets the top descriptor + subtitle.
 */
export default function PurchaseFunnelCard( { funnel, dataLabel, scope = 'account' } ) {
	// Render nothing when the payload is absent, so the card never asserts an
	// empty funnel for "metric unavailable".
	if ( ! funnel || ! Array.isArray( funnel.stages ) || funnel.stages.length < 3 ) {
		return null;
	}

	const byKey = Object.fromEntries( funnel.stages.map( ( s ) => [ s.key, s ] ) );
	const played = Number( byKey.played?.count || 0 );
	const carts = Number( byKey.added_to_cart?.count || 0 );
	const direct = Number( byKey.added_to_cart?.direct || 0 );
	const purchased = Number( byKey.purchased?.count || 0 );

	// Bar segments are fractions of the track, denominated by players (the top).
	// Clamp to [0,1] so a stale-service deploy skew can never invert the funnel
	// (the backend range_video_funnel already guarantees purchased <= added <= played).
	const frac = ( n ) => ( played > 0 ? Math.max( 0, Math.min( 1, n / played ) ) : 0 );
	// Assisted-only = added but not in-video, so direct + assistedOnly = carts.
	const assistedOnly = Math.max( 0, carts - direct );

	// Clamp to 100% like buyAdvanced below: a stale-service skew (carts > played)
	// must not print an above-100% "advanced" annotation.
	const cartAdvanced = played > 0 ? pct( Math.min( ( carts / played ) * 100, 100 ) ) : pct( 0 );
	// cart -> purchase conversion, drop annotation only; clamp to 100%.
	const buyAdvanced = carts > 0 ? pct( Math.min( ( purchased / carts ) * 100, 100 ) ) : pct( 0 );
	// purchased as a share OF PLAYERS (bar + server stage rate denominator),
	// for the Purchased row's "of players" subtitle — NOT purchased/carts.
	const buyShare = played > 0 ? pct( ( purchased / played ) * 100 ) : pct( 0 );
	const didNotAdd = Math.max( 0, played - carts );
	const abandoned = Math.max( 0, carts - purchased );

	const topDescriptor = scope === 'video'
		? __( 'this video', 'godam' )
		: __( 'any GoDAM video', 'godam' );
	const subtitle = scope === 'video'
		? __( 'Distinct viewers of this video. Covers Direct and Assisted.', 'godam' )
		: __( 'Distinct visitors, counted across page visits. Covers Direct and Assisted.', 'godam' );

	return (
		<div className="godam-card godam-funnel-card" data-test-id="godam-purchase-funnel-card">
			<div className="godam-card__head">
				<div className="flex items-center gap-2.5">
					<h2>{ __( 'Purchase Funnel', 'godam' ) }</h2>
					<span className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">Woo</span>
					<span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] tracking-wide">{ __( 'NEW', 'godam' ) }</span>
				</div>
				{ dataLabel && (
					<span className="text-[13px] text-[#50575e] border border-[#e2e4e7] rounded-md px-3 py-1">{ dataLabel }</span>
				) }
			</div>

			<p className="text-[13px] text-zinc-500 -mt-1 mb-5">{ subtitle }</p>

			<div className="flex flex-col gap-0.5" data-test-id="godam-purchase-funnel">
				<FunnelRow
					label={ __( 'Played a video', 'godam' ) }
					descriptor={ topDescriptor }
					segments={ played > 0 ? [ { color: COLOR_DIRECT, frac: 1 } ] : [] }
					count={ played }
					rightSub={ __( 'visitors', 'godam' ) }
					testId="godam-purchase-funnel-bar-played"
				/>
				<DropRow
					advanced={ cartAdvanced }
					lostLabel={ sprintf(
						/* translators: %s: number of visitors who did not add to cart. */
						__( '%s did not add to cart', 'godam' ),
						fmt( didNotAdd ),
					) }
				/>
				<FunnelRow
					label={ __( 'Added to cart', 'godam' ) }
					descriptor={ __( 'in-video or after clicking out', 'godam' ) }
					segments={ [
						{ color: COLOR_DIRECT, frac: frac( direct ) },
						{ color: COLOR_ASSISTED, frac: frac( assistedOnly ) },
					] }
					count={ carts }
					rightSub={ sprintf(
						/* translators: %s: percentage of players. */
						__( '%s of players', 'godam' ),
						cartAdvanced,
					) }
					testId="godam-purchase-funnel-bar-added_to_cart"
				/>
				<DropRow
					advanced={ buyAdvanced }
					lostIsWarning
					lostLabel={ sprintf(
						/* translators: %s: number of visitors who added to cart but did not buy. */
						__( '%s abandoned after adding', 'godam' ),
						fmt( abandoned ),
					) }
				/>
				<FunnelRow
					label={ __( 'Purchased', 'godam' ) }
					descriptor={ __( 'of those who added', 'godam' ) }
					segments={ purchased > 0 ? [ { color: COLOR_DIRECT, frac: frac( purchased ) } ] : [] }
					count={ purchased }
					rightSub={ sprintf(
						/* translators: %s: percentage of players. */
						__( '%s of players', 'godam' ),
						buyShare,
					) }
					testId="godam-purchase-funnel-bar-purchased"
				/>
			</div>

			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 pt-4 border-t border-[#eef0f3] text-[13px] text-zinc-600">
				<span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={ { background: COLOR_DIRECT } } />{ __( 'Direct, added to cart in-video', 'godam' ) }</span>
				<span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={ { background: COLOR_ASSISTED } } />{ __( 'Assisted, clicked out then bought', 'godam' ) }</span>
				<span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-zinc-300" style={ { background: '#eef0f3' } } />{ __( 'did not reach this stage', 'godam' ) }</span>
			</div>

			{ funnel.still_counting && (
				<div
					className="godam-funnel__note mt-4 inline-flex items-center gap-2 text-[13px] text-[#0a7f2e] bg-[#0a7f2e]/10 border border-[#0a7f2e]/20 rounded-lg px-3 py-2"
					data-test-id="godam-purchase-funnel-still-counting"
				>
					<span className="w-2 h-2 rounded-full bg-[#0a7f2e]" aria-hidden="true" />
					{ sprintf(
						/* translators: %s: the selected date range label. */
						__( 'Still counting — purchases for %s keep settling for up to 30 days.', 'godam' ),
						dataLabel || __( 'this range', 'godam' ),
					) }
				</div>
			) }
		</div>
	);
}

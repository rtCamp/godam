/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

const STAGE_LABELS = {
	viewers: __( 'Viewers', 'godam' ),
	added_to_cart: __( 'Added to cart', 'godam' ),
	purchased: __( 'Purchased', 'godam' ),
};

// Woo purple at the top of the funnel, easing to GoDAM pink at the purchase end.
const BAR_BACKGROUNDS = {
	viewers: 'linear-gradient(90deg, #8b5fc0, #7f54b3)',
	added_to_cart: 'linear-gradient(90deg, #9a6fca, #8a5cc0)',
	purchased: 'linear-gradient(90deg, #ab3a6c, #95305d)',
};

/**
 * Per-video Purchase Funnel.
 *
 * The three distinct-visitor stages a shopper passes through — Viewers -> Added
 * to cart -> Purchased — each bar proportional to its share of viewers, with the
 * drop-off between stages called out. A "still counting" note appears when the
 * selected range is recent enough that purchase attribution is still settling
 * (the backend decides that; the card only toggles the note).
 *
 * @param {Object} props
 * @param {Object} [props.funnel]    The video_funnel payload { stages, still_counting }.
 * @param {string} [props.dataLabel] The active range label (e.g. "Last 7 days").
 */
export default function PurchaseFunnelCard( { funnel, dataLabel } ) {
	// Render nothing when the payload is absent (an analytics service that predates
	// the funnel read), so the card never asserts a misleading empty funnel.
	if ( ! funnel || ! Array.isArray( funnel.stages ) || funnel.stages.length === 0 ) {
		return null;
	}

	const { stages } = funnel;

	return (
		<div className="godam-card godam-funnel-card" data-test-id="godam-purchase-funnel-card">
			<div className="godam-card__head">
				<h2>{ __( 'Purchase Funnel', 'godam' ) }</h2>
				<span className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">Woo</span>
			</div>

			<div className="godam-funnel flex flex-col" data-test-id="godam-purchase-funnel">
				{ stages.map( ( stage, i ) => {
					const count = Number( stage.count || 0 );
					const rate = Math.max( 0, Math.min( 100, Number( stage.rate || 0 ) ) );
					const prevCount = i > 0 ? Number( stages[ i - 1 ].count || 0 ) : null;
					const drop = prevCount && prevCount > 0
						? Math.round( ( 1 - ( count / prevCount ) ) * 100 )
						: null;
					// Keep a thin sliver visible so a 0% stage still reads as a bar.
					const barWidth = Math.max( rate, count > 0 ? 6 : 2 );

					return (
						<div key={ stage.key } className="godam-funnel__stage">
							{ i > 0 && (
								<div
									className="godam-funnel__drop text-[11px] text-zinc-400 text-center py-1.5"
									data-test-id="godam-purchase-funnel-drop"
								>
									{ drop !== null && drop > 0
										? sprintf(
											/* translators: %d: drop-off percentage between funnel stages. */
											__( '▼ %d%% drop-off', 'godam' ),
											drop,
										)
										: __( 'no drop-off', 'godam' ) }
								</div>
							) }

							<div className="flex items-baseline justify-between mb-1.5">
								<span className="text-sm font-semibold text-[#1e1e1e]">
									{ STAGE_LABELS[ stage.key ] || stage.key }
								</span>
								<span className="text-xs text-zinc-500" data-test-id={ `godam-purchase-funnel-share-${ stage.key }` }>
									{ sprintf(
										/* translators: 1: visitor count, 2: percentage of viewers. */
										__( '%1$s · %2$s%% of viewers', 'godam' ),
										count.toLocaleString(),
										rate.toFixed( rate % 1 ? 1 : 0 ),
									) }
								</span>
							</div>

							<div className="godam-funnel__track w-full flex justify-center">
								<div
									className="godam-funnel__bar h-12 rounded-md flex items-center justify-center text-white font-bold text-lg"
									style={ { width: `${ barWidth }%`, background: BAR_BACKGROUNDS[ stage.key ] || '#7f54b3' } }
									data-test-id={ `godam-purchase-funnel-bar-${ stage.key }` }
								>
									{ count.toLocaleString() }
								</div>
							</div>
						</div>
					);
				} ) }
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

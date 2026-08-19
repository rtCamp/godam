/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Video-to-Cart KPI card for the dashboard Insights row.
 *
 * The count leads (distinct people who played a video and then added a product to
 * cart); the rate (share of viewers) and the Direct/Assisted split support it —
 * mirroring the Top Products "Add to Cart" column.
 *
 * @param {Object} props
 * @param {Object} [props.videoToCart] The video_to_cart payload { carts, rate, direct, assisted, played }.
 * @param {string} [props.dataLabel]   The active range label (e.g. "All time").
 */
export default function VideoToCartCard( { videoToCart, dataLabel } ) {
	// Render nothing when the payload is entirely absent (an analytics service that
	// predates the video_to_cart roll-up), so the card never asserts a misleading
	// "0 carts" for "metric unavailable". A present payload with zero carts is a
	// real value and still renders.
	if ( videoToCart === null || videoToCart === undefined ) {
		return null;
	}

	const vtc = videoToCart || {};
	const carts = Number( vtc.carts || 0 );
	const rate = Number( vtc.rate || 0 );
	const direct = Number( vtc.direct || 0 );
	const assisted = Number( vtc.assisted || 0 );

	return (
		<div
			className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
			data-test-id="godam-video-to-cart-card"
		>
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-video-to-cart-label">{ __( 'Video to Cart', 'godam' ) }</p>
						<Tooltip
							text={ __(
								'Distinct people who played a video and then added a product to cart — inside the video (in-video) or on the product page after clicking through (via product page).',
								'godam',
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-3">
						<p className="min-w-[90px] single-metrics-value" data-test-id="godam-video-to-cart-value">{ carts.toLocaleString() }</p>
						<div className="flex flex-col gap-1">
							<span className="text-xs text-zinc-500">
								{ sprintf(
									/* translators: %s: percentage of viewers who added to cart. */
									__( '%s%% of viewers', 'godam' ),
									rate.toFixed( 1 ),
								) }
							</span>
							{ /* Two stacked lines rather than one nowrap line: the combined
							    "N in-video · M via product page" overflowed and clipped in
							    the narrow Insights card. Each line is short, so it never
							    clips at any card width. */ }
							<span className="text-[11px] text-zinc-400">
								{ sprintf(
									/* translators: %s: in-video (Direct) add-to-cart count. */
									__( '%s in-video', 'godam' ),
									direct.toLocaleString(),
								) }
							</span>
							<span className="text-[11px] text-zinc-400">
								{ sprintf(
									/* translators: %s: via-product-page (Assisted) add-to-cart count. */
									__( '%s via product page', 'godam' ),
									assisted.toLocaleString(),
								) }
							</span>
							<span className="text-[11px] text-zinc-400">{ dataLabel || __( 'All time', 'godam' ) }</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

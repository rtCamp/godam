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
 * Shows the count of distinct people who played a video and then added a product
 * to cart, plus the rate (share of viewers). Each person is counted once. The
 * in-video vs via-product-page split lives in the Top Products table, where those
 * counts add up cleanly.
 *
 * @param {Object} props
 * @param {Object} [props.videoToCart] The video_to_cart payload (uses carts + rate).
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

	return (
		<div
			className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
			data-test-id="godam-video-to-cart-card"
		>
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-video-to-cart-label">{ __( 'Video to Cart', 'godam' ) }</p>
						{ /* WooCommerce badge (per Figma): signals the metric comes from
						    the WooCommerce add-on / store data. */ }
						<span
							className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]"
							data-test-id="godam-video-to-cart-woo-tag"
						>
							Woo
						</span>
						<Tooltip
							text={ __(
								'Distinct people who played a video and then added a product to cart. Each person is counted once.',
								'godam',
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-2">
						{ /* Count + rate only. The in-video vs via-product-page split is
						    intentionally not shown here: the count is deduped per person, so
						    a buyer who added both ways would make the split read higher than
						    the count. That split lives in the Top Products table, where the
						    numbers sum. */ }
						<div className="flex flex-row items-baseline gap-2">
							<p className="single-metrics-value" data-test-id="godam-video-to-cart-value">{ carts.toLocaleString() }</p>
							<span className="text-xs text-zinc-500">
								{ sprintf(
									/* translators: %s: percentage of viewers who played and then added to cart. */
									__( 'carts from video, %s%% of viewers who played', 'godam' ),
									rate.toFixed( 1 ),
								) }
							</span>
						</div>
						<span className="text-[11px] text-zinc-400">{ dataLabel || __( 'All time', 'godam' ) }</span>
					</div>
				</div>
			</div>
		</div>
	);
}

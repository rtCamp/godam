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
								'Distinct people who played a video and then added a product to cart — inside the video (in-video) or on the product page after clicking through (via product page).',
								'godam',
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-2">
						{ /* Count + rate on one row, and the direct/assisted split on one
						    line: keeps the card as short as the sibling cards now that the
						    four-card row is wide enough for it (was stacked to avoid a clip
						    in the older five-card row). */ }
						<div className="flex flex-row items-baseline gap-2">
							<p className="single-metrics-value" data-test-id="godam-video-to-cart-value">{ carts.toLocaleString() }</p>
							<span className="text-xs text-zinc-500 whitespace-nowrap">
								{ sprintf(
									/* translators: %s: percentage of viewers who added to cart. */
									__( '%s%% of viewers', 'godam' ),
									rate.toFixed( 1 ),
								) }
							</span>
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-[11px] text-zinc-400">
								{ sprintf(
									/* translators: 1: in-video (Direct) adds, 2: via-product-page (Assisted) adds. */
									__( '%1$s in-video · %2$s via product page', 'godam' ),
									direct.toLocaleString(),
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

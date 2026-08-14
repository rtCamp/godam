/**
 * Internal dependencies
 */
import Tooltip from '../../analytics/Tooltip';

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
	const vtc = videoToCart || {};
	const carts = Number( vtc.carts || 0 );
	const rate = Number( vtc.rate || 0 );
	const direct = Number( vtc.direct || 0 );
	const assisted = Number( vtc.assisted || 0 );

	return (
		<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full">
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap">{ __( 'Video to Cart', 'godam' ) }</p>
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
						<p className="min-w-[90px] single-metrics-value">{ carts.toLocaleString() }</p>
						<div className="flex flex-col gap-1">
							<span className="text-xs text-zinc-500">
								{ sprintf(
									/* translators: %s: percentage of viewers who added to cart. */
									__( '%s%% of viewers', 'godam' ),
									rate.toFixed( 1 ),
								) }
							</span>
							<span className="text-[11px] text-zinc-400 whitespace-nowrap">
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

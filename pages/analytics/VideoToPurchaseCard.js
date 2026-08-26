/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Video-to-Purchase KPI card for the Insights row.
 *
 * The purchase sibling of VideoToCartCard: shows the count of distinct people who
 * played a video and then bought an attributed product, plus the rate (share of
 * viewers). Each person is counted once, whatever they bought. Sits beside Video
 * to Cart and Revenue so the cart rate and the purchase rate read the same way.
 *
 * @param {Object} props
 * @param {Object} [props.videoToPurchase] The video_to_purchase payload (uses purchases + rate).
 * @param {string} [props.dataLabel]       The active range label (e.g. "All time").
 */
export default function VideoToPurchaseCard( { videoToPurchase, dataLabel } ) {
	// Render nothing when the payload is entirely absent (an analytics service that
	// predates the video_to_purchase read), so the card never asserts a misleading
	// "0 purchases" for "metric unavailable". A present payload with zero purchases
	// is a real value and still renders.
	if ( videoToPurchase === null || videoToPurchase === undefined ) {
		return null;
	}

	const vtp = videoToPurchase || {};
	const purchases = Number( vtp.purchases || 0 );
	const rate = Number( vtp.rate || 0 );

	return (
		<div
			className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
			data-test-id="godam-video-to-purchase-card"
		>
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-video-to-purchase-label">{ __( 'Video to Purchase', 'godam' ) }</p>
						{ /* WooCommerce badge (per Figma): signals the metric comes from
						    the WooCommerce add-on / store data. */ }
						<span
							className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]"
							data-test-id="godam-video-to-purchase-woo-tag"
						>
							Woo
						</span>
						<Tooltip
							text={ __(
								'Distinct people who played a video and then bought an attributed product. Each person is counted once.',
								'godam',
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-2">
						<div className="flex flex-row items-baseline gap-2">
							<p className="single-metrics-value" data-test-id="godam-video-to-purchase-value">{ purchases.toLocaleString() }</p>
							<span className="text-xs text-zinc-500">
								{ sprintf(
									/* translators: %s: percentage of viewers who played and then purchased. */
									__( 'orders from video, %s%% of viewers who played', 'godam' ),
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

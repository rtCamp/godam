/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { check } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import Tooltip from '../../analytics/Tooltip';
import { useFetchGa4CountsQuery } from '../redux/api/dashboardAnalyticsApi';

/**
 * Settings link back to the General Settings tab, where the actual
 * `enable_gtm_tracking` toggle lives (this widget never renders its own
 * toggle). Reuses the same `admin.php?page=rtgodam_settings` URL the
 * dashboard already localizes as `window.videoData.adminUrl` — just pointed
 * at the "general-settings" tab (App.js reads the URL hash to pick the
 * active tab) instead of whatever tab that constant happens to hardcode.
 *
 * @return {string} URL to the General Settings tab.
 */
const getGeneralSettingsUrl = () => {
	const base = ( window.videoData?.adminUrl || 'admin.php?page=rtgodam_settings' ).split( '#' )[ 0 ];
	return `${ base }#general-settings`;
};

/**
 * GA4 connection widget for the dashboard.
 *
 * Confirms whether GoDAM is pushing `add_to_cart`/`purchase` GA4 ecommerce
 * events (tagged with video context) into the store's own `window.dataLayer`
 * — the actual push happens in the godam-for-woo add-on; this widget only
 * surfaces the on/off state and, once on, the running counts.
 *
 * Reads `enable_gtm_tracking` directly off `window.godamSettings.enableGTMTracking`
 * (already localized to the page) rather than round-tripping through an API call.
 */
const GA4ConnectionWidget = () => {
	const isConnected = !! window.godamSettings?.enableGTMTracking;

	const { data } = useFetchGa4CountsQuery( undefined, { skip: ! isConnected } );

	const tooltipText = __(
		'add_to_cart and purchase are GA4’s default ecommerce events, already tracked by many stores.',
		'godam',
	);

	if ( ! isConnected ) {
		return (
			<div
				className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
				data-test-id="godam-ga4-connection-widget"
			>
				<div className="analytics-single-info w-full">
					<div className="flex justify-between items-start flex-row w-full gap-2">
						<div className="analytics-info-heading">
							<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-ga4-connection-label">
								{ __( 'Send add_to_cart and purchase to your GA4', 'godam' ) }
							</p>
							<Tooltip text={ tooltipText } />
						</div>
					</div>
					<div className="flex flex-row justify-between gap-2 items-end">
						<a
							className="godam-button"
							href={ getGeneralSettingsUrl() }
							data-test-id="godam-ga4-connection-enable-link"
						>
							{ __( 'Enable', 'godam' ) }
						</a>
					</div>
				</div>
			</div>
		);
	}

	const addToCartCount = Number( data?.addToCartCount || 0 );
	const purchaseCount = Number( data?.purchaseCount || 0 );

	return (
		<div
			className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
			data-test-id="godam-ga4-connection-widget"
		>
			<div className="analytics-single-info w-full">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading flex items-center gap-1">
						<span
							className="flex items-center gap-1 text-xs font-semibold text-emerald-700"
							data-test-id="godam-ga4-connection-status"
						>
							<Icon icon={ check } size={ 14 } />
							{ __( 'Sending to GA4', 'godam' ) }
						</span>
						<Tooltip text={ tooltipText } />
					</div>
				</div>
				<div className="flex flex-row justify-between gap-4 items-end">
					<div className="flex flex-row gap-6">
						<div className="flex flex-col">
							<p className="single-metrics-value" data-test-id="godam-ga4-connection-add-to-cart-count">
								{ addToCartCount.toLocaleString() }
							</p>
							<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'add_to_cart', 'godam' ) }</span>
						</div>
						<div className="flex flex-col">
							<p className="single-metrics-value" data-test-id="godam-ga4-connection-purchase-count">
								{ purchaseCount.toLocaleString() }
							</p>
							<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'purchase', 'godam' ) }</span>
						</div>
					</div>
					<a
						className="godam-button"
						href={ getGeneralSettingsUrl() }
						data-test-id="godam-ga4-connection-manage-link"
					>
						{ __( 'Manage', 'godam' ) }
					</a>
				</div>
			</div>
		</div>
	);
};

export default GA4ConnectionWidget;

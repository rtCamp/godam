/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { check, warning } from '@wordpress/icons';

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
 * Friendly names for `source_type` values the REST response may report, used
 * when another GA4 integration is active and GoDAM is standing down. Falls
 * back to a generic phrase for unrecognized or empty values.
 */
const KNOWN_SOURCE_LABELS = {
	custom: __( 'a custom GA4 integration', 'godam' ),
	manual: __( 'a manually configured GA4 integration', 'godam' ),
};

/**
 * Human-readable label for a `source_type` value.
 *
 * @param {string} sourceType Raw `source_type` from the REST response.
 * @return {string} Friendly description of the other GA4 source.
 */
const getSourceLabel = ( sourceType ) => {
	if ( ! sourceType ) {
		return __( 'another GA4 integration', 'godam' );
	}

	if ( KNOWN_SOURCE_LABELS[ sourceType ] ) {
		return KNOWN_SOURCE_LABELS[ sourceType ];
	}

	return sourceType;
};

const tooltipText = __(
	'Add To Cart and Purchase are GA4’s default ecommerce events, already tracked by many stores.',
	'godam',
);

/**
 * Shared outer wrapper for every state of the widget.
 *
 * @param {Object} props          Props.
 * @param {Object} props.children Widget content.
 * @return {JSX.Element} Wrapper element.
 */
const WidgetShell = ( { children } ) => (
	<div
		className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
		data-test-id="godam-ga4-connection-widget"
	>
		<div className="analytics-single-info w-full">
			{ children }
		</div>
	</div>
);

/**
 * "All time" caption shown next to the counts. The counters are lifetime WP
 * options with no per-day breakdown, so — unlike the range-scoped KPI cards
 * this widget sits alongside — they never reflect the dashboard's date-range
 * picker. Called out explicitly so that isn't misread as range-scoped.
 *
 * @return {JSX.Element} Caption element.
 */
const AllTimeBadge = () => (
	<span
		className="text-xs tracking-wide text-zinc-500 whitespace-nowrap"
		data-test-id="godam-ga4-connection-all-time-badge"
	>
		{ __( 'All time', 'godam' ) }
	</span>
);

/**
 * GA4 connection widget for the dashboard.
 *
 * Confirms whether GoDAM is pushing `add_to_cart`/`purchase` GA4 ecommerce
 * events (tagged with video context) into the store's own `window.dataLayer`
 * — the actual push happens in the godam-for-woo add-on; this widget only
 * surfaces the on/off state and, once on, the running counts.
 *
 * Reads `enable_gtm_tracking` directly off `window.godamSettings.enableGTMTracking`
 * (already localized to the page) rather than round-tripping through an API call,
 * but that toggle only says GoDAM is *prepared* to push events — the REST
 * response's `source_active`/`source_type` say whether it actually is, or
 * whether another GA4 integration on the store already covers this and GoDAM
 * is standing down.
 */
const GA4ConnectionWidget = () => {
	const isConnected = !! window.godamSettings?.enableGTMTracking;

	const { data, isLoading, isError } = useFetchGa4CountsQuery( undefined, { skip: ! isConnected } );

	if ( ! isConnected ) {
		return (
			<WidgetShell>
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-ga4-connection-label">
							{ __( 'GA4 Tracking', 'godam' ) }
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
			</WidgetShell>
		);
	}

	if ( isLoading ) {
		return (
			<WidgetShell>
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading flex items-center gap-1">
						<span
							className="flex items-center gap-1 text-xs font-semibold text-zinc-500"
							data-test-id="godam-ga4-connection-status"
						>
							{ __( 'Checking GA4 status…', 'godam' ) }
						</span>
					</div>
				</div>
			</WidgetShell>
		);
	}

	if ( isError ) {
		return (
			<WidgetShell>
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading flex items-center gap-1">
						<span
							className="flex items-center gap-1 text-xs font-semibold text-zinc-500"
							data-test-id="godam-ga4-connection-status"
						>
							<Icon icon={ warning } size={ 14 } />
							{ __( 'GA4 unavailable', 'godam' ) }
						</span>
						<Tooltip text={ __( 'Could not reach the GA4 status endpoint. This can happen right after an update — try refreshing in a moment.', 'godam' ) } />
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<a
						className="godam-button"
						href={ getGeneralSettingsUrl() }
						data-test-id="godam-ga4-connection-manage-link"
					>
						{ __( 'Manage', 'godam' ) }
					</a>
				</div>
			</WidgetShell>
		);
	}

	const addToCartCount = Number( data?.addToCartCount || 0 );
	const purchaseCount = Number( data?.purchaseCount || 0 );
	const isStandingDown = !! data?.sourceActive;

	if ( isStandingDown ) {
		const sourceLabel = getSourceLabel( data?.sourceType );

		return (
			<WidgetShell>
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading flex items-center gap-1">
						<span
							className="flex items-center gap-1 text-xs font-semibold text-amber-700"
							data-test-id="godam-ga4-connection-status"
						>
							<Icon icon={ warning } size={ 14 } />
							{ __( 'GoDAM is standing down', 'godam' ) }
						</span>
						<Tooltip
							text={ sprintf(
								/* translators: %s: name of the other active GA4 integration. */
								__( '%s is already sending these events, so GoDAM is not pushing them to avoid duplicates.', 'godam' ),
								sourceLabel,
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-4 items-end">
					<div className="flex flex-row gap-6">
						<div className="flex flex-col">
							<p className="single-metrics-value" data-test-id="godam-ga4-connection-add-to-cart-count">
								{ addToCartCount.toLocaleString() }
							</p>
							<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'Add to Cart', 'godam' ) }</span>
						</div>
						<div className="flex flex-col">
							<p className="single-metrics-value" data-test-id="godam-ga4-connection-purchase-count">
								{ purchaseCount.toLocaleString() }
							</p>
							<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'Purchase', 'godam' ) }</span>
						</div>
					</div>
				</div>
				<div>
					<AllTimeBadge />
					<a
						className="godam-button"
						href={ getGeneralSettingsUrl() }
						data-test-id="godam-ga4-connection-manage-link"
					>
						{ __( 'Manage', 'godam' ) }
					</a>
				</div>
			</WidgetShell>
		);
	}

	return (
		<WidgetShell>
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
						<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'Add to Cart', 'godam' ) }</span>
					</div>
					<div className="flex flex-col">
						<p className="single-metrics-value" data-test-id="godam-ga4-connection-purchase-count">
							{ purchaseCount.toLocaleString() }
						</p>
						<span className="text-xs text-zinc-500 whitespace-nowrap">{ __( 'Purchase', 'godam' ) }</span>
					</div>
				</div>
			</div>
			<div>
				<AllTimeBadge />
				<a
					className="godam-button"
					href={ getGeneralSettingsUrl() }
					data-test-id="godam-ga4-connection-manage-link"
				>
					{ __( 'Manage', 'godam' ) }
				</a>
			</div>
		</WidgetShell>
	);
};

export default GA4ConnectionWidget;

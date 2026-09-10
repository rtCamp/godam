/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { check, warning, chevronRight } from '@wordpress/icons';

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
 * Shared outer wrapper for every state of the widget. `.analytics-info` /
 * `.analytics-single-info` are only styled (flex layout, padding, gap — see
 * analytics/index.scss) as descendants of `.analytics-info-container`, which
 * the caller (Dashboard.js) is responsible for wrapping this in.
 *
 * A single row at `lg` and up (status on the left, counts + action on the
 * right); stacked below that. `w-full` since this widget gets its own row,
 * not a half-width slot shared with another card.
 *
 * @param {Object} props          Props.
 * @param {Object} props.children Widget content — see the per-state renders below.
 * @return {JSX.Element} Wrapper element.
 */
const WidgetShell = ( { children } ) => (
	<div
		className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full"
		data-test-id="godam-ga4-connection-widget"
	>
		{ /* `godam-ga4-connection-body` (not the lg:flex-row/items-center/justify-between
		    Tailwind utilities alone) drives the row/column switch — the nested
		    .analytics-info-container .analytics-info .analytics-single-info rule in
		    analytics/index.scss sets flex-direction unconditionally at 3-class
		    specificity, which a 1-class Tailwind utility (even matched at the lg
		    breakpoint) cannot outrank; see the matching override in dashboard/index.scss. */ }
		<div className="analytics-single-info godam-ga4-connection-body w-full gap-3">
			{ children }
		</div>
	</div>
);

/**
 * Small filled dot signalling the connection state at a glance, alongside
 * the text status next to it (which carries the actual meaning) — color
 * alone is never the only signal.
 *
 * @param {Object} props            Props.
 * @param {string} props.colorClass Tailwind background-color class.
 * @return {JSX.Element} Dot element.
 */
const StatusDot = ( { colorClass } ) => (
	<span className={ `inline-block w-2 h-2 rounded-full shrink-0 ${ colorClass }` } aria-hidden="true" />
);

/**
 * The status line shown at the top of every state: a dot + icon + label,
 * with an optional info tooltip.
 *
 * @param {Object}      props           Props.
 * @param {string}      props.dotClass  Tailwind background-color class for the StatusDot.
 * @param {string}      props.textClass Tailwind text-color class for the label.
 * @param {WPIcon|null} [props.icon]    Optional icon before the label.
 * @param {string}      props.label     The status text.
 * @param {string}      [props.tooltip] Optional tooltip text.
 * @return {JSX.Element} Status line element.
 */
const StatusLine = ( { dotClass, textClass, icon, label, tooltip } ) => (
	<div className="flex items-center gap-2">
		<StatusDot colorClass={ dotClass } />
		<span
			className={ `flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${ textClass }` }
			data-test-id="godam-ga4-connection-status"
		>
			{ icon && <Icon icon={ icon } size={ 14 } /> }
			{ label }
		</span>
		{ tooltip && <Tooltip text={ tooltip } /> }
	</div>
);

/**
 * "Enable"/"Manage" action — styled as a real button (not a plain link) in
 * the site's own admin theme color (`--wp-admin-theme-color`, same variable
 * the dashboard's icon fills already follow), with a trailing arrow so it
 * reads as a navigation action rather than a plain label.
 *
 * @param {Object} props        Props.
 * @param {string} props.href   Destination URL.
 * @param {string} props.label  Button text.
 * @param {string} props.testId `data-test-id` for the link.
 * @return {JSX.Element} Button-styled link.
 */
const ActionButton = ( { href, label, testId } ) => (
	<a
		className="godam-ga4-connection-button"
		href={ href }
		data-test-id={ testId }
	>
		{ label }
		<Icon icon={ chevronRight } size={ 16 } />
	</a>
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
 * The add_to_cart/purchase counts, side by side, once a value is available
 * (the connected and standing-down states — the count is meaningful either
 * way, since the server counts events "prepared to send" independent of
 * whether GoDAM itself ends up pushing them; see the standing-down copy).
 *
 * @param {Object} props                Props.
 * @param {number} props.addToCartCount Lifetime add_to_cart count.
 * @param {number} props.purchaseCount  Lifetime purchase count.
 * @return {JSX.Element} Metrics row.
 */
const MetricsRow = ( { addToCartCount, purchaseCount } ) => (
	<div className="flex flex-row gap-8">
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
				<StatusLine
					dotClass="bg-zinc-400"
					textClass="text-zinc-500"
					label={ __( 'GA4 Tracking off', 'godam' ) }
					tooltip={ tooltipText }
				/>
				<ActionButton
					href={ getGeneralSettingsUrl() }
					label={ __( 'Enable', 'godam' ) }
					testId="godam-ga4-connection-enable-link"
				/>
			</WidgetShell>
		);
	}

	if ( isLoading ) {
		return (
			<WidgetShell>
				<StatusLine
					dotClass="bg-zinc-400 animate-pulse"
					textClass="text-zinc-500"
					label={ __( 'Checking GA4 status…', 'godam' ) }
				/>
			</WidgetShell>
		);
	}

	if ( isError ) {
		return (
			<WidgetShell>
				<StatusLine
					dotClass="bg-red-500"
					textClass="text-zinc-500"
					icon={ warning }
					label={ __( 'GA4 unavailable', 'godam' ) }
					tooltip={ __( 'Could not reach the GA4 status endpoint. This can happen right after an update — try refreshing in a moment.', 'godam' ) }
				/>
				<ActionButton
					href={ getGeneralSettingsUrl() }
					label={ __( 'Manage', 'godam' ) }
					testId="godam-ga4-connection-manage-link"
				/>
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
				<StatusLine
					dotClass="bg-amber-500"
					textClass="text-amber-700"
					icon={ warning }
					label={ __( 'GoDAM is standing down', 'godam' ) }
					tooltip={ sprintf(
						/* translators: %s: name of the other active GA4 integration. */
						__( '%s is already sending these events, so GoDAM is not pushing them to avoid duplicates.', 'godam' ),
						sourceLabel,
					) }
				/>
				<div className="flex items-center gap-6">
					<MetricsRow addToCartCount={ addToCartCount } purchaseCount={ purchaseCount } />
					<div className="flex items-center gap-3">
						<AllTimeBadge />
						<ActionButton
							href={ getGeneralSettingsUrl() }
							label={ __( 'Manage', 'godam' ) }
							testId="godam-ga4-connection-manage-link"
						/>
					</div>
				</div>
			</WidgetShell>
		);
	}

	return (
		<WidgetShell>
			<StatusLine
				dotClass="bg-emerald-500"
				textClass="text-emerald-700"
				icon={ check }
				label={ __( 'Sending to GA4', 'godam' ) }
				tooltip={ tooltipText }
			/>
			<div className="flex items-center gap-6">
				<MetricsRow addToCartCount={ addToCartCount } purchaseCount={ purchaseCount } />
				<div className="flex items-center gap-3">
					<AllTimeBadge />
					<ActionButton
						href={ getGeneralSettingsUrl() }
						label={ __( 'Manage', 'godam' ) }
						testId="godam-ga4-connection-manage-link"
					/>
				</div>
			</div>
		</WidgetShell>
	);
};

export default GA4ConnectionWidget;

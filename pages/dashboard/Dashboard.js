/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { info } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { ERROR_TYPE } from '../shared/enums';
import AnalyticsUnavailableNotice from '../shared/AnalyticsUnavailableNotice';
import { generateCountryHeatmap } from '../analytics/helper';
import { useFetchDashboardMetricsQuery, useFetchDashboardMetricsHistoryQuery } from './redux/api/dashboardAnalyticsApi';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import { getAPIKeyErrorInfo, hasAPIKey } from '../godam/utils';
import SingleMetrics from '../analytics/SingleMetrics';
import VideoToCartCard from '../analytics/VideoToCartCard';
import VideoToPurchaseCard from '../analytics/VideoToPurchaseCard';
import RevenueCard from '../analytics/RevenueCard';
import PurchaseFunnelCard from '../analytics/PurchaseFunnelCard';
import PlacementFunnelCard from '../analytics/PlacementFunnelCard';
import ViewersGauge from './components/ViewersGauge';
import PlaybackPerformanceDashboard from '../analytics/PlaybackPerformance';
import TopVideosTable from './components/TopVideosTable';
import TopProductsTable from './components/TopProductsTable';
import DateRangePicker, { triggerLabelFor, fromISO } from '../analytics/components/DateRangePicker';

/**
 * Retrieve dashboard sections registered by add-ons.
 *
 * Add-ons (e.g. godam-for-woo) can register additional dashboard
 * sections by pushing onto `window.godamDashboardSections`. Each entry
 * may be either a React component (function, class, React.memo, or
 * React.forwardRef) or an object of the form
 * `{ id, component, priority }`. Sections are rendered below the
 * "Top Videos" table, ordered by `priority` (ascending; default 10).
 *
 * Example:
 *
 * ```js
 * window.godamDashboardSections = window.godamDashboardSections || [];
 * window.godamDashboardSections.push( {
 *   id: 'reel-pops-analytics',
 *   priority: 20,
 *   component: ReelPopsAnalyticsSection,
 * } );
 * ```
 *
 * @return {Array} Sorted array of section descriptors.
 */

/**
 * Return true for any value React can render as a component — plain
 * function/class components as well as exotic components produced by
 * React.memo() and React.forwardRef(). React elements created from JSX
 * are explicitly excluded because they are instances, not component
 * types, and attempting to render them as `<SectionComponent />` will
 * throw.
 *
 * @param {*} value
 *
 * @return {boolean} True if the value is a valid React component type.
 */
const REACT_MEMO_TYPE = Symbol.for( 'react.memo' );
const REACT_FORWARD_REF_TYPE = Symbol.for( 'react.forward_ref' );

const isReactComponent = ( value ) => {
	if ( typeof value === 'function' ) {
		return true;
	}
	if ( React.isValidElement( value ) ) {
		return false;
	}
	return (
		value !== null &&
		typeof value === 'object' &&
		( value.$$typeof === REACT_MEMO_TYPE ||
			value.$$typeof === REACT_FORWARD_REF_TYPE )
	);
};

/**
 * Normalise a raw entry from `window.godamDashboardSections` or from
 * `window.registerGodamDashboardSection()` into a canonical descriptor.
 *
 * @param {*}      entry Raw entry (component or descriptor object).
 * @param {number} idx   Fallback index for generating a unique id.
 *
 * @return {{ id: string, component: *, priority: number }|null} Descriptor object or null if the entry is invalid.
 */
const normaliseSection = ( entry, idx ) => {
	if ( isReactComponent( entry ) ) {
		return { id: `dashboard-section-${ idx }`, component: entry, priority: 10 };
	}
	if ( entry && typeof entry === 'object' && isReactComponent( entry.component ) ) {
		return {
			id: entry.id || `dashboard-section-${ idx }`,
			component: entry.component,
			priority: typeof entry.priority === 'number' ? entry.priority : 10,
		};
	}
	return null;
};

/** Internal event name used to signal that a new section was registered. */
const SECTION_REGISTERED_EVENT = 'godam:register-section';

/**
 * Module-level registry populated before the app mounts (from the
 * legacy `window.godamDashboardSections` array) and kept up-to-date
 * via `window.registerGodamDashboardSection()`.
 */
const sectionRegistry = ( Array.isArray( window.godamDashboardSections )
	? window.godamDashboardSections
	: []
).reduce( ( acc, entry, idx ) => {
	const descriptor = normaliseSection( entry, idx );
	if ( descriptor ) {
		acc[ descriptor.id ] = descriptor;
	}
	return acc;
}, /** @type {Object.<string, *>} */ ( {} ) );

/**
 * Global registration API for add-ons.
 *
 * Add-ons (e.g. godam-for-woo) should call this function to register a
 * dashboard section. It works whether the dashboard has already mounted or
 * not: pre-mount calls seed the initial state, post-mount calls dispatch a
 * DOM event that triggers a React state update.
 *
 * Accepts a React component (function, class, React.memo, or React.forwardRef)
 * or an object of the form `{ id, component, priority }`.
 *
 * Example: window.registerGodamDashboardSection( { id: 'reel-pops-analytics', priority: 20, component: MySection } )
 *
 * @param {*} entry Component or descriptor object to register.
 */
window.registerGodamDashboardSection = ( entry ) => {
	const idx = Object.keys( sectionRegistry ).length;
	const descriptor = normaliseSection( entry, idx );
	if ( ! descriptor ) {
		return;
	}
	sectionRegistry[ descriptor.id ] = descriptor;
	window.dispatchEvent( new CustomEvent( SECTION_REGISTERED_EVENT ) );
};

/**
 * Return a sorted snapshot of the section registry.
 *
 * @return {Array} Sorted array of section descriptors.
 */
const getSortedSections = () =>
	Object.values( sectionRegistry ).sort( ( a, b ) => a.priority - b.priority );

const Dashboard = () => {
	const [ extendedSections, setExtendedSections ] = useState( getSortedSections );

	// Re-read the registry whenever an add-on registers a section after mount.
	useEffect( () => {
		const onSectionRegistered = () => setExtendedSections( getSortedSections() );
		window.addEventListener( SECTION_REGISTERED_EVENT, onSectionRegistered );
		return () => window.removeEventListener( SECTION_REGISTERED_EVENT, onSectionRegistered );
	}, [] );

	const siteUrl = window.location.origin;

	// Top Products is a WooCommerce feature; show its tab only when WooCommerce is
	// active (godam-for-woo supplies the product interactions it reads). Non-Woo
	// sites keep the plain Top Videos table with no tab switcher.
	const hasWooProducts = !! window.videoData?.isWoo;
	const [ topTab, setTopTab ] = useState( 'videos' );

	// The switcher renders inside the active table's head (where its title would
	// be), so there is no separate title bar and no duplicate heading. Null on
	// non-Woo sites, where the table falls back to its own "Top Videos" heading.
	const topTabSwitcher = hasWooProducts ? (
		<div className="godam-top-tabs__nav" role="tablist" aria-label={ __( 'Top content', 'godam' ) }>
			<button
				type="button"
				role="tab"
				aria-selected={ topTab === 'videos' }
				className={ `godam-top-tabs__tab${ topTab === 'videos' ? ' is-active' : '' }` }
				data-test-id="godam-top-tab-videos"
				onClick={ () => setTopTab( 'videos' ) }
			>
				{ __( 'Top Videos', 'godam' ) }
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={ topTab === 'products' }
				className={ `godam-top-tabs__tab${ topTab === 'products' ? ' is-active' : '' }` }
				data-test-id="godam-top-tab-products"
				onClick={ () => setTopTab( 'products' ) }
			>
				{ __( 'Top Products', 'godam' ) }
			</button>
		</div>
	) : null;

	// Reel Pops live in the godam-for-woo add-on, which registers the
	// "reel-pops-analytics" dashboard section. Only surface the link when it's
	// available so the page exists to navigate to.
	const hasReelPops = extendedSections.some(
		( section ) => section.id === 'reel-pops-analytics',
	);

	const apiKeyError = getAPIKeyErrorInfo();
	const apiKeyErrorType = apiKeyError?.type || null;

	// Skip all analytics queries when there is no API key or there is a locally-known key error.
	const shouldSkipAnalytics = ! hasAPIKey || !! apiKeyErrorType;

	const { data: dashboardMetrics, isLoading: isDashboardMetricsLoading, isError: isDashboardMetricsError } = useFetchDashboardMetricsQuery( { siteUrl }, { skip: shouldSkipAnalytics } );
	window.dashboardMetrics = dashboardMetrics;

	// Per-card date range for the "Total Plays / Unique Viewers" card (gauge +
	// geography). The date args are omitted at All Time so the args reduce to
	// `{ siteUrl }` — the exact same cache key as the primary query above, so
	// RTK actually dedups (one request) and only forks once a range is picked.
	// (RTK's default serializeQueryArgs keys on the arg object, so a literal
	// `startDate: null` would NOT dedup.) Range mode returns a live range-scoped
	// unique-viewer count from the microservice, so the gauge shows real numbers
	// in every range (not just All Time).
	const [ gaugeRange, setGaugeRange ] = useState( { startDate: null, endDate: null } );
	const { data: gaugeMetrics } = useFetchDashboardMetricsQuery(
		{
			siteUrl,
			...( gaugeRange.startDate ? { startDate: gaugeRange.startDate } : {} ),
			...( gaugeRange.endDate ? { endDate: gaugeRange.endDate } : {} ),
		},
		{ skip: shouldSkipAnalytics },
	);

	// Per-card date range for the "Insights" KPI cards. A bounded range makes
	// the microservice return per-card % deltas (vs the previous equal window);
	// all-time returns them null, so the delta badges stay hidden.
	const [ insightsRange, setInsightsRange ] = useState( { startDate: null, endDate: null } );
	const { data: insightsMetrics } = useFetchDashboardMetricsQuery(
		{
			siteUrl,
			...( insightsRange.startDate ? { startDate: insightsRange.startDate } : {} ),
			...( insightsRange.endDate ? { endDate: insightsRange.endDate } : {} ),
		},
		{ skip: shouldSkipAnalytics },
	);
	const insightsRangeActive = Boolean( insightsRange.startDate && insightsRange.endDate );
	const insightsSpanDays = insightsRangeActive
		? Math.round( ( fromISO( insightsRange.endDate ) - fromISO( insightsRange.startDate ) ) / 86400000 ) + 1
		: 0;
	const insightsDeltaLabel = sprintf(
		/* translators: %d: number of days in the compared previous window. */
		__( 'vs prev %d days', 'godam' ),
		insightsSpanDays,
	);
	const insightsCardLabel = insightsRangeActive ? triggerLabelFor( insightsRange ) : __( 'All time', 'godam' );

	// Skip secondary queries until the primary metrics call has returned without an error.
	// This prevents parallel requests being sent when the server rejects the API key.
	const shouldSkipSecondaryQueries = shouldSkipAnalytics || ! dashboardMetrics || !! dashboardMetrics?.errorType;

	const { data: dashboardMetricsHistory } = useFetchDashboardMetricsHistoryQuery( { days: 60, siteUrl }, { skip: shouldSkipSecondaryQueries } );

	// Connected, but the analytics backend is unreachable (server down) or returned
	// a microservice error. Gated on a valid key so it never shows for a
	// disconnected site — that case is handled by the onboarding overlay.
	const analyticsUnreachable = !! window.userData?.validApiKey && ! shouldSkipAnalytics && ( isDashboardMetricsError || dashboardMetrics?.errorType === ERROR_TYPE.MICROSERVICE_ERROR );

	// Reveal the dashboard once the primary metrics call settles. The onboarding
	// overlay handles the disconnected case, so there's no in-dashboard overlay.
	useEffect( () => {
		if ( ! ( ( ! isDashboardMetricsLoading && dashboardMetrics ) || isDashboardMetricsError ) ) {
			return;
		}
		const loadingEl = document.getElementById( 'loading-analytics-animation' );
		const container = document.getElementById( 'dashboard-container' );
		if ( loadingEl ) {
			loadingEl.style.display = 'none';
		}
		// Don't reveal the (data-less) dashboard when the backend is unreachable —
		// the unavailable notice is shown instead.
		if ( container && ! analyticsUnreachable ) {
			container.classList.remove( 'hidden' );
		}
	}, [ dashboardMetrics, isDashboardMetricsLoading, isDashboardMetricsError, analyticsUnreachable ] );

	useEffect( () => {
		// The geography map lives inside the gauge card, so it follows the same
		// per-card range (gaugeMetrics). generateCountryHeatmap clears both
		// containers before drawing, so it is safe to re-run when the range
		// changes; it shows an empty-state placeholder when there is no data.
		if ( gaugeMetrics ) {
			const interval = setInterval( () => {
				const mapContainer = document.querySelector( '#map-container' );
				const tableContainer = document.querySelector( '#table-container' );
				if ( mapContainer && tableContainer ) {
					clearInterval( interval );
					generateCountryHeatmap(
						gaugeMetrics.country_views || {},
						'#map-container',
						'#table-container',
					);
				}
			}, 100 );

			return () => clearInterval( interval );
		}
	}, [ gaugeMetrics ] );

	useEffect( () => {
		const checkExist = setInterval( () => {
			const bandwidthEl = document.querySelector( '#bandwidth-donut-chart' );
			const storageEl = document.querySelector( '#storage-donut-chart' );

			if ( bandwidthEl && storageEl && window?.userData ) {
				clearInterval( checkExist );
			}
		}, 100 );

		return () => clearInterval( checkExist );
	}, [] );

	return (
		<div className="godam-dashboard-container">
			<GodamHeader />

			<div id="loading-analytics-animation" className="progress-bar-wrapper">
				<div className="progress-bar-container">
					<div className="progress-bar">
						<div className="progress-bar-inner"></div>
					</div>
				</div>
			</div>

			{ analyticsUnreachable && <AnalyticsUnavailableNotice area="dashboard" /> }

			<div id="dashboard-container" className="dashboard-container hidden">
				<div className="godam-dashboard-head">
					<h1 className="godam-dashboard-title">{ __( 'Dashboard', 'godam' ) }</h1>
					{ /* Page-level FYI — analytics aren't real-time. Sits beside the title. */ }
					<div className="godam-analytics-fyi flex items-center gap-1.5 text-xs text-zinc-500">
						<Icon icon={ info } size={ 15 } />
						<span>
							{ __(
								'Heads up: analytics update periodically, so new activity may take up to 30 minutes to show here.',
								'godam',
							) }
						</span>
					</div>
					{ hasReelPops && (
						<a
							className="godam-reel-pop-link"
							href="admin.php?page=rtgodam_reel_pops"
						>
							{ __( 'See Reel Pop Analytics', 'godam' ) }
							<span className="godam-reel-pop-link__arrow" aria-hidden="true">↗</span>
						</a>
					) }
				</div>

				<div className="godam-dashboard-grid">
					{ /* Left column — Total Plays / Unique Viewers + geography. */ }
					<div className="godam-card godam-viewers-card">
						<div className="godam-card__head">
							<h2>{ __( 'Total Plays / Unique Viewers', 'godam' ) }</h2>
							<DateRangePicker
								value={ gaugeRange }
								onChange={ setGaugeRange }
								testIdPrefix="godam-dashboard-gauge-daterange"
							/>
						</div>
						<ViewersGauge
							plays={ gaugeMetrics?.plays ?? 0 }
							uniqueViewers={ gaugeMetrics?.unique_viewers ?? null }
						/>
						<div className="country-views">
							<div className="country-views-map" id="map-container"></div>
							<div className="country-views-table" id="table-container"></div>
						</div>
					</div>

					{ /* Right column — Insights KPIs + Playback Performance. */ }
					<div className="godam-dashboard-right">
						<div className="godam-card godam-insights-card">
							<div className="godam-card__head">
								<h2>{ __( 'Insights', 'godam' ) }</h2>
								<DateRangePicker
									value={ insightsRange }
									onChange={ setInsightsRange }
									testIdPrefix="godam-dashboard-insights-daterange"
								/>
							</div>
							<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-row items-stretch flex-wrap justify-center lg:flex-wrap lg:[&>*]:grow lg:[&>*]:basis-40">

								<SingleMetrics
									mode="dashboard"
									metricType="total-videos"
									label={ __( 'Active Videos', 'godam' ) }
									tooltipText={ __(
										'Number of unique videos that received user interactions each day, such as views or plays.',
										'godam',
									) }
									rangeActive={ insightsRangeActive }
									deltaLabel={ insightsDeltaLabel }
									dataLabel={ insightsCardLabel }
									analyticsDataFetched={ {
										total_videos: insightsMetrics?.total_videos ?? 0,
									} }
								/>

								<SingleMetrics
									mode="dashboard"
									metricType={ 'play-rate' }
									label={ __( 'Avg. Play Rate', 'godam' ) }
									tooltipText={ __(
										'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads',
										'godam',
									) }
									rangeActive={ insightsRangeActive }
									deltaLabel={ insightsDeltaLabel }
									dataLabel={ insightsCardLabel }
									analyticsDataFetched={ insightsMetrics }
								/>

								<SingleMetrics
									mode="dashboard"
									metricType={ 'watch-time' }
									label={ __( 'Watch Time', 'godam' ) }
									tooltipText={ __(
										'Total time the video has been watched, aggregated across all plays',
										'godam',
									) }
									rangeActive={ insightsRangeActive }
									deltaLabel={ insightsDeltaLabel }
									dataLabel={ insightsCardLabel }
									analyticsDataFetched={ insightsMetrics }
								/>

								{ /* Engagement Rate is intentionally not shown on the dashboard;
								    Average Engagement still appears on each video's own
								    analytics page. */ }
							</div>

							{ /* WooCommerce metrics on their own row below the core Insights:
							    Video-to-Cart and Video-to-Purchase side by side (per the
							    design), each with its range-aware trend badge. Woo-gated:
							    both would otherwise read a permanent, misleading "0" on a
							    non-Woo store. */ }
							{ hasWooProducts && (
								<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-col items-stretch flex-wrap gap-4 mt-4 lg:[&>*]:grow lg:[&>*]:basis-40">
									<VideoToCartCard
										videoToCart={ insightsMetrics?.video_to_cart }
										dataLabel={ insightsCardLabel }
										deltaLabel={ insightsDeltaLabel }
									/>
									<VideoToPurchaseCard
										videoToPurchase={ insightsMetrics?.video_to_purchase }
										dataLabel={ insightsCardLabel }
										deltaLabel={ insightsDeltaLabel }
									/>
								</div>
							) }
						</div>

						<div className="playback-performance" id="global-analytics-container">
							<PlaybackPerformanceDashboard
								initialData={ dashboardMetricsHistory }
								mode="dashboard"
							/>
						</div>
					</div>
				</div>

				{ /* Video-Attributed Revenue (WooCommerce only): the headline revenue
				    figure, split Direct/Assisted, with account-wide Influenced shown
				    separately. Full-width card, single store currency. */ }
				{ hasWooProducts && (
					<RevenueCard
						revenue={ insightsMetrics?.revenue }
						dataLabel={ insightsCardLabel }
						deltaLabel={ insightsDeltaLabel }
					/>
				) }

				{ /* Account-wide Play-to-Cart-to-Purchase funnel (WooCommerce only). */ }
				{ hasWooProducts && (
					<PurchaseFunnelCard
						funnel={ insightsMetrics?.video_funnel }
						dataLabel={ insightsCardLabel }
						scope="account"
					/>
				) }

				{ /* Funnel by placement (WooCommerce only) — fetches its own data. */ }
				{ hasWooProducts && (
					<PlacementFunnelCard
						siteUrl={ siteUrl }
						startDate={ insightsRange.startDate }
						endDate={ insightsRange.endDate }
						dataLabel={ insightsCardLabel }
					/>
				) }

				{ hasWooProducts && topTab === 'products'
					? <TopProductsTable siteUrl={ siteUrl } skip={ shouldSkipSecondaryQueries } tabSwitcher={ topTabSwitcher } />
					: <TopVideosTable siteUrl={ siteUrl } skip={ shouldSkipSecondaryQueries } tabSwitcher={ topTabSwitcher } /> }

				{ extendedSections.map( ( { id, component: SectionComponent } ) => (
					<SectionComponent key={ id } />
				) ) }
			</div>
		</div>
	);
};

export default Dashboard;

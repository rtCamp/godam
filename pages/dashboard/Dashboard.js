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
import ViewersGauge from './components/ViewersGauge';
import PlaybackPerformanceDashboard from '../analytics/PlaybackPerformance';
import TopVideosTable from './components/TopVideosTable';
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
	// geography). `{ null, null }` = All Time, so this first request shares the
	// primary query's cache key (RTK dedups it) and only forks once a range is
	// picked. Range mode has no range-scoped unique-viewer count yet, so the
	// microservice returns `unique_viewers: null` and the gauge shows "—".
	const [ gaugeRange, setGaugeRange ] = useState( { startDate: null, endDate: null } );
	const { data: gaugeMetrics } = useFetchDashboardMetricsQuery(
		{ siteUrl, startDate: gaugeRange.startDate, endDate: gaugeRange.endDate },
		{ skip: shouldSkipAnalytics },
	);

	// Per-card date range for the "Insights" KPI cards. A bounded range makes
	// the microservice return per-card % deltas (vs the previous equal window);
	// all-time returns them null, so the delta badges stay hidden.
	const [ insightsRange, setInsightsRange ] = useState( { startDate: null, endDate: null } );
	const { data: insightsMetrics } = useFetchDashboardMetricsQuery(
		{ siteUrl, startDate: insightsRange.startDate, endDate: insightsRange.endDate },
		{ skip: shouldSkipAnalytics },
	);
	const insightsRangeActive = Boolean( insightsRange.startDate && insightsRange.endDate );
	const insightsSpanDays = insightsRangeActive
		? Math.round( ( fromISO( insightsRange.endDate ) - fromISO( insightsRange.startDate ) ) / 86400000 ) + 1
		: 0;
	const insightsDeltaLabel = sprintf(
		/* translators: %d: number of days in the compared previous window. */
		__( 'vs previous %d days', 'godam' ),
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
							<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-row items-stretch flex-wrap justify-center lg:flex-nowrap">

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

								<SingleMetrics
									mode="dashboard"
									metricType={ 'engagement-rate' }
									label={ __( 'Engagement Rate', 'godam' ) }
									tooltipText={ __(
										'Average share of each video that viewers watched, across all plays.',
										'godam',
									) }
									rangeActive={ insightsRangeActive }
									deltaLabel={ insightsDeltaLabel }
									dataLabel={ insightsCardLabel }
									analyticsDataFetched={ insightsMetrics }
								/>
							</div>
						</div>

						<div className="playback-performance" id="global-analytics-container">
							<PlaybackPerformanceDashboard
								initialData={ dashboardMetricsHistory }
								mode="dashboard"
							/>
						</div>
					</div>
				</div>

				<TopVideosTable siteUrl={ siteUrl } skip={ shouldSkipSecondaryQueries } />

				{ extendedSections.map( ( { id, component: SectionComponent } ) => (
					<SectionComponent key={ id } />
				) ) }
			</div>
		</div>
	);
};

export default Dashboard;

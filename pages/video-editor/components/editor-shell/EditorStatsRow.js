/**
 * WordPress dependencies
 */
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from '../../../analytics/redux/api/analyticsApi';
import Tooltip from '../../../analytics/Tooltip';

/**
 * Format a whole-number count (e.g. 12345 -> "12,345").
 *
 * @param {number} value Raw count.
 * @return {string} Localised number.
 */
const formatCount = ( value ) => {
	const n = Number( value ) || 0;
	return n.toLocaleString();
};

/**
 * Format a duration in seconds as m:ss (or h:mm:ss).
 *
 * @param {number} seconds Duration in seconds.
 * @return {string} Formatted duration.
 */
const formatWatchTime = ( seconds ) => {
	const total = Math.round( Number( seconds ) || 0 );
	const hrs = Math.floor( total / 3600 );
	const mins = Math.floor( ( total % 3600 ) / 60 );
	const secs = total % 60;
	const pad = ( v ) => String( v ).padStart( 2, '0' );

	if ( hrs > 0 ) {
		return `${ hrs }:${ pad( mins ) }:${ pad( secs ) }`;
	}
	return `${ mins }:${ pad( secs ) }`;
};

/**
 * Stats row shown beneath the top bar.
 *
 * Wires Total Plays / Avg. Watch Time / Total Impressions to the existing
 * `/godam/v1/analytics/fetch` endpoint and Layer CTR (conversion) to the
 * processed-history feed. Read-only and non-breaking: queries are skipped
 * when there is no valid API key, and every cell degrades to `0`/`—`.
 *
 * @param {Object} props
 * @param {number} props.attachmentID The current video's attachment ID.
 * @return {JSX.Element} The stats row.
 */
const EditorStatsRow = ( { attachmentID } ) => {
	const siteUrl = window.location.origin;
	const hasValidApiKey = Boolean( window?.userData?.validApiKey );
	// The shared analyticsApi sets X-WP-Nonce from window.wpApiSettings.nonce;
	// skip the queries entirely if it is not localised on this page so the
	// request never throws — the row then degrades to 0 / —.
	const skip = ! attachmentID || ! hasValidApiKey || ! window?.wpApiSettings?.nonce;

	const { data: analytics, isLoading: isAnalyticsLoading } = useFetchAnalyticsDataQuery(
		{ videoId: attachmentID, siteUrl },
		{ skip },
	);

	const hasAnalytics = analytics && ! analytics.errorType;

	const { data: history } = useFetchProcessedAnalyticsHistoryQuery(
		{ videoId: attachmentID, siteUrl, days: 30 },
		{ skip: skip || ! hasAnalytics },
	);

	const plays = hasAnalytics ? Number( analytics.plays ) || 0 : 0;
	const playTime = hasAnalytics ? Number( analytics.play_time ) || 0 : 0;
	const impressions = hasAnalytics ? Number( analytics.page_load ) || 0 : 0;
	const avgWatch = plays > 0 ? playTime / plays : 0;

	// Layer CTR ≈ converting sessions / plays, mirroring the analytics page.
	const ctr = ( () => {
		const rows = Array.isArray( history ) ? history : [];
		if ( ! rows.length ) {
			return null;
		}
		const totals = rows.reduce(
			( acc, row ) => {
				acc.plays += Number( row.plays ) || 0;
				acc.converting += Number( row.unique_converting_sessions ) || 0;
				return acc;
			},
			{ plays: 0, converting: 0 },
		);
		if ( totals.plays <= 0 ) {
			return null;
		}
		return Math.min( 100, ( totals.converting / totals.plays ) * 100 );
	} )();

	const stats = [
		{
			label: __( 'Total Plays', 'godam' ),
			value: formatCount( plays ),
			tooltip: __( 'The total number of times this video has been played.', 'godam' ),
		},
		{
			label: __( 'Layer CTR', 'godam' ),
			value: ctr === null ? '—' : `${ ctr.toFixed( 1 ) }%`,
			tooltip: __( 'Click-through rate of interactive layers: the share of plays where a viewer interacted with a layer. Layer CTR = Converting sessions / Total plays.', 'godam' ),
		},
		{
			label: __( 'Avg. Watch Time', 'godam' ),
			value: formatWatchTime( avgWatch ),
			tooltip: __( 'Average time watched per play. Avg. Watch Time = Total watch time / Total plays.', 'godam' ),
		},
		{
			label: __( 'Total Impressions', 'godam' ),
			value: formatCount( impressions ),
			tooltip: __( 'How many times the video player loaded on a page, whether or not it was played.', 'godam' ),
		},
	];

	return (
		<div className="godam-video-editor__stats">
			{ stats.map( ( stat ) => (
				<div key={ stat.label } className="godam-video-editor__stat">
					<div className="godam-video-editor__stat-label">
						{ stat.label }
						<Tooltip text={ stat.tooltip } />
					</div>
					<p className="godam-video-editor__stat-value">
						{ isAnalyticsLoading ? <Spinner /> : stat.value }
					</p>
				</div>
			) ) }
		</div>
	);
};

export default EditorStatsRow;

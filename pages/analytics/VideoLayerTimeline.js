/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { info } from '@wordpress/icons';
import { Icon } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useVideoLayerData } from './hooks/useVideoLayerData';
import LayerTimelineStrip from './timeline/LayerTimelineStrip';
import LayerDetailPanel from './timeline/LayerDetailPanel';
import DateRangePicker from './timeline/DateRangePicker';
import InfoTooltip from './timeline/InfoTooltip';

/**
 * Pick the footer hint text based on what the user is currently looking at.
 *
 * Flat ternary chain pulled into a helper so the JSX stays readable and
 * lint stays happy about nested conditionals.
 *
 * @param {Array}       parents        Loaded parent layers.
 * @param {Object|null} selectedParent Currently selected parent.
 * @return {string} Hint text.
 */
function getFooterHint( parents, selectedParent ) {
	if ( parents.length === 0 ) {
		return __(
			'Add an interactive layer in the video editor to start tracking performance.',
			'godam',
		);
	}
	if (
		selectedParent &&
		Array.isArray( selectedParent.sub_hotspots ) &&
		selectedParent.sub_hotspots.length > 0
	) {
		return __(
			'Click on any hotspot on the left to see its performance.',
			'godam',
		);
	}
	return __(
		'Click on any layer above to view its performance details.',
		'godam',
	);
}

/**
 * Compact loading skeleton matching the final strip + detail card shape.
 *
 * @return {JSX.Element} Skeleton element.
 */
function TimelineSkeleton() {
	return (
		<div className="px-6 py-6">
			<div className="flex gap-6 mb-6">
				{ [ 0, 1, 2, 3, 4 ].map( ( i ) => (
					<div
						key={ i }
						className="flex flex-col items-center gap-2"
					>
						<div className="w-11 h-11 rounded-lg animate-pulse bg-zinc-200" />
						<div className="w-16 h-3 rounded animate-pulse bg-zinc-200" />
						<div className="w-10 h-3 rounded animate-pulse bg-zinc-200" />
					</div>
				) ) }
			</div>
			<div className="h-72 rounded-xl animate-pulse bg-zinc-100" />
		</div>
	);
}

/**
 * VideoLayerTimeline
 *
 * Top-level "Video Layer Timeline" section on the single-video analytics
 * page. Holds the title row + date range picker, the horizontal marker
 * strip, the detail panel for the selected layer, and the footer hint.
 *
 * Replaces the previous tab-based InteractiveLayerAnalytics container.
 * The timeline auto-discovers layer types from the data — no add-on
 * registration is needed. Add-ons that emit layers with `layer_type` in
 * the server-side whitelist (e.g. godam-for-woo's `'woo'`) get their
 * markers rendered automatically when events exist.
 *
 * @param {Object}        props
 * @param {number|string} props.attachmentID  WP attachment ID of the video.
 * @param {number}        props.videoDuration Total video length in seconds.
 * @return {JSX.Element} The full timeline section.
 */
const VideoLayerTimeline = ( { attachmentID, videoDuration } ) => {
	const [ dateRange, setDateRange ] = useState( '7d' );
	const siteUrl = window.location.origin;

	const { parents, isLoading, errorType, errorMessage } = useVideoLayerData( {
		videoId: attachmentID,
		siteUrl,
		dateRange,
	} );

	const [ selectedParentId, setSelectedParentId ] = useState( null );

	// Auto-select the first parent layer when data arrives. Re-runs only
	// when the parent set itself changes — so clicking around doesn't
	// reset selection.
	useEffect( () => {
		if ( parents.length === 0 ) {
			setSelectedParentId( null );
			return;
		}
		if (
			! selectedParentId ||
			! parents.find( ( p ) => p.id === selectedParentId )
		) {
			setSelectedParentId( parents[ 0 ].id );
		}
	}, [ parents, selectedParentId ] );

	const selectedParent =
		parents.find( ( p ) => p.id === selectedParentId ) || null;

	return (
		<section className="mx-10 my-6 bg-white border border-zinc-200 rounded-lg overflow-hidden">
			{ /* Header */ }
			<header className="px-6 pt-6 pb-2 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h3 className="text-lg font-semibold text-zinc-900 m-0">
							{ __( 'Video Layer Timeline', 'godam' ) }
						</h3>
						<InfoTooltip
							size={ 16 }
							text={ __(
								'Each marker represents an interactive layer in this video. Click a marker to see how viewers interacted with it.',
								'godam',
							) }
						/>
					</div>
					<p className="text-sm text-zinc-500 m-0 mt-1">
						{ __(
							'See when interactive layers appeared in your video and how they performed.',
							'godam',
						) }
					</p>
				</div>
				<DateRangePicker value={ dateRange } onChange={ setDateRange } />
			</header>

			{ /* Body */ }
			{ isLoading && <TimelineSkeleton /> }
			{ ! isLoading && errorType && (
				<div className="px-6 py-10 text-center text-sm text-zinc-500">
					{ errorMessage ||
						__(
							'Unable to load layer analytics. Please try again.',
							'godam',
						) }
				</div>
			) }
			{ ! isLoading && ! errorType && (
				<>
					<LayerTimelineStrip
						parents={ parents }
						videoDuration={ videoDuration }
						selectedParentId={ selectedParentId }
						onSelect={ setSelectedParentId }
					/>

					{ selectedParent && (
						<div className="px-6 pb-6">
							<LayerDetailPanel
								parent={ selectedParent }
								attachmentID={ attachmentID }
							/>
						</div>
					) }

					{ /* Footer hint */ }
					<div className="border-t border-zinc-100 px-6 py-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
						<span className="text-zinc-400">
							<Icon icon={ info } size={ 14 } />
						</span>
						{ getFooterHint( parents, selectedParent ) }
					</div>
				</>
			) }
		</section>
	);
};

export default VideoLayerTimeline;

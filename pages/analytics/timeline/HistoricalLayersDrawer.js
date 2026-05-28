/**
 * External dependencies
 */
import React, { useState } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { chevronDown, chevronUp } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import LayerTimelineStrip from './LayerTimelineStrip';

/**
 * Collapsible drawer for layers that have been removed from the video's
 * published config but still carry analytics history.
 *
 * Plan §5.8 keeps removed-layer data intact ("how did that CTA perform
 * before I killed it" — desirable default). This drawer separates the
 * historical view from the active strip so the marketer can scan
 * current performance without removed layers competing visually, while
 * still surfacing them one click away.
 *
 * Closed by default. Expands on click. Renders the same
 * `<LayerTimelineStrip>` the active set uses — markers come through
 * with `isActive=false` from the data layer, so styling differences
 * (muted color, "Removed" pill) are already handled per-marker.
 *
 * @param {Object}      props
 * @param {Array}       props.parents          Removed parent layers (subset of useVideoLayerData's parents[]).
 * @param {number}      props.videoDuration    Video length in seconds — for marker positioning on the strip.
 * @param {string|null} props.selectedParentId Selected layer id, or null.
 * @param {Function}    props.onSelect         (parentId) => void.
 * @return {JSX.Element|null} Drawer, or null when parents[] is empty.
 */
const HistoricalLayersDrawer = ( {
	parents,
	videoDuration,
	selectedParentId,
	onSelect,
} ) => {
	const [ isOpen, setIsOpen ] = useState( false );

	if ( ! parents || parents.length === 0 ) {
		return null;
	}

	const count = parents.length;
	const label = sprintf(
		/* translators: %d is the count of removed layers. */
		_n( 'Removed layers (%d)', 'Removed layers (%d)', count, 'godam' ),
		count,
	);

	return (
		<div className="border-t border-zinc-100">
			<button
				type="button"
				onClick={ () => setIsOpen( ( v ) => ! v ) }
				className="w-full flex items-center justify-between px-6 py-3 text-left bg-transparent border-0 cursor-pointer hover:bg-zinc-50"
				aria-expanded={ isOpen }
			>
				<span className="flex items-center gap-2 text-sm font-medium text-zinc-600">
					<span>{ label }</span>
					<span className="text-xs text-zinc-400">
						{ __(
							'No longer in the video; historical analytics preserved.',
							'godam',
						) }
					</span>
				</span>
				<Icon icon={ isOpen ? chevronUp : chevronDown } size={ 18 } />
			</button>

			{ isOpen && (
				<LayerTimelineStrip
					parents={ parents }
					videoDuration={ videoDuration }
					selectedParentId={ selectedParentId }
					onSelect={ onSelect }
				/>
			) }
		</div>
	);
};

export default HistoricalLayersDrawer;

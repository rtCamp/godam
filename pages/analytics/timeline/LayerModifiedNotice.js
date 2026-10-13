/**
 * External dependencies
 */
import React, { useState, useMemo, useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { info, closeSmall } from '@wordpress/icons';

/**
 * Format a position (seconds) as M:SS.ss for the notice text.
 *
 * Two decimals when there are fractional seconds, integer when
 * exact — "0:01" reads cleaner than "0:01.00" for the common case
 * of marketers placing layers at whole-second boundaries.
 *
 * @param {number} seconds Position in the video.
 * @return {string} M:SS or M:SS.ss.
 */
function formatPosition( seconds ) {
	const total = Math.max( 0, Number( seconds ) || 0 );
	const m = Math.floor( total / 60 );
	const s = total - ( m * 60 );
	const sFixed = Number.isInteger( s )
		? String( s ).padStart( 2, '0' )
		: s.toFixed( 2 ).padStart( 5, '0' );
	return `${ m }:${ sFixed }`;
}

/**
 * localStorage key for the dismissed state, scoped per layer so dismissing
 * one notice doesn't hide them all.
 *
 * @param {string} layerId Layer UUID.
 * @return {string} localStorage key.
 */
function dismissKey( layerId ) {
	return `godam-analytics-modified-notice-dismissed-${ layerId }`;
}

/**
 * Human-readable join of positions: ["0:01", "0:03", "0:05"] →
 * "0:01, 0:03 and 0:05". Two values → "0:01 and 0:03". Single value
 * is unreachable in practice (the notice doesn't render with <2
 * positions) but degrades to just the value.
 *
 * @param {string[]} parts Pre-formatted positions.
 * @return {string} Joined string.
 */
function joinPositions( parts ) {
	if ( parts.length === 0 ) {
		return '';
	}
	if ( parts.length === 1 ) {
		return parts[ 0 ];
	}
	if ( parts.length === 2 ) {
		return sprintf(
			/* translators: 1: first position, 2: second position. */
			__( '%1$s and %2$s', 'godam' ),
			parts[ 0 ],
			parts[ 1 ],
		);
	}
	const head = parts.slice( 0, -1 ).join( ', ' );
	return sprintf(
		/* translators: 1: comma-separated positions, 2: last position. */
		__( '%1$s and %2$s', 'godam' ),
		head,
		parts[ parts.length - 1 ],
	);
}

/**
 * LayerModifiedNotice
 *
 * Renders a dismissible notice in the detail panel when a layer has
 * been moved (multiple distinct `layer_timestamp` values observed in
 * its analytics history). Text:
 *
 * "This layer has been modified. It was previously at 0:01 and 0:03.
 * Analytics shown here are cumulative across all changes."
 *
 * Dismiss state lives in localStorage scoped per layer_id — closing
 * the notice on one layer doesn't hide it on others.
 *
 * Mount conditions (handled by caller):
 * - parent.historical_positions.length > 1
 * - parent is not selected as a sub-hotspot view (the notice is
 * about the parent layer's lifetime, not a single product's)
 *
 * @param {Object}   props
 * @param {string}   props.layerId             Parent layer UUID — namespaces the dismiss state.
 * @param {number[]} props.historicalPositions Distinct positions in seconds, sorted ascending.
 * @return {JSX.Element|null} Notice or null when dismissed.
 */
const LayerModifiedNotice = ( { layerId, historicalPositions } ) => {
	const [ dismissed, setDismissed ] = useState( () => {
		if ( typeof window === 'undefined' || ! layerId ) {
			return false;
		}
		try {
			return window.localStorage.getItem( dismissKey( layerId ) ) === '1';
		} catch ( e ) {
			return false;
		}
	} );

	// Reset dismiss when the layer changes (different parent selected).
	useEffect( () => {
		if ( typeof window === 'undefined' || ! layerId ) {
			return;
		}
		try {
			setDismissed( window.localStorage.getItem( dismissKey( layerId ) ) === '1' );
		} catch ( e ) {
			setDismissed( false );
		}
	}, [ layerId ] );

	const positionsText = useMemo( () => {
		const positions = Array.isArray( historicalPositions ) ? historicalPositions : [];
		const formatted = positions.map( ( p ) => formatPosition( p ) );
		return joinPositions( formatted );
	}, [ historicalPositions ] );

	if ( dismissed ) {
		return null;
	}

	const handleDismiss = () => {
		setDismissed( true );
		try {
			window.localStorage.setItem( dismissKey( layerId ), '1' );
		} catch ( e ) {
			// localStorage unavailable / quota — fail silently; the in-memory
			// state still hides the notice for this render session.
		}
	};

	return (
		<div
			className="flex items-start justify-between gap-3 mx-6 mt-4 mb-2 px-4 py-3 rounded-lg border"
			style={ {
				borderColor: '#FEF3C7',
				background: '#FFFBEB',
			} }
			role="status"
		>
			<div className="flex items-start gap-2 min-w-0">
				<span
					className="shrink-0"
					style={ { color: '#B45309', marginTop: 2 } }
					aria-hidden="true"
				>
					<Icon icon={ info } size={ 16 } />
				</span>
				<p className="text-sm text-zinc-700 m-0">
					<strong>{ __( 'This layer has been modified.', 'godam' ) }</strong>
					{ ' ' }
					{ sprintf(
						/* translators: %s is a comma-separated list of timestamps like "0:01 and 0:03". */
						__( 'It was previously at %s. Analytics shown here are cumulative across all changes.', 'godam' ),
						positionsText,
					) }
				</p>
			</div>
			<button
				type="button"
				onClick={ handleDismiss }
				aria-label={ __( 'Dismiss notice', 'godam' ) }
				className="shrink-0 inline-flex items-center justify-center bg-transparent border-0 p-0 text-zinc-500 hover:text-zinc-700 cursor-pointer"
				style={ { lineHeight: 0 } }
			>
				<Icon icon={ closeSmall } size={ 18 } />
			</button>
		</div>
	);
};

export default LayerModifiedNotice;

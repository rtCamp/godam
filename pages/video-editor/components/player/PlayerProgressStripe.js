/**
 * Reel-style progress stripe for the video-editor stage preview.
 *
 * The stage hides the Video.js control bar (the docked Timeline owns scrubbing
 * on the Layers / Chapters tabs), which left the preview with no visible sign
 * of playback progress at all. This is the minimal always-on affordance: a thin
 * stripe pinned to the bottom edge of the video, like a reel. It thickens on
 * hover and reveals a handle plus a time bubble, and can be clicked, dragged or
 * arrow-keyed to seek.
 *
 * Playback state is read straight off the Video.js player rather than Redux so
 * the stripe stays smooth: a rAF loop drives it while playing and the player's
 * own events cover the paused / seeking / buffering cases.
 */

/**
 * External dependencies
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatClock } from '../../utils/time';

// Player events that can move the playhead, change the duration, or extend the
// buffered range — any of them means the stripe needs a fresh read.
const READ_EVENTS = [ 'loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked', 'progress' ];

/**
 * Furthest buffered position, in seconds.
 *
 * @param {Object} player Video.js player.
 * @return {number} Buffered end (0 when unknown).
 */
const getBufferedEnd = ( player ) => {
	try {
		const ranges = player.buffered();
		let end = 0;
		for ( let i = 0; i < ranges.length; i++ ) {
			end = Math.max( end, ranges.end( i ) );
		}
		return end;
	} catch {
		// `buffered()` throws before the tech is ready.
		return 0;
	}
};

/**
 * Bottom-edge progress stripe.
 *
 * @param {Object}  props           Props.
 * @param {Object}  props.player    Video.js player instance (null until ready).
 * @param {boolean} props.isVisible Whether the stripe should render.
 * @return {JSX.Element|null} The stripe, or null when there is nothing to show.
 */
const PlayerProgressStripe = ( { player, isVisible = true } ) => {
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ duration, setDuration ] = useState( 0 );
	const [ bufferedEnd, setBufferedEnd ] = useState( 0 );
	const [ hoverFraction, setHoverFraction ] = useState( null );
	const [ isScrubbing, setIsScrubbing ] = useState( false );

	const trackRef = useRef( null );
	const rafRef = useRef( null );

	useEffect( () => {
		// Nothing to track while the stripe is hidden (Settings tab, or a layer is
		// open) — the rAF loop would re-render this component for no one.
		if ( ! player || ! isVisible ) {
			return;
		}

		const read = () => {
			if ( player.isDisposed() ) {
				return;
			}
			const total = player.duration();
			setDuration( Number.isFinite( total ) && total > 0 ? total : 0 );
			setCurrentTime( player.currentTime() || 0 );
			setBufferedEnd( getBufferedEnd( player ) );
		};

		const tick = () => {
			read();
			rafRef.current = requestAnimationFrame( tick );
		};

		const startTracking = () => {
			if ( rafRef.current === null ) {
				tick();
			}
		};

		const stopTracking = () => {
			if ( rafRef.current !== null ) {
				cancelAnimationFrame( rafRef.current );
				rafRef.current = null;
			}
			read();
		};

		player.on( READ_EVENTS, read );
		player.on( 'play', startTracking );
		player.on( [ 'pause', 'ended' ], stopTracking );

		read();
		if ( ! player.paused() ) {
			startTracking();
		}

		return () => {
			if ( rafRef.current !== null ) {
				cancelAnimationFrame( rafRef.current );
				rafRef.current = null;
			}
			// The player is disposed on unmount by its own effect; unbinding a
			// disposed player throws, so only detach while it is still alive.
			if ( ! player.isDisposed() ) {
				player.off( READ_EVENTS, read );
				player.off( 'play', startTracking );
				player.off( [ 'pause', 'ended' ], stopTracking );
			}
		};
	}, [ player, isVisible ] );

	const seekToTime = useCallback( ( seconds ) => {
		if ( ! player || player.isDisposed() || ! duration ) {
			return;
		}
		const clamped = Math.max( 0, Math.min( Number( seconds ) || 0, duration ) );
		player.currentTime( clamped );
		// Paint immediately: `timeupdate` can lag a frame or two behind a seek.
		setCurrentTime( clamped );
	}, [ player, duration ] );

	const handleHover = ( event ) => {
		const rect = trackRef.current?.getBoundingClientRect();
		if ( ! rect?.width ) {
			return;
		}
		const fraction = ( event.clientX - rect.left ) / rect.width;
		setHoverFraction( Math.max( 0, Math.min( fraction, 1 ) ) );
	};

	if ( ! isVisible || ! duration ) {
		return null;
	}

	const progress = Math.max( 0, Math.min( ( currentTime / duration ) * 100, 100 ) );
	const buffered = Math.max( 0, Math.min( ( bufferedEnd / duration ) * 100, 100 ) );

	return (
		<div
			className={ `godam-ve-stripe ${ isScrubbing ? 'is-scrubbing' : '' }`.trim() }
			onMouseMove={ handleHover }
			onMouseLeave={ () => setHoverFraction( null ) }
		>
			<div className="godam-ve-stripe__track" ref={ trackRef }>
				<span className="godam-ve-stripe__buffer" style={ { width: `${ buffered }%` } } />
				<span className="godam-ve-stripe__fill" style={ { width: `${ progress }%` } } />
				<span className="godam-ve-stripe__handle" style={ { left: `${ progress }%` } } />

				<input
					type="range"
					className="godam-ve-stripe__range"
					aria-label={ __( 'Video progress', 'godam' ) }
					min="0"
					max={ duration }
					step={ 0.01 }
					value={ currentTime }
					onChange={ ( event ) => seekToTime( event.target.value ) }
					onPointerDown={ () => setIsScrubbing( true ) }
					onPointerUp={ () => setIsScrubbing( false ) }
					onPointerCancel={ () => setIsScrubbing( false ) }
				/>
			</div>

			{ hoverFraction !== null && (
				<span
					className="godam-ve-stripe__bubble"
					style={ { left: `${ hoverFraction * 100 }%` } }
				>
					{ formatClock( hoverFraction * duration ) }
				</span>
			) }
		</div>
	);
};

export default PlayerProgressStripe;

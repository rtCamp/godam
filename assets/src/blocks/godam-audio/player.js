/**
 * WordPress dependencies
 */
import { useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatTime } from '../../js/godam-player/utils/dataHelpers';

/**
 * Minimal audio player used in the block editor canvas. Renders the same
 * `.godam-audio-player` markup and classes as the front-end (built by view.js)
 * and mirrors the customization editor's preview player — plain triangle
 * play/pause control, a rounded progress bar with no knob, and the duration —
 * so the player looks identical across the editor canvas, the customization
 * editor, and the front end.
 *
 * @param {Object} props     Props.
 * @param {string} props.src Audio source URL.
 * @return {JSX.Element} The player.
 */
const AudioMiniPlayer = ( { src } ) => {
	const audioRef = useRef( null );
	const [ isPlaying, setIsPlaying ] = useState( false );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ duration, setDuration ] = useState( 0 );

	const progress = duration > 0 ? ( currentTime / duration ) * 100 : 0;

	const togglePlay = () => {
		const audio = audioRef.current;
		if ( ! audio ) {
			return;
		}
		if ( audio.paused ) {
			audio.play();
		} else {
			audio.pause();
		}
	};

	return (
		<div className="godam-audio-player">
			<button
				type="button"
				className="godam-audio-player__play"
				onClick={ togglePlay }
				aria-label={ isPlaying ? __( 'Pause', 'godam' ) : __( 'Play', 'godam' ) }
			>
				<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
					{ isPlaying
						? <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
						: <path d="M8 5v14l11-7z" fill="currentColor" /> }
				</svg>
			</button>
			<input
				type="range"
				className="godam-audio-player__scrubber"
				min="0"
				max={ duration || 0 }
				step="0.1"
				value={ currentTime }
				onChange={ ( e ) => {
					const audio = audioRef.current;
					if ( audio ) {
						audio.currentTime = parseFloat( e.target.value );
					}
				} }
				style={ { '--godam-audio-progress': `${ progress }%` } }
				aria-label={ __( 'Seek', 'godam' ) }
			/>
			<span className="godam-audio-player__time">{ formatTime( duration ) }</span>
			<audio
				ref={ audioRef }
				src={ src }
				preload="metadata"
				onLoadedMetadata={ ( e ) => setDuration( e.target.duration || 0 ) }
				onTimeUpdate={ ( e ) => setCurrentTime( e.target.currentTime || 0 ) }
				onPlay={ () => setIsPlaying( true ) }
				onPause={ () => setIsPlaying( false ) }
				onEnded={ () => setIsPlaying( false ) }
			/>
		</div>
	);
};

export default AudioMiniPlayer;

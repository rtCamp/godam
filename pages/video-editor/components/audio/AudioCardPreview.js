/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useRef, useEffect, useMemo } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { check, copy } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getChapterRows } from '../chapters/utils';
import { parseCaptions, formatClock } from '../transcription/utils';
import { useGetTranscriptionQuery } from '../../redux/api/transcription';
import './audio-card-preview.scss';

/**
 * Strip HTML tags from a rendered string (attachment description/caption come
 * back as rendered HTML).
 *
 * @param {string} html Rendered HTML.
 * @return {string} Plain text.
 */
const stripHtml = ( html ) => {
	if ( ! html || typeof html !== 'string' ) {
		return '';
	}
	const el = document.createElement( 'div' );
	el.innerHTML = html;
	return ( el.textContent || el.innerText || '' ).trim();
};

/**
 * Live audio preview shown in the customization editor's stage for audio
 * attachments. Renders the exact same card / player / Chapters+Transcript
 * markup and classes as the block editor and front end (shared styles live in
 * assets/src/css/_godam-audio-card.scss), so all three surfaces look identical.
 * Chapters come from the Redux store (edited live in the Chapters tab);
 * transcript cues are fetched from the attachment's saved caption file.
 *
 * @param {Object}   props                  Props.
 * @param {number}   props.attachmentID     Attachment ID (for the transcript query).
 * @param {Object}   props.attachmentConfig The `/wp/v2/media/:id` payload.
 * @param {Array}    props.sources          Playable sources ([{ src, type }]).
 * @param {Function} [props.onDuration]     Reports the loaded audio duration upward.
 * @param {Object}   [props.seekRef]        Mutable ref set to a seek(seconds) fn so the editor's Chapters tab can drive this player.
 * @return {JSX.Element} The audio preview card.
 */
const AudioCardPreview = ( { attachmentID, attachmentConfig, sources, onDuration, seekRef } ) => {
	const audioRef = useRef( null );
	const [ isPlaying, setIsPlaying ] = useState( false );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ duration, setDuration ] = useState( 0 );
	const [ activeTab, setActiveTab ] = useState( 'chapters' );
	const [ collapsed, setCollapsed ] = useState( false );
	const [ cues, setCues ] = useState( [] );
	const [ copied, setCopied ] = useState( false );

	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const chapterRows = useMemo( () => getChapterRows( chapters || [], duration ), [ chapters, duration ] );

	const title =
		attachmentConfig?.title?.rendered ||
		attachmentConfig?.title ||
		__( 'Untitled audio', 'godam' );
	// WordPress can seed an attachment's description with the raw media URL;
	// strip any URLs so the file path never shows up as description copy.
	const description = stripHtml(
		attachmentConfig?.description?.rendered || attachmentConfig?.caption?.rendered || '',
	)
		.replace( /https?:\/\/\S+/g, '' )
		.replace( /\s+/g, ' ' )
		.trim();
	const audioSrc = sources?.[ 0 ]?.src || attachmentConfig?.source_url || '';
	// GoDAM audio stores its cover in post meta (rtgodam_media_audio_thumbnail),
	// exposed under `.meta` in the /wp/v2/media payload. Fall back to the video
	// thumbnail key for safety.
	const cover =
		attachmentConfig?.meta?.rtgodam_media_audio_thumbnail ||
		attachmentConfig?.meta?.rtgodam_media_video_thumbnail ||
		'';

	// Fetch the saved transcript path, then load and parse the caption file.
	const { data: transcription } = useGetTranscriptionQuery( attachmentID, { skip: ! attachmentID } );
	const transcriptPath = transcription?.transcript_path;

	useEffect( () => {
		let cancelled = false;
		if ( ! transcriptPath ) {
			setCues( [] );
			return undefined;
		}
		( async () => {
			try {
				const response = await fetch( transcriptPath );
				if ( cancelled ) {
					return;
				}
				// Clear any previously loaded cues when the new path 404s, so a
				// stale transcript doesn't keep rendering after a regenerate/upload.
				if ( ! response.ok ) {
					setCues( [] );
					return;
				}
				const raw = await response.text();
				if ( ! cancelled ) {
					setCues( parseCaptions( raw ) );
				}
			} catch {
				// Clear stale cues on failure; the empty state is shown.
				if ( ! cancelled ) {
					setCues( [] );
				}
			}
		} )();
		return () => {
			cancelled = true;
		};
	}, [ transcriptPath ] );

	// Index of the cue under the playhead, for active-line highlighting.
	const activeCueIndex = useMemo( () => {
		return cues.findIndex( ( cue ) => currentTime >= cue.start && currentTime < cue.end );
	}, [ cues, currentTime ] );

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

	const handleSeek = ( time ) => {
		const audio = audioRef.current;
		if ( audio && Number.isFinite( time ) ) {
			audio.currentTime = time;
		}
	};

	// Expose seeking to the editor's Chapters tab (left panel) so clicking a
	// chapter there scrubs this preview.
	useEffect( () => {
		if ( seekRef ) {
			seekRef.current = handleSeek;
		}
		return () => {
			if ( seekRef ) {
				seekRef.current = null;
			}
		};
	}, [ seekRef ] );

	const handleLoadedMetadata = ( e ) => {
		const value = e.target.duration || 0;
		setDuration( value );
		onDuration?.( value );
	};

	const handleCopyTranscript = async () => {
		if ( ! cues.length || ! navigator.clipboard?.writeText ) {
			return;
		}
		await navigator.clipboard.writeText( cues.map( ( cue ) => cue.text ).join( '\n' ) );
		setCopied( true );
		setTimeout( () => setCopied( false ), 2000 );
	};

	const progress = duration > 0 ? ( currentTime / duration ) * 100 : 0;

	return (
		<div className="godam-audio-preview" data-test-id="godam-audio-editor-preview">
			<div className="godam-audio-card">
				<div className="godam-audio-card__head">
					<div className="godam-audio-card__cover">
						{ cover && (
							<img src={ cover } alt="" />
						) }
					</div>
					<div className="godam-audio-card__body">
						<h3 className="godam-audio-card__title">{ title }</h3>
						{ description && (
							<p className="godam-audio-card__description">{ description }</p>
						) }

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
								onChange={ ( e ) => handleSeek( parseFloat( e.target.value ) ) }
								style={ { '--godam-audio-progress': `${ progress }%` } }
								aria-label={ __( 'Seek', 'godam' ) }
							/>
							<span className="godam-audio-player__time">{ formatClock( duration ) }</span>
							<audio
								ref={ audioRef }
								src={ audioSrc }
								preload="metadata"
								onLoadedMetadata={ handleLoadedMetadata }
								onTimeUpdate={ ( e ) => setCurrentTime( e.target.currentTime || 0 ) }
								onPlay={ () => setIsPlaying( true ) }
								onPause={ () => setIsPlaying( false ) }
								onEnded={ () => setIsPlaying( false ) }
							/>
						</div>
					</div>
				</div>

				<div className={ `godam-audio-tabs${ collapsed ? ' is-collapsed' : '' }` }>
					<div className="godam-audio-tabs__bar">
						<div className="godam-audio-tabs__nav" role="tablist">
							<button
								type="button"
								role="tab"
								aria-selected={ activeTab === 'chapters' }
								className={ `godam-audio-tabs__tab${ activeTab === 'chapters' ? ' is-active' : '' }` }
								onClick={ () => setActiveTab( 'chapters' ) }
							>
								{ __( 'Chapters', 'godam' ) }
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={ activeTab === 'transcript' }
								className={ `godam-audio-tabs__tab${ activeTab === 'transcript' ? ' is-active' : '' }` }
								onClick={ () => setActiveTab( 'transcript' ) }
							>
								{ __( 'Transcript', 'godam' ) }
							</button>
						</div>
						<button
							type="button"
							className="godam-audio-tabs__toggle"
							aria-expanded={ ! collapsed }
							aria-label={ __( 'Toggle panel', 'godam' ) }
							onClick={ () => setCollapsed( ( value ) => ! value ) }
						>
							<span className="dashicons dashicons-arrow-down-alt2"></span>
						</button>
					</div>

					{ ! collapsed && (
						<div className="godam-audio-tabs__body">
							{ activeTab === 'chapters' && (
								<div className="godam-audio-tabs__panel">
									{ chapterRows.length === 0 && (
										<p className="godam-audio-tabs__empty">{ __( 'No chapters to show', 'godam' ) }</p>
									) }
									{ chapterRows.map( ( row, index ) => (
										<button
											type="button"
											key={ row.id }
											className="godam-audio-tabs__row"
											onClick={ () => handleSeek( row.startSeconds ) }
										>
											<span className="godam-audio-tabs__stamp">{ formatClock( row.startSeconds ) }</span>
											<span className="godam-audio-tabs__row-text">
												{ row.text?.trim() || __( 'Chapter', 'godam' ) + ' ' + ( index + 1 ) }
											</span>
										</button>
									) ) }
								</div>
							) }

							{ activeTab === 'transcript' && (
								<div className="godam-audio-tabs__panel">
									{ cues.length === 0 && (
										<p className="godam-audio-tabs__empty">{ __( 'No transcript to show', 'godam' ) }</p>
									) }
									{ cues.length > 0 && (
										<>
											<button
												type="button"
												className={ `godam-audio-tabs__copy${ copied ? ' is-copied' : '' }` }
												aria-label={ copied ? __( 'Copied', 'godam' ) : __( 'Copy transcript', 'godam' ) }
												onClick={ handleCopyTranscript }
											>
												<Icon icon={ copied ? check : copy } size={ 20 } />
											</button>
											<div className="godam-audio-tabs__transcript">
												{ cues.map( ( cue, index ) => (
													<button
														type="button"
														key={ index }
														className={ `godam-audio-tabs__row${ index === activeCueIndex ? ' is-active' : '' }` }
														onClick={ () => handleSeek( cue.start ) }
													>
														<span className="godam-audio-tabs__stamp">{ formatClock( cue.start ) }</span>
														<span className="godam-audio-tabs__row-text">{ cue.text }</span>
													</button>
												) ) }
											</div>
										</>
									) }
								</div>
							) }
						</div>
					) }
				</div>
			</div>
		</div>
	);
};

export default AudioCardPreview;

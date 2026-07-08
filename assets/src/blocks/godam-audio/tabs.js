/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { check, copy } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { formatTime } from '../../js/godam-player/utils/dataHelpers';
import { parseCaptions } from '../../js/godam-player/utils/parseCaptions';

/**
 * Editor-canvas Chapters / Transcript panel for the audio block.
 *
 * Mirrors the front-end panel (render.php) so the block preview matches what
 * visitors see. Chapters come from the attachment's `rtgodam_meta.chapters`
 * and the transcript from its saved caption file — both edited in the
 * "Customize Audio" editor and fetched here by attachment id. Display-only
 * (no seeking) since this is a block preview.
 *
 * @param {Object}   props                Props.
 * @param {number}   props.id             Attachment ID.
 * @param {boolean}  props.showTranscript Whether the Transcript tab is enabled.
 * @param {boolean}  [props.showChapters] Whether the Chapters tab is enabled (default true).
 * @param {Function} [props.onRendered]   Called with whether the panel renders so the card can join it visually.
 * @return {JSX.Element|null} The panel, or null when there's nothing to show.
 */
const AudioTabs = ( { id, showTranscript, showChapters = true, onRendered } ) => {
	const [ chapters, setChapters ] = useState( [] );
	const [ cues, setCues ] = useState( [] );
	const [ activeTab, setActiveTab ] = useState( 'chapters' );
	const [ collapsed, setCollapsed ] = useState( false );
	const [ copied, setCopied ] = useState( false );

	const handleCopyTranscript = async () => {
		if ( ! cues.length || ! navigator.clipboard?.writeText ) {
			return;
		}
		await navigator.clipboard.writeText( cues.map( ( cue ) => cue.text ).join( '\n' ) );
		setCopied( true );
		setTimeout( () => setCopied( false ), 2000 );
	};

	useEffect( () => {
		let cancelled = false;

		if ( ! id || ( ! showTranscript && ! showChapters ) ) {
			setChapters( [] );
			setCues( [] );
			return undefined;
		}

		// Chapters live on the attachment's rtgodam_meta.
		apiFetch( { path: `/wp/v2/media/${ id }` } )
			.then( ( media ) => {
				if ( cancelled ) {
					return;
				}
				const raw = media?.rtgodam_meta?.chapters;
				const list = Array.isArray( raw ) ? raw : [];
				setChapters(
					list.map( ( chapter ) => ( {
						start: parseFloat( chapter.startTime ) || 0,
						text: chapter.text || '',
					} ) ),
				);
			} )
			.catch( () => {} );

		// Transcript is a saved caption file resolved by the transcription REST.
		apiFetch( { path: `/godam/v1/transcription?attachment_id=${ id }` } )
			.then( async ( res ) => {
				const path = res?.transcript_path;
				if ( ! path ) {
					if ( ! cancelled ) {
						setCues( [] );
					}
					return;
				}
				const response = await fetch( path );
				const text = response.ok ? await response.text() : '';
				if ( ! cancelled ) {
					setCues( parseCaptions( text ) );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setCues( [] );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ id, showTranscript, showChapters ] );

	// Match the front end: the panel appears only when enabled and there's
	// something to show.
	const chaptersVisible = showChapters && chapters.length > 0;
	const transcriptVisible = showTranscript && cues.length > 0;
	const shouldRender = chaptersVisible || transcriptVisible;

	// Resolve the active tab against what's actually visible, so hiding a tab
	// falls back to the other instead of showing an empty body.
	const availableTabs = [ chaptersVisible && 'chapters', transcriptVisible && 'transcript' ].filter( Boolean );
	const currentTab = availableTabs.includes( activeTab ) ? activeTab : availableTabs[ 0 ];

	useEffect( () => {
		onRendered?.( shouldRender );
	}, [ shouldRender, onRendered ] );

	if ( ! shouldRender ) {
		return null;
	}

	return (
		<div className="godam-audio-tabs" data-test-id="godam-audio-editor-tabs">
			<div className="godam-audio-tabs__bar">
				<div className="godam-audio-tabs__nav" role="tablist">
					{ chaptersVisible && (
						<button
							type="button"
							className={ `godam-audio-tabs__tab${ currentTab === 'chapters' ? ' is-active' : '' }` }
							role="tab"
							aria-selected={ currentTab === 'chapters' }
							onClick={ () => setActiveTab( 'chapters' ) }
						>
							{ __( 'Chapters', 'godam' ) }
						</button>
					) }
					{ transcriptVisible && (
						<button
							type="button"
							className={ `godam-audio-tabs__tab${ currentTab === 'transcript' ? ' is-active' : '' }` }
							role="tab"
							aria-selected={ currentTab === 'transcript' }
							onClick={ () => setActiveTab( 'transcript' ) }
						>
							{ __( 'Transcript', 'godam' ) }
						</button>
					) }
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
					{ currentTab === 'chapters' && (
						<div className="godam-audio-tabs__panel">
							{ chapters.length === 0 && (
								<p className="godam-audio-tabs__empty">{ __( 'No chapters to show', 'godam' ) }</p>
							) }
							{ chapters.length > 0 && (
								<ul className="godam-audio-tabs__list">
									{ chapters.map( ( chapter, index ) => (
										<li key={ index }>
											<div className="godam-audio-tabs__row">
												<span className="godam-audio-tabs__stamp">{ formatTime( chapter.start ) }</span>
												<span className="godam-audio-tabs__row-text">{ chapter.text }</span>
											</div>
										</li>
									) ) }
								</ul>
							) }
						</div>
					) }

					{ currentTab === 'transcript' && (
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
											<div className="godam-audio-tabs__row" key={ index }>
												<span className="godam-audio-tabs__stamp">{ formatTime( cue.start ) }</span>
												<span className="godam-audio-tabs__row-text">{ cue.text }</span>
											</div>
										) ) }
									</div>
								</>
							) }
						</div>
					) }
				</div>
			) }
		</div>
	);
};

export default AudioTabs;

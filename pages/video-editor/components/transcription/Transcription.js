/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Spinner, Notice, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { plus, update, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	useGetTranscriptionQuery,
	useGenerateTranscriptionMutation,
	useUploadTranscriptionMutation,
	useDeleteTranscriptionMutation,
} from '../../redux/api/transcription';
import { parseCaptions, formatClock, formatBytes, isTranscribingStatus } from './utils';

const BoltIcon = (
	<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
		<path d="M10.8334 1.66699L3.41671 10.5673C3.12614 10.916 2.98086 11.0904 2.97864 11.2376C2.97672 11.3656 3.03377 11.4874 3.13355 11.5677C3.24834 11.6601 3.4754 11.6601 3.92952 11.6601H10L9.16671 18.3337L16.5834 9.4333C16.8739 9.08457 17.0192 8.91021 17.0214 8.76304C17.0234 8.63503 16.9663 8.51319 16.8665 8.43288C16.7517 8.34049 16.5247 8.34049 16.0706 8.34049H10L10.8334 1.66699Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

/**
 * Transcription tab panel.
 *
 * Drives the design states off the SaaS job status: an empty state with
 * "Generate" / "Upload" actions, a busy state with progress copy while AI
 * transcription runs, and the ready state showing the file meta + cue list
 * (with Replace / Delete actions). Uploading a caption file is a quiet action
 * — it just opens the media picker and swaps the transcript in.
 *
 * The transcript is stored on the attachment (not in `rtgodam_meta`), so this
 * panel owns its data via the transcription API rather than the editor store.
 *
 * @param {Object} props              Props.
 * @param {number} props.attachmentID WordPress attachment id.
 * @param {number} props.duration     Video duration in seconds (for the header).
 * @param {string} [props.fileSize]   Pre-formatted media size shown beside the duration.
 * @return {JSX.Element} The Transcription panel.
 */
const Transcription = ( { attachmentID, duration, fileSize } ) => {
	const [ isGenerating, setIsGenerating ] = useState( false );
	const [ cues, setCues ] = useState( [] );
	const [ cuesLoading, setCuesLoading ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ confirmDelete, setConfirmDelete ] = useState( false );

	const { data: transcription } = useGetTranscriptionQuery( attachmentID, {
		// Poll while a generation job is running so the panel flips to "ready"
		// on its own once the SaaS finishes.
		pollingInterval: isGenerating ? 8000 : 0,
	} );

	const [ generateTranscription ] = useGenerateTranscriptionMutation();
	const [ uploadTranscription ] = useUploadTranscriptionMutation();
	const [ deleteTranscription, { isLoading: isDeleting } ] = useDeleteTranscriptionMutation();

	const transcriptPath = transcription?.transcript_path || '';
	const status = transcription?.status || '';
	const isReady = Boolean( transcriptPath );

	// Once a generation job we're polling for resolves, drop out of the busy state.
	useEffect( () => {
		if ( isGenerating && ( isReady || status === 'Failed' ) ) {
			setIsGenerating( false );
			if ( status === 'Failed' ) {
				setError( __( 'Transcription failed. Please try again.', 'godam' ) );
			}
		}
	}, [ isGenerating, isReady, status ] );

	// Fetch and parse the caption file whenever the path changes.
	useEffect( () => {
		let cancelled = false;
		if ( ! transcriptPath ) {
			setCues( [] );
			return undefined;
		}
		setCuesLoading( true );
		fetch( transcriptPath )
			.then( ( res ) => ( res.ok ? res.text() : Promise.reject( res ) ) )
			.then( ( text ) => {
				if ( ! cancelled ) {
					setCues( parseCaptions( text ) );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setCues( [] );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setCuesLoading( false );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ transcriptPath ] );

	const handleGenerate = async () => {
		setError( '' );
		setIsGenerating( true );
		try {
			const result = await generateTranscription( attachmentID ).unwrap();
			// SaaS may answer synchronously when the transcript already exists.
			if ( result?.transcript_path ) {
				setIsGenerating( false );
			} else if ( result?.success === false && result?.error && ! isTranscribingStatus( result?.current_status ) ) {
				// Anything other than "already in progress" surfaces as an error.
				setIsGenerating( false );
				setError( result.error );
			}
		} catch ( err ) {
			setIsGenerating( false );
			setError( err?.data?.message || __( 'Could not start transcription. Please try again.', 'godam' ) );
		}
	};

	// Open the media picker and attach the chosen .vtt / .srt as the transcript.
	// Used by both "Upload File" (empty state) and "Replace" (ready state) — a
	// quiet action with no progress/success messaging; the panel just updates.
	const handleUpload = () => {
		setError( '' );
		const frame = wp.media( {
			title: __( 'Select a caption file', 'godam' ),
			button: { text: __( 'Use this file', 'godam' ) },
			library: { type: [ 'text/vtt', 'application/x-subrip', 'text/plain' ] },
			multiple: false,
		} );

		frame.on( 'select', async () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			const url = attachment?.url || '';
			if ( ! /\.(vtt|srt)$/i.test( url ) ) {
				setError( __( 'Please choose a .vtt or .srt caption file.', 'godam' ) );
				return;
			}
			try {
				await uploadTranscription( { attachmentID, url } ).unwrap();
			} catch ( err ) {
				setError( err?.data?.message || __( 'Could not attach the caption file.', 'godam' ) );
			}
		} );

		frame.open();
	};

	const handleDelete = async () => {
		setConfirmDelete( false );
		setError( '' );
		try {
			await deleteTranscription( attachmentID ).unwrap();
			setCues( [] );
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not remove the transcript.', 'godam' ) );
		}
	};

	const durationLabel = formatClock( duration );
	const sizeLabel = fileSize || formatBytes( transcription?.file_size );
	const fileName = transcription?.file_name || __( 'Transcript', 'godam' );
	const showReady = isReady && ! isGenerating;

	return (
		<div className="godam-ve-transcription">
			<div className="godam-ve-transcription__head">
				<h2 className="godam-ve-transcription__title">{ __( 'Transcription', 'godam' ) }</h2>
				{ showReady && (
					<p className="godam-ve-transcription__subtitle">
						{ [ durationLabel, sizeLabel ].filter( Boolean ).join( ' • ' ) }
					</p>
				) }
			</div>

			<div className="godam-ve-transcription__body">
				{ error && (
					<Notice status="error" isDismissible onRemove={ () => setError( '' ) }>
						{ error }
					</Notice>
				) }

				{ showReady ? (
					/* ---- Ready: file row + cue list (Flow 35) ---- */
					<>
						<div className="godam-ve-transcription__file">
							<span className="godam-ve-transcription__file-name">{ fileName }</span>
							<div className="godam-ve-transcription__file-actions">
								<Button
									icon={ update }
									label={ __( 'Replace transcription file', 'godam' ) }
									showTooltip
									onClick={ handleUpload }
								/>
								<Button
									icon={ trash }
									label={ __( 'Delete transcription', 'godam' ) }
									showTooltip
									isDestructive
									isBusy={ isDeleting }
									onClick={ () => setConfirmDelete( true ) }
								/>
							</div>
						</div>

						{ cuesLoading ? (
							<div className="godam-ve-transcription__loader">
								<Spinner />
							</div>
						) : (
							<ul className="godam-ve-transcription__cues">
								{ cues.map( ( cue, index ) => (
									<li key={ index } className="godam-ve-transcription__cue">
										<span className="godam-ve-transcription__cue-time">{ formatClock( cue.start ) }</span>
										<p className="godam-ve-transcription__cue-text">{ cue.text }</p>
									</li>
								) ) }
								{ cues.length === 0 && (
									<li className="godam-ve-transcription__cue-empty">
										{ __( 'No cues found in this caption file.', 'godam' ) }
									</li>
								) }
							</ul>
						) }
					</>
				) : (
					/* ---- Empty / Generating (Flow 32 + 33) ---- */
					<div className="godam-ve-transcription__generate">
						<p className="godam-ve-transcription__help">
							{ __( "Automatically transcribe the audio using GoDAM's AI engine", 'godam' ) }
						</p>
						<Button
							className="godam-ve-transcription__generate-btn"
							variant="secondary"
							icon={ BoltIcon }
							disabled={ isGenerating }
							onClick={ handleGenerate }
						>
							{ __( 'Generate Transcription', 'godam' ) }
						</Button>

						<div className="godam-ve-transcription__divider">
							<span>{ __( 'OR', 'godam' ) }</span>
						</div>

						{ isGenerating ? (
							<div className="godam-ve-transcription__progress">
								<Spinner />
								<p className="godam-ve-transcription__progress-title">
									{ __( 'Generating transcription…', 'godam' ) }
								</p>
								<p className="godam-ve-transcription__progress-note">
									{ __( "This usually takes 10–15 minutes. We'll notify you once it's ready", 'godam' ) }
								</p>
								<span className="godam-ve-transcription__progress-bar" aria-hidden="true" />
							</div>
						) : (
							<Button
								className="godam-ve-transcription__upload-btn"
								variant="secondary"
								icon={ plus }
								onClick={ handleUpload }
							>
								{ __( 'Upload File', 'godam' ) }
							</Button>
						) }
					</div>
				) }
			</div>

			{ confirmDelete && (
				<Modal
					title={ __( 'Delete transcription', 'godam' ) }
					onRequestClose={ () => setConfirmDelete( false ) }
				>
					<p>{ __( 'Delete this transcription? This cannot be undone.', 'godam' ) }</p>
					<div className="flex justify-between items-center gap-3">
						<Button
							variant="tertiary"
							className="w-full justify-center"
							onClick={ () => setConfirmDelete( false ) }
						>
							{ __( 'Cancel', 'godam' ) }
						</Button>
						<Button
							variant="primary"
							className="w-full justify-center"
							isDestructive
							onClick={ handleDelete }
						>
							{ __( 'Delete', 'godam' ) }
						</Button>
					</div>
				</Modal>
			) }
		</div>
	);
};

export default Transcription;

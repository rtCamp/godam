/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Modal, Spinner, Notice, TextareaControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useUpdateCaptionMutation } from '../../redux/api/transcription';
import { parseCaptions, cuesToVTT, formatClock } from './utils';

/**
 * Cue editor for a single caption track.
 *
 * Mirrors Central's "Correct" flow: fetch the track's VTT, let the user fix the
 * text of each cue (timings are read-only here), then write a rebuilt VTT back
 * via `update_caption`. Only offered for tracks the SaaS can round-trip — the
 * caption manager disables it for `has_rich_formatting` rows.
 *
 * @param {Object}   props              Props.
 * @param {number}   props.attachmentID WordPress attachment id.
 * @param {Object}   props.caption      Caption-track row being edited.
 * @param {Function} props.onClose      Close handler.
 * @return {JSX.Element} The cue editor modal.
 */
const CaptionCueEditor = ( { attachmentID, caption, onClose } ) => {
	const [ cues, setCues ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( '' );

	const [ updateCaption, { isLoading: isSaving } ] = useUpdateCaptionMutation();

	// Load and parse the caption file.
	useEffect( () => {
		let cancelled = false;
		if ( ! caption?.vtt_path ) {
			setLoading( false );
			return undefined;
		}
		setLoading( true );
		fetch( caption.vtt_path )
			.then( ( res ) => ( res.ok ? res.text() : Promise.reject( res ) ) )
			.then( ( text ) => {
				if ( ! cancelled ) {
					setCues( parseCaptions( text ) );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setError( __( 'Could not load this caption file.', 'godam' ) );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setLoading( false );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ caption?.vtt_path ] );

	const setCueText = ( index, text ) => {
		setCues( ( prev ) => prev.map( ( cue, i ) => ( i === index ? { ...cue, text } : cue ) ) );
	};

	const handleSave = async () => {
		setError( '' );
		try {
			await updateCaption( {
				attachmentID,
				captionID: caption.caption_id,
				content: cuesToVTT( cues ),
			} ).unwrap();
			onClose();
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not save the caption.', 'godam' ) );
		}
	};

	const title = caption?.label
		? sprintf( /* translators: %s: caption track label. */ __( 'Edit captions — %s', 'godam' ), caption.label )
		: __( 'Edit captions', 'godam' );

	return (
		<Modal title={ title } onRequestClose={ onClose } className="godam-ve-caption-cue-editor">
			{ error && (
				<Notice status="error" isDismissible onRemove={ () => setError( '' ) }>
					{ error }
				</Notice>
			) }

			{ loading ? (
				<div className="godam-ve-transcription__loader">
					<Spinner />
				</div>
			) : (
				<ul className="godam-ve-caption-cue-editor__cues">
					{ cues.map( ( cue, index ) => (
						<li key={ index } className="godam-ve-caption-cue-editor__cue">
							<span className="godam-ve-caption-cue-editor__time">
								{ formatClock( cue.start ) }
							</span>
							<TextareaControl
								__nextHasNoMarginBottom
								label={ sprintf(
									/* translators: %s: cue start time, e.g. 01:23. */
									__( 'Caption text at %s', 'godam' ),
									formatClock( cue.start ),
								) }
								hideLabelFromVision
								value={ cue.text }
								rows={ 2 }
								onChange={ ( value ) => setCueText( index, value ) }
							/>
						</li>
					) ) }
					{ cues.length === 0 && (
						<li className="godam-ve-caption-cue-editor__empty">
							{ __( 'No cues found in this caption file.', 'godam' ) }
						</li>
					) }
				</ul>
			) }

			<div className="flex justify-between items-center gap-3">
				<Button variant="tertiary" className="w-full justify-center" onClick={ onClose }>
					{ __( 'Cancel', 'godam' ) }
				</Button>
				<Button
					variant="primary"
					className="w-full justify-center"
					isBusy={ isSaving }
					disabled={ isSaving || loading || cues.length === 0 }
					onClick={ handleSave }
				>
					{ __( 'Save', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default CaptionCueEditor;

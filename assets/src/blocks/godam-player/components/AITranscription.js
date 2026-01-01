/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { BaseControl, Button, Spinner, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { ReactComponent as TranscriptIcon } from '../../../images/ai-transcript.svg';

/**
 * AI Transcription component for GoDAM video block.
 *
 * @param {Object}   props                         Component props.
 * @param {number}   props.attachmentId            The attachment ID.
 * @param {number}   props.instanceId              The instance ID for unique control IDs.
 * @param {boolean}  props.hasTranscription        Whether transcription already exists.
 * @param {Function} props.onTranscriptionComplete Callback when transcription is generated.
 *
 * @return {JSX.Element} The AI Transcription component.
 */
export default function AITranscription( {
	attachmentId,
	instanceId,
	hasTranscription = false,
	onTranscriptionComplete,
} ) {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	/**
	 * Handle generate transcription button click.
	 */
	const handleGenerateTranscription = async () => {
		setIsLoading( true );
		setNotice( null );

		try {
			const response = await apiFetch( {
				path: '/godam/v1/ai-transcription/process',
				method: 'POST',
				data: {
					attachment_id: attachmentId,
				},
			} );

			if ( response.success ) {
				// Call the callback to update tracks in parent component
				if ( onTranscriptionComplete ) {
					await onTranscriptionComplete();
				}
			} else {
				throw new Error(
					response.message ||
					__( 'Failed to generate transcription.', 'godam' ),
				);
			}
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message:
					error.message ||
					__( 'An error occurred while generating transcription.', 'godam' ),
			} );
		} finally {
			setIsLoading( false );
		}
	};

	// Don't show anything if attachment ID is invalid.
	if ( ! attachmentId || isNaN( Number( attachmentId ) ) ) {
		return null;
	}

	let buttonLabel = __( 'Generate AI Transcription', 'godam' );
	if ( isLoading ) {
		buttonLabel = __( 'Generating…', 'godam' );
	} else if ( hasTranscription ) {
		buttonLabel = __( 'Transcription Generated', 'godam' );
	}

	const helpText = __(
		'Generate AI-powered captions for the video. Once generated, captions will be available automatically in the player.',
		'godam',
	);

	const isButtonDisabled = hasTranscription || isLoading;

	return (
		<BaseControl
			id={ `video-block__ai-transcription-${ instanceId }` }
			label={ __( 'AI Transcription', 'godam' ) }
			help={ helpText }
			__nextHasNoMarginBottom
		>
			<div className="ai_transcription_control__content">
				<Button
					__next40pxDefaultSize
					variant="primary"
					onClick={ handleGenerateTranscription }
					disabled={ isButtonDisabled }
					icon={ isLoading && <Spinner /> }
					isBusy={ isLoading }
				>
					<span className="ai_transcription_control__button_content">
						{ buttonLabel }
						<TranscriptIcon
							aria-label={ __( 'AI transcription icon', 'godam' ) }
							role="img"
							className={
								`ai_transcription_control__icon` +
								( isButtonDisabled
									? ' ai_transcription_control__icon_disabled'
									: '' )
							}
						/>
					</span>
				</Button>

				{ notice && (
					<div className="ai_transcription_control__notice_wrapper">
						<Notice
							status={ notice.type }
							isDismissible={ false }
						>
							{ notice.message }
						</Notice>
					</div>
				) }
			</div>
		</BaseControl>
	);
}

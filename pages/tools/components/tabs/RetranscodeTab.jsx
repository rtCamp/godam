/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import {
	Button,
	Panel,
	PanelBody,
	Snackbar,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef } from '@wordpress/element';
/**
 * Internal dependencies
 */
import ProgressBar from '../ProgressBar.jsx';

const RetranscodeTab = () => {
	const [ error, setError ] = useState( null );
	const [ fetchingMedia, setFetchingMedia ] = useState( false );
	const [ retranscoding, setRetranscoding ] = useState( false );
	const [ attachments, setAttachments ] = useState( [] );
	const [ mediaCount, setMediaCount ] = useState( 0 );
	const [ aborted, setAborted ] = useState( false );
	const [ logs, setLogs ] = useState( [] );
	const [ done, setDone ] = useState( false );
	const [ forceRetranscode, setForceRetranscode ] = useState( false );

	// Use a ref to track if the operation should be aborted.
	const abortRef = useRef( false );

	const mediaPageUrl = `${ window.godamRestRoute?.adminUrl || '/wp-admin/' }upload.php`;

	const description = sprintf(
		// translators: %s is the URL to the Media page in the WordPress admin.
		__(
			"You can retranscode specific media files (rather than ALL pending media) from the <a class='godam-url' href='%s'>Media</a> page using Bulk Action via drop down or mouse hover a specific media video file.",
			'godam',
		),
		mediaPageUrl,
	);

	const fetchRetranscodeMedia = () => {
		setFetchingMedia( true );
		setError( null );

		// Add force param if checkbox is checked
		const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/not-transcoded${ forceRetranscode ? '?force=1' : '' }`;

		axios.get( url, {
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} )
			.then( ( response ) => {
				//console.log( 'Fetched media for retranscoding:', response.data );
				if ( response.data?.data && Array.isArray( response.data.data ) && response.data.data.length > 0 ) {
					setAttachments( response.data.data );
					//console.log( 'Media files fetched for retranscoding:', response.data.data );
				} else {
					setError( {
						message: __( 'No media files found for retranscoding.', 'godam' ),
						details: __( 'Please ensure you have media files that require retranscoding.', 'godam' ),
					} );
				}
			} )
			.catch( ( err ) => {
				setError( {
					message: __( 'An error occurred while fetching media for retranscoding.', 'godam' ),
					details: err.response ? err.response.data.message : err.message,
				} );
			} )
			.finally( () => {
				setFetchingMedia( false );
			} );
	};

	const abortRetranscoding = () => {
		abortRef.current = true;
		setAborted( true );
		setRetranscoding( false );
	};

	const startRetranscoding = async () => {
		if ( attachments?.length > 0 ) {
			setRetranscoding( true );
			setAborted( false );
			setMediaCount( 0 );
			setLogs( [] );
			setDone( false );
			abortRef.current = false;

			for ( let i = 0; i < attachments.length; i++ ) {
				// Check if abort was requested.
				if ( abortRef.current ) {
					break;
				}

				const attachment = attachments[ i ];

				try {
					const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode`;

					const res = await axios.post( url, {
						id: attachment,
					}, {
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': window.godamRestRoute?.nonce,
						},
					} );

					const data = res.data;

					if ( data?.message ) {
						// Log the success message
						setLogs( ( prevLogs ) => [ ...prevLogs, data.message ] );
					}
				} catch ( err ) {
					const data = err.response.data;
					if ( data?.message ) {
						// Log the success message
						setLogs( ( prevLogs ) => [ ...prevLogs, data.message ] );
					}
				} finally {
					setMediaCount( ( prevCount ) => prevCount + 1 );
				}
			}

			setRetranscoding( false );
			setDone( true );

			// Reset abort state after completion.
			if ( abortRef.current ) {
				setAborted( false );
			}
		}
	};

	const resetState = () => {
		setAttachments( [] );
		setMediaCount( 0 );
		setAborted( false );
		setError( null );
		setRetranscoding( false );
		setLogs( [] );
		setDone( false );
		abortRef.current = false;
	};

	return (
		<>
			<Panel header={ __( 'Retranscode Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<p>
						{ __( 'This tool will fetch all media remains to transcode and retranscode all video media uploaded to your website. This can be handy if you need to transcode media files uploaded in the past.', 'godam' ) }
					</p>

					<p dangerouslySetInnerHTML={ { __html: description } } />

					<p>
						{ __( 'To begin, just press the button below.', 'godam' ) }
					</p>

					{ /* Force retranscode checkbox */ }
					<div style={ { marginBottom: '1em' } }>
						{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
						<label>
							<input
								type="checkbox"
								checked={ forceRetranscode }
								onChange={ ( e ) => setForceRetranscode( e.target.checked ) }
								style={ { marginRight: '0.5em' } }
							/>
							{ __( 'Force retranscode (even if already transcoded)', 'godam' ) }
						</label>
					</div>

					{
						error &&
						<Snackbar className="snackbar-error">
							{ error?.message }
							<br />
							{ error?.details }
						</Snackbar>
					}

					{
						fetchingMedia &&
						<div className="flex items-center gap-4 my-5 text-lg text-gray-500">
							<div className="flex" role="status">
								<svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-[#ab3a6c]" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
									<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
								</svg>
								<span className="sr-only">fetchingMedia...</span>
							</div>

							<span>{ __( 'Fetching media that require retranscoding…', 'godam' ) }</span>
						</div>
					}

					{
						attachments?.length > 0 &&
						<div className="my-5 text-lg text-gray-600">
							{ ! forceRetranscode && sprintf(
								// translators: %d is the number of media files that require retranscoding.
								__( '%d media file(s) require retranscoding.', 'godam' ),
								attachments.length,
							) }
							{ forceRetranscode && sprintf(
								// translators: %d is the number of media files that will be retranscoded.
								__( '%d media file(s) will be retranscoded regardless of their current state.', 'godam' ),
								attachments.length,
							) }
						</div>
					}

					{
						retranscoding &&
						// Show x/y media retranscoded.
						<span className="text-gray-600">
							{ sprintf(
								// translators: %d is the number of media files sent for retranscoding.
								__( '%1$d/%2$d media files sent for retranscoding…', 'godam' ),
								mediaCount,
								attachments.length,
							) }
						</span>
					}

					{
						( retranscoding || aborted || done ) &&
						<div className="mb-4">
							<ProgressBar total={ attachments?.length } done={ mediaCount } />
							<pre className="w-full h-[120px] max-h-[120px] overflow-y-auto bg-gray-100 p-3 rounded">
								{ logs.map( ( log, index ) => (
									<div key={ index } className="text-sm text-gray-700">
										• { log }
									</div>
								) ) }
							</pre>
						</div>
					}

					<div className="flex gap-2">
						{
							// Show main action button.
							! retranscoding &&
							<Button
								variant="primary"
								className="godam-button"
								onClick={ () => {
									if ( attachments.length > 0 ) {
										startRetranscoding();
									} else {
										fetchRetranscodeMedia();
									}
								} }
								disabled={ fetchingMedia }
							>
								{ ( () => {
									if ( attachments.length === 0 ) {
										return __( 'Fetch Media', 'godam' );
									} else if ( ! done && ! aborted ) {
										return __( 'Start Retranscoding', 'godam' );
									}
									return __( 'Restart Retranscoding', 'godam' );
								} )() }
							</Button>
						}

						{
							// Show abort button during retranscoding.
							retranscoding &&
							<Button
								variant="secondary"
								className="godam-button"
								onClick={ abortRetranscoding }
								style={ { backgroundColor: '#dc3545', color: 'white' } }
							>
								{ __( 'Abort Operation', 'godam' ) }
							</Button>
						}

						{
							// Show reset button after completion or abort.
							( aborted || ( ! retranscoding && attachments.length > 0 && mediaCount > 0 ) ) &&
							<Button
								variant="tertiary"
								className="godam-button"
								onClick={ resetState }
							>
								{ __( 'Reset', 'godam' ) }
							</Button>
						}
					</div>

				</PanelBody>
			</Panel>
		</>
	);
};

export default RetranscodeTab;

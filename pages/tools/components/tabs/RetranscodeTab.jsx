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
import { useState, useRef, useEffect } from '@wordpress/element';
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
	const [ selectedIds, setSelectedIds ] = useState( null );
	const [ successCount, setSuccessCount ] = useState( 0 );
	const [ failureCount, setFailureCount ] = useState( 0 );
	const [ totalMediaCount, setTotalMediaCount ] = useState( 0 );

	// On mount, check for 'media_ids' in the URL
	useEffect( () => {
		const params = new URLSearchParams( window.location.search );
		const idsParam = params.get( 'media_ids' );
		const nonce = params.get( '_wpnonce' );

		// Verify the nonce if media_ids are present
		if ( idsParam && nonce ) {
			// Process the IDs only if we have a valid nonce from the URL
			if ( nonce === window.easydamMediaLibrary?.godamToolsNonce ) {
				const idsArr = idsParam.split( ',' ).map( ( id ) => parseInt( id, 10 ) ).filter( Boolean );
				if ( idsArr.length > 0 ) {
					setAttachments( idsArr );
					setSelectedIds( idsArr );
				}
			} else {
				setError( {
					message: __( 'The requested operation is not allowed.', 'godam' ),
					details: __( 'The nonce provided in the URL is invalid or expired.', 'godam' ),
				} );
			}
		}
	}, [] );

	// Whenever selectedIds are provided, set forceRetranscode to false
	useEffect( () => {
		if ( selectedIds && selectedIds.length > 0 ) {
			setForceRetranscode( false );
		}
	}, [ selectedIds ] );

	// Use a ref to track if the operation should be aborted.
	const abortRef = useRef( false );

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
				if ( response.data?.data && Array.isArray( response.data.data ) && response.data.data.length > 0 ) {
					setAttachments( response.data.data );
					if ( response.data?.total_media_count ) {
						setTotalMediaCount( response.data.total_media_count );
					}
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
				setSuccessCount( 0 );
				setFailureCount( 0 );
			} );
	};

	const abortRetranscoding = () => {
		abortRef.current = true;
		setAborted( true );
		setRetranscoding( false );
		setLogs( ( prevLogs ) => [ ...prevLogs, __( 'Aborting operation to send media for retranscoding.', 'godam' ) ] );
	};

	const startRetranscoding = async () => {
		if ( attachments?.length > 0 ) {
			setRetranscoding( true );
			setAborted( false );
			setMediaCount( 0 );
			setLogs( [] );
			setDone( false );
			abortRef.current = false;
			setSuccessCount( 0 );
			setFailureCount( 0 );

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
						setSuccessCount( ( prevCount ) => prevCount + 1 );
					}
				} catch ( err ) {
					const data = err.response.data;
					if ( data?.message ) {
						// Log the success message
						setLogs( ( prevLogs ) => [ ...prevLogs, data.message ] );
					}
					setFailureCount( ( prevCount ) => prevCount + 1 );
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
		setForceRetranscode( false );
		setSelectedIds( null );
		abortRef.current = false;

		// Reset the URL to remove media_ids, goback and nonce
		const url = new URL( window.location.href );
		url.searchParams.delete( 'media_ids' );
		url.searchParams.delete( '_wpnonce' );
		url.searchParams.delete( 'goback' );
		window.history.replaceState( {}, '', url.toString() );
	};

	return (
		<>
			<Panel header={ __( 'Retranscode Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					{ selectedIds && selectedIds.length > 0 && (
						<Snackbar className="snackbar-warning">
							{ sprintf(
								// translators: %d is the number of selected media files.
								__( 'You are retranscoding %d selected media file(s) from the Media Library.', 'godam' ),
								selectedIds.length,
							) }
						</Snackbar>
					) }
					<p>
						{ __(
							'This tool allows you to retranscode your media files. You can either retranscode specific files selected from the Media Library, or only those that are not yet transcoded.',
							'godam',
						) }
					</p>

					<p>
						{ __( 'Checking the "Force retranscode" option will retranscode all media files regardless of their current state.', 'godam' ) }
					</p>

					<p>
						<i>
							{ __(
								'Note: Retranscoding will use your bandwidth allowance. Use the force retranscode option carefully.',
								'godam',
							) }
						</i>
					</p>

					{
						/* Force retranscode checkbox */
						! ( selectedIds && selectedIds.length > 0 ) &&
						( attachments.length === 0 ) &&
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
					}

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
						! done &&
						! aborted &&
						<div className="my-5 text-lg text-gray-600">
							{ selectedIds && selectedIds.length > 0 && (
								// translators: %d is the number of selected media files.
								sprintf( __( '%d selected media file(s) will be retranscoded.', 'godam' ), selectedIds.length )
							) }
							{ ! selectedIds && ! forceRetranscode && sprintf(
								// translators: %d is the number of media files that require retranscoding.
								__( '%1$d/%2$d media file(s) require retranscoding.', 'godam' ),
								attachments.length,
								totalMediaCount,
							) }
							{ forceRetranscode && sprintf(
								// translators: %d is the number of media files that will be retranscoded.
								__( '%1$d/%1$d media file(s) will be retranscoded regardless of their current state.', 'godam' ),
								attachments.length,
								totalMediaCount,
							) }
						</div>
					}

					{
						( done || aborted ) &&
						successCount > 0 &&
						<Snackbar className="snackbar-success">
							{ sprintf(
								// translators: %d is the number of media files retranscoded.
								__( 'Successfully sent %d media file(s) for retranscoding.', 'godam' ),
								successCount,
							) }
						</Snackbar>
					}

					{
						( done || aborted ) &&
						failureCount > 0 &&
						<Snackbar className="snackbar-error">
							{ sprintf(
								// translators: %d is the number of media files that failed to retranscode.
								__( 'Failed to send %d media file(s) for retranscoding.', 'godam' ),
								failureCount,
							) }
						</Snackbar>
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
							// Show reset button after completion or abort or after fetching media.
							( aborted || ( ! retranscoding && attachments.length > 0 ) ) &&
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

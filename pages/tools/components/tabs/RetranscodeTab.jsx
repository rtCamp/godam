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
	Notice,
	Modal,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';
/**
 * Internal dependencies
 */
import ProgressBar from '../ProgressBar.jsx';
import { scrollToTop } from '../../../godam/utils';

const RetranscodeTab = () => {
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
	const [ attachmentDetails, setAttachmentDetails ] = useState( [] ); // [{id, name, size}]
	const [ showBandwidthModal, setShowBandwidthModal ] = useState( false );
	const [ modalSelection, setModalSelection ] = useState( [] ); // array of selected IDs
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

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
				showNotice( __( 'The requested operation is not allowed. The nonce provided in the URL is invalid or expired.', 'godam' ), 'error' );
			}
		}
	}, [] );

	useEffect( () => {
		if ( selectedIds && selectedIds.length > 0 ) {
			// Whenever selectedIds are provided, set forceRetranscode to false
			setForceRetranscode( false );
			// show notice about selected media
			showNotice(
				sprintf(
					// translators: %d is the number of selected media files.
					__( 'You are retranscoding %d selected media file(s) from the Media Library.', 'godam' ),
					selectedIds.length,
				),
				'warning',
			);
		}
	}, [ selectedIds ] );

	// Use a ref to track if the operation should be aborted.
	const abortRef = useRef( false );
	// Ref to hold polling interval so we can clear it when finished
	const pollIntervalRef = useRef( null );

	// Fetch the current queue status, used both for polling and initial mount
	const fetchQueueStatus = async () => {
		try {
			const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/status`;
			const res = await axios.get( url, {
				headers: {
					'X-WP-Nonce': window.godamRestRoute?.nonce,
				},
			} );
			const data = res.data;

			if ( data?.total ) {
				// Mirror the total in attachments so existing UI remains unchanged.
				setAttachments( new Array( data.total ).fill( 0 ) );
			}
			setMediaCount( data?.processed || 0 );
			setSuccessCount( data?.success || 0 );
			setFailureCount( data?.failure || 0 );
			setLogs( data?.logs || [] );

			if ( data?.status === 'running' ) {
				setRetranscoding( true );
				// Ensure continuous polling across page reloads.
				if ( ! pollIntervalRef.current ) {
					beginPolling();
				}
			} else if ( data?.status === 'idle' || ! data?.status ) {
				// Fresh state, ensure UI reset (in case user refreshed after reset).
				setAttachments( [] );
				setLogs( [] );
				setMediaCount( 0 );
				setSuccessCount( 0 );
				setFailureCount( 0 );
				setAborted( false );
				setDone( false );
				setRetranscoding( false );
				clearInterval( pollIntervalRef.current );
				pollIntervalRef.current = null;
			} else {
				setRetranscoding( false );
				// Stop polling when not running.
				clearInterval( pollIntervalRef.current );
				pollIntervalRef.current = null;
			}

			if ( data?.status === 'done' ) {
				setDone( true );
				clearInterval( pollIntervalRef.current );
			} else if ( data?.status === 'aborted' ) {
				setAborted( true );
				clearInterval( pollIntervalRef.current );
			}
		} catch ( e ) {
			// Fail silently as polling errors are non-fatal.
		}
	};

	// Kick off polling helper
	const beginPolling = () => {
		if ( pollIntervalRef.current ) {
			clearInterval( pollIntervalRef.current );
		}
		pollIntervalRef.current = setInterval( fetchQueueStatus, 5000 );
	};

	const abortRetranscoding = () => {
		// Tell the backend to abort and stop polling.
		axios.post( `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/abort`, {}, {
			headers: {
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} );
		setAborted( true );
		setRetranscoding( false );
		clearInterval( pollIntervalRef.current );
		setLogs( ( prevLogs ) => [ ...prevLogs, __( 'Aborting operation to send media for retranscoding.', 'godam' ) ] );
	};

	const startRetranscoding = async () => {
		if ( attachments?.length > 0 ) {
			setRetranscoding( true );
			setAborted( false );
			setMediaCount( 0 );
			setLogs( [] );
			setDone( false );
			setSuccessCount( 0 );
			setFailureCount( 0 );

			try {
				const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue`;
				await axios.post( url, { ids: attachments }, {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.godamRestRoute?.nonce,
					},
				} );
				fetchQueueStatus();
				beginPolling();
			} catch ( err ) {
				showNotice(
					sprintf(
						// translators: %s is the error message.
						__( 'Failed to start retranscoding: %s', 'godam' ),
						err.response ? err.response.data.message : err.message,
					),
					'error',
				);
				setRetranscoding( false );
			}
		}
	};

	// Function to fetch media that require retranscoding (kept from original implementation)
	const fetchRetranscodeMedia = () => {
		setFetchingMedia( true );

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
					showNotice( __( 'No media files found for retranscoding. Please ensure you have media files that require retranscoding.', 'godam' ), 'info' );
				}
			} )
			.catch( ( err ) => {
				showNotice(
					sprintf(
						// translators: %s is the error message.
						__( 'Failed to fetch media for retranscoding: %s', 'godam' ),
						err.response ? err.response.data.message : err.message,
					),
					'error',
				);
			} )
			.finally( () => {
				setFetchingMedia( false );
				setSuccessCount( 0 );
				setFailureCount( 0 );
			} );
	};

	// On mount, check if a queue is already running so we can resume progress.
	useEffect( () => {
		fetchQueueStatus();
		return () => {
			if ( pollIntervalRef.current ) {
				clearInterval( pollIntervalRef.current );
			}
		};
	}, [] );

	// Fetch attachment details (name, size) after attachments are set
	useEffect( () => {
		if ( attachments.length > 0 && attachments[ 0 ] !== 0 ) {
			// Fetch media details using the same approach as PHP code
			Promise.all(
				attachments.map( ( id ) =>
					fetch( `${ window.godamRestRoute?.url }godam/v1/transcoding/media/details/${ id }`, {
						headers: {
							'X-WP-Nonce': window.godamRestRoute?.nonce,
						},
					} )
						.then( ( res ) => res.json() )
						.then( ( data ) => ( {
							id,
							name: data.name || `ID ${ id }`,
							size: data.size || 0,
						} ) )
						.catch( () => ( {
							id,
							name: `ID ${ id }`,
							size: 0,
						} ) ),
				),
			).then( setAttachmentDetails );
		} else if ( attachments.length === 0 ) {
			setAttachmentDetails( [] );
		} else {
			setAttachmentDetails( attachments ); // already detailed
		}
	}, [ attachments ] );

	// Bandwidth calculation
	const availableBandwidthGB = 0.05;//( window.userData?.totalBandwidth || 0 ) - ( window.userData?.bandwidthUsed || 0 );
	const totalRequiredGB = attachmentDetails.reduce( ( sum, att ) => sum + ( ( att.size || 0 ) / 1024 / 1024 / 1024 ), 0 );

	// Modal logic: show modal if not all fit, or error if none fit
	useEffect( () => {
		if ( attachmentDetails.length > 0 ) {
			if ( totalRequiredGB > availableBandwidthGB ) {
				// Find which files can fit
				const sorted = [ ...attachmentDetails ].sort( ( a, b ) => a.size - b.size );
				let runningTotal = 0;
				const canFit = [];
				for ( const att of sorted ) {
					const attGB = ( att.size || 0 ) / 1024 / 1024 / 1024;
					if ( runningTotal + attGB <= availableBandwidthGB ) {
						runningTotal += attGB;
						canFit.push( att.id );
					}
				}
				if ( canFit.length > 0 ) {
					setModalSelection( canFit );
					setShowBandwidthModal( true );
				} else {
					showNotice( __( 'Not enough bandwidth left to retranscode any selected media.', 'godam' ), 'error' );
					setShowBandwidthModal( false );
				}
			} else {
				setShowBandwidthModal( false );
			}
		}
	}, [ attachmentDetails, totalRequiredGB, availableBandwidthGB ] );

	const resetState = () => {
		setAttachments( [] );
		setMediaCount( 0 );
		setAborted( false );
		setNotice( { ...notice, isVisible: false } );
		setRetranscoding( false );
		setLogs( [] );
		setSuccessCount( 0 );
		setFailureCount( 0 );
		setDone( false );
		setForceRetranscode( false );
		setSelectedIds( null );
		setAttachmentDetails( [] );
		setShowBandwidthModal( false );
		setModalSelection( [] );
		// Stop any active polling.
		if ( pollIntervalRef.current ) {
			clearInterval( pollIntervalRef.current );
			pollIntervalRef.current = null;
		}
		// Inform backend to reset queue and progress so subsequent visits start fresh.
		axios.post( `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/reset`, {}, {
			headers: {
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} ).catch( () => {} );
		abortRef.current = false;

		// Reset the URL to remove media_ids, goback and nonce
		const url = new URL( window.location.href );
		url.searchParams.delete( 'media_ids' );
		url.searchParams.delete( '_wpnonce' );
		url.searchParams.delete( 'goback' );
		window.history.replaceState( {}, '', url.toString() );
	};

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	useEffect( () => {
		// Show notice if retranscoding is done or aborted with counts
		if ( done || aborted ) {
			let message = '';
			if ( successCount > 0 ) {
				message += sprintf(
					// translators: %d is the number of media files retranscoded.
					__( 'Successfully sent %d media file(s) for retranscoding.', 'godam' ),
					successCount,
				);
			}
			if ( failureCount > 0 ) {
				if ( message ) {
					message += ' ';
				}
				message += sprintf(
					// translators: %d is the number of media files that failed to retranscode.
					__( 'Failed to send %d media file(s) for retranscoding.', 'godam' ),
					failureCount,
				);
			}

			if ( ! message ) {
				message = __( 'Operation completed without any media files to retranscode.', 'godam' );
			}

			const noticeType = successCount > 0 && failureCount === 0 ? 'success' : 'error';

			showNotice( message, noticeType );
		}
	}, [ done, aborted, successCount, failureCount ] );

	return (
		<>
			<div className="status-notices-container">
				{ notice.isVisible && (
					<Notice
						status={ notice.status }
						className="my-2"
						onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					>
						{ notice.message }
					</Notice>
				) }
			</div>

			<Panel header={ __( 'Retranscode Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					{ /* Bandwidth/Quota Display */ }
					<div className="flex gap-4 flex-wrap mb-4">
						<div>
							<strong>{ __( 'Bandwidth Available:', 'godam' ) }</strong> { parseFloat( availableBandwidthGB ).toFixed( 2 ) } GB
						</div>
						<div>
							<strong>{ __( 'Bandwidth Used:', 'godam' ) }</strong> { parseFloat( window.userData?.bandwidthUsed || 0 ).toFixed( 2 ) } GB
						</div>
					</div>
					{ /* Bandwidth Modal */ }
					{ showBandwidthModal && (
						<Modal
							title={ __( 'Select Media to Retranscode', 'godam' ) }
							onRequestClose={ () => setShowBandwidthModal( false ) }
							isOpen={ showBandwidthModal }
						>
							<div style={ { maxHeight: 400, overflowY: 'auto' } }>
								{ attachmentDetails.map( ( att ) => {
									const attGB = ( att.size || 0 ) / 1024 / 1024 / 1024;
									const checked = modalSelection.includes( att.id );
									// Calculate running total if this is checked
									const newTotal = modalSelection
										.filter( ( id ) => id !== att.id )
										.reduce( ( sum, id ) => {
											const found = attachmentDetails.find( ( a ) => a.id === id );
											return sum + ( ( found?.size || 0 ) / 1024 / 1024 / 1024 );
										}, checked ? 0 : attGB );
									const disabled = ! checked && ( newTotal + attGB > availableBandwidthGB );
									return (
										<div key={ att.id } style={ { marginBottom: 8 } }>
											<input
												type="checkbox"
												checked={ checked }
												disabled={ disabled }
												onChange={ () => {
													setModalSelection( ( sel ) =>
														checked ? sel.filter( ( id ) => id !== att.id ) : [ ...sel, att.id ],
													);
												} }
											/>
											{ att.name } ({ ( att.size / 1024 / 1024 ).toFixed( 2 ) } MB)
										</div>
									);
								} ) }
								<div style={ { marginTop: 16 } }>
									<strong>{ __( 'Required Bandwidth:', 'godam' ) }</strong> { modalSelection.reduce( ( sum, id ) => {
										const att = attachmentDetails.find( ( a ) => a.id === id );
										return sum + ( ( att?.size || 0 ) / 1024 / 1024 / 1024 );
									}, 0 ).toFixed( 2 ) } GB / { availableBandwidthGB.toFixed( 2 ) } GB { __( 'available', 'godam' ) }
								</div>
								<Button
									variant="primary"
									style={ { marginTop: 16 } }
									onClick={ () => {
										setAttachments( modalSelection );
										setShowBandwidthModal( false );
									} }
								>
									{ __( 'Proceed', 'godam' ) }
								</Button>
							</div>
						</Modal>
					) }

					<p>
						{ __(
							'This tool allows you to retranscode media files. You can either retranscode specific files selected from the Media Library or only those that have not yet been transcoded.',
							'godam',
						) }
					</p>

					<p>
						{ __( 'Checking the "Force retranscode" option will retranscode all media files regardless of their current state.', 'godam' ) }
						<br />
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

					{
						retranscoding &&
						<span className="block text-gray-600 mb-4">
							{ __( 'You can safely close this tab! Retranscoding will continue in the background.', 'godam' ) }
						</span>
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

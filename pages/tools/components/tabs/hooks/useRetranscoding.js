/**
 * External dependencies
 */
import axios from 'axios';
import { useCallback } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../../godam/utils';

// eslint-disable-next-line no-unused-vars
const useRetranscoding = ( callback, deps ) => {
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
	const [ totalLibraryCount, setTotalLibraryCount ] = useState( 0 );
	const [ queueTotal, setQueueTotal ] = useState( 0 );
	const [ attachmentDetails, setAttachmentDetails ] = useState( [] );
	const [ showBandwidthModal, setShowBandwidthModal ] = useState( false );
	const [ modalSelection, setModalSelection ] = useState( [] );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ initialStatusFetching, setInitialStatusFetching ] = useState( true );

	// Use a ref to track if the operation should be aborted.
	const abortRef = useRef( false );
	// Ref to hold polling interval so we can clear it when finished
	const pollIntervalRef = useRef( null );

	// Track if the component has been reset by user
	const hasBeenManuallyReset = useRef( false );
	// Track if we're currently polling to prevent multiple intervals
	const isPolling = useRef( false );

	// Fetch the current queue status, used both for polling and initial mount
	const fetchQueueStatus = useCallback( async () => {
		// If we've manually reset, don't fetch queue status automatically
		// This prevents reverting back to the error state
		if ( hasBeenManuallyReset.current ) {
			return;
		}

		try {
			const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/status`;
			const res = await axios.get( url, {
				headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
			} );
			const data = res.data;

			// Keep track of the current queue size for the running denominator
			if ( typeof data?.total === 'number' ) {
				setQueueTotal( data.total );
			}

			// Do not override eligible totalMediaCount here; it represents total items requiring retranscoding
			// if ( data?.total ) { setTotalMediaCount( data.total || 0 ); }

			setMediaCount( data?.processed || 0 );
			setSuccessCount( data?.success || 0 );
			setFailureCount( data?.failure || 0 );
			setLogs( data?.logs || [] );

			if ( data?.status === 'running' ) {
				setRetranscoding( true );
				if ( ! pollIntervalRef.current && ! isPolling.current ) {
					beginPolling();
				}
			} else if ( data?.status === 'idle' || ! data?.status ) {
				setLogs( [] );
				setMediaCount( 0 );
				setSuccessCount( 0 );
				setFailureCount( 0 );
				// Do not clear totalMediaCount here; it should be driven by fetchRetranscodeMedia/reset only
				// setTotalMediaCount( 0 );
				setAborted( false );
				setDone( false );
				setRetranscoding( false );
				if ( pollIntervalRef.current ) {
					clearInterval( pollIntervalRef.current );
					pollIntervalRef.current = null;
					isPolling.current = false;
				}
			} else {
				setRetranscoding( false );
				if ( pollIntervalRef.current ) {
					clearInterval( pollIntervalRef.current );
					pollIntervalRef.current = null;
					isPolling.current = false;
				}
			}

			if ( data?.status === 'done' ) {
				setDone( true );
				if ( pollIntervalRef.current ) {
					clearInterval( pollIntervalRef.current );
					pollIntervalRef.current = null;
					isPolling.current = false;
				}
			} else if ( data?.status === 'aborted' ) {
				setAborted( true );
				if ( pollIntervalRef.current ) {
					clearInterval( pollIntervalRef.current );
					pollIntervalRef.current = null;
					isPolling.current = false;
				}
			}
		} catch ( e ) {
			// Silent error handling, but stop excessive polling on persistent errors
			if ( pollIntervalRef.current ) {
				clearInterval( pollIntervalRef.current );
				pollIntervalRef.current = null;
				isPolling.current = false;
			}
		}
	} );

	// Kick off polling helper
	const beginPolling = () => {
		if ( pollIntervalRef.current ) {
			clearInterval( pollIntervalRef.current );
		}
		isPolling.current = true;
		pollIntervalRef.current = setInterval( fetchQueueStatus, 5000 );
	};

	const abortRetranscoding = () => {
		// Tell the backend to abort and stop polling.
		axios.post( `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/abort`, {}, {
			headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
		} );
		setAborted( true );
		setRetranscoding( false );
		if ( pollIntervalRef.current ) {
			clearInterval( pollIntervalRef.current );
			pollIntervalRef.current = null;
			isPolling.current = false;
		}
		setLogs( ( prevLogs ) => [ ...prevLogs, __( 'Aborting operation to send media for retranscoding.', 'godam' ) ] );
	};

	const startRetranscoding = async () => {
		if ( attachments?.length > 0 ) {
			const ids = ( typeof attachments[ 0 ] === 'object' ? attachments.map( ( a ) => a.id ) : attachments )
				.filter( ( id ) => id && id > 0 );
			if ( ids.length === 0 ) {
				showNotice( __( 'No valid media IDs to retranscode.', 'godam' ), 'error' );
				return;
			}
			// Before we optimistically flip UI state, ask server to start.
			try {
				const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue`;
				await axios.post( url, { ids }, {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.godamRestRoute?.nonce,
					},
					validateStatus: () => true, // We'll branch on status code
				} ).then( async ( res ) => {
					if ( res.status === 200 ) {
						// Fresh start accepted
						setRetranscoding( true );
						setAborted( false );
						setMediaCount( 0 );
						setLogs( [] );
						setDone( false );
						setSuccessCount( 0 );
						setFailureCount( 0 );
						fetchQueueStatus();
						beginPolling();
						return;
					}
					if ( res.status === 409 ) {
						const data = res.data || {};
						// If already running elsewhere, show notice and begin polling status.
						if ( data.status === 'running' ) {
							showNotice( __( 'Retranscoding is already running (possibly in another tab or device). Showing current status.', 'godam' ), 'warning' );
							setRetranscoding( true );
							fetchQueueStatus();
							beginPolling();
							return;
						}
						// If done or aborted but not reset, instruct user to reset.
						if ( data.status === 'done' || data.status === 'aborted' ) {
							showNotice( __( 'A previous retranscoding session has finished but the state has not been reset. Please click Reset before starting a new session.', 'godam' ), 'warning' );
							setRetranscoding( false );
							return;
						}
					}
					// Any other status -> treat as error
					throw new Error( ( res.data && res.data.message ) || `HTTP ${ res.status }` );
				} );
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

	// Function to fetch media that require retranscoding
	const fetchRetranscodeMedia = () => {
		setFetchingMedia( true );
		const url = `${ window.godamRestRoute?.url }godam/v1/transcoding/not-transcoded${ forceRetranscode ? '?force=1' : '' }`;
		axios.get( url, {
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} )
			.then( ( response ) => {
				const list = response.data?.data;
				if ( Array.isArray( list ) && list.length > 0 ) {
					// If objects already include details (id,name,size) store both forms.
					if ( typeof list[ 0 ] === 'object' ) {
						setAttachments( list.map( ( o ) => ( { id: o.id, name: o.name, size: o.size } ) ) );
						setAttachmentDetails( list );
					} else {
						setAttachments( list );
					}
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

	const resetState = () => {
		// First, stop any active polling to prevent state updates during reset
		if ( pollIntervalRef.current ) {
			clearInterval( pollIntervalRef.current );
			pollIntervalRef.current = null;
			isPolling.current = false;
		}

		// Mark that we've manually reset so we don't automatically revert state
		hasBeenManuallyReset.current = true;

		// Inform backend to reset queue and progress
		axios.post( `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/reset`, {}, {
			headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
		} )
			.then( () => {
				// Only reset local state after backend confirms reset
				setAttachments( [] );
				setMediaCount( 0 );
				setTotalMediaCount( 0 );
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
				abortRef.current = false;
			} )
			.catch( () => {
				// Handle the case where backend reset fails
				// Still reset UI state even if backend call fails
				setAttachments( [] );
				setMediaCount( 0 );
				setTotalMediaCount( 0 );
				setAborted( false );
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

				// Show a notice that full reset may need a page refresh
				setNotice( {
					message: __( 'Reset completed. If you still see previous data, please refresh the page.', 'godam' ),
					status: 'info',
					isVisible: true,
				} );
			} )
			.finally( () => {
				// Always remove Media Library handoff params so selection doesn't persist
				try {
					const url = new URL( window.location.href );
					url.searchParams.delete( 'media_ids' );
					url.searchParams.delete( '_wpnonce' );
					url.searchParams.delete( 'goback' );
					window.history.replaceState( {}, '', url.toString() );
					// Clear any guard flag used to suppress duplicate notices
					try {
						delete window.__godamBulkSelectionGuard;
					} catch ( _e ) { /* noop */ }
				} catch ( _e ) { /* noop */ }
			} );
	};

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	const handleFetchOrStart = async () => {
		// Reset the manual reset flag since we're starting a new operation
		hasBeenManuallyReset.current = false;

		// Always probe server status first to coordinate across tabs/devices
		try {
			const statusUrl = `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/status`;
			const res = await axios.get( statusUrl, { headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce } } );
			const data = res.data || {};
			if ( data.status === 'running' ) {
				showNotice( __( 'Retranscoding is already running. Showing current status.', 'godam' ), 'warning' );
				setRetranscoding( true );
				fetchQueueStatus();
				beginPolling();
				return;
			}
			if ( data.status === 'done' || data.status === 'aborted' ) {
				showNotice( __( 'A previous retranscoding session exists. Please Reset before starting a new one.', 'godam' ), 'warning' );
				return;
			}
		} catch ( e ) {
			// ignore and proceed
		}

		if ( attachments.length > 0 ) {
			startRetranscoding();
		} else {
			fetchRetranscodeMedia();
		}
	};

	// On mount, check if a queue is already running so we can resume progress.
	useEffect( () => {
		fetchQueueStatus()
			.finally( () => setInitialStatusFetching( false ) );
		return () => {
			if ( pollIntervalRef.current ) {
				clearInterval( pollIntervalRef.current );
				pollIntervalRef.current = null;
				isPolling.current = false;
			}
		};
	}, [] ); // Empty dependency array to run only once on mount

	// On mount, fetch total Media Library count once
	useEffect( () => {
		axios.get( '/wp-json/wp/v2/media', {
			params: { per_page: 1 },
			headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
		} )
			.then( ( res ) => {
				const total = parseInt( res.headers?.[ 'x-wp-total' ] || '0', 10 );
				if ( ! Number.isNaN( total ) ) {
					setTotalLibraryCount( total );
				}
			} )
			.catch( () => { /* ignore */ } );
	}, [] );

	// Show notice if retranscoding is done or aborted with counts
	useEffect( () => {
		if ( done || aborted ) {
			let message = '';
			if ( successCount > 0 ) {
				message += sprintf(
					/* translators: %d is the number of successfully retranscoded media files. */
					__( 'Successfully sent %d media file(s) for retranscoding.', 'godam' ),
					successCount,
				);
			}
			if ( failureCount > 0 ) {
				if ( message ) {
					message += ' ';
				}
				message += sprintf(
					/* translators: %d is the number of media files that failed to be sent for retranscoding. */
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

	// If user navigates here with a selection from Media Library while a prior session exists, ask to reset first
	useEffect( () => {
		if ( attachments?.length > 0 && ( done || aborted ) && ! retranscoding ) {
			showNotice( __( 'A previous retranscoding session exists. Please click Reset before starting a new session with your selected media.', 'godam' ), 'warning' );
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ attachments?.length, done, aborted, retranscoding ] );

	return {
		// State
		fetchingMedia,
		retranscoding,
		attachments,
		mediaCount,
		aborted,
		logs,
		done,
		forceRetranscode,
		selectedIds,
		successCount,
		failureCount,
		totalMediaCount,
		totalLibraryCount,
		queueTotal,
		attachmentDetails,
		showBandwidthModal,
		modalSelection,
		notice,
		initialStatusFetching,

		// Setters
		setAttachments,
		setForceRetranscode,
		setSelectedIds,
		setAttachmentDetails,
		setShowBandwidthModal,
		setModalSelection,
		setNotice,

		// Functions
		fetchQueueStatus,
		abortRetranscoding,
		startRetranscoding,
		fetchRetranscodeMedia,
		resetState,
		showNotice,
		handleFetchOrStart,
	};
};

export default useRetranscoding;

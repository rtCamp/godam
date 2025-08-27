/*
 * Hooks that encapsulate side‑effects originally implemented inside RetranscodeTab.jsx
 * to keep the main component lean and focused on rendering.
 */
/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

// Handle media IDs passed via URL (?media_ids=1,2,3&_wpnonce=...)
export const useUrlMediaIds = ( setAttachments, setSelectedIds, showNotice ) => {
	useEffect( () => {
		const params = new URLSearchParams( window.location.search );
		const idsParam = params.get( 'media_ids' );
		const nonce = params.get( '_wpnonce' );

		if ( ! idsParam || ! nonce ) {
			return;
		}

		if ( nonce === window.easydamMediaLibrary?.godamToolsNonce ) {
			const idsArr = idsParam
				.split( ',' )
				.map( ( id ) => parseInt( id, 10 ) )
				.filter( Boolean );
			if ( idsArr.length > 0 ) {
				setAttachments( idsArr );
				setSelectedIds( idsArr );

				// Probe server status so bulk selection behaves gracefully across tabs/devices
				// and show a clear message without requiring user to click Start.
				fetch( `${ window.godamRestRoute?.url }godam/v1/transcoding/retranscode-queue/status`, {
					headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
					credentials: 'same-origin',
				} )
					.then( ( r ) => r.json() )
					.then( ( data ) => {
						const status = data?.status || 'idle';
						if ( status === 'running' ) {
							// Mark that we already informed user to avoid duplicate generic notices
							window.__godamBulkSelectionGuard = 'running';
							showNotice( __( 'Retranscoding is already running (possibly from another tab or device). Showing current status. your bulk selection will not start a new job.', 'godam' ), 'warning' );
						} else if ( status === 'done' || status === 'aborted' ) {
							window.__godamBulkSelectionGuard = 'blocked';
							showNotice( __( 'A previous retranscoding session exists. Please click Reset before starting a new session with your selected media.', 'godam' ), 'warning' );
						} else {
							// No guard necessary for idle state; allow normal flow
							window.__godamBulkSelectionGuard = 'idle';
						}
					} )
					.catch( () => {
						// On failure, do nothing special; default notices will apply
					} );
			}
		} else {
			showNotice( __( 'The requested operation is not allowed. The nonce provided in the URL is invalid or expired.', 'godam' ), 'error' );
		}
	}, [ setAttachments, setSelectedIds, showNotice ] );
};

// Show notice when specific media are selected and disable force retranscode.
export const useSelectedIdsNotice = ( selectedIds, setForceRetranscode, showNotice ) => {
	useEffect( () => {
		if ( selectedIds && selectedIds.length > 0 ) {
			setForceRetranscode( false );
			// If a guard notice was already shown for bulk selection (running/blocked), avoid duplicate generic notice
			const guard = window.__godamBulkSelectionGuard;
			if ( guard !== 'running' && guard !== 'blocked' ) {
				showNotice( sprintf( /* translators: %d is the number of selected media files. */ __( 'You are retranscoding %d selected media file(s) from the Media Library.', 'godam' ), selectedIds.length ), 'warning' );
			}
		}
	}, [ selectedIds, setForceRetranscode, showNotice ] );
};

// Populate attachment details (name, size) whether we have objects already or must fetch per ID.
export const useAttachmentDetails = ( attachments, attachmentDetails, setAttachmentDetails ) => {
	useEffect( () => {
		if ( attachments.length === 0 ) {
			setAttachmentDetails( [] );
			return;
		}

		// If enriched objects already supplied, adopt directly.
		if ( typeof attachments[ 0 ] === 'object' ) {
			setAttachmentDetails( attachments );
			return;
		}

		// Only numeric IDs path (e.g., from URL or modal selection)
		const allNumbers = attachments.every( ( a ) => typeof a === 'number' );
		if ( ! allNumbers ) {
			return;
		} // Defensive

		// Reuse cached details if all present
		if ( attachmentDetails.length > 0 ) {
			const existingForAll = attachments.every( ( id ) => attachmentDetails.find( ( d ) => d.id === id ) );
			if ( existingForAll ) {
				setAttachmentDetails( attachmentDetails.filter( ( d ) => attachments.includes( d.id ) ) );
				return;
			}
		}

		// Fetch all details in parallel
		Promise.all( attachments.map( ( id ) =>
			fetch( `${ window.godamRestRoute?.url }godam/v1/transcoding/media/details/${ id }`, {
				headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
			} )
				.then( ( r ) => r.json() )
				.then( ( data ) => ( { id, name: data.name || `ID ${ id }`, size: data.size || 0 } ) )
				.catch( () => ( { id, name: `ID ${ id }`, size: 0 } ) ),
		) ).then( setAttachmentDetails );
	}, [ attachments, attachmentDetails, setAttachmentDetails ] );
};

// Bandwidth gating modal logic.
export const useBandwidthModal = (
	attachmentDetails,
	availableBandwidthGB,
	totalRequiredGB,
	setModalSelection,
	setShowBandwidthModal,
	showNotice,
	modalSelection,
) => {
	useEffect( () => {
		// Don't show modal if no attachment details
		if ( attachmentDetails.length === 0 ) {
			setShowBandwidthModal( false );
			return;
		}

		const overLimit = totalRequiredGB > availableBandwidthGB;
		if ( overLimit ) {
			// Determine which subset can fit (smallest-first) only if user hasn't chosen yet
			if ( modalSelection.length === 0 ) {
				const sorted = [ ...attachmentDetails ].sort( ( a, b ) => ( a.size || 0 ) - ( b.size || 0 ) );
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
				// User is adjusting selection, keep modal open but do not override their choice
				setShowBandwidthModal( true );
			}
		} else {
			// Enough bandwidth available, no need for modal
			setShowBandwidthModal( false );
		}
	}, [ attachmentDetails, availableBandwidthGB, totalRequiredGB, modalSelection.length, setModalSelection, setShowBandwidthModal, showNotice ] );
};

// Show completion / aborted notice with success & failure counts.
export const useCompletionNotice = ( done, aborted, successCount, failureCount, showNotice ) => {
	useEffect( () => {
		if ( ! done && ! aborted ) {
			return;
		}

		let message = '';
		if ( successCount > 0 ) {
			message += sprintf( /* translators: %d is the number of media files retranscoded. */ __( 'Successfully sent %d media file(s) for retranscoding.', 'godam' ), successCount );
		}
		if ( failureCount > 0 ) {
			if ( message ) {
				message += ' ';
			}
			message += sprintf( /* translators: %d is the number of media files that failed to retranscode. */ __( 'Failed to send %d media file(s) for retranscoding.', 'godam' ), failureCount );
		}
		if ( ! message ) {
			message = __( 'Operation completed without any media files to retranscode.', 'godam' );
		}
		const noticeType = successCount > 0 && failureCount === 0 ? 'success' : 'error';
		showNotice( message, noticeType );
	}, [ done, aborted, successCount, failureCount, showNotice ] );
};

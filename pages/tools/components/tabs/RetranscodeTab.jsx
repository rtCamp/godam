/**
 * WordPress dependencies
 */
import {
	Panel,
	PanelBody,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import useRetranscoding from './hooks/useRetranscoding.js';
import {
	NoticeContainer,
	BandwidthDisplay,
	BandwidthModal,
	LoadingSpinner,
	ForceRetranscodeCheckbox,
	ProgressSection,
	ActionButtons,
} from './components/index.js';

const RetranscodeTab = () => {
	const {
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
		abortRetranscoding,
		resetState,
		showNotice,
		handleFetchOrStart,
	} = useRetranscoding();

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
	}, [ setAttachments, setSelectedIds, showNotice ] );

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
	}, [ selectedIds, setForceRetranscode, showNotice ] );

	// Fetch attachment details (name, size) after attachments are set
	useEffect( () => {
		if ( attachments.length === 0 ) {
			setAttachmentDetails( [] );
			return;
		}

		// If attachments already objects, just adopt them.
		if ( typeof attachments[ 0 ] === 'object' ) {
			setAttachmentDetails( attachments );
			return;
		}

		// attachments are numeric IDs (e.g., coming from URL or modal selection). Try reuse existing details.
		const allNumbers = attachments.every( ( a ) => typeof a === 'number' );
		if ( allNumbers ) {
			// Reuse cached details if they cover all IDs.
			if ( attachmentDetails.length > 0 ) {
				const existingForAll = attachments.every( ( id ) => attachmentDetails.find( ( d ) => d.id === id ) );
				if ( existingForAll ) {
					setAttachmentDetails( attachmentDetails.filter( ( d ) => attachments.includes( d.id ) ) );
					return;
				}
			}
			// Fetch details in parallel.
			Promise.all( attachments.map( ( id ) =>
				fetch( `${ window.godamRestRoute?.url }godam/v1/transcoding/media/details/${ id }`, {
					headers: { 'X-WP-Nonce': window.godamRestRoute?.nonce },
				} )
					.then( ( r ) => r.json() )
					.then( ( data ) => ( { id, name: data.name || `ID ${ id }`, size: data.size || 0 } ) )
					.catch( () => ( { id, name: `ID ${ id }`, size: 0 } ) ),
			) ).then( setAttachmentDetails );
		}
	}, [ attachmentDetails, attachments, setAttachmentDetails ] );

	// Bandwidth calculation
	const availableBandwidthGB = ( window.userData?.totalBandwidth || 0 ) - ( window.userData?.bandwidthUsed || 0 );
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
	}, [ attachmentDetails, totalRequiredGB, availableBandwidthGB, setModalSelection, setShowBandwidthModal, showNotice ] );

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
	}, [ done, aborted, successCount, failureCount, showNotice ] );

	return (
		<>
			<NoticeContainer
				notice={ notice }
				onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
			/>

			<Panel header={ __( 'Retranscode Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<BandwidthDisplay
						availableBandwidthGB={ availableBandwidthGB }
						bandwidthUsed={ window.userData?.bandwidthUsed }
					/>

					<BandwidthModal
						showBandwidthModal={ showBandwidthModal }
						attachmentDetails={ attachmentDetails }
						modalSelection={ modalSelection }
						setModalSelection={ setModalSelection }
						availableBandwidthGB={ availableBandwidthGB }
						onClose={ resetState }
						onProceed={ () => {
							setAttachments( modalSelection );
							setShowBandwidthModal( false );
						} }
					/>

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
						<ForceRetranscodeCheckbox
							forceRetranscode={ forceRetranscode }
							setForceRetranscode={ setForceRetranscode }
						/>
					}

					{ fetchingMedia && (
						<LoadingSpinner
							message={ __( 'Fetching media that require retranscoding…', 'godam' ) }
						/>
					) }

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

					<ProgressSection
						retranscoding={ retranscoding }
						aborted={ aborted }
						done={ done }
						mediaCount={ mediaCount }
						attachments={ attachments }
						logs={ logs }
					/>

					{
						retranscoding &&
						<span className="block text-gray-600 mb-4">
							{ __( 'You can safely close this tab! Retranscoding will continue in the background.', 'godam' ) }
						</span>
					}

					<ActionButtons
						retranscoding={ retranscoding }
						initialStatusFetching={ initialStatusFetching }
						fetchingMedia={ fetchingMedia }
						attachments={ attachments }
						attachmentDetails={ attachmentDetails }
						totalRequiredGB={ totalRequiredGB }
						availableBandwidthGB={ availableBandwidthGB }
						done={ done }
						aborted={ aborted }
						onFetchOrStart={ handleFetchOrStart }
						onAbort={ abortRetranscoding }
						onReset={ resetState }
					/>

				</PanelBody>
			</Panel>
		</>
	);
};

export default RetranscodeTab;

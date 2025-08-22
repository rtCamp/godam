/**
 * WordPress dependencies
 */
import { Panel, PanelBody } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

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
import {
	useUrlMediaIds,
	useSelectedIdsNotice,
	useAttachmentDetails,
	useBandwidthModal,
	useCompletionNotice,
} from './hooks/useRetranscodeTabEffects.js';

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
		abortRetranscoding,
		resetState,
		showNotice,
		handleFetchOrStart,
	} = useRetranscoding();

	// Helper functions for better readability
	const getAvailableBandwidthGB = () => {
		return ( window.userData?.totalBandwidth || 0 ) - ( window.userData?.bandwidthUsed || 0 );
	};

	const getTotalRequiredGB = () => {
		return attachmentDetails.reduce( ( sum, att ) => sum + ( ( att.size || 0 ) / 1024 / 1024 / 1024 ), 0 );
	};

	const shouldShowForceRetranscodeCheckbox = () => {
		return ! ( selectedIds && selectedIds.length > 0 ) &&
            ( attachments.length === 0 ) &&
            ! retranscoding &&
            ! done &&
            ! aborted &&
            ! initialStatusFetching;
	};

	const handleModalClose = () => {
		setShowBandwidthModal( false );
		setModalSelection( [] );
		// Clear attachments and details to prevent modal from reopening
		setAttachments( [] );
		setAttachmentDetails( [] );
	};

	// Derived values
	const availableBandwidthGB = getAvailableBandwidthGB();
	const totalRequiredGB = getTotalRequiredGB();

	// Side‑effects moved into dedicated hooks for clarity
	useUrlMediaIds( setAttachments, setSelectedIds, showNotice );
	useSelectedIdsNotice( selectedIds, setForceRetranscode, showNotice );
	useAttachmentDetails( attachments, attachmentDetails, setAttachmentDetails );
	useBandwidthModal( attachmentDetails, availableBandwidthGB, totalRequiredGB, setModalSelection, setShowBandwidthModal, showNotice, modalSelection );
	useCompletionNotice( done, aborted, successCount, failureCount, showNotice );

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
						onClose={ handleModalClose }
						onProceed={ () => {
							setAttachments( modalSelection );
							setSelectedIds( modalSelection );
							setForceRetranscode( false );
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

					{ /* Force retranscode checkbox */ }
					{ shouldShowForceRetranscodeCheckbox() && (
						<ForceRetranscodeCheckbox
							forceRetranscode={ forceRetranscode }
							setForceRetranscode={ setForceRetranscode }
						/>
					) }

					{ fetchingMedia && (
						<LoadingSpinner
							message={ __( 'Fetching media that require retranscoding…', 'godam' ) }
						/>
					) }

					{ attachments?.length > 0 && ! done && ! aborted && (
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
					) }

					{ retranscoding && (
						// Show x/y media retranscoded.
						<span className="text-gray-600">
							{ sprintf(
								// translators: %d is the number of media files sent for retranscoding.
								__( '%1$d/%2$d media files sent for retranscoding…', 'godam' ),
								mediaCount,
								queueTotal || attachments.length,
							) }
						</span>
					) }

					<ProgressSection
						retranscoding={ retranscoding }
						aborted={ aborted }
						done={ done }
						mediaCount={ mediaCount }
						attachments={ attachments }
						logs={ logs }
						queueTotal={ queueTotal }
					/>

					{ retranscoding && (
						<span className="block text-gray-600 mb-4">
							{ __( 'You can safely close this tab! Retranscoding will continue in the background.', 'godam' ) }
						</span>
					) }

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

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const ActionButtons = ( {
	retranscoding,
	initialStatusFetching,
	fetchingMedia,
	attachments,
	attachmentDetails,
	totalRequiredGB,
	availableBandwidthGB,
	done,
	aborted,
	onFetchOrStart,
	onAbort,
	onReset,
} ) => {
	return (
		<div className="flex gap-2">
			{
				// Show main action button only when not retranscoding and not completed/aborted
				! retranscoding && ! done && ! aborted &&
				<Button
					variant="primary"
					className="godam-button"
					onClick={ onFetchOrStart }
					disabled={
						initialStatusFetching ||
						fetchingMedia ||
						( ( attachments.length > 0 ) && attachmentDetails.length === 0 ) ||
						( attachmentDetails.length > 0 && totalRequiredGB > availableBandwidthGB )
					}
				>
					{ ( () => {
						if ( attachments.length === 0 ) {
							return __( 'Fetch Media', 'godam' );
						} else if ( attachmentDetails.length === 0 ) {
							return __( 'Please wait', 'godam' );
						}
						return __( 'Start Retranscoding', 'godam' );
					} )() }
				</Button>
			}

			{
				// Show abort button during retranscoding.
				retranscoding &&
				<Button
					variant="secondary"
					className="godam-button"
					onClick={ onAbort }
					style={ { backgroundColor: '#dc3545', color: 'white' } }
					disabled={ initialStatusFetching }
				>
					{ __( 'Abort Operation', 'godam' ) }
				</Button>
			}

			{
				// Show reset button after completion, failure, abort or after fetching media.
				( done || aborted || ( ! retranscoding && attachments.length > 0 ) ) &&
				<Button
					variant="secondary"
					className="godam-button"
					onClick={ onReset }
					disabled={ initialStatusFetching }
				>
					{ __( 'Reset', 'godam' ) }
				</Button>
			}
		</div>
	);
};

export default ActionButtons;

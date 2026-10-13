/**
 * "You're all set" dialog shown when the Media Library tour completes.
 */

/**
 * WordPress dependencies
 */
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen  Whether the modal is visible.
 * @param {Function} props.onClose Close handler.
 * @return {JSX.Element|null} The modal, or null when closed.
 */
const FinishModal = ( { isOpen, onClose } ) => {
	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'You’re all set!', 'godam' ) }
			onRequestClose={ onClose }
			className="godam-ml-tour-finish"
			size="small"
		>
			<p className="godam-ml-tour-finish__text">
				{ __( 'You now know how to organize your Media Library with GoDAM folders. Replay the tour anytime from the bulb button next to Manage Media.', 'godam' ) }
			</p>
			<div className="godam-ml-tour-finish__actions">
				<Button variant="primary" onClick={ onClose }>
					{ __( 'Done', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default FinishModal;

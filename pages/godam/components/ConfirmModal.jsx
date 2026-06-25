/**
 * WordPress dependencies
 */
import { Modal, Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './confirm-modal.scss';

/**
 * Reusable confirmation modal.
 *
 * Renders a small dialog with a title, body content and a Cancel / Confirm
 * button pair. Used for destructive or irreversible actions such as removing
 * the API key or resetting onboarding.
 *
 * @param {Object}      param0               - Component props.
 * @param {boolean}     param0.isOpen        - Whether the modal is visible.
 * @param {string}      param0.title         - Modal heading.
 * @param {JSX.Element} param0.children      - Modal body content.
 * @param {string}      param0.confirmLabel  - Confirm button label.
 * @param {string}      param0.cancelLabel   - Cancel button label.
 * @param {Function}    param0.onConfirm     - Called when the confirm button is clicked.
 * @param {Function}    param0.onCancel      - Called when the modal is dismissed or cancelled.
 * @param {boolean}     param0.isBusy        - Whether the confirm action is in progress.
 * @param {boolean}     param0.isDestructive - Whether the confirm action is destructive.
 *
 * @return {JSX.Element|null} The rendered modal or null when closed.
 */
const ConfirmModal = ( {
	isOpen,
	title,
	children,
	confirmLabel = __( 'Confirm', 'godam' ),
	cancelLabel = __( 'Cancel', 'godam' ),
	onConfirm,
	onCancel,
	isBusy = false,
	isDestructive = false,
	...rest
} ) => {
	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ title }
			onRequestClose={ onCancel }
			className="godam-confirm-modal"
			size="small"
			shouldCloseOnClickOutside={ ! isBusy }
			shouldCloseOnEsc={ ! isBusy }
		>
			<div className="godam-confirm-modal__body">
				{ children }
			</div>
			<div className="godam-confirm-modal__actions">
				<Button
					variant="tertiary"
					onClick={ onCancel }
					disabled={ isBusy }
				>
					{ cancelLabel }
				</Button>
				<Button
					variant="primary"
					onClick={ onConfirm }
					isDestructive={ isDestructive }
					isBusy={ isBusy }
					icon={ isBusy && <Spinner /> }
					disabled={ isBusy }
					{ ...rest }
				>
					{ confirmLabel }
				</Button>
			</div>
		</Modal>
	);
};

export default ConfirmModal;

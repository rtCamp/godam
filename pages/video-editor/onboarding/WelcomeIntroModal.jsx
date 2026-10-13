/**
 * First-run welcome shown when WooCommerce / GoDAM-for-Woo is NOT active.
 *
 * The single-option counterpart of WelcomeChooserModal: a title, a one-line
 * intro, an image placeholder (sharing the "interactive" artwork with the
 * chooser card), and Skip / Get Started actions. Get Started starts the core
 * Video Editor product guide.
 */

/**
 * WordPress dependencies
 */
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { WELCOME_IMAGES } from './welcomeImages';
import './welcome-intro-modal.scss';

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen    Whether the modal is visible.
 * @param {Function} props.onSkip    Called for "Skip for now" / dismiss.
 * @param {Function} props.onConfirm Called for "Get Started".
 * @param {boolean}  props.isBusy    Whether the action is in progress.
 * @return {JSX.Element|null} The rendered modal or null when closed.
 */
const WelcomeIntroModal = ( { isOpen, onSkip, onConfirm, isBusy = false } ) => {
	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Get Started with GoDAM', 'godam' ) }
			onRequestClose={ onSkip }
			className="godam-welcome-intro"
			size="medium"
			shouldCloseOnClickOutside={ ! isBusy }
			shouldCloseOnEsc={ ! isBusy }
		>
			<p className="godam-welcome-intro__subtitle">
				{ __( 'Get started by adding interactive layers to your video', 'godam' ) }
			</p>

			{ /* Image placeholder — shares the "interactive" artwork with the chooser. */ }
			<div className="godam-welcome-intro__media" aria-hidden="true">
				{ WELCOME_IMAGES.interactive && (
					<img className="godam-welcome-intro__media-img" src={ WELCOME_IMAGES.interactive } alt="" />
				) }
			</div>

			<div className="godam-welcome-intro__actions">
				<Button variant="tertiary" onClick={ onSkip } disabled={ isBusy }>
					{ __( 'Skip for now', 'godam' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ onConfirm }
					isBusy={ isBusy }
					disabled={ isBusy }
					data-test-id="godam-product-guide-button-start"
				>
					{ __( 'Get Started', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default WelcomeIntroModal;

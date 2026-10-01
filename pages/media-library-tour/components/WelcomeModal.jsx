/**
 * First-run welcome for the Media Library guided tour.
 */

/**
 * WordPress dependencies
 */
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { WelcomeIllustration } from './icons.jsx';

const FEATURES = () => [
	{
		title: __( 'Folders & sub-folders', 'godam' ),
		text: __( 'Organize every file into a tidy, nested structure.', 'godam' ),
	},
	{
		title: __( 'Drag & drop', 'godam' ),
		text: __( 'Move media into folders, or rearrange the folders themselves.', 'godam' ),
	},
	{
		title: __( 'Bookmarks & locks', 'godam' ),
		text: __( 'Pin the folders you use most and protect the ones that matter.', 'godam' ),
	},
];

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen    Whether the modal is visible.
 * @param {Function} props.onSkip    "Skip for now" / dismiss.
 * @param {Function} props.onConfirm "Start the tour".
 * @return {JSX.Element|null} The modal, or null when closed.
 */
const WelcomeModal = ( { isOpen, onSkip, onConfirm } ) => {
	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Welcome to the GoDAM Media Library', 'godam' ) }
			onRequestClose={ onSkip }
			className="godam-ml-tour-welcome"
			size="medium"
		>
			<p className="godam-ml-tour-welcome__subtitle">
				{ __( 'Take a quick, hands-on tour: you’ll create a folder, nest a sub-folder inside it and move media into it. It takes about two minutes.', 'godam' ) }
			</p>

			<div className="godam-ml-tour-welcome__media">
				<WelcomeIllustration />
			</div>

			<ul className="godam-ml-tour-welcome__features">
				{ FEATURES().map( ( feature ) => (
					<li key={ feature.title }>
						<strong>{ feature.title }</strong>
						<span>{ feature.text }</span>
					</li>
				) ) }
			</ul>

			<div className="godam-ml-tour-welcome__actions">
				<Button variant="tertiary" onClick={ onSkip }>
					{ __( 'Skip for now', 'godam' ) }
				</Button>
				<Button variant="primary" onClick={ onConfirm } data-test-id="godam-ml-tour-start">
					{ __( 'Start the tour', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default WelcomeModal;

/**
 * First-run welcome chooser shown when GoDAM-for-Woo is active.
 *
 * Replaces the single-option welcome with a two-card picker: the shopper-focused
 * Woo path (Shoppable Video block + in-editor tour) or the interactive-layers
 * path (the core Video Editor product guide).
 * When GoDAM-for-Woo is inactive the caller shows WelcomeIntroModal instead.
 */

/**
 * WordPress dependencies
 */
import { Modal, Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { WELCOME_IMAGES } from './welcomeImages';
import './welcome-chooser-modal.scss';

export const WELCOME_CHOICES = { WOO: 'woo', INTERACTIVE: 'interactive' };

const CARDS = [
	{
		key: WELCOME_CHOICES.WOO,
		badge: __( 'Woo', 'godam' ),
		title: __( 'Turn product videos into sales', 'godam' ),
		body: __( 'Add shoppable galleries and product blocks.', 'godam' ),
		image: WELCOME_IMAGES.woo,
	},
	{
		key: WELCOME_CHOICES.INTERACTIVE,
		title: __( 'Make your videos interactive', 'godam' ),
		body: __( 'Add CTAs or hotspots directly on top of any video.', 'godam' ),
		image: WELCOME_IMAGES.interactive,
	},
];

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen   Whether the modal is visible.
 * @param {Function} props.onSkip   Called for "Skip for now" / dismiss.
 * @param {Function} props.onChoose Called with the selected choice key.
 * @param {boolean}  props.isBusy   Whether the chosen action is in progress.
 * @return {JSX.Element|null} The rendered modal or null when closed.
 */
const WelcomeChooserModal = ( { isOpen, onSkip, onChoose, isBusy = false } ) => {
	const [ selected, setSelected ] = useState( WELCOME_CHOICES.WOO );

	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Welcome to GoDAM', 'godam' ) }
			onRequestClose={ onSkip }
			className="godam-welcome-chooser"
			size="large"
			shouldCloseOnClickOutside={ ! isBusy }
			shouldCloseOnEsc={ ! isBusy }
		>
			<p className="godam-welcome-chooser__subtitle">
				{ __( 'Choose what you’d like to explore first.', 'godam' ) }
			</p>

			<div className="godam-welcome-chooser__cards" role="radiogroup" aria-label={ __( 'Welcome options', 'godam' ) }>
				{ CARDS.map( ( card ) => {
					const isActive = selected === card.key;
					return (
						<button
							key={ card.key }
							type="button"
							role="radio"
							aria-checked={ isActive }
							className={ `godam-welcome-chooser__card${ isActive ? ' is-selected' : '' }` }
							onClick={ () => setSelected( card.key ) }
							data-test-id={ `godam-product-guide-card-${ card.key }` }
						>
							{ /* Image placeholder — artwork drops in here later. */ }
							<span className="godam-welcome-chooser__media" aria-hidden="true">
								{ card.image && (
									<img className="godam-welcome-chooser__media-img" src={ card.image } alt="" />
								) }
								{ card.badge && (
									<span className="godam-welcome-chooser__badge">{ card.badge }</span>
								) }
							</span>
							<span className="godam-welcome-chooser__card-foot">
								<span className={ `godam-welcome-chooser__radio${ isActive ? ' is-selected' : '' }` } aria-hidden="true" />
								<span>
									<span className="godam-welcome-chooser__card-title">{ card.title }</span>
									<span className="godam-welcome-chooser__card-body">{ card.body }</span>
								</span>
							</span>
						</button>
					);
				} ) }
			</div>

			<div className="godam-welcome-chooser__actions">
				<Button variant="tertiary" onClick={ onSkip } disabled={ isBusy }>
					{ __( 'Skip for now', 'godam' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ () => onChoose( selected ) }
					isBusy={ isBusy }
					disabled={ isBusy }
					data-test-id="godam-product-guide-button-see-how"
				>
					{ __( 'See how it works', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default WelcomeChooserModal;

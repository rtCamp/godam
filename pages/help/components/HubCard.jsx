/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { GODAM_DOCS_URL } from '../constants';
import HubIcon from './HubIcon';

/**
 * A single documentation hub card.
 *
 * Hubs without a `slug` have no docs hub published yet — they keep the card
 * layout but render an inert action, so the status badge stays the only claim
 * the card makes.
 *
 * @param {Object} props     Component props.
 * @param {Object} props.hub Hub definition from `getHubSections()`.
 */
const HubCard = ( { hub } ) => {
	const { icon, eyebrow, title, description, badge, badgeVariant, slug } = hub;
	const url = slug ? `${ GODAM_DOCS_URL }/${ slug }/` : '';

	return (
		<article className="godam-help-card">
			<span className="godam-help-card__icon">
				<HubIcon name={ icon } />
			</span>

			<p className="godam-help-card__eyebrow">{ eyebrow }</p>
			<h3 className="godam-help-card__title">{ title }</h3>
			<p className="godam-help-card__description">{ description }</p>

			{ badge && (
				<p className={ `godam-help-badge godam-help-badge--${ badgeVariant || 'accent' }` }>
					{ badge }
				</p>
			) }

			<div className="godam-help-card__action">
				{ url ? (
					<a
						className="godam-help-button"
						href={ url }
						target="_blank"
						rel="noreferrer"
					>
						{ __( 'Open docs', 'godam' ) }
						<span className="screen-reader-text">
							{ __( '(opens in a new tab)', 'godam' ) }
						</span>
					</a>
				) : (
					<span className="godam-help-button godam-help-button--disabled" aria-disabled="true">
						{ __( 'Open docs', 'godam' ) }
					</span>
				) }
			</div>
		</article>
	);
};

export default HubCard;

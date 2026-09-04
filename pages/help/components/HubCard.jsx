/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { GODAM_DOCS_URL } from '../constants.js';
import HubIcon from './HubIcon.jsx';

/**
 * A single documentation hub card.
 *
 * Hubs without a `slug` have no docs hub published yet, so the card omits the
 * action entirely and lets the status badge be the only claim it makes. An
 * "Open docs" button — even a greyed one — would imply docs already exist.
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

			<p className="godam-help-eyebrow godam-help-card__eyebrow">{ eyebrow }</p>
			<h3 className="godam-help-card__title">{ title }</h3>
			<p className="godam-help-card__description">{ description }</p>

			{ badge && (
				<p className={ `godam-help-badge godam-help-badge--${ badgeVariant || 'accent' }` }>
					{ badge }
				</p>
			) }

			{ url && (
				<div className="godam-help-card__action">
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
				</div>
			) }
		</article>
	);
};

export default HubCard;

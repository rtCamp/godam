/**
 * The Poll layer's front-end runtime (#2294). Polls come from WP-Polls.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { registerLayerRuntime, getLayerRuntime } from '../../godam-layers/runtime/registry.js';
import { mountOverlayLayer } from './overlay.js';

/**
 * Watch a poll layer for a vote.
 *
 * WP-Polls replaces its voting form (`.wp-polls-form`) with the results
 * (`.wp-polls-ans`) once the viewer votes. It also shows the results straight
 * away to a viewer who voted in an earlier session, so a vote only counts
 * after the voting form was seen.
 *
 * @param {HTMLElement} element Layer element.
 * @return {Function} Check returning `{ converted }` once the results show, else null.
 */
export function watchPollOutcome( element ) {
	let formSeen = Boolean( element?.querySelector( '.wp-polls-form' ) );
	return () => {
		const hasForm = Boolean( element.querySelector( '.wp-polls-form' ) );
		formSeen = formSeen || hasForm;
		const showsResults = ! hasForm && Boolean( element.querySelector( '.wp-polls-ans' ) );
		return showsResults ? { converted: formSeen } : null;
	};
}

/**
 * Register the Poll runtime, unless something already did.
 */
export function registerPollRuntime() {
	if ( getLayerRuntime( 'poll' ) ) {
		return;
	}
	registerLayerRuntime( 'poll', {
		title: 'Poll',
		validate: ( layer, { dependencies } ) => Boolean( dependencies?.wpPolls ),
		mount: mountOverlayLayer( () => ( {
			skipText: () => __( 'Skip Poll', 'godam' ),
			watchOutcome: watchPollOutcome,
			conversionAction: 'voted',
		} ) ),
	} );
}

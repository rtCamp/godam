/**
 * Internal dependencies
 */
import { openLightboxForId } from './managers/modalManager.js';
import { ACTIVATION_KEYS, TRIGGER_ATTRIBUTE, parseStartTime } from './utils/lightboxTargets.js';

/**
 * Element triggers — let any button, image or link open the lightbox.
 *
 * The markup contract is a single attribute carrying the video ID, so a trigger
 * can be any element: `<button data-godam-lightbox="4595">Watch</button>`, or
 * `<a href="{embedUrl}" data-godam-lightbox="4595" data-godam-lightbox-t="42">`
 * to also get a no-JS fallback and a start time.
 *
 * `openLightboxForId()` decides what actually opens — the on-page player when
 * there is a lightbox one to move, the embed page in an iframe otherwise.
 */

const TRIGGER_SELECTOR = `[${ TRIGGER_ATTRIBUTE }]`;

/**
 * Read the video ID off a trigger element.
 *
 * @param {HTMLElement} trigger - The trigger element.
 * @return {string} The ID, or an empty string.
 */
function getTriggerId( trigger ) {
	return ( trigger.getAttribute( TRIGGER_ATTRIBUTE ) || '' ).trim();
}

/**
 * Open the lightbox for whatever a trigger points at.
 *
 * @param {HTMLElement} trigger - The activated trigger element.
 */
function openFromTrigger( trigger ) {
	const id = getTriggerId( trigger );
	if ( ! id ) {
		return;
	}

	openLightboxForId( id, {
		startTime: parseStartTime( trigger.dataset.godamLightboxT ),
		title: trigger.getAttribute( 'data-godam-lightbox-title' ) || trigger.textContent?.trim(),
	} );
}

/**
 * Whether the element already activates on Enter/Space by itself.
 *
 * @param {HTMLElement} element - The trigger.
 * @return {boolean} True for natively interactive elements.
 */
function isNativelyInteractive( element ) {
	const tag = element.tagName?.toLowerCase();
	return (
		( 'a' === tag && element.hasAttribute( 'href' ) ) ||
		[ 'button', 'input', 'select', 'textarea' ].includes( tag )
	);
}

/**
 * Give non-interactive triggers (a `<div>`, an `<img>`) the semantics they need
 * to be reachable and operable from a keyboard.
 *
 * Runs on every pass and is idempotent, so triggers injected later by a page
 * builder or by AJAX get the same treatment.
 */
export function prepareTriggers() {
	document.querySelectorAll( TRIGGER_SELECTOR ).forEach( ( trigger ) => {
		if ( trigger.dataset.godamLightboxReady === '1' ) {
			return;
		}
		trigger.dataset.godamLightboxReady = '1';

		if ( isNativelyInteractive( trigger ) ) {
			return;
		}

		if ( ! trigger.hasAttribute( 'role' ) ) {
			trigger.setAttribute( 'role', 'button' );
		}
		if ( ! trigger.hasAttribute( 'tabindex' ) ) {
			trigger.setAttribute( 'tabindex', '0' );
		}
	} );
}

/**
 * Bind the single delegated listener pair.
 *
 * Delegation on `document` in the capture phase means markup injected later
 * needs no re-binding, and matches how `ModalManager` already beats Video.js to
 * a click.
 */
export function initLightboxTriggers() {
	if ( document.documentElement.dataset.godamLightboxTriggers === '1' ) {
		return;
	}
	document.documentElement.dataset.godamLightboxTriggers = '1';

	document.addEventListener(
		'click',
		( event ) => {
			const trigger = event.target?.closest?.( TRIGGER_SELECTOR );
			if ( ! trigger ) {
				return;
			}

			// Leave modified and non-primary clicks to the browser. An `<a href>`
			// trigger is a real link to the embed page, so Cmd/Ctrl+click must still
			// open it in a new tab and Shift+click in a new window. (Middle-click
			// needs no handling — it fires `auxclick`, which never reaches here.)
			if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 ) {
				return;
			}

			// Stop an `<a href="{embedUrl}">` fallback from navigating away.
			event.preventDefault();
			event.stopPropagation();
			openFromTrigger( trigger );
		},
		true,
	);

	document.addEventListener(
		'keydown',
		( event ) => {
			if ( ! ACTIVATION_KEYS.includes( event.key ) ) {
				return;
			}

			const trigger = event.target?.closest?.( TRIGGER_SELECTOR );
			if ( ! trigger || isNativelyInteractive( trigger ) ) {
				// Native elements fire a click of their own; handling the key too
				// would open the lightbox twice.
				return;
			}

			event.preventDefault();
			openFromTrigger( trigger );
		},
		true,
	);

	prepareTriggers();
}

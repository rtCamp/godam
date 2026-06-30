/**
 * Product-guide controller — a thin, framework-agnostic wrapper around driver.js.
 *
 * Implemented as a module singleton (not React state) so the guide survives the
 * Video Editor's list → editor view swap, which unmounts/mounts large subtrees
 * without a full page reload. The controller drives one highlight at a time and
 * waits for each step's target element to appear in the DOM before highlighting
 * it, so action-gated steps (click Edit, click Copy) can cross that boundary.
 *
 * React talks to it through `useProductGuide` (subscribe + configure); the
 * targeted components call `notify()` when the user performs a gated action.
 */

/**
 * External dependencies
 */
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getSteps } from './steps';
import { setProductGuideState, PRODUCT_GUIDE_STATES } from './productGuideState';
import './product-guide.scss';

let driverObj = null;
let steps = [];
let index = 0;
let active = false;

// Callbacks registered by the React layer (open the End-guide / Add-to-page modals).
let callbacks = {};

// Subscribers notified on any state change so React can mirror active/step.
const subscribers = new Set();

const snapshot = () => ( {
	active,
	index,
	total: steps.length,
	stepId: steps[ index ]?.id ?? null,
} );

const emit = () => {
	const state = snapshot();
	subscribers.forEach( ( fn ) => fn( state ) );
};

/**
 * Subscribe to controller state changes.
 *
 * @param {Function} fn Listener invoked with the current snapshot.
 * @return {Function} Unsubscribe function.
 */
export const subscribe = ( fn ) => {
	subscribers.add( fn );
	return () => subscribers.delete( fn );
};

/**
 * Register React callbacks. Merged, so multiple callers can contribute.
 *
 * @param {Object} next Partial callback map ({ onRequestEnd, onFinalAction }).
 */
export const configure = ( next ) => {
	callbacks = { ...callbacks, ...next };
};

/**
 * Resolve a step's target element, polling until it appears AND the step's
 * optional `ready` predicate is satisfied (e.g. the video timeline has loaded),
 * or the timeout elapses. Polling (rather than a MutationObserver) is used so
 * that `ready` predicates reading JS properties — like `video.duration` — are
 * picked up too. On timeout the element is still returned if it exists, so a
 * slow `ready` check degrades to showing the step rather than skipping it.
 *
 * @param {Object} step      The step ({ element, ready? }).
 * @param {number} [timeout] Max wait in ms.
 * @return {Promise<Element|null>} The element, or null if it never appears.
 */
const waitForStep = ( step, timeout = 10000 ) =>
	new Promise( ( resolve ) => {
		const interval = 120;
		let waited = 0;

		const resolved = () => {
			const el = document.querySelector( step.element );
			if ( el && ( ! step.ready || step.ready( el ) ) ) {
				return el;
			}
			return null;
		};

		const immediate = resolved();
		if ( immediate ) {
			resolve( immediate );
			return;
		}

		const timer = setInterval( () => {
			const el = resolved();
			if ( el ) {
				clearInterval( timer );
				resolve( el );
				return;
			}
			waited += interval;
			if ( waited >= timeout ) {
				clearInterval( timer );
				// Degrade gracefully: show the step if the element exists even when
				// the `ready` predicate never passed; otherwise skip it.
				resolve( document.querySelector( step.element ) );
			}
		}, interval );
	} );

/**
 * Remove the driver overlay + popover without changing the guide's logical
 * state (active flag / current index). Used to get the driver visuals out of
 * the way while a confirm modal is shown, so the guide can resume afterwards.
 */
const teardownVisuals = () => {
	if ( driverObj ) {
		driverObj.destroy();
		driverObj = null;
	}
};

const ensureDriver = () => {
	if ( driverObj ) {
		return driverObj;
	}
	driverObj = driver( {
		// Disable overlay-click / Escape closing so every exit goes through the
		// popover's X, which opens the "end guide?" confirm (see onCloseClick).
		allowClose: false,
		// The user must be able to click the highlighted control (Edit, Copy…).
		disableActiveInteraction: false,
		overlayColor: 'rgba(15, 15, 25, 0.6)',
		popoverClass: 'godam-product-guide',
	} );
	return driverObj;
};

/**
 * Highlight the current step, waiting for its element first. If the element
 * never appears the step is skipped so the tour can't dead-end.
 */
const show = async () => {
	const step = steps[ index ];
	if ( ! step || ! active ) {
		return;
	}

	const element = await waitForStep( step );

	// Bail if the guide was ended while we were waiting.
	if ( ! active ) {
		return;
	}

	if ( ! element ) {
		if ( index < steps.length - 1 ) {
			index += 1;
			show();
		}
		return;
	}

	const progress = `${ index + 1 }/${ steps.length }`;

	ensureDriver().highlight( {
		element,
		popover: {
			// Design popover: message only (no title), an X, an n/total counter
			// and a bottom progress bar. The flow is action-driven; only steps
			// flagged `showNext` (the config panel) expose a Next button.
			description: step.text,
			side: step.side || 'bottom',
			align: step.align || 'start',
			showButtons: step.showNext ? [ 'next', 'close' ] : [ 'close' ],
			nextBtnText: __( 'Next', 'godam' ),
			showProgress: true,
			progressText: progress,
			onNextClick: () => next(),
			// We own the lifecycle: the X opens the confirm modal rather than
			// silently destroying the tour.
			onCloseClick: () => {
				// Tear down the driver overlay/popover (z-index 1e9) before opening
				// the confirm modal, otherwise the popover sits above the modal and
				// swallows its button clicks. The guide stays "active" at the current
				// step so "Keep going" can resume() it.
				teardownVisuals();
				if ( callbacks.onRequestEnd ) {
					callbacks.onRequestEnd();
				} else {
					dismiss();
				}
			},
			// Inject the design's progress bar (driver only renders the counter text)
			// and position the Next button (config-panel step) below the bar.
			onPopoverRender: ( popover ) => {
				const pct = Math.round( ( ( index + 1 ) / steps.length ) * 100 );
				let bar = popover.wrapper.querySelector( '.godam-product-guide__bar' );
				if ( ! bar ) {
					bar = document.createElement( 'div' );
					bar.className = 'godam-product-guide__bar';
					const fill = document.createElement( 'span' );
					fill.className = 'godam-product-guide__bar-fill';
					bar.appendChild( fill );
					popover.wrapper.appendChild( bar );
				}
				bar.querySelector( '.godam-product-guide__bar-fill' ).style.width = `${ pct }%`;

				// Move the Next button's row to the very end so it sits after the
				// progress bar (the counter stays in the footer above the bar).
				const nextBtn = popover.wrapper.querySelector( '.driver-popover-next-btn' );
				if ( nextBtn ) {
					const navBtns = nextBtn.closest( '.driver-popover-navigation-btns' ) || nextBtn.parentElement;
					popover.wrapper.appendChild( navBtns );
				}
			},
		},
	} );

	emit();
};

/**
 * Start (or restart) the guide from the first step.
 */
export const start = () => {
	steps = getSteps();
	index = 0;
	active = true;
	show();
	emit();
};

/**
 * Request the welcome dialog (used by the "See how it works" re-launch). Lets
 * the React layer re-open the welcome modal — the two-card chooser on Woo sites,
 * or the single Get-Started modal otherwise — so a restart begins from the same
 * entry point as a first run. Falls back to starting the tour directly if no
 * welcome handler is registered.
 */
export const requestWelcome = () => {
	if ( callbacks.onRequestWelcome ) {
		callbacks.onRequestWelcome();
	} else {
		start();
	}
};

/**
 * Advance to the next step, or complete the guide if on the last step.
 */
export const next = () => {
	if ( index < steps.length - 1 ) {
		index += 1;
		show();
		emit();
	} else {
		complete();
	}
};

/**
 * Notify the controller that the user performed an action. Advances the guide
 * when it matches the current step's `advanceOn`. Final steps complete the
 * guide and fire `onFinalAction` (e.g. the "add to a page" prompt).
 *
 * @param {string} actionId Action identifier (matches a step's `advanceOn`).
 */
export const notify = ( actionId ) => {
	if ( ! active ) {
		return;
	}
	const step = steps[ index ];
	if ( ! step || step.advanceOn !== actionId ) {
		return;
	}
	if ( step.isFinal ) {
		complete();
		if ( callbacks.onFinalAction ) {
			callbacks.onFinalAction();
		}
	} else {
		next();
	}
};

/**
 * Tear down the driver overlay without changing the persisted state.
 */
export const destroy = () => {
	teardownVisuals();
	active = false;
	emit();
};

/**
 * Temporarily hide the guide's overlay + popover without changing logical
 * state, so a native UI can take the foreground (e.g. the wp.media image
 * picker, whose modal would otherwise sit below the driver overlay and have
 * its clicks swallowed). Pair with `resume()` once that UI closes.
 */
export const suspend = () => {
	if ( active ) {
		teardownVisuals();
	}
};

/**
 * Re-show the current step (used after the End-guide modal is cancelled).
 */
export const resume = () => {
	if ( active ) {
		show();
	}
};

/**
 * Complete the guide — persist "completed" and tear down.
 */
export const complete = () => {
	setProductGuideState( PRODUCT_GUIDE_STATES.COMPLETED );
	destroy();
};

/**
 * Dismiss the guide — persist "dismissed" and tear down.
 */
export const dismiss = () => {
	setProductGuideState( PRODUCT_GUIDE_STATES.DISMISSED );
	destroy();
};

/**
 * Whether the guide is currently running.
 *
 * @return {boolean} True while a tour is active.
 */
export const isActive = () => active;

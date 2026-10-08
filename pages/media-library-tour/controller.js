/**
 * Media Library guided-tour controller — a framework-agnostic wrapper around
 * driver.js, modelled on the Video Editor product guide (see
 * pages/video-editor/onboarding/productGuide.js).
 *
 * It highlights one step at a time and waits for each step's target to exist
 * before showing it, so steps can follow the user's real actions: opening the
 * New Folder modal, creating a folder, opening a folder's menu, dragging media
 * into it. Interactive steps advance on a polled predicate (`advanceWhen`) or a
 * document event broadcast by the folder sidebar (`advanceOn`); informational
 * steps use Next / Back. The current step and the tour context (ids of the
 * folders the user created) are mirrored to sessionStorage so the tour resumes
 * after a page reload.
 *
 * React (the welcome / end / finish modals) talks to it through `configure()`.
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
import { EVENTS, $visible, waitFor } from './dom';
import { setTourState, TOUR_STATES, writeSession, clearSession } from './state';

const POLL_INTERVAL = 150;
// driver.js highlight transition (its default `duration` is 400ms) plus margin.
const TRANSITION_MS = 600;
const INTERACTIVE_CLASS = 'godam-ml-tour-interactive';

let driverObj = null;
let steps = [];
let index = 0;
let active = false;
let ctx = {};
let history = [];
let pollTimer = null;
let showToken = 0;
let highlighted = null;
let lastRect = '';
let highlightedAt = 0;
let callbacks = {};

/**
 * Register React callbacks ({ onRequestEnd, onComplete }). Merged.
 *
 * @param {Object} next Partial callback map.
 */
export const configure = ( next ) => {
	callbacks = { ...callbacks, ...next };
};

const resolve = ( value ) => ( typeof value === 'function' ? value( ctx ) : value );

// driver.js renders the popover description as HTML. Tour copy is plain text but
// interpolates user-controlled folder names, so encode it to stop a crafted
// folder name from injecting markup or event handlers into wp-admin.
const escapeHtml = ( value ) =>
	String( value ?? '' ).replace( /[&<>"']/g, ( char ) => ( {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[ char ] ) );

const passes = ( step ) => ! step.when || step.when( ctx );

const isInformational = ( step ) => Boolean( step?.showNext ) && ! step.advanceOn && ! step.advanceWhen && ! step.skipTo;

const stopWatching = () => {
	if ( pollTimer ) {
		clearInterval( pollTimer );
		pollTimer = null;
	}
	document.querySelectorAll( `.${ INTERACTIVE_CLASS }` ).forEach( ( el ) => el.classList.remove( INTERACTIVE_CLASS ) );
};

/**
 * Remove the overlay + popover without touching the logical state, so a modal
 * (end-tour confirm) can take the foreground and the tour can resume after.
 */
const teardownVisuals = () => {
	stopWatching();
	highlighted = null;
	if ( driverObj ) {
		driverObj.destroy();
		driverObj = null;
	}
};

const ensureDriver = () => {
	if ( ! driverObj ) {
		driverObj = driver( {
			// Every exit goes through the popover's X (→ "End tour?" confirm).
			allowClose: false,
			// Arrow keys would otherwise page the tour while the user types a folder name.
			allowKeyboardControl: false,
			// The user must be able to click / drag the highlighted control.
			disableActiveInteraction: false,
			overlayColor: '#0f0f19',
			overlayOpacity: 0.6,
			stagePadding: 6,
			stageRadius: 8,
			popoverClass: 'godam-ml-tour',
		} );
	}
	return driverObj;
};

const persist = () => {
	if ( active && steps[ index ] ) {
		writeSession( { stepId: steps[ index ].id, ctx } );
	}
};

// Steps that depend on something the user hasn't done yet (e.g. "open your
// new folder") are counted as upcoming until they are actually skipped, so the
// n/total counter doesn't grow as the tour goes on.
let skipped = new Set();

const counts = ( step ) => ! skipped.has( step.id ) && ( step.optimistic || passes( step ) );

const progress = () => {
	const visible = steps.filter( counts );
	const position = steps.slice( 0, index + 1 ).filter( counts ).length;
	return { position: Math.max( position, 1 ), total: Math.max( visible.length, 1 ) };
};

const goToIndex = ( nextIndex, { record = true } = {} ) => {
	if ( record && steps[ index ] && history[ history.length - 1 ] !== index ) {
		history.push( index );
	}
	index = nextIndex;
	show();
};

/**
 * Jump to a step by id (used by `backTo` when the user abandons an action).
 *
 * @param {string} id Step id.
 */
const goTo = ( id ) => {
	const target = steps.findIndex( ( step ) => step.id === id );
	if ( target > -1 ) {
		// Drop history entries after the target so Back stays coherent.
		history = history.filter( ( i ) => i < target );
		goToIndex( target, { record: target > index } );
	}
};

/**
 * Advance to the next step, or complete the tour after the last one.
 */
export const next = () => {
	if ( ! active ) {
		return;
	}
	steps[ index ]?.onAdvance?.( ctx );
	if ( index < steps.length - 1 ) {
		goToIndex( index + 1 );
	} else {
		complete();
	}
};

/**
 * Go back to the previous informational step.
 */
const back = () => {
	const prev = history.pop();
	if ( typeof prev === 'number' ) {
		goToIndex( prev, { record: false } );
	}
};

const canGoBack = () => {
	const prev = history[ history.length - 1 ];
	return typeof prev === 'number' && isInformational( steps[ prev ] ) && isInformational( steps[ index ] );
};

const watch = ( step, element ) => {
	stopWatching();

	( step.interactive || [] ).forEach( ( selector ) => {
		document.querySelectorAll( selector ).forEach( ( el ) => el.classList.add( INTERACTIVE_CLASS ) );
	} );

	let revealed = ! step.reveal;
	// One refresh right after the transition settles catches targets that
	// moved while it was running.
	let refreshedAfterSettle = false;

	pollTimer = setInterval( () => {
		if ( ! active || steps[ index ] !== step ) {
			return;
		}
		if ( ! revealed ) {
			const target = document.querySelector( resolve( step.reveal ) );
			if ( target ) {
				target.scrollIntoView( { block: 'center' } );
				revealed = true;
			}
		}
		if ( step.advanceWhen && step.advanceWhen( ctx ) ) {
			next();
			return;
		}
		if ( step.abortWhen && step.abortWhen( ctx ) ) {
			goTo( step.backTo );
			return;
		}
		// React re-rendered the target (or it scrolled / resized): re-attach.
		if ( ! element.isConnected ) {
			show();
			return;
		}
		// Keep the popover glued to a target that moves (e.g. a modal still
		// animating in). driver.js's refresh() re-positions against its
		// *settled* element, which during the ~400ms highlight transition is
		// still the previous step's target — refreshing then would park the
		// popover next to the old control (e.g. "New Folder") until the next
		// scroll. So only refresh once the transition has landed on this element.
		//
		// driver.js has no public "settled element" API: getActiveElement()
		// switches to the new target as soon as the transition *starts*, which is
		// exactly the window we must avoid. So read the internal
		// `__activeElement`, and if a future driver.js renames it, fall back to
		// waiting out the transition by time instead of never refreshing.
		const settledEl = driverObj?.getState?.( '__activeElement' );
		const settled = undefined === settledEl
			? Date.now() - highlightedAt > TRANSITION_MS
			: settledEl === element;
		const rect = JSON.stringify( element.getBoundingClientRect() );
		if ( settled && ( rect !== lastRect || ! refreshedAfterSettle ) ) {
			lastRect = rect;
			refreshedAfterSettle = true;
			driverObj.refresh();
		}
		// Newly rendered interactive regions (e.g. a folder row added mid-step).
		( step.interactive || [] ).forEach( ( selector ) => {
			document.querySelectorAll( selector ).forEach( ( el ) => el.classList.add( INTERACTIVE_CLASS ) );
		} );
	}, POLL_INTERVAL );
};

/**
 * Show the current step: skip it when its `when` fails, prepare the page,
 * wait for its target, then highlight it.
 */
const show = async () => {
	const token = ++showToken;
	const step = steps[ index ];

	if ( ! active ) {
		return;
	}
	if ( ! step ) {
		complete();
		return;
	}
	if ( ! passes( step ) ) {
		skipped.add( step.id );
		goToIndex( index + 1, { record: false } );
		return;
	}

	persist();
	stopWatching();
	step.onEnter?.( ctx );

	// The action this step belongs to was abandoned (e.g. resuming after a
	// reload on "name your folder" with no modal open) — rewind to its start.
	const aborted = () => Boolean( step.abortWhen && step.backTo && step.abortWhen( ctx ) );

	let element = aborted() ? null : $visible( resolve( step.element ) );

	if ( ! element && ! aborted() ) {
		// Don't leave the previous popover hanging over a page that is changing.
		teardownVisuals();
		element = await waitFor( () => aborted() || ( step.skipWhen?.( ctx ) && 'skip' ) || $visible( resolve( step.element ) ), 10000 );
	}

	// A newer show() (or an end/dismiss) superseded this one while we waited.
	if ( token !== showToken || ! active ) {
		return;
	}

	if ( true === element || aborted() ) {
		goTo( step.backTo );
		return;
	}

	if ( ! element || 'skip' === element ) {
		// Target never appeared (or can't) — skip rather than dead-end the tour.
		skipped.add( step.id );
		goToIndex( index + 1, { record: false } );
		return;
	}

	highlighted = element;
	highlightedAt = Date.now();
	lastRect = JSON.stringify( element.getBoundingClientRect() );

	const { position, total } = progress();
	const buttons = [ 'close' ];
	if ( step.showNext ) {
		buttons.unshift( 'next' );
	}
	if ( canGoBack() ) {
		buttons.unshift( 'previous' );
	}

	ensureDriver().highlight( {
		element,
		popover: {
			title: step.title || '',
			description: escapeHtml( resolve( step.text ) ),
			side: step.side || 'bottom',
			align: step.align || 'start',
			showButtons: buttons,
			nextBtnText: step.nextLabel || __( 'Next', 'godam' ),
			prevBtnText: __( 'Back', 'godam' ),
			showProgress: true,
			progressText: `${ position }/${ total }`,
			onNextClick: () => ( step.skipTo ? goTo( step.skipTo ) : next() ),
			onPrevClick: () => back(),
			onCloseClick: () => {
				teardownVisuals();
				if ( callbacks.onRequestEnd ) {
					callbacks.onRequestEnd();
				} else {
					dismiss();
				}
			},
			onPopoverRender: ( popover ) => {
				// driver.js focuses the popover right after this callback; hand focus
				// back to where the user types (otherwise a space typed into the folder
				// name would "press" the focused close button).
				if ( step.focus ) {
					setTimeout( () => document.querySelector( step.focus )?.focus(), 0 );
				}

				// Progress bar along the bottom of the bubble.
				const pct = Math.round( ( position / total ) * 100 );
				let bar = popover.wrapper.querySelector( '.godam-ml-tour__bar' );
				if ( ! bar ) {
					bar = document.createElement( 'div' );
					bar.className = 'godam-ml-tour__bar';
					const fill = document.createElement( 'span' );
					fill.className = 'godam-ml-tour__bar-fill';
					bar.appendChild( fill );
					popover.wrapper.appendChild( bar );
				}
				bar.querySelector( '.godam-ml-tour__bar-fill' ).style.width = `${ pct }%`;
			},
		},
	} );

	watch( step, element );
};

const onDocumentEvent = ( event ) => {
	const step = steps[ index ];
	if ( ! active || ! step || step.advanceOn !== event.type || ! highlighted ) {
		return;
	}
	if ( step.onEvent && false === step.onEvent( ctx, event.detail ) ) {
		return;
	}
	next();
};

const listen = ( on ) => {
	Object.values( EVENTS ).forEach( ( name ) => {
		if ( on ) {
			document.addEventListener( name, onDocumentEvent );
		} else {
			document.removeEventListener( name, onDocumentEvent );
		}
	} );
};

/**
 * Start the tour from the first step, or resume a saved position.
 *
 * @param {Object} [options]         Options.
 * @param {string} [options.stepId]  Step to resume at.
 * @param {Object} [options.context] Saved tour context.
 */
export const start = ( { stepId = null, context = {} } = {} ) => {
	steps = getSteps();
	ctx = { ...context };
	history = [];
	skipped = new Set();
	const resumeAt = stepId ? steps.findIndex( ( step ) => step.id === stepId ) : 0;
	index = resumeAt > -1 ? resumeAt : 0;
	active = true;
	listen( true );
	show();
};

/**
 * Tear the tour down without changing the persisted per-user state.
 */
export const destroy = () => {
	showToken++;
	active = false;
	listen( false );
	teardownVisuals();
	clearSession();
};

/**
 * Re-show the current step (after the end-tour confirm is cancelled).
 */
export const resume = () => {
	if ( active ) {
		show();
	}
};

/**
 * Finish the tour — persist "completed", tear down, and notify React.
 */
export const complete = () => {
	setTourState( TOUR_STATES.COMPLETED );
	destroy();
	callbacks.onComplete?.();
};

/**
 * End the tour early — persist "dismissed" and tear down.
 */
export const dismiss = () => {
	setTourState( TOUR_STATES.DISMISSED );
	destroy();
};

/**
 * Whether the tour is currently running.
 *
 * @return {boolean} True while active.
 */
export const isActive = () => active;

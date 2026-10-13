/**
 * Internal dependencies
 */
// The sync is exercised through the real popstate/hashchange events rather than
// by calling syncLightboxWithUrl() directly, so that the wiring is covered too.
import {
	ModalManager,
	getLightbox,
	initLightboxUrlSync,
	openLightboxForId,
} from './modalManager';

/**
 * External dependencies
 */
import videojs from 'video.js';

// The lightbox only calls videojs.getPlayer(); a null return is the "not yet
// initialised" path, which most of these tests exercise deliberately. The
// fullscreen suite swaps in a stand-in player.
jest.mock( 'video.js', () => ( {
	__esModule: true,
	default: { getPlayer: jest.fn( () => null ) },
} ) );

/**
 * Render a lightbox player and return the pieces the manager works with.
 *
 * Pass `lightbox: false` for an ordinary inline player — one a trigger or a deep
 * link can still open, but whose inline render is not a click-to-open poster.
 *
 * @param {Object}  attrs          - Video data attributes.
 * @param {string}  attrs.id       - Attachment ID.
 * @param {string}  attrs.jobId    - Transcoding job ID.
 * @param {boolean} attrs.lightbox - Whether "Show in lightbox" is on.
 * @return {Object} The video element, its movable root and its wrapper.
 */
function renderPlayer( { id = '4595', jobId = 'job-1', lightbox = true } = {} ) {
	// Mirrors inc/templates/godam-player.php: an outer div carrying the
	// aspect-ratio / brand-colour custom properties, then <figure>, then
	// .godam-video-wrapper. The outer div is the movable root.
	document.body.innerHTML = `
		<div id="content">
			<p id="before">before</p>
			<div id="root" style="max-width:600px">
				<figure id="godam-player-container-x">
					<div class="godam-video-wrapper${ lightbox ? ' godam-show-in-lightbox' : '' }">
						<video id="v" data-id="${ id }" data-job_id="${ jobId }" data-show-in-lightbox="${ lightbox }"></video>
					</div>
				</figure>
			</div>
			<p id="after">after</p>
		</div>
	`;

	return {
		video: document.getElementById( 'v' ),
		playerRoot: document.getElementById( 'root' ),
		wrapper: document.querySelector( '.godam-video-wrapper' ),
	};
}

/**
 * Put the shared singleton back to a pristine state.
 *
 * Clearing `<body>` detaches the overlay that `ensureModal()` cached, so the
 * cache has to be dropped too or later opens would append into orphaned nodes.
 * A real page builds the overlay once and never removes it.
 */
function resetLightbox() {
	const lightbox = getLightbox();
	lightbox.close();
	document.body.innerHTML = '';
	lightbox.modal = null;
	lightbox.historyPushed = false;
}

describe( 'ModalManager', () => {
	let lightbox;

	beforeEach( () => {
		window.history.replaceState( {}, '', '/my-page/' );
		lightbox = new ModalManager();
	} );

	afterEach( () => {
		// Close before tearing down the DOM: an open manager leaves a document-level
		// keydown listener behind, and a later Escape would then reach two managers.
		lightbox.historyPushed = false; // Skip the history.back() during teardown.
		lightbox.close();
		document.body.innerHTML = '';
		document.body.className = '';
	} );

	describe( 'openElement', () => {
		it( 'moves the player into the overlay and restores it on close', () => {
			const { video, playerRoot } = renderPlayer();

			lightbox.openElement( playerRoot, { video } );

			expect( playerRoot.parentElement.className ).toBe( 'godam-player-modal-video' );
			expect( playerRoot.classList.contains( 'godam-player-modal-item' ) ).toBe( true );
			expect( lightbox.isOpen() ).toBe( true );
			expect( document.body.classList.contains( 'godam-player-modal-open' ) ).toBe( true );

			lightbox.close();

			// Back in its exact original position, between the two paragraphs.
			expect( playerRoot.parentElement.id ).toBe( 'content' );
			expect( playerRoot.previousElementSibling.id ).toBe( 'before' );
			expect( playerRoot.nextElementSibling.id ).toBe( 'after' );
			expect( playerRoot.classList.contains( 'godam-player-modal-item' ) ).toBe( false );
			expect( lightbox.isOpen() ).toBe( false );
			expect( document.body.classList.contains( 'godam-player-modal-open' ) ).toBe( false );
		} );

		it( 'leaves no anchor comment behind after closing', () => {
			const { video, playerRoot } = renderPlayer();

			lightbox.openElement( playerRoot, { video } );
			lightbox.close();

			const comments = [ ...document.getElementById( 'content' ).childNodes ].filter(
				( node ) => node.nodeType === Node.COMMENT_NODE,
			);
			expect( comments ).toHaveLength( 0 );
		} );

		it( 'ignores a missing player root', () => {
			lightbox.openElement( null );
			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'restores focus to whatever was focused before opening', () => {
			const { video, playerRoot } = renderPlayer();
			const trigger = document.createElement( 'button' );
			document.body.appendChild( trigger );
			trigger.focus();

			lightbox.openElement( playerRoot, { video } );
			expect( document.activeElement ).not.toBe( trigger );

			lightbox.close();
			expect( document.activeElement ).toBe( trigger );
		} );
	} );

	describe( 'closed poster', () => {
		/**
		 * A player stand-in with the surface close() touches.
		 *
		 * @return {Object} Fake Video.js player.
		 */
		const fakePlayer = () => ( {
			pause: jest.fn(),
			play: jest.fn( () => Promise.resolve() ),
			hasStarted: jest.fn(),
			currentTime: jest.fn( () => 12 ),
			el: () => null,
			isFullscreen: () => false,
			on: () => {},
			off: () => {},
		} );

		afterEach( () => {
			videojs.getPlayer.mockReturnValue( null );
		} );

		it( 'flags the wrapper while open, so the closed-state rule steps aside', () => {
			const { video, playerRoot, wrapper } = renderPlayer();

			lightbox.openElement( playerRoot, { video } );
			expect( wrapper.classList.contains( 'godam-lightbox-open' ) ).toBe( true );

			lightbox.close();
			expect( wrapper.classList.contains( 'godam-lightbox-open' ) ).toBe( false );
		} );

		it( 'clears the started flag on close, bringing the poster and play icon back', () => {
			const { video, playerRoot } = renderPlayer();
			const player = fakePlayer();
			videojs.getPlayer.mockReturnValue( player );

			lightbox.openElement( playerRoot, { video } );
			lightbox.close();

			expect( player.pause ).toHaveBeenCalled();
			expect( player.hasStarted ).toHaveBeenCalledWith( false );
			// Never rewound: reopening resumes where the viewer stopped.
			expect( player.currentTime ).not.toHaveBeenCalledWith( expect.anything() );
		} );

		it( 'leaves an ordinary inline player opened by a trigger in its played state', () => {
			const { video, playerRoot } = renderPlayer( { lightbox: false } );
			const player = fakePlayer();
			videojs.getPlayer.mockReturnValue( player );

			lightbox.openElement( playerRoot, { video } );
			lightbox.close();

			expect( player.pause ).toHaveBeenCalled();
			expect( player.hasStarted ).not.toHaveBeenCalled();
		} );

		it( 'has no wrapper to flag for an ordinary inline player', () => {
			const { video, playerRoot, wrapper } = renderPlayer( { lightbox: false } );

			lightbox.openElement( playerRoot, { video } );
			expect( wrapper.classList.contains( 'godam-lightbox-open' ) ).toBe( false );
		} );
	} );

	describe( 'openIframe', () => {
		it( 'renders an iframe and removes it on close', () => {
			lightbox.openIframe( '/?godam_page=video-embed&id=7', { title: 'Demo' } );

			const iframe = document.querySelector( '.godam-player-modal-iframe' );
			expect( iframe ).not.toBeNull();
			expect( iframe.getAttribute( 'src' ) ).toBe( '/?godam_page=video-embed&id=7' );
			expect( iframe.getAttribute( 'title' ) ).toBe( 'Demo' );
			expect( iframe.getAttribute( 'allowfullscreen' ) ).toBe( 'true' );

			lightbox.close();

			// Removing the iframe is what stops playback.
			expect( document.querySelector( '.godam-player-modal-iframe' ) ).toBeNull();
		} );

		it( 'ignores an empty src', () => {
			lightbox.openIframe( '' );
			expect( lightbox.isOpen() ).toBe( false );
		} );
	} );

	describe( 'history', () => {
		it( 'pushes the hash on open and pops it on close', () => {
			const { video, playerRoot } = renderPlayer();

			lightbox.openElement( playerRoot, { video, historyId: 'job-1' } );
			expect( window.location.hash ).toBe( '#godam-video-job-1' );
			expect( lightbox.historyPushed ).toBe( true );

			const back = jest.spyOn( window.history, 'back' ).mockImplementation( () => {} );
			lightbox.close();

			// Stepping back off our own entry keeps Back/Forward sane.
			expect( back ).toHaveBeenCalledTimes( 1 );
			expect( lightbox.historyPushed ).toBe( false );
			back.mockRestore();
		} );

		it( 'strips a job-ID hash even though the entry recorded the attachment ID', () => {
			// Regression: every link shared before the attachment ID became canonical
			// carries the job ID. The strip used to require the URL hash and the
			// entry's own hash to match, so those links stayed stranded in the URL
			// after closing.
			window.history.replaceState( {}, '', '/my-page/#godam-video-7hq7u3oht1' );
			const { video, playerRoot } = renderPlayer( { id: '4595', jobId: '7hq7u3oht1' } );

			lightbox.openElement( playerRoot, {
				video,
				historyId: '4595', // Canonical spelling, deliberately not the URL's.
				pushHistory: false,
			} );

			lightbox.close();

			expect( window.location.hash ).toBe( '' );
			expect( window.location.pathname ).toBe( '/my-page/' );
		} );

		it( 'keeps the path and query when stripping the hash', () => {
			window.history.replaceState( {}, '', '/my-page/?t=42&utm=x#godam-video-4595' );
			const { video, playerRoot } = renderPlayer();

			lightbox.openElement( playerRoot, { video, historyId: '4595', pushHistory: false } );
			lightbox.close();

			expect( window.location.hash ).toBe( '' );
			expect( window.location.search ).toBe( '?t=42&utm=x' );
		} );

		it( 'does not push for a deep-link entry, and strips the hash on close', () => {
			window.history.replaceState( {}, '', '/my-page/#godam-video-job-1' );
			const { video, playerRoot } = renderPlayer();

			const back = jest.spyOn( window.history, 'back' ).mockImplementation( () => {} );
			lightbox.openElement( playerRoot, { video, historyId: 'job-1', pushHistory: false } );

			expect( lightbox.historyPushed ).toBe( false );

			lightbox.close();

			// Nothing of ours to pop — the hash is simply dropped.
			expect( back ).not.toHaveBeenCalled();
			expect( window.location.hash ).toBe( '' );
			back.mockRestore();
		} );

		it( 'swaps the hash instead of stacking entries when reopening', () => {
			const { video, playerRoot } = renderPlayer();
			const push = jest.spyOn( window.history, 'pushState' );

			lightbox.openElement( playerRoot, { video, historyId: 'job-1' } );
			lightbox.openIframe( '/embed/2', { historyId: 'job-2' } );

			// One entry ever represents "a lightbox is open", so closing needs one Back.
			expect( push ).toHaveBeenCalledTimes( 1 );
			expect( window.location.hash ).toBe( '#godam-video-job-2' );
			expect( lightbox.historyPushed ).toBe( true );
			push.mockRestore();
		} );

		it( 'does not touch history when no ID is given', () => {
			const { video, playerRoot } = renderPlayer();

			lightbox.openElement( playerRoot, { video } );
			expect( window.location.hash ).toBe( '' );
			expect( lightbox.historyPushed ).toBe( false );
		} );
	} );

	describe( 'keyboard', () => {
		it( 'closes on Escape', () => {
			const { video, playerRoot } = renderPlayer();
			lightbox.openElement( playerRoot, { video } );

			document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'stops listening for Escape once closed', () => {
			const { video, playerRoot } = renderPlayer();
			lightbox.openElement( playerRoot, { video } );
			lightbox.close();

			const closeSpy = jest.spyOn( lightbox, 'close' );
			document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

			expect( closeSpy ).not.toHaveBeenCalled();
			closeSpy.mockRestore();
		} );

		it( 'moves focus into the dialog when Tab is pressed on the wrapper', () => {
			lightbox.openIframe( '/embed/1' );

			// showModal() parks focus on the wrapper, which is outside the focusable
			// list, so Tab must land on the first item rather than the page behind.
			document.querySelector( '.godam-player-modal-wrapper' ).focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', cancelable: true } );
			document.dispatchEvent( event );

			expect( event.defaultPrevented ).toBe( true );
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-close' ) );
		} );

		it( 'wraps from the last focusable back to the first', () => {
			lightbox.openIframe( '/embed/1' );

			// The iframe is last; Tab from there must not escape the overlay.
			document.querySelector( '.godam-player-modal-iframe' ).focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', cancelable: true } );
			document.dispatchEvent( event );

			expect( event.defaultPrevented ).toBe( true );
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-close' ) );
		} );

		it( 'wraps backwards from the first focusable to the last', () => {
			lightbox.openIframe( '/embed/1' );
			document.querySelector( '.godam-player-modal-close' ).focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: true, cancelable: true } );
			document.dispatchEvent( event );

			expect( event.defaultPrevented ).toBe( true );
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-iframe' ) );
		} );

		it( 'pins the close button inside the dialog, not the screen corner', () => {
			lightbox.openIframe( '/embed/1' );

			const wrapper = document.querySelector( '.godam-player-modal-wrapper' );
			const closeBtn = document.querySelector( '.godam-player-modal-close' );

			// Inside the dialog so it reads as part of the video, and so
			// `aria-modal="true"` does not hide it from assistive tech.
			expect( wrapper.contains( closeBtn ) ).toBe( true );
			expect( wrapper.getAttribute( 'aria-modal' ) ).toBe( 'true' );
			// A dialog with no name is announced as just "dialog".
			expect( wrapper.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'lets Tab move naturally between items in the middle of the list', () => {
			const { video, playerRoot } = renderPlayer();
			// Two focusable controls, so the iframe/close pair is not degenerate.
			playerRoot.querySelector( 'figure' ).insertAdjacentHTML(
				'beforeend',
				'<button id="ctrl-a">a</button><button id="ctrl-b">b</button>',
			);
			lightbox.openElement( playerRoot, { video } );

			document.getElementById( 'ctrl-a' ).focus();
			const event = new KeyboardEvent( 'keydown', { key: 'Tab', cancelable: true } );
			document.dispatchEvent( event );

			// Not first and not last — the browser's own focus order is correct here.
			expect( event.defaultPrevented ).toBe( false );
		} );

		it( 'skips controls Video.js has hidden', () => {
			const { video, playerRoot } = renderPlayer();
			playerRoot.querySelector( 'figure' ).insertAdjacentHTML(
				'beforeend',
				'<button id="ctrl-hidden" class="vjs-hidden">hidden</button>',
			);
			lightbox.openElement( playerRoot, { video } );

			document.querySelector( '.godam-player-modal-close' ).focus();
			document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Tab', cancelable: true } ) );

			// The hidden control is not a focus stop, so the close button is both
			// first and last and focus stays put.
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-close' ) );
		} );
	} );

	describe( 'register', () => {
		it( 'opens the lightbox on an inline click, addressably', () => {
			const { playerRoot } = renderPlayer();
			lightbox.register( document.getElementById( 'v' ) );

			playerRoot.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

			expect( lightbox.isOpen() ).toBe( true );
			// The attachment ID is the canonical shareable spelling.
			expect( window.location.hash ).toBe( '#godam-video-4595' );
		} );

		it( 'binds only once per player root', () => {
			const { playerRoot, video } = renderPlayer();

			lightbox.register( video );
			lightbox.register( video );

			const openSpy = jest.spyOn( lightbox, 'open' );
			playerRoot.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

			expect( openSpy ).toHaveBeenCalledTimes( 1 );
			openSpy.mockRestore();
		} );

		it( 'lets clicks through to the controls once the player is in the lightbox', () => {
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );
			lightbox.openElement( playerRoot, { video } );

			const event = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
			playerRoot.dispatchEvent( event );

			// Not swallowed — Video.js needs to see it.
			expect( event.defaultPrevented ).toBe( false );
		} );

		/**
		 * Fire a touch gesture at an element.
		 *
		 * @param {HTMLElement} target            - Element to touch.
		 * @param {Object}      opts              - Gesture shape.
		 * @param {number[]}    [opts.from]       - Start [screenX, screenY].
		 * @param {number[]}    [opts.to]         - End [screenX, screenY].
		 * @param {number}      [opts.fingers]    - Number of touch points.
		 * @param {boolean}     [opts.cancelable] - Whether touchend is cancelable.
		 * @return {Event} The dispatched touchend, for defaultPrevented checks.
		 */
		const touchGesture = ( target, { from = [ 10, 10 ], to = [ 10, 10 ], fingers = 1, cancelable = true } = {} ) => {
			const mk = ( x, y ) => ( { screenX: x, screenY: y, clientX: x, clientY: y, target } );
			const touches = Array.from( { length: fingers }, () => mk( ...from ) );

			const startEv = new Event( 'touchstart', { bubbles: true, cancelable: true } );
			startEv.touches = touches;
			target.dispatchEvent( startEv );

			const endEv = new Event( 'touchend', { bubbles: true, cancelable } );
			endEv.touches = [];
			endEv.changedTouches = [ mk( ...to ) ];
			target.dispatchEvent( endEv );
			return endEv;
		};

		it( 'opens on a tap, which Video.js otherwise leaves without a click', () => {
			// Video.js cancels touchend on the tech to suppress synthesized mouse
			// events, so the click handler never fires on a touch device.
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );

			const end = touchGesture( video );

			expect( lightbox.isOpen() ).toBe( true );
			expect( document.querySelector( '.godam-player-modal-video video' ) ).toBe( video );
			// Cancelling the touchend is what stops a second, synthesized click.
			expect( end.defaultPrevented ).toBe( true );
			expect( playerRoot.parentElement.className ).toBe( 'godam-player-modal-video' );
		} );

		it( 'ignores a swipe so the page can still be scrolled from the video', () => {
			const { video } = renderPlayer();
			lightbox.register( video );

			touchGesture( video, { from: [ 10, 10 ], to: [ 10, 90 ] } );

			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'ignores a multi-touch gesture', () => {
			const { video } = renderPlayer();
			lightbox.register( video );

			touchGesture( video, { fingers: 2 } );

			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'ignores a touchend with no matching touchstart', () => {
			const { video } = renderPlayer();
			lightbox.register( video );

			const endEv = new Event( 'touchend', { bubbles: true, cancelable: true } );
			endEv.changedTouches = [ { screenX: 10, screenY: 10 } ];
			video.dispatchEvent( endEv );

			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'leaves taps on video-overlay inner blocks alone', () => {
			const { playerRoot, video } = renderPlayer();
			playerRoot.querySelector( '.godam-video-wrapper' ).insertAdjacentHTML(
				'afterbegin',
				'<div class="godam-video-overlay-container"><a id="cta" href="/shop">Buy now</a></div>',
			);
			lightbox.register( video );

			const end = touchGesture( document.getElementById( 'cta' ) );

			expect( lightbox.isOpen() ).toBe( false );
			expect( end.defaultPrevented ).toBe( false );
		} );

		it( 'lets taps through to the controls once the player is in the lightbox', () => {
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );
			lightbox.openElement( playerRoot, { video } );

			const end = touchGesture( video );

			// Not swallowed — Video.js needs to see it to toggle playback.
			expect( end.defaultPrevented ).toBe( false );
		} );

		it( 'ignores a video with no movable root', () => {
			document.body.innerHTML = '<video id="v" data-show-in-lightbox="true"></video>';
			expect( () => lightbox.register( document.getElementById( 'v' ) ) ).not.toThrow();
		} );

		it( 'gives the poster button semantics so it is keyboard-reachable', () => {
			const { playerRoot, video } = renderPlayer();

			lightbox.register( video );

			expect( playerRoot.getAttribute( 'role' ) ).toBe( 'button' );
			expect( playerRoot.getAttribute( 'tabindex' ) ).toBe( '0' );
			expect( playerRoot.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'drops the button semantics while the player is open, and restores them on close', () => {
			// Left in place they would label an action that already happened, add a
			// Tab stop that does nothing, and wrap the whole control bar in a button.
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );

			lightbox.openElement( playerRoot, { video } );

			expect( playerRoot.hasAttribute( 'role' ) ).toBe( false );
			expect( playerRoot.hasAttribute( 'tabindex' ) ).toBe( false );
			expect( playerRoot.hasAttribute( 'aria-label' ) ).toBe( false );

			lightbox.close();

			expect( playerRoot.getAttribute( 'role' ) ).toBe( 'button' );
			expect( playerRoot.getAttribute( 'tabindex' ) ).toBe( '0' );
			expect( playerRoot.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'never removes semantics the author set themselves', () => {
			document.body.innerHTML = `
				<div id="root" role="region" aria-label="Author label">
					<figure><div class="godam-video-wrapper">
						<video id="v" data-id="4595" data-job_id="job-1" data-show-in-lightbox="true"></video>
					</div></figure>
				</div>
			`;
			const playerRoot = document.getElementById( 'root' );
			const video = document.getElementById( 'v' );

			lightbox.register( video );
			// Only tabindex was missing, so only tabindex is ours to manage.
			expect( playerRoot.getAttribute( 'role' ) ).toBe( 'region' );
			expect( playerRoot.getAttribute( 'aria-label' ) ).toBe( 'Author label' );

			lightbox.openElement( playerRoot, { video } );

			expect( playerRoot.getAttribute( 'role' ) ).toBe( 'region' );
			expect( playerRoot.getAttribute( 'aria-label' ) ).toBe( 'Author label' );
			expect( playerRoot.hasAttribute( 'tabindex' ) ).toBe( false );

			lightbox.close();

			expect( playerRoot.getAttribute( 'tabindex' ) ).toBe( '0' );
		} );

		it( 'leaves an unregistered root alone on open', () => {
			// A root that never got poster semantics must not have attributes
			// invented for it when the lightbox closes.
			const { playerRoot, video } = renderPlayer();

			lightbox.openElement( playerRoot, { video } );
			lightbox.close();

			expect( playerRoot.hasAttribute( 'role' ) ).toBe( false );
			expect( playerRoot.hasAttribute( 'tabindex' ) ).toBe( false );
		} );

		it.each( [ 'Enter', ' ' ] )( 'opens on %s', ( key ) => {
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );

			playerRoot.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true } ) );

			expect( lightbox.isOpen() ).toBe( true );
		} );

		it( 'ignores other keys', () => {
			const { playerRoot, video } = renderPlayer();
			lightbox.register( video );

			playerRoot.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'a', bubbles: true, cancelable: true } ) );

			expect( lightbox.isOpen() ).toBe( false );
		} );

		it( 'leaves clicks on video-overlay inner blocks alone', () => {
			// Authors drop their own buttons and links into the video overlay.
			// Swallowing those would silently break them.
			const { playerRoot, video } = renderPlayer();
			playerRoot.querySelector( '.godam-video-wrapper' ).insertAdjacentHTML(
				'afterbegin',
				'<div class="godam-video-overlay-container"><a id="cta" href="/shop">Buy now</a></div>',
			);
			lightbox.register( video );

			const event = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
			document.getElementById( 'cta' ).dispatchEvent( event );

			expect( lightbox.isOpen() ).toBe( false );
			expect( event.defaultPrevented ).toBe( false );
		} );

		it( 'still opens on a click on the player itself', () => {
			const { playerRoot, video } = renderPlayer();
			playerRoot.querySelector( '.godam-video-wrapper' ).insertAdjacentHTML(
				'afterbegin',
				'<div class="godam-video-overlay-container"><a id="cta" href="/shop">Buy now</a></div>',
			);
			lightbox.register( video );

			playerRoot.querySelector( '.godam-video-wrapper' ).dispatchEvent(
				new MouseEvent( 'click', { bubbles: true, cancelable: true } ),
			);

			expect( lightbox.isOpen() ).toBe( true );
		} );
	} );

	describe( 'detached root', () => {
		it( 'bails instead of throwing when the player root has no parent', () => {
			const { video } = renderPlayer();
			const orphan = document.getElementById( 'root' );
			orphan.remove();

			expect( () => lightbox.openElement( orphan, { video } ) ).not.toThrow();
			expect( lightbox.isOpen() ).toBe( false );
		} );
	} );
} );

describe( 'fullscreen inside the lightbox', () => {
	let lightbox;
	let player;
	let playerEl;

	/**
	 * A player stand-in with just the surface ModalManager touches.
	 *
	 * @param {HTMLElement} el - The `.video-js` element it reports.
	 * @return {Object} Fake Video.js player.
	 */
	const fakePlayer = ( el ) => {
		const handlers = {};
		return {
			el: () => el,
			on: ( ev, fn ) => {
				handlers[ ev ] = handlers[ ev ] || [];
				handlers[ ev ].push( fn );
			},
			off: ( ev, fn ) => {
				handlers[ ev ] = ( handlers[ ev ] || [] ).filter( ( f ) => f !== fn );
			},
			trigger: ( ev ) => ( handlers[ ev ] || [] ).forEach( ( f ) => f() ),
			isFullscreen: () => false,
			play: () => Promise.resolve(),
			pause: () => {},
			readyState: () => 4,
			one: () => {},
			currentTime: () => 0,
			hasStarted: jest.fn(),
		};
	};

	beforeEach( () => {
		window.history.replaceState( {}, '', '/my-page/' );
		document.body.innerHTML = `
			<div id="root">
				<figure><div class="godam-video-wrapper">
					<div class="easydam-video-container">
						<div class="video-js" id="playerEl">
							<video id="v" data-id="4595" data-job_id="job-1" data-show-in-lightbox="true"></video>
						</div>
					</div>
				</div></figure>
			</div>
		`;
		playerEl = document.getElementById( 'playerEl' );
		player = fakePlayer( playerEl );
		videojs.getPlayer.mockReturnValue( player );
		// jsdom has no scrollTo, and releasing the iOS lock restores scroll position.
		window.scrollTo = jest.fn();
		lightbox = new ModalManager();
	} );

	afterEach( () => {
		lightbox.historyPushed = false;
		lightbox.close();
		videojs.getPlayer.mockReturnValue( null );
		document.body.innerHTML = '';
		document.body.style.cssText = '';
		document.documentElement.style.cssText = '';
	} );

	/**
	 * Do what the iOS custom fullscreen button does.
	 */
	const enterCustomFullscreen = () => {
		playerEl.classList.add( 'vjs-fullscreen' );
		playerEl.closest( '.easydam-video-container' ).classList.add( 'godam-video-fullscreen' );
		document.body.style.position = 'fixed';
		document.body.style.top = '-120px';
		document.body.style.overflow = 'hidden';
		player.trigger( 'customfullscreenchange' );
	};

	it( 'drops the wrapper transform so a fullscreen player can fill the viewport', () => {
		// The wrapper is transformed for centring, which would otherwise make it the
		// containing block for the fullscreen player's `position: fixed`.
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		const wrapper = document.querySelector( '.godam-player-modal-wrapper' );

		expect( wrapper.classList.contains( 'godam-lightbox-fullscreen' ) ).toBe( false );

		enterCustomFullscreen();

		expect( wrapper.classList.contains( 'godam-lightbox-fullscreen' ) ).toBe( true );
	} );

	it( 'restores the wrapper when fullscreen exits', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		const wrapper = document.querySelector( '.godam-player-modal-wrapper' );

		enterCustomFullscreen();
		playerEl.classList.remove( 'vjs-fullscreen' );
		player.trigger( 'customfullscreenchange' );

		expect( wrapper.classList.contains( 'godam-lightbox-fullscreen' ) ).toBe( false );
	} );

	it( 'releases the body scroll lock when the lightbox closes mid-fullscreen', () => {
		// Only the exit button undoes the iOS lock, so closing around it — Back,
		// Escape, a trigger for another video — used to leave the page pinned.
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		enterCustomFullscreen();

		lightbox.close();

		expect( document.body.style.position ).toBe( '' );
		expect( document.body.style.top ).toBe( '' );
		expect( document.body.style.overflow ).toBe( '' );
		expect( playerEl.classList.contains( 'vjs-fullscreen' ) ).toBe( false );
		expect(
			playerEl.closest( '.easydam-video-container' ).classList.contains( 'godam-video-fullscreen' ),
		).toBe( false );
	} );

	it( 'leaves the body alone when closing without fullscreen', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		document.body.style.top = '-40px'; // Set by something else entirely.

		lightbox.close();

		expect( document.body.style.top ).toBe( '-40px' );
	} );

	it( 'Escape exits fullscreen first and leaves the lightbox open', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		const wrapper = document.querySelector( '.godam-player-modal-wrapper' );
		enterCustomFullscreen();

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

		expect( lightbox.isOpen() ).toBe( true );
		expect( playerEl.classList.contains( 'vjs-fullscreen' ) ).toBe( false );
		expect(
			playerEl.closest( '.easydam-video-container' ).classList.contains( 'godam-video-fullscreen' ),
		).toBe( false );
		// The wrapper's centring transform comes back with it.
		expect( wrapper.classList.contains( 'godam-lightbox-fullscreen' ) ).toBe( false );
		// And the page is scrollable again.
		expect( document.body.style.position ).toBe( '' );
	} );

	it( 'a second Escape then closes the lightbox', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		enterCustomFullscreen();

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( lightbox.isOpen() ).toBe( true );

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( lightbox.isOpen() ).toBe( false );
	} );

	it( 'Escape closes straight away when not fullscreen', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

		expect( lightbox.isOpen() ).toBe( false );
	} );

	it( 'hands native fullscreen back to the browser rather than closing', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		player.isFullscreen = () => true;
		player.exitFullscreen = jest.fn();

		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

		expect( player.exitFullscreen ).toHaveBeenCalledTimes( 1 );
		expect( lightbox.isOpen() ).toBe( true );
	} );

	it( 'stops tracking fullscreen once closed', () => {
		lightbox.openElement( document.getElementById( 'root' ), { video: document.getElementById( 'v' ) } );
		const wrapper = document.querySelector( '.godam-player-modal-wrapper' );

		lightbox.close();
		playerEl.classList.add( 'vjs-fullscreen' );
		player.trigger( 'customfullscreenchange' );

		expect( wrapper.classList.contains( 'godam-lightbox-fullscreen' ) ).toBe( false );
	} );
} );

describe( 'openLightboxForId', () => {
	beforeEach( () => {
		window.godamData = { embedBaseUrl: 'http://example.com/', hostPostId: '12' };
		window.history.replaceState( {}, '', '/my-page/' );
		resetLightbox();
	} );

	it( 'moves an on-page lightbox player rather than iframing it', () => {
		renderPlayer();

		expect( openLightboxForId( '4595' ) ).toBe( true );

		const content = document.querySelector( '.godam-player-modal-video' );
		expect( content.querySelector( 'video' ).dataset.id ).toBe( '4595' );
		expect( content.querySelector( 'iframe' ) ).toBeNull();
	} );

	it( 'resolves by job ID too, but normalises the hash to the attachment ID', () => {
		renderPlayer();

		openLightboxForId( 'job-1' );

		expect( document.querySelector( '.godam-player-modal-video video' ) ).not.toBeNull();
		expect( window.location.hash ).toBe( '#godam-video-4595' );
	} );

	it( 'falls back to the embed iframe when the video is not on the page', () => {
		expect( openLightboxForId( '999' ) ).toBe( true );

		const iframe = document.querySelector( '.godam-player-modal-iframe' );
		const url = new URL( iframe.getAttribute( 'src' ) );
		expect( url.searchParams.get( 'id' ) ).toBe( '999' );
		expect( url.searchParams.get( 'host_post_id' ) ).toBe( '12' );
		expect( url.searchParams.get( 'block_source' ) ).toBe( 'lightbox-trigger' );
	} );

	it( 'iframes an ordinary visible inline player instead of tearing it out of the page', () => {
		// Moving a player the visitor can already see would leave a hole in the
		// layout and hijack playback, so only lightbox players are re-used.
		document.body.innerHTML = `
			<div><figure><video id="v" data-id="4595" data-show-in-lightbox="false"></video></figure></div>
		`;

		openLightboxForId( '4595' );

		expect( document.querySelector( '.godam-player-modal-iframe' ) ).not.toBeNull();
		expect( document.getElementById( 'v' ).closest( '.godam-player-modal-video' ) ).toBeNull();
	} );

	it( 'refuses a missing ID', () => {
		expect( openLightboxForId( '' ) ).toBe( false );
		expect( openLightboxForId( null ) ).toBe( false );
		expect( getLightbox().isOpen() ).toBe( false );
	} );

	it( 'writes the attachment ID into the hash, not the job ID', () => {
		// The canonical shareable form: the ID authors recognise and write into
		// triggers. The share button now produces the same spelling.
		renderPlayer( { id: '4595', jobId: '7hq7u3oht1' } );

		openLightboxForId( '4595' );

		expect( window.location.hash ).toBe( '#godam-video-4595' );
	} );

	it( 'writes the attachment ID even when the caller addresses the video by job ID', () => {
		renderPlayer( { id: '4595', jobId: '7hq7u3oht1' } );

		openLightboxForId( '7hq7u3oht1' );

		expect( getLightbox().isOpen() ).toBe( true );
		expect( window.location.hash ).toBe( '#godam-video-4595' );
	} );

	it( 'still opens for virtual media, which only has a job ID', () => {
		document.body.innerHTML = `
			<div id="root"><figure><div class="godam-video-wrapper">
				<video data-id="" data-job_id="vm-123" data-show-in-lightbox="true"></video>
			</div></figure></div>
		`;

		openLightboxForId( 'vm-123' );

		expect( document.querySelector( '.godam-player-modal-video video' ) ).not.toBeNull();
		expect( window.location.hash ).toBe( '#godam-video-vm-123' );
	} );
} );

describe( 'syncLightboxWithUrl', () => {
	beforeAll( () => {
		initLightboxUrlSync();
	} );

	beforeEach( () => {
		window.godamData = { embedBaseUrl: 'http://example.com/', hostPostId: '12' };
		window.history.replaceState( {}, '', '/my-page/' );
		resetLightbox();
	} );

	it( 'opens when the URL gains a lightbox hash (Forward, or an anchor link)', () => {
		renderPlayer();
		window.history.replaceState( {}, '', '/my-page/#godam-video-job-1' );

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );

		expect( getLightbox().isOpen() ).toBe( true );
		expect( document.querySelector( '.godam-player-modal-video video' ).dataset.id ).toBe( '4595' );
	} );

	it( 'reacts to hashchange, which anchor links fire without a popstate', () => {
		renderPlayer();
		window.history.replaceState( {}, '', '/my-page/#godam-video-job-1' );

		window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );

		expect( getLightbox().isOpen() ).toBe( true );
	} );

	it( 'closes when the URL loses the lightbox hash', () => {
		renderPlayer();
		openLightboxForId( 'job-1' );
		expect( getLightbox().isOpen() ).toBe( true );

		window.history.replaceState( {}, '', '/my-page/' );
		window.dispatchEvent( new PopStateEvent( 'popstate' ) );

		expect( getLightbox().isOpen() ).toBe( false );
		expect( getLightbox().historyPushed ).toBe( false );
	} );

	it( 'does not re-open the video it is already showing', () => {
		renderPlayer();
		openLightboxForId( 'job-1' );
		const shown = document.querySelector( '.godam-player-modal-video' ).firstElementChild;

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );

		// Same node, untouched — a needless close/reopen would restart playback.
		expect( document.querySelector( '.godam-player-modal-video' ).firstElementChild ).toBe( shown );
		expect( getLightbox().isOpen() ).toBe( true );
	} );

	it( 'switches to a different video when the hash changes to another ID', () => {
		document.body.innerHTML = `
			<div id="a"><figure><div class="godam-video-wrapper">
				<video data-id="1" data-job_id="job-a" data-show-in-lightbox="true"></video>
			</div></figure></div>
			<div id="b"><figure><div class="godam-video-wrapper">
				<video data-id="2" data-job_id="job-b" data-show-in-lightbox="true"></video>
			</div></figure></div>
		`;
		openLightboxForId( 'job-a' );
		expect( document.querySelector( '.godam-player-modal-video video' ).dataset.id ).toBe( '1' );

		window.history.replaceState( {}, '', '/my-page/#godam-video-job-b' );
		window.dispatchEvent( new PopStateEvent( 'popstate' ) );

		expect( document.querySelector( '.godam-player-modal-video video' ).dataset.id ).toBe( '2' );
	} );

	it( 'stays closed when the URL has no lightbox hash', () => {
		renderPlayer();

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );

		expect( getLightbox().isOpen() ).toBe( false );
	} );

	it( 'survives a single anchor click firing both popstate and hashchange', () => {
		// A fragment click can fire both events. The second reconcile must be a
		// no-op: re-opening would restart playback, and re-resolving mid-open used
		// to drop to an iframe.
		renderPlayer();
		window.history.replaceState( {}, '', '/my-page/#godam-video-job-1' );

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );
		const opened = document.querySelector( '.godam-player-modal-video' ).firstElementChild;

		window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );

		expect( document.querySelector( '.godam-player-modal-video' ).firstElementChild ).toBe( opened );
		expect( document.querySelector( '.godam-player-modal-iframe' ) ).toBeNull();
	} );

	it( 'no-ops the second reconcile when the URL uses the attachment ID but the entry stored the job ID', () => {
		// The regression this guard exists for: openLightboxForId() records the job
		// ID as the history hash, so comparing hash strings against an
		// attachment-ID URL never matched and the player was torn down.
		renderPlayer();
		window.history.replaceState( {}, '', '/my-page/#godam-video-4595' );

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );
		const opened = document.querySelector( '.godam-player-modal-video' ).firstElementChild;
		expect( opened.querySelector( 'video' ).dataset.id ).toBe( '4595' );

		window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );

		expect( document.querySelector( '.godam-player-modal-video' ).firstElementChild ).toBe( opened );
		expect( document.querySelector( '.godam-player-modal-iframe' ) ).toBeNull();
	} );

	it( 'keeps using the on-page lightbox player when an inline copy of the same video exists', () => {
		// Reproduces the live page that broke: the same video rendered twice, once
		// as a lightbox poster and once as a plain inline player.
		document.body.innerHTML = `
			<div id="lb"><figure><div class="godam-video-wrapper">
				<video data-id="4595" data-job_id="job-1" data-show-in-lightbox="true"></video>
			</div></figure></div>
			<div id="plain"><figure><div class="godam-video-wrapper">
				<video data-id="4595" data-job_id="job-1" data-show-in-lightbox="false"></video>
			</div></figure></div>
		`;
		window.history.replaceState( {}, '', '/my-page/#godam-video-4595' );

		window.dispatchEvent( new PopStateEvent( 'popstate' ) );
		window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );

		const shown = document.querySelector( '.godam-player-modal-video' );
		expect( shown.querySelector( 'iframe' ) ).toBeNull();
		expect( shown.querySelector( 'video' ).dataset.showInLightbox ).toBe( 'true' );
		// The plain player must be left exactly where it was.
		expect( document.getElementById( 'plain' ) ).not.toBeNull();
	} );
} );

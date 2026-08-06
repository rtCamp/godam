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

// The lightbox only calls videojs.getPlayer(); a null return is the "not yet
// initialised" path, which these tests exercise deliberately.
jest.mock( 'video.js', () => ( {
	__esModule: true,
	default: { getPlayer: jest.fn( () => null ) },
} ) );

/**
 * Render a lightbox player and return the pieces the manager works with.
 *
 * @param {Object} attrs       - Video data attributes.
 * @param {string} attrs.id    - Attachment ID.
 * @param {string} attrs.jobId - Transcoding job ID.
 * @return {Object} The video element and its movable root.
 */
function renderPlayer( { id = '4595', jobId = 'job-1' } = {} ) {
	// Mirrors inc/templates/godam-player.php: an outer div carrying the
	// aspect-ratio / brand-colour custom properties, then <figure>, then
	// .godam-video-wrapper. The outer div is the movable root.
	document.body.innerHTML = `
		<div id="content">
			<p id="before">before</p>
			<div id="root" style="max-width:600px">
				<figure id="godam-player-container-x">
					<div class="godam-video-wrapper godam-show-in-lightbox">
						<video id="v" data-id="${ id }" data-job_id="${ jobId }" data-show-in-lightbox="true"></video>
					</div>
				</figure>
			</div>
			<p id="after">after</p>
		</div>
	`;

	return {
		video: document.getElementById( 'v' ),
		playerRoot: document.getElementById( 'root' ),
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
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-iframe' ) );
		} );

		it( 'wraps from the last focusable back to the first', () => {
			lightbox.openIframe( '/embed/1' );

			// The close button is last; Tab from there must not escape the overlay.
			document.querySelector( '.godam-player-modal-close' ).focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', cancelable: true } );
			document.dispatchEvent( event );

			expect( event.defaultPrevented ).toBe( true );
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-iframe' ) );
		} );

		it( 'wraps backwards from the first focusable to the last', () => {
			lightbox.openIframe( '/embed/1' );
			document.querySelector( '.godam-player-modal-iframe' ).focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: true, cancelable: true } );
			document.dispatchEvent( event );

			expect( event.defaultPrevented ).toBe( true );
			expect( document.activeElement ).toBe( document.querySelector( '.godam-player-modal-close' ) );
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

		it( 'ignores a video with no movable root', () => {
			document.body.innerHTML = '<video id="v" data-show-in-lightbox="true"></video>';
			expect( () => lightbox.register( document.getElementById( 'v' ) ) ).not.toThrow();
		} );
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

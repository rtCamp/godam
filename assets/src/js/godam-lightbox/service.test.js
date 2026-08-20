/**
 * Unit tests for the shared lightbox service.
 *
 * The gallery block had no automated coverage of its modal at all — the QA
 * selectors for it exist but no spec consumes them — so these tests are the
 * first safety net under this behaviour. They pin the things a rewrite would
 * plausibly break: the embed URL contract, flush-before-teardown ordering,
 * focus restoration, and the no-op path when an item has no video.
 */

/**
 * Internal dependencies
 */
import {
	open,
	close,
	navigate,
	isOpen,
	getState,
	createIframeRenderer,
	CLASSES,
	__resetForTests,
} from './service';

/**
 * A renderer that records the order of lifecycle calls, so tests can assert
 * ordering rather than only end state.
 *
 * @param {string[]} log Shared call log.
 * @return {Object} A renderer.
 */
const trackingRenderer = ( log ) => {
	let media = null;

	return {
		name: 'tracking',
		canLoad: ( item ) => Boolean( item?.videoId ),
		ensure: ( host ) => {
			if ( media && media.isConnected ) {
				return media;
			}
			media = document.createElement( 'div' );
			media.className = host.classes.media;
			media.setAttribute( host.focusableAttr, 'true' );
			media.tabIndex = 0;
			host.dialog.insertBefore( media, host.insertBefore );
			log.push( 'ensure' );
			return media;
		},
		load: ( item ) => log.push( `load:${ item.videoId }` ),
		reset: () => log.push( 'reset' ),
		flush: () => log.push( 'flush' ),
		destroy: () => {
			log.push( 'destroy' );
			if ( media ) {
				media.remove();
				media = null;
			}
		},
	};
};

const dialog = () => document.querySelector( `.${ CLASSES.dialog }` );
const overlay = () => document.querySelector( `.${ CLASSES.overlay }` );
const closeButton = () => document.querySelector( `.${ CLASSES.close }` );
const prevButton = () => document.querySelector( `.${ CLASSES.navPrev }` );
const nextButton = () => document.querySelector( `.${ CLASSES.navNext }` );

const press = ( key, options = {} ) => {
	document.dispatchEvent(
		new KeyboardEvent( 'keydown', { key, bubbles: true, ...options } ),
	);
};

describe( 'lightbox service', () => {
	afterEach( () => {
		__resetForTests();
		delete window.videoAnalyticsParams;
		document.body.innerHTML = '';
	} );

	describe( 'open / close lifecycle', () => {
		it( 'opens on the requested index and marks the modal active', () => {
			const log = [];
			const opened = open( {
				items: [ { videoId: 11 }, { videoId: 22 } ],
				index: 1,
				renderer: trackingRenderer( log ),
			} );

			expect( opened ).toBe( true );
			expect( isOpen() ).toBe( true );
			expect( getState() ).toMatchObject( { open: true, index: 1 } );
			expect( overlay().classList.contains( 'is-active' ) ).toBe( true );
			expect( dialog().classList.contains( 'is-active' ) ).toBe( true );
			expect( document.body.classList.contains( CLASSES.bodyOpen ) ).toBe( true );
			expect( log ).toEqual( [ 'ensure', 'flush', 'load:22' ] );
		} );

		it( 'gives the dialog the accessible attributes a modal needs', () => {
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );

			expect( dialog().getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( dialog().getAttribute( 'aria-modal' ) ).toBe( 'true' );
			expect( dialog().getAttribute( 'aria-label' ) ).toBeTruthy();
			expect( closeButton().getAttribute( 'aria-label' ) ).toBeTruthy();
			expect( prevButton().getAttribute( 'aria-label' ) ).toBeTruthy();
			expect( nextButton().getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'flushes the media before resetting it on close, never after', () => {
			const log = [];
			open( { items: [ { videoId: 5 } ], renderer: trackingRenderer( log ) } );
			log.length = 0;

			close();

			// If these two ever swap, the browser cancels the in-flight
			// analytics POST and the viewer's watch data is lost.
			expect( log ).toEqual( [ 'flush', 'reset' ] );
		} );

		it( 'clears the active state and body class on close', () => {
			open( { items: [ { videoId: 5 } ], renderer: trackingRenderer( [] ) } );
			close();

			expect( isOpen() ).toBe( false );
			expect( getState() ).toMatchObject( { open: false, index: -1 } );
			expect( overlay().classList.contains( 'is-active' ) ).toBe( false );
			expect( dialog().classList.contains( 'is-active' ) ).toBe( false );
			expect( document.body.classList.contains( CLASSES.bodyOpen ) ).toBe( false );
		} );

		it( 'is a no-op with no side effects when the item has no video', () => {
			const log = [];
			const onShow = jest.fn();

			const opened = open( {
				items: [ {} ],
				renderer: trackingRenderer( log ),
				onShow,
			} );

			expect( opened ).toBe( false );
			expect( isOpen() ).toBe( false );
			expect( onShow ).not.toHaveBeenCalled();
			expect( log ).toEqual( [] );
			expect( document.body.classList.contains( CLASSES.bodyOpen ) ).toBe( false );
		} );

		it( 'refuses to open without a renderer', () => {
			expect( open( { items: [ { videoId: 1 } ] } ) ).toBe( false );
			expect( open() ).toBe( false );
			expect( isOpen() ).toBe( false );
		} );

		it( 'closes the previous session when a second caller opens', () => {
			const firstClose = jest.fn();
			open( {
				items: [ { videoId: 1 } ],
				renderer: trackingRenderer( [] ),
				onClose: firstClose,
				owner: 'first',
			} );

			open( {
				items: [ { videoId: 2 } ],
				renderer: trackingRenderer( [] ),
				owner: 'second',
			} );

			expect( firstClose ).toHaveBeenCalledTimes( 1 );
			expect( getState().owner ).toBe( 'second' );
		} );

		it( 'destroys the outgoing renderer when a different one takes over', () => {
			const firstLog = [];
			const first = trackingRenderer( firstLog );
			open( { items: [ { videoId: 1 } ], renderer: first } );

			open( { items: [ { videoId: 2 } ], renderer: trackingRenderer( [] ) } );

			expect( firstLog ).toContain( 'destroy' );
		} );
	} );

	describe( 'focus management', () => {
		it( 'moves focus to close on open and restores it on close', () => {
			const trigger = document.createElement( 'button' );
			document.body.appendChild( trigger );
			trigger.focus();

			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );
			expect( document.activeElement ).toBe( closeButton() );

			close();
			expect( document.activeElement ).toBe( trigger );
		} );

		it( 'keeps the original trigger as the restore target across navigation', () => {
			const trigger = document.createElement( 'button' );
			document.body.appendChild( trigger );
			trigger.focus();

			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: trackingRenderer( [] ),
			} );
			navigate( 1 );
			close();

			expect( document.activeElement ).toBe( trigger );
		} );

		it( 'wraps Tab from the last control back to the media element', () => {
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: trackingRenderer( [] ),
			} );

			const media = dialog().querySelector( `.${ CLASSES.media }` );
			nextButton().focus();
			press( 'Tab' );

			expect( document.activeElement ).toBe( media );
		} );

		it( 'wraps Shift+Tab from the media element to the last control', () => {
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: trackingRenderer( [] ),
			} );

			dialog().querySelector( `.${ CLASSES.media }` ).focus();
			press( 'Tab', { shiftKey: true } );

			expect( document.activeElement ).toBe( nextButton() );
		} );
	} );

	describe( 'navigation', () => {
		it( 'wraps forwards and backwards', () => {
			const log = [];
			open( {
				items: [ { videoId: 1 }, { videoId: 2 }, { videoId: 3 } ],
				renderer: trackingRenderer( log ),
			} );

			navigate( 1 );
			expect( getState().index ).toBe( 1 );

			navigate( -1 );
			navigate( -1 );
			expect( getState().index ).toBe( 2 );
		} );

		it( 'flushes the outgoing video before loading the next one', () => {
			const log = [];
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: trackingRenderer( log ),
			} );
			log.length = 0;

			navigate( 1 );

			expect( log ).toEqual( [ 'flush', 'load:2' ] );
		} );

		it( 'hides the nav controls for a single-item playlist', () => {
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );

			expect( prevButton().classList.contains( 'is-active' ) ).toBe( false );
			expect( nextButton().classList.contains( 'is-active' ) ).toBe( false );
		} );

		it( 'hides the nav controls when navigation is disabled', () => {
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				navigation: false,
				renderer: trackingRenderer( [] ),
			} );

			expect( nextButton().classList.contains( 'is-active' ) ).toBe( false );
		} );

		it( 'does nothing on a single-item playlist', () => {
			const log = [];
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( log ) } );
			log.length = 0;

			navigate( 1 );

			expect( log ).toEqual( [] );
			expect( getState().index ).toBe( 0 );
		} );

		it( 're-reads a function playlist so items added while open are navigable', () => {
			const items = [ { videoId: 1 } ];
			open( { items: () => items, renderer: trackingRenderer( [] ) } );

			// Load-more appends tiles to the list the modal is navigating.
			items.push( { videoId: 2 } );
			navigate( 1 );

			expect( getState().item ).toEqual( { videoId: 2 } );
		} );
	} );

	describe( 'keyboard and pointer dismissal', () => {
		it( 'closes on Escape', () => {
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );
			press( 'Escape' );
			expect( isOpen() ).toBe( false );
		} );

		it( 'navigates on arrow keys', () => {
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: trackingRenderer( [] ),
			} );

			press( 'ArrowRight' );
			expect( getState().index ).toBe( 1 );

			press( 'ArrowLeft' );
			expect( getState().index ).toBe( 0 );
		} );

		it( 'closes on overlay click', () => {
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );
			overlay().click();
			expect( isOpen() ).toBe( false );
		} );

		it( 'ignores keys once closed', () => {
			open( { items: [ { videoId: 1 } ], renderer: trackingRenderer( [] ) } );
			close();

			// Would throw if the handler still assumed a live session.
			expect( () => press( 'Escape' ) ).not.toThrow();
			expect( () => press( 'ArrowRight' ) ).not.toThrow();
		} );
	} );

	describe( 'caller callbacks', () => {
		it( 'calls onShow before the media loads, for open and for navigation', () => {
			const order = [];
			const renderer = trackingRenderer( order );

			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer,
				onShow: ( { index, isNavigate } ) =>
					order.push( `show:${ index }:${ isNavigate }` ),
			} );

			expect( order ).toEqual( [ 'show:0:false', 'ensure', 'flush', 'load:1' ] );

			order.length = 0;
			navigate( 1 );
			expect( order ).toEqual( [ 'show:1:true', 'flush', 'load:2' ] );
		} );

		it( 'calls onClose once, after the modal is torn down', () => {
			const onClose = jest.fn( () => {
				expect( isOpen() ).toBe( false );
				expect( document.body.classList.contains( CLASSES.bodyOpen ) ).toBe( false );
			} );

			open( {
				items: [ { videoId: 1 } ],
				renderer: trackingRenderer( [] ),
				onClose,
				owner: 'gallery',
			} );
			close();
			close();

			expect( onClose ).toHaveBeenCalledTimes( 1 );
			expect( onClose ).toHaveBeenCalledWith( { index: 0, owner: 'gallery' } );
		} );
	} );

	describe( 'class aliases', () => {
		const aliases = {
			overlay: 'legacy-overlay',
			dialog: 'legacy-dialog',
			media: 'legacy-media',
			close: 'legacy-close',
			nav: 'legacy-nav',
			navPrev: 'legacy-prev',
			navNext: 'legacy-next',
			bodyOpen: 'legacy-open',
		};

		it( 'applies the caller aliases alongside the canonical classes', () => {
			open( {
				items: [ { videoId: 1 } ],
				renderer: trackingRenderer( [] ),
				aliases,
			} );

			expect( overlay().classList.contains( 'legacy-overlay' ) ).toBe( true );
			expect( dialog().classList.contains( 'legacy-dialog' ) ).toBe( true );
			expect( closeButton().classList.contains( 'legacy-close' ) ).toBe( true );
			expect( prevButton().classList.contains( 'legacy-nav' ) ).toBe( true );
			expect( prevButton().classList.contains( 'legacy-prev' ) ).toBe( true );
			expect( nextButton().classList.contains( 'legacy-next' ) ).toBe( true );
			expect( document.body.classList.contains( 'legacy-open' ) ).toBe( true );
		} );

		it( 'strips them on close so the next caller starts clean', () => {
			open( {
				items: [ { videoId: 1 } ],
				renderer: trackingRenderer( [] ),
				aliases,
			} );
			close();

			expect( overlay().classList.contains( 'legacy-overlay' ) ).toBe( false );
			expect( dialog().classList.contains( 'legacy-dialog' ) ).toBe( false );
			expect( document.body.classList.contains( 'legacy-open' ) ).toBe( false );
		} );
	} );

	describe( 'iframe renderer', () => {
		it( 'builds the embed URL the gallery has always emitted', () => {
			window.videoAnalyticsParams = { postId: 42 };

			const renderer = createIframeRenderer( {
				embedBaseUrl: 'https://example.test/',
				blockSource: 'video-gallery',
				extraParams: () => ( { godam_gallery: '1', engagements: 'show' } ),
			} );

			open( { items: [ { videoId: 7 } ], renderer } );

			const iframe = dialog().querySelector( 'iframe' );
			expect( iframe.getAttribute( 'src' ) ).toBe(
				'https://example.test/?godam_page=video-embed&id=7&godam_gallery=1&engagements=show&host_post_id=42&block_source=video-gallery',
			);
		} );

		it( 'omits optional params the caller does not supply', () => {
			const renderer = createIframeRenderer( {
				embedBaseUrl: '/',
				blockSource: 'video-block-lightbox',
			} );

			open( { items: [ { videoId: 3 } ], renderer } );

			expect( dialog().querySelector( 'iframe' ).getAttribute( 'src' ) ).toBe(
				'/?godam_page=video-embed&id=3&host_post_id=0&block_source=video-block-lightbox',
			);
		} );

		it( 'lazy-loads, allows fullscreen, and joins the focus trap', () => {
			open( {
				items: [ { videoId: 1 } ],
				renderer: createIframeRenderer( {} ),
			} );

			const iframe = dialog().querySelector( 'iframe' );
			expect( iframe.getAttribute( 'loading' ) ).toBe( 'lazy' );
			expect( iframe.getAttribute( 'allowfullscreen' ) ).toBe( 'allowfullscreen' );
			expect( iframe.getAttribute( 'title' ) ).toBeTruthy();
			expect( iframe.getAttribute( 'data-godam-lightbox-focusable' ) ).toBe( 'true' );
		} );

		it( 'parks the iframe on about:blank when closed', () => {
			open( {
				items: [ { videoId: 1 } ],
				renderer: createIframeRenderer( {} ),
			} );
			close();

			expect( dialog().querySelector( 'iframe' ).getAttribute( 'src' ) ).toBe(
				'about:blank',
			);
		} );

		it( 'reuses one iframe across navigation instead of rebuilding it', () => {
			open( {
				items: [ { videoId: 1 }, { videoId: 2 } ],
				renderer: createIframeRenderer( {} ),
			} );

			const before = dialog().querySelector( 'iframe' );
			navigate( 1 );

			expect( dialog().querySelector( 'iframe' ) ).toBe( before );
			expect( dialog().querySelectorAll( 'iframe' ) ).toHaveLength( 1 );
		} );

		it( 'carries the alias class the caller asks for', () => {
			open( {
				items: [ { videoId: 1 } ],
				renderer: createIframeRenderer( { aliasClass: 'legacy-iframe' } ),
			} );

			const iframe = dialog().querySelector( 'iframe' );
			expect( iframe.classList.contains( CLASSES.media ) ).toBe( true );
			expect( iframe.classList.contains( 'legacy-iframe' ) ).toBe( true );
		} );

		it( 'pulls buffered analytics out of the embed page before teardown', () => {
			const payload = {
				endpoint: 'https://analytics.test',
				body: { videoId: 9 },
			};
			const flushPayloads = jest.fn( () => [ payload ] );
			global.fetch = jest.fn( () => Promise.resolve() );

			const renderer = createIframeRenderer( {} );
			open( { items: [ { videoId: 9 } ], renderer } );

			// Stand in for the same-origin embed page exposing its buffer.
			const iframe = dialog().querySelector( 'iframe' );
			Object.defineProperty( iframe, 'contentWindow', {
				configurable: true,
				value: { godamGalleryFlushPayloads: flushPayloads },
			} );

			close();

			expect( flushPayloads ).toHaveBeenCalledTimes( 1 );
			expect( global.fetch ).toHaveBeenCalledWith(
				'https://analytics.test/analytics/',
				expect.objectContaining( {
					method: 'POST',
					keepalive: true,
					body: JSON.stringify( payload.body ),
				} ),
			);

			delete global.fetch;
		} );

		it( 'stays silent when the embed page exposes no buffer', () => {
			global.fetch = jest.fn();

			const renderer = createIframeRenderer( {} );
			open( { items: [ { videoId: 9 } ], renderer } );

			expect( () => close() ).not.toThrow();
			expect( global.fetch ).not.toHaveBeenCalled();

			delete global.fetch;
		} );
	} );
} );

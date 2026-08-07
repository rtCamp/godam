/**
 * Internal dependencies
 */
import { initLightboxTriggers, prepareTriggers } from './lightboxTriggers';
import { openLightboxForId } from './managers/modalManager';

jest.mock( './managers/modalManager', () => ( {
	openLightboxForId: jest.fn( () => true ),
} ) );

describe( 'lightbox triggers', () => {
	beforeAll( () => {
		// The listeners are delegated from `document` and bound once for the page,
		// so bind them here rather than per test.
		initLightboxTriggers();
	} );

	beforeEach( () => {
		openLightboxForId.mockClear();
	} );

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	/**
	 * Render markup and return the first trigger in it.
	 *
	 * @param {string} html - Markup to render.
	 * @return {HTMLElement} The trigger element.
	 */
	const render = ( html ) => {
		document.body.innerHTML = html;
		prepareTriggers();
		return document.querySelector( '[data-godam-lightbox]' );
	};

	const click = ( element ) =>
		element.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

	it( 'opens the lightbox for the trigger ID', () => {
		click( render( '<button data-godam-lightbox="4595">Watch</button>' ) );

		expect( openLightboxForId ).toHaveBeenCalledTimes( 1 );
		expect( openLightboxForId.mock.calls[ 0 ][ 0 ] ).toBe( '4595' );
	} );

	it( 'passes a start time through', () => {
		click( render( '<button data-godam-lightbox="4595" data-godam-lightbox-t="42">W</button>' ) );

		expect( openLightboxForId.mock.calls[ 0 ][ 1 ] ).toMatchObject( { startTime: 42 } );
	} );

	it( 'ignores an invalid start time rather than seeking to NaN', () => {
		click( render( '<button data-godam-lightbox="4595" data-godam-lightbox-t="soon">W</button>' ) );

		expect( openLightboxForId.mock.calls[ 0 ][ 1 ] ).toMatchObject( { startTime: null } );
	} );

	it( 'prevents an <a> fallback from navigating away', () => {
		const trigger = render( '<a href="/?godam_page=video-embed&id=4595" data-godam-lightbox="4595">W</a>' );
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
		trigger.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
		expect( openLightboxForId ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [
		[ 'Cmd/Ctrl', { metaKey: true } ],
		[ 'Ctrl', { ctrlKey: true } ],
		[ 'Shift', { shiftKey: true } ],
		[ 'Alt', { altKey: true } ],
	] )( 'leaves a %s+click to the browser so the link can open in a new tab', ( _label, modifier ) => {
		const trigger = render( '<a href="/?godam_page=video-embed&id=4595" data-godam-lightbox="4595">W</a>' );
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, ...modifier } );
		trigger.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( false );
		expect( openLightboxForId ).not.toHaveBeenCalled();
	} );

	it( 'leaves a non-primary click alone', () => {
		const trigger = render( '<a href="/x" data-godam-lightbox="4595">W</a>' );
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 2 } );
		trigger.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( false );
		expect( openLightboxForId ).not.toHaveBeenCalled();
	} );

	it( 'still opens on a plain left click', () => {
		const trigger = render( '<a href="/x" data-godam-lightbox="4595">W</a>' );
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 0 } );
		trigger.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
		expect( openLightboxForId ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'works when the click lands on a child of the trigger', () => {
		render( '<button data-godam-lightbox="4595"><span id="label">Watch</span></button>' );
		click( document.getElementById( 'label' ) );

		expect( openLightboxForId ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'ignores clicks outside any trigger', () => {
		render( '<div><button data-godam-lightbox="4595">W</button><a href="/x" id="other">other</a></div>' );
		click( document.getElementById( 'other' ) );

		expect( openLightboxForId ).not.toHaveBeenCalled();
	} );

	it( 'ignores a trigger with no ID', () => {
		click( render( '<button data-godam-lightbox="">W</button>' ) );

		expect( openLightboxForId ).not.toHaveBeenCalled();
	} );

	it( 'uses the trigger text as the iframe title when none is given', () => {
		click( render( '<button data-godam-lightbox="4595">  Watch the demo  </button>' ) );

		expect( openLightboxForId.mock.calls[ 0 ][ 1 ] ).toMatchObject( { title: 'Watch the demo' } );
	} );

	it( 'prefers an explicit title', () => {
		click( render( '<button data-godam-lightbox="4595" data-godam-lightbox-title="Product demo">W</button>' ) );

		expect( openLightboxForId.mock.calls[ 0 ][ 1 ] ).toMatchObject( { title: 'Product demo' } );
	} );

	describe( 'accessibility', () => {
		it( 'makes a non-interactive trigger reachable and operable', () => {
			const trigger = render( '<img src="p.jpg" alt="Watch" data-godam-lightbox="4595" />' );

			expect( trigger.getAttribute( 'role' ) ).toBe( 'button' );
			expect( trigger.getAttribute( 'tabindex' ) ).toBe( '0' );
		} );

		it( 'leaves native elements alone', () => {
			const trigger = render( '<button data-godam-lightbox="4595">W</button>' );

			expect( trigger.hasAttribute( 'role' ) ).toBe( false );
			expect( trigger.hasAttribute( 'tabindex' ) ).toBe( false );
		} );

		it( 'does not override an author-supplied role or tabindex', () => {
			const trigger = render( '<div role="link" tabindex="3" data-godam-lightbox="4595">W</div>' );

			expect( trigger.getAttribute( 'role' ) ).toBe( 'link' );
			expect( trigger.getAttribute( 'tabindex' ) ).toBe( '3' );
		} );

		it.each( [ 'Enter', ' ' ] )( 'activates a non-interactive trigger on %s', ( key ) => {
			const trigger = render( '<div data-godam-lightbox="4595">W</div>' );
			trigger.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true } ) );

			expect( openLightboxForId ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'does not double-open a native button on Enter', () => {
			// A <button> fires its own click for Enter/Space; handling the key too
			// would open the lightbox twice.
			const trigger = render( '<button data-godam-lightbox="4595">W</button>' );
			trigger.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true, cancelable: true } ) );

			expect( openLightboxForId ).not.toHaveBeenCalled();
		} );

		it( 'ignores other keys', () => {
			const trigger = render( '<div data-godam-lightbox="4595">W</div>' );
			trigger.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'a', bubbles: true, cancelable: true } ) );

			expect( openLightboxForId ).not.toHaveBeenCalled();
		} );
	} );

	it( 'binds by delegation, so markup added later needs no re-binding', () => {
		// No prepareTriggers() call here: a delegated listener must catch it anyway.
		document.body.innerHTML = '<div id="host"></div>';
		document.getElementById( 'host' ).innerHTML = '<button data-godam-lightbox="999">Later</button>';

		click( document.querySelector( '[data-godam-lightbox]' ) );

		expect( openLightboxForId.mock.calls[ 0 ][ 0 ] ).toBe( '999' );
	} );
} );

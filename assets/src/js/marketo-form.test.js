/**
 * Tests for the Marketo form layer loader (marketo-form.js).
 *
 * The loader is an IIFE that runs on import, so each test sets up the page and
 * `window.MktoForms2` first, then loads the module in isolation.
 */

/**
 * Put Marketo form layers on the page, as the player template renders them.
 *
 * @param {string[]} formIds Marketo form IDs, one layer each.
 */
function renderLayers( formIds ) {
	document.body.innerHTML = formIds
		.map(
			( formId, i ) =>
				`<div class="marketo-form-container"><form id="godam-mkto-${ i }" data-marketo-form-id="${ formId }"></form></div>`,
		)
		.join( '' );
}

/**
 * Run marketo-form.js against the current page.
 */
function loadScript() {
	jest.isolateModules( () => {
		require( './marketo-form' );
	} );
}

/**
 * The layer's form node, by position: while a form loads, its node carries
 * forms2's `mktoForm_<id>` id instead of its own.
 *
 * @param {number} i Layer index.
 * @return {HTMLElement} The layer's form node.
 */
const formNode = ( i ) => document.querySelectorAll( '[data-marketo-form-id]' )[ i ];

/**
 * @param {number} i Layer index.
 * @return {boolean} Whether the layer shows "This form could not be loaded."
 */
const isUnavailable = ( i ) =>
	!! formNode( i ).parentElement.querySelector( '.godam-marketo-unavailable' );

describe( 'marketo-form.js', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		window.godamMarketoFormData = {
			instanceHost: '//app-sj04.marketo.com',
			munchkinId: '123-ABC-456',
			unavailableText: 'This form could not be loaded.',
		};
	} );

	afterEach( () => {
		jest.useRealTimers();
		delete window.MktoForms2;
		delete window.godamMarketoFormData;
		document.body.innerHTML = '';
	} );

	it( 'renders a form that forms2 fills, without a message', () => {
		renderLayers( [ '1001' ] );
		window.MktoForms2 = {
			loadForm: jest.fn( ( host, munchkin, formId, callback ) => {
				document.getElementById( `mktoForm_${ formId }` ).appendChild( document.createElement( 'input' ) );
				callback( { onSuccess: jest.fn() } );
			} ),
		};

		loadScript();
		jest.advanceTimersByTime( 20000 );

		expect( isUnavailable( 0 ) ).toBe( false );
		expect( formNode( 0 ).style.display ).toBe( '' );
	} );

	it( 'shows the message when forms2 calls back with no form', () => {
		renderLayers( [ '1001' ] );
		window.MktoForms2 = {
			loadForm: jest.fn( ( host, munchkin, formId, callback ) => callback( null ) ),
		};

		loadScript();

		expect( isUnavailable( 0 ) ).toBe( true );
	} );

	it( 'gives up on a form whose callback never fires, and still loads the next one', () => {
		renderLayers( [ '1001', '1002' ] );
		window.MktoForms2 = {
			// The first load never calls back (a blocked request); the second works.
			loadForm: jest.fn( ( host, munchkin, formId, callback ) => {
				if ( formId === 1002 ) {
					document.getElementById( `mktoForm_${ formId }` ).appendChild( document.createElement( 'input' ) );
					callback( { onSuccess: jest.fn() } );
				}
			} ),
		};

		loadScript();
		expect( window.MktoForms2.loadForm ).toHaveBeenCalledTimes( 1 );
		expect( isUnavailable( 0 ) ).toBe( false );

		jest.advanceTimersByTime( 12000 );

		expect( isUnavailable( 0 ) ).toBe( true );
		// The node got its own id back before the next form loaded.
		expect( formNode( 0 ).id ).toBe( 'godam-mkto-0' );
		expect( window.MktoForms2.loadForm ).toHaveBeenCalledTimes( 2 );
		expect( isUnavailable( 1 ) ).toBe( false );
	} );

	it( 'ignores a late callback after giving up', () => {
		renderLayers( [ '1001' ] );
		let lateCallback;
		window.MktoForms2 = {
			loadForm: jest.fn( ( host, munchkin, formId, callback ) => {
				lateCallback = callback;
			} ),
		};

		loadScript();
		jest.advanceTimersByTime( 12000 );
		lateCallback( null );

		expect( formNode( 0 ).parentElement.querySelectorAll( '.godam-marketo-unavailable' ) ).toHaveLength( 1 );
	} );

	it( 'shows the message on every layer when forms2 itself never loads', () => {
		renderLayers( [ '1001', '1002' ] );

		loadScript();
		jest.advanceTimersByTime( 9000 );
		expect( isUnavailable( 0 ) ).toBe( false );

		jest.advanceTimersByTime( 2000 );

		expect( isUnavailable( 0 ) ).toBe( true );
		expect( isUnavailable( 1 ) ).toBe( true );
	} );
} );

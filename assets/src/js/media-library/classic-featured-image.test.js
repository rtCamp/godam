/**
 * Internal dependencies
 */
import {
	setupClassicFeaturedImage,
	resolveClassicFeaturedImage,
	clearDeferredFeaturedImage,
} from './classic-featured-image';

/**
 * Build a `wp.media` double with a frame whose content mode and single selection
 * are controllable, plus a spy standing in for the real `featuredImage.set`.
 *
 * @param {Object}      options                    Options.
 * @param {string}      options.mode               Content mode the frame reports.
 * @param {string|null} options.selectedId         ID of the single selected model, or null.
 * @param {boolean}     options.featuredImageFrame Whether the frame carries a 'featured-image' state, as only wp.media.featuredImage.frame() does.
 * @return {Object} The spy `set` and the frame double.
 */
const mockWpMedia = ( { mode = 'godam', selectedId = 'job-abc', featuredImageFrame = true } = {} ) => {
	const set = jest.fn();

	const frame = {
		content: { mode: () => mode },
		// Only wp.media.featuredImage.frame() carries a 'featured-image' state.
		states: { get: ( id ) => ( featuredImageFrame && 'featured-image' === id ? {} : undefined ) },
		state: () => ( {
			get: () => ( {
				single: () => ( null === selectedId ? undefined : { id: selectedId } ),
			} ),
		} ),
	};

	window.wp = {
		media: {
			frame,
			featuredImage: { set },
		},
	};

	return { set, frame };
};

const PARKED_ID = 'job-abc';

/**
 * Build the classic editor's featured image meta box so the in-flight placeholder has
 * somewhere to render.
 *
 * @param {string} html Markup standing in for the current featured image.
 * @return {HTMLElement} The `.inside` container core itself repaints.
 */
const mockMetaBox = ( html = '<p id="previous">previous image</p>' ) => {
	document.body.innerHTML = `<div id="postimagediv"><div class="inside">${ html }</div></div>`;

	return document.querySelector( '#postimagediv .inside' );
};

describe( 'classic editor featured image deferral', () => {
	afterEach( () => {
		// The parked ID is module state, so a test that parks a pick would otherwise leak
		// it into the next one and make the suite order-dependent.
		clearDeferredFeaturedImage( PARKED_ID );
		document.body.innerHTML = '';
		delete window.wp;
		jest.restoreAllMocks();
	} );

	it( 'parks a GoDAM pick instead of sending it to the meta box', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );

		expect( set ).not.toHaveBeenCalled();
	} );

	it( 'releases the real attachment ID once the attachment exists', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
		expect( set ).toHaveBeenCalledWith( 4321 );
	} );

	it( 'ignores a release for a different GoDAM item', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-other', 4321 );

		expect( set ).not.toHaveBeenCalled();
	} );

	it( 'releases only once, so a repeat call cannot resurrect a stale pick', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 4321 );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'passes a pick made outside the GoDAM tab straight through', () => {
		const { set, frame } = mockWpMedia( { mode: 'browse', selectedId: '77' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 77 );

		expect( set ).toHaveBeenCalledWith( 77 );
	} );

	it( 'lets "Remove featured image" through even while the tab reads as godam', () => {
		// remove() calls set( -1 ), which never matches the selected model. The content
		// mode can still read 'godam' from an earlier session in the same frame.
		const { set, frame } = mockWpMedia( { mode: 'godam', selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( -1 );

		expect( set ).toHaveBeenCalledWith( -1 );
	} );

	it( 'clears a parked pick once a later call goes through unparked', () => {
		const { set, frame } = mockWpMedia( { mode: 'godam', selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );

		frame.content.mode = () => 'browse';
		window.wp.media.featuredImage.set( 88 );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
		expect( set ).toHaveBeenCalledWith( 88 );
	} );

	it( 'wraps set() only once across repeated tab activations', () => {
		const { frame } = mockWpMedia();

		setupClassicFeaturedImage( frame );
		const wrapped = window.wp.media.featuredImage.set;
		setupClassicFeaturedImage( frame );

		expect( window.wp.media.featuredImage.set ).toBe( wrapped );
	} );

	it( 'is a no-op when the classic featured image helper is absent', () => {
		window.wp = { media: {} };

		expect( () => setupClassicFeaturedImage() ).not.toThrow();
		expect( () => resolveClassicFeaturedImage( 'job-abc', 4321 ) ).not.toThrow();
	} );

	it( 'clears a park so a failed creation does not swallow the next pick', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );

		expect( clearDeferredFeaturedImage( 'job-abc' ) ).toBe( true );

		// The failed pick must not land later...
		resolveClassicFeaturedImage( 'job-abc', 4321 );
		expect( set ).not.toHaveBeenCalled();

		// ...and the next pick must still be parkable and releasable.
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 9999 );
		expect( set ).toHaveBeenCalledWith( 9999 );
	} );

	it( 'ignores a clear for an item other than the parked one', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );

		// A slow failure must not release a pick the user made after it.
		expect( clearDeferredFeaturedImage( 'job-stale' ) ).toBe( false );

		resolveClassicFeaturedImage( 'job-abc', 4321 );
		expect( set ).toHaveBeenCalledWith( 4321 );
	} );

	it( 'leaves core alone when the GoDAM tab renders in a non-featured-image frame', () => {
		const { set, frame } = mockWpMedia( { featuredImageFrame: false } );

		setupClassicFeaturedImage( frame );

		// Insert Media and gallery frames must not get a patched core global at all.
		expect( window.wp.media.featuredImage.set ).toBe( set );
		expect( window.wp.media.featuredImage.godamOriginalSet ).toBeUndefined();
	} );

	it( 'shows an in-flight placeholder while a pick is parked', () => {
		const { frame } = mockWpMedia( { selectedId: 'job-abc' } );
		const inside = mockMetaBox();

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );

		expect( inside.querySelector( '.godam-featured-image-pending' ) ).not.toBeNull();
		expect( inside.querySelector( '#previous' ) ).toBeNull();
	} );

	it( 'restores the previous featured image markup when a pick fails to resolve', () => {
		const { frame } = mockWpMedia( { selectedId: 'job-abc' } );
		const inside = mockMetaBox();

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );
		clearDeferredFeaturedImage( 'job-abc' );

		expect( inside.querySelector( '#previous' ) ).not.toBeNull();
		expect( inside.querySelector( '.godam-featured-image-pending' ) ).toBeNull();
	} );

	it( 'leaves the placeholder for core to repaint on a successful release', () => {
		const { set, frame } = mockWpMedia( { selectedId: 'job-abc' } );
		const inside = mockMetaBox();

		setupClassicFeaturedImage( frame );
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		// The real set() is what replaces #postimagediv .inside, so the old markup must not
		// be restored underneath it.
		expect( set ).toHaveBeenCalledWith( 4321 );
		expect( inside.querySelector( '#previous' ) ).toBeNull();
	} );
} );

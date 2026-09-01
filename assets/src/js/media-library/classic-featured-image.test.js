/**
 * Internal dependencies
 */
import {
	setupClassicFeaturedImage,
	resolveClassicFeaturedImage,
} from './classic-featured-image';

/**
 * Build a `wp.media` double with a frame whose content mode and single selection
 * are controllable, plus a spy standing in for the real `featuredImage.set`.
 *
 * @param {Object}      options            Options.
 * @param {string}      options.mode       Content mode the frame reports.
 * @param {string|null} options.selectedId ID of the single selected model, or null.
 * @return {Object} The spy `set` and the frame double.
 */
const mockWpMedia = ( { mode = 'godam', selectedId = 'job-abc' } = {} ) => {
	const set = jest.fn();

	const frame = {
		content: { mode: () => mode },
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

describe( 'classic editor featured image deferral', () => {
	afterEach( () => {
		delete window.wp;
		jest.restoreAllMocks();
	} );

	it( 'parks a GoDAM pick instead of sending it to the meta box', () => {
		const { set } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 'job-abc' );

		expect( set ).not.toHaveBeenCalled();
	} );

	it( 'releases the real attachment ID once the attachment exists', () => {
		const { set } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
		expect( set ).toHaveBeenCalledWith( 4321 );
	} );

	it( 'ignores a release for a different GoDAM item', () => {
		const { set } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-other', 4321 );

		expect( set ).not.toHaveBeenCalled();
	} );

	it( 'releases only once, so a repeat call cannot resurrect a stale pick', () => {
		const { set } = mockWpMedia( { selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 'job-abc' );
		resolveClassicFeaturedImage( 'job-abc', 4321 );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'passes a pick made outside the GoDAM tab straight through', () => {
		const { set } = mockWpMedia( { mode: 'browse', selectedId: '77' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 77 );

		expect( set ).toHaveBeenCalledWith( 77 );
	} );

	it( 'lets "Remove featured image" through even while the tab reads as godam', () => {
		// remove() calls set( -1 ), which never matches the selected model. The content
		// mode can still read 'godam' from an earlier session in the same frame.
		const { set } = mockWpMedia( { mode: 'godam', selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( -1 );

		expect( set ).toHaveBeenCalledWith( -1 );
	} );

	it( 'clears a parked pick once a later call goes through unparked', () => {
		const { set, frame } = mockWpMedia( { mode: 'godam', selectedId: 'job-abc' } );

		setupClassicFeaturedImage();
		window.wp.media.featuredImage.set( 'job-abc' );

		frame.content.mode = () => 'browse';
		window.wp.media.featuredImage.set( 88 );
		resolveClassicFeaturedImage( 'job-abc', 4321 );

		expect( set ).toHaveBeenCalledTimes( 1 );
		expect( set ).toHaveBeenCalledWith( 88 );
	} );

	it( 'wraps set() only once across repeated tab activations', () => {
		mockWpMedia();

		setupClassicFeaturedImage();
		const wrapped = window.wp.media.featuredImage.set;
		setupClassicFeaturedImage();

		expect( window.wp.media.featuredImage.set ).toBe( wrapped );
	} );

	it( 'is a no-op when the classic featured image helper is absent', () => {
		window.wp = { media: {} };

		expect( () => setupClassicFeaturedImage() ).not.toThrow();
		expect( () => resolveClassicFeaturedImage( 'job-abc', 4321 ) ).not.toThrow();
	} );
} );

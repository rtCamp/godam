/**
 * Tests for the standalone layer-analytics runtime that image pages boot
 * (no video player). Guards the two behaviours the image feature relies on:
 * the findVideoElementById image fallback (so a still image resolves its
 * data-block-source at flush) and initLayerAnalytics's idempotent registration
 * plus single flush-listener bind.
 */
/**
 * Internal dependencies
 */
import { initLayerAnalytics, findVideoElementById } from './layer-analytics-runtime';

describe( 'findVideoElementById', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'resolves the video-js element by data-id', () => {
		document.body.innerHTML = '<div class="easydam-player video-js" data-id="7"></div>';
		expect( findVideoElementById( 7 )?.getAttribute( 'data-id' ) ).toBe( '7' );
	} );

	it( 'falls back to the image frame, so an image page can read its data-block-source', () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="31" data-block-source="godam-image"></div>';
		const el = findVideoElementById( 31 );
		expect( el ).not.toBeNull();
		expect( el.dataset.blockSource ).toBe( 'godam-image' );
	} );

	it( 'prefers the video element over an image frame sharing the id', () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="9"></div><div class="video-js" data-id="9"></div>';
		expect( findVideoElementById( 9 )?.classList.contains( 'video-js' ) ).toBe( true );
	} );

	it( 'returns null when neither is present', () => {
		expect( findVideoElementById( 404 ) ).toBeNull();
	} );
} );

describe( 'initLayerAnalytics', () => {
	beforeEach( () => {
		delete window.GoDAM;
		delete window.godamLayerFlushBound;
	} );

	it( 'registers the buffer API when the video bundle has not', () => {
		initLayerAnalytics();
		expect( typeof window.GoDAM.addLayerInteraction ).toBe( 'function' );
		expect( typeof window.GoDAM.flushLayerInteractions ).toBe( 'function' );
	} );

	it( 'does not overwrite an existing addLayerInteraction (video bundle wins)', () => {
		const existing = jest.fn();
		window.GoDAM = { addLayerInteraction: existing };
		initLayerAnalytics();
		expect( window.GoDAM.addLayerInteraction ).toBe( existing );
	} );

	it( 'binds the flush listeners only once across repeated calls', () => {
		const spy = jest.spyOn( window, 'addEventListener' );
		const count = () =>
			spy.mock.calls.filter( ( [ e ] ) => e === 'pagehide' || e === 'beforeunload' ).length;
		initLayerAnalytics();
		expect( count() ).toBe( 2 ); // beforeunload + pagehide
		initLayerAnalytics(); // godamLayerFlushBound already set -> no re-bind
		expect( count() ).toBe( 2 );
		spy.mockRestore();
	} );
} );

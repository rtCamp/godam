/**
 * Unit tests for the grid view's failure tooltip on the transcode status icon.
 */

/**
 * Internal dependencies
 */
import { setFailureText } from './failure';

describe( 'setFailureText', () => {
	let loader;

	beforeEach( () => {
		document.body.innerHTML = '<div class="transcoding-status__loader"></div>';
		loader = document.querySelector( '.transcoding-status__loader' );
	} );

	it( 'puts the reason in the tooltip and marks the icon for the E2E tests', () => {
		setFailureText( loader, 'Your GoDAM storage is full.' );

		expect( loader.style.getPropertyValue( '--status-text' ) ).toBe( '"Your GoDAM storage is full."' );
		expect( loader.getAttribute( 'aria-label' ) ).toBe( 'Your GoDAM storage is full.' );
		expect( loader.getAttribute( 'data-test-id' ) ).toBe( 'godam-transcode-failure-tooltip' );
	} );

	it( 'clears the reason and the test ID when there is none', () => {
		setFailureText( loader, 'Your GoDAM storage is full.' );
		setFailureText( loader, '' );

		expect( loader.style.getPropertyValue( '--status-text' ) ).toBe( '' );
		expect( loader.hasAttribute( 'aria-label' ) ).toBe( false );
		expect( loader.hasAttribute( 'data-test-id' ) ).toBe( false );
	} );

	it( 'does nothing without an icon', () => {
		expect( () => setFailureText( null, 'x' ) ).not.toThrow();
	} );
} );

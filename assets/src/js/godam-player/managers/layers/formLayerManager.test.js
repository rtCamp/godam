/**
 * Internal dependencies
 */
import FormLayerManager from './formLayerManager';

/**
 * Minimal player stub — emitLayerEvent only needs a videoKey off the element.
 *
 * @param {string} id data-id attribute value.
 * @return {Object} Fake VideoJS player.
 */
const fakePlayer = ( id = 'vid-1' ) => ( {
	el: () => ( {
		getAttribute: ( attr ) => ( attr === 'data-id' ? id : null ),
		dataset: { id },
	} ),
	currentTime: () => 5,
	isFullscreen: () => false,
} );

/**
 * A Marketo form layer as the player template renders it.
 *
 * @return {HTMLElement} Layer element, attached to the document.
 */
const marketoLayerElement = () => {
	const layerElement = document.createElement( 'div' );
	layerElement.innerHTML = '<div class="form-container marketo-form-container"><form></form></div>';
	document.body.appendChild( layerElement );
	return layerElement;
};

/**
 * Add a message after the layer's form, like marketo-form.js does.
 *
 * @param {HTMLElement} layerElement Layer element.
 * @param {string}      className    Message class.
 */
const addMessage = ( layerElement, className ) => {
	const message = document.createElement( 'p' );
	message.className = className;
	layerElement.querySelector( 'form' ).after( message );
};

// MutationObserver callbacks run as microtasks.
const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

describe( 'FormLayerManager with a Marketo layer', () => {
	let manager, events, layerElement;

	beforeEach( () => {
		events = [];
		window.GoDAM = {
			addLayerInteraction: ( key, event ) => events.push( event ),
			getTabHiddenAccumulatedMs: () => 0,
			getDeviceType: () => 'desktop',
			wasFirstViewForVideo: () => true,
		};
		manager = new FormLayerManager( fakePlayer(), true, 'inst-1' );
		layerElement = marketoLayerElement();
		manager.setupFormLayer(
			{ id: 'l1', type: 'form', form_type: 'marketo', displayTime: 3, allow_skip: false },
			layerElement,
		);
	} );

	afterEach( () => {
		layerElement.remove();
	} );

	it( 'keeps the skip button hidden while the form is showing', () => {
		expect( layerElement.querySelector( '.skip-button' ).classList.contains( 'hidden' ) ).toBe( true );
	} );

	it( 'shows Continue and records a submission after a submit', async () => {
		addMessage( layerElement, 'godam-marketo-success' );
		await flush();

		const skipButton = layerElement.querySelector( '.skip-button' );
		expect( skipButton.classList.contains( 'hidden' ) ).toBe( false );
		expect( skipButton.textContent ).toBe( 'Continue' );
		expect( events.map( ( e ) => e.action_type ) ).toEqual( [ 'submitted' ] );
	} );

	it( 'shows Continue but records nothing when the form could not load', async () => {
		addMessage( layerElement, 'godam-marketo-unavailable' );
		await flush();

		const skipButton = layerElement.querySelector( '.skip-button' );
		expect( skipButton.classList.contains( 'hidden' ) ).toBe( false );
		expect( skipButton.textContent ).toBe( 'Continue' );
		expect( events ).toEqual( [] );
	} );
} );

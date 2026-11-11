/**
 * Layer API (#2294): the front-end runtimes of the core layer types, and the
 * form providers as variations of the Form runtime.
 */

/**
 * Internal dependencies
 */
import { registerCoreLayerRuntimes } from '../../../tests/js/register-core-layer-views.js';
import { hotspotLayerUsesIconFont } from './hotspot/view.js';
import { createLayerHost } from '../js/godam-layers/runtime/host.js';
import { getOverlayController } from '../js/godam-player/layers/overlay.js';
import {
	getLayerRuntime,
	getLayerRuntimeVariation,
	registerLayerRuntimeVariation,
	shouldMountLayer,
	whenLayerRuntime,
} from '../js/godam-layers/runtime/registry.js';
import { registerFormRuntime } from './form/view.js';
import { getLayerDisplayName } from '../js/godam-player/utils/layerActions.js';

const fakePlayer = () => ( {
	el: () => ( { getAttribute: ( attr ) => ( attr === 'data-id' ? 'vid-1' : null ) } ),
	currentTime: () => 5,
	isFullscreen: () => false,
	controls: jest.fn(),
	pause: jest.fn(),
	play: jest.fn(),
} );

// MutationObserver callbacks run as microtasks.
const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

const element = ( html = '' ) => {
	const el = document.createElement( 'div' );
	el.innerHTML = html;
	document.body.appendChild( el );
	return el;
};

describe( 'Layer API: core layer runtimes', () => {
	let events, host;

	const mountLayer = ( layer, html ) => {
		const el = element( html );
		host.mount( layer, el );
		return el;
	};
	const skipButton = ( el ) => el.querySelector( '.skip-button' );

	beforeEach( () => {
		delete window.godam;
		registerCoreLayerRuntimes();
		events = [];
		window.GoDAM = {
			addLayerInteraction: ( key, event ) => events.push( event ),
			getTabHiddenAccumulatedMs: () => 0,
		};
		host = createLayerHost( { player: fakePlayer(), media: { type: 'video' }, instanceId: 'p1', isDisplayingLayers: {} } );
		// The player's LayersManager creates the shared overlay controller.
		getOverlayController( host );
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		delete window.GoDAM;
		delete window.wpforms;
	} );

	it( 'registers CTA, Form, Poll and Hotspot, and is safe to call twice', () => {
		const error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		registerCoreLayerRuntimes();
		expect( error ).not.toHaveBeenCalled();
		expect( [ 'cta', 'form', 'poll', 'hotspot' ].map( ( name ) => getLayerRuntime( name )?.name ) ).toEqual( [ 'cta', 'form', 'poll', 'hotspot' ] );
		expect( getLayerRuntime( 'hotspot' ).supports.media ).toEqual( [ 'video', 'image' ] );
		expect( getLayerRuntime( 'cta' ).supports.media ).toEqual( [ 'video' ] );
		error.mockRestore();
	} );

	describe( 'form providers', () => {
		it( 'registers the 12 form plugins as Form variations, in the editor\'s order', () => {
			expect( getLayerRuntime( 'form' ).variations.map( ( { name } ) => name ) ).toEqual( [
				'gravity', 'wpforms', 'cf7', 'jetpack', 'sureforms', 'forminator',
				'fluentforms', 'everestforms', 'ninjaforms', 'metform', 'marketo', 'hubspot',
			] );
		} );

		it.each( [
			[ 'gravity', '<div class="gform_confirmation_message">Thanks</div>' ],
			[ 'wpforms', '<div class="wpforms-confirmation-container-full">Thanks</div>' ],
			[ 'cf7', '<form class="wpcf7-form sent"></form>' ],
			[ 'jetpack', '<div class="contact-form-success">Thanks</div>' ],
			[ 'sureforms', '<div class="srfm-success-box srfm-active">Thanks</div>' ],
			[ 'forminator', '<div class="forminator-success forminator-show">Thanks</div>' ],
			[ 'fluentforms', '<div class="ff-message-success">Thanks</div>' ],
			[ 'everestforms', '<div class="everest-forms-notice--success">Thanks</div>' ],
			[ 'ninjaforms', '<div class="nf-response-msg">Thanks</div>' ],
			[ 'metform', '<div class="mf-response-msg"><p>Thanks</p></div>' ],
			[ 'marketo', '<p class="godam-marketo-success">Thanks</p>' ],
			[ 'hubspot', '<div class="godam-hubspot-submitted"></div>' ],
		] )( '%s recognises its own confirmation, and only that', ( name, confirmation ) => {
			const provider = getLayerRuntimeVariation( 'form', { form_type: name } );
			expect( provider.isSubmitted( element( confirmation ) ) ).toBe( true );
			expect( provider.isSubmitted( element( '<form></form>' ) ) ).toBe( false );

			const others = getLayerRuntime( 'form' ).variations.filter( ( other ) => other.name !== name );
			const confirmed = element( confirmation );
			others.forEach( ( other ) => expect( [ other.name, other.isSubmitted( confirmed ) ] ).toEqual( [ other.name, false ] ) );
		} );

		it( 'treats an empty Ninja Forms or MetForm response as not sent', () => {
			expect( getLayerRuntimeVariation( 'form', { form_type: 'ninjaforms' } ).isSubmitted( element( '<div class="nf-response-msg"></div>' ) ) ).toBe( false );
			expect( getLayerRuntimeVariation( 'form', { form_type: 'metform' } ).isSubmitted( element( '<div class="mf-response-msg"><p></p></div>' ) ) ).toBe( false );
		} );

		it( 'records a submission with the provider\'s label once the confirmation shows', async () => {
			const el = mountLayer( { id: 'f1', type: 'form', form_type: 'gravity', displayTime: 3 }, '<form></form>' );
			expect( skipButton( el ).textContent ).toBe( 'Skip Form' );

			el.insertAdjacentHTML( 'beforeend', '<div class="gform_confirmation_message">Thanks</div>' );
			await flush();

			expect( skipButton( el ).textContent ).toBe( 'Continue' );
			expect( events ).toHaveLength( 1 );
			expect( events[ 0 ] ).toMatchObject( {
				action_type: 'submitted',
				layer_name: 'Gravity Forms layer at 3.00s',
				layer_metadata: { form_type: 'gravity' },
			} );
		} );

		it( 'runs a form from an add-on provider end to end', async () => {
			registerLayerRuntimeVariation( 'form', {
				name: 'acme',
				title: 'Acme Forms',
				isAvailable: ( dependencies ) => Boolean( dependencies?.acme ),
				isSubmitted: ( el ) => Boolean( el.querySelector( '.acme-done' ) ),
			} );
			const layer = { id: 'f1', type: 'form', form_type: 'acme', displayTime: 1 };
			expect( shouldMountLayer( getLayerRuntime( 'form' ), layer, { acme: true } ) ).toBe( true );

			const el = mountLayer( layer, '<form></form>' );
			el.insertAdjacentHTML( 'beforeend', '<p class="acme-done"></p>' );
			await flush();

			expect( events.map( ( { action_type: action, layer_name: name } ) => [ action, name ] ) ).toEqual( [ [ 'submitted', 'Acme Forms layer at 1.00s' ] ] );
			expect( getLayerDisplayName( layer, 'form' ) ).toBe( 'Acme Forms layer at 1.00s' );
		} );

		it( 'stops WPForms scrolling the page when a WPForms layer mounts', () => {
			window.wpforms = { scrollToError: 'scroll', animateScrollTop: 'scroll' };
			mountLayer( { id: 'f1', type: 'form', form_type: 'wpforms' } );
			expect( typeof window.wpforms.scrollToError ).toBe( 'function' );
			expect( typeof window.wpforms.animateScrollTop ).toBe( 'function' );
		} );
	} );

	describe( 'poll', () => {
		it( 'records a vote when the voting form turns into the results', async () => {
			const el = mountLayer( { id: 'p1', type: 'poll' }, '<form class="wp-polls-form"></form>' );
			expect( skipButton( el ).textContent ).toBe( 'Skip Poll' );

			el.innerHTML = '<ul class="wp-polls-ans"></ul>';
			await flush();

			expect( events.map( ( { action_type: action } ) => action ) ).toEqual( [ 'voted' ] );
		} );

		it( 'counts no vote for a viewer who already voted, whose results show straight away', async () => {
			const el = mountLayer( { id: 'p1', type: 'poll' }, '<ul class="wp-polls-ans"></ul>' );
			el.querySelector( 'ul' ).classList.add( 'loaded' );
			await flush();

			expect( skipButton( el ).textContent ).toBe( 'Continue' );
			expect( events ).toEqual( [] );
		} );
	} );

	describe( 'cta', () => {
		it( 'records a click on a link inside the layer', () => {
			const el = mountLayer( { id: 'c1', type: 'cta' }, '<a href="https://example.com">Go</a>' );
			el.querySelector( 'a' ).dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
			expect( events[ 0 ] ).toMatchObject( { action_type: 'clicked', layer_metadata: { click_target_url: 'https://example.com', form_type: '' } } );
		} );

		it( 'reads "Done" on an end-of-video CTA and never turns into "Continue"', async () => {
			const el = mountLayer( { id: 'c1', type: 'cta', trigger: 'end_of_video' }, '' );
			el.insertAdjacentHTML( 'beforeend', '<div class="gform_confirmation_message"></div>' );
			await flush();
			expect( skipButton( el ).textContent ).toBe( 'Done' );
		} );
	} );

	it( 'asks for FontAwesome only for a hotspot layer that draws an icon', () => {
		expect( hotspotLayerUsesIconFont( { hotspots: [ { icon: 'star' } ] } ) ).toBe( true );
		expect( hotspotLayerUsesIconFont( { hotspots: [ {} ] } ) ).toBe( false );
		expect( hotspotLayerUsesIconFont( {} ) ).toBe( false );
	} );
} );

describe( 'Layer API: the Form view script loading after the player', () => {
	afterEach( () => {
		delete window.godam;
		delete window.godamPluginDependencies;
	} );

	it( 'has the core providers in place when layers waiting for the Form runtime mount', () => {
		delete window.godam;
		window.godamPluginDependencies = { gravityforms: true, wpforms: true };
		const accepted = [];
		[ 'gravity', 'wpforms' ].forEach( ( formType ) => {
			whenLayerRuntime( 'form', ( runtime ) => accepted.push( shouldMountLayer( runtime, { type: 'form', form_type: formType } ) ) );
		} );

		registerFormRuntime();

		expect( accepted ).toEqual( [ true, true ] );
	} );
} );

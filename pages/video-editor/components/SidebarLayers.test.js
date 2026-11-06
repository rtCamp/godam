/**
 * Layer API contract tests (#2291): the "Add layer" menu and the layer list.
 *
 * These pin down what the editor does today, so the Layer API refactor (#2292)
 * can move core layer types onto a registry and prove nothing changed. They
 * cover the exact data each core layer type starts with when it is added; the
 * add-on path (`godamVideoEditorConfig.layerOptions` adds a menu entry and
 * `window.godamLayerCreators[ type ]` supplies the new layer's data); media-type
 * gating (video needs a playhead position, images allow only some types); and
 * saved layers whose type has no registration.
 *
 * Since #2292 the editor reads layer types from the layer registry, so these
 * tests register the core types and the add-on types from the old hooks the
 * same way the editor's entry point does. Tests marked "current behaviour" pin
 * something a later Layer API PR intends to change on purpose; update them in
 * the PR that changes the behaviour.
 */

/**
 * Internal dependencies
 */
import '../../../tests/js/mock-form-provider-panels';

/**
 * Internal dependencies
 */
import '../../../tests/js/layer-contract-globals';

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { registerLayerVariation, unregisterLayerVariation } from '@godam/layers';

/**
 * Internal dependencies
 */
import SidebarLayers, { getDefaultLayerName } from './SidebarLayers';
import { registerEditorLayerTypes } from '../layers';

// The real slice reads page globals at import time; only the action shapes matter here.
jest.mock( '../redux/slice/videoSlice', () => ( {
	addLayer: ( payload ) => ( { type: 'addLayer', payload } ),
	removeLayer: ( payload ) => ( { type: 'removeLayer', payload } ),
	setCurrentLayer: ( payload ) => ( { type: 'setCurrentLayer', payload } ),
	setAddLayerModalTime: ( payload ) => ( { type: 'setAddLayerModalTime', payload } ),
} ) );

jest.mock( '../onboarding/productGuide', () => ( { notify: jest.fn() } ) );

jest.mock( 'uuid', () => ( { v4: () => 'test-uuid' } ) );

// The core settings panels aren't rendered here; registering them is enough.
jest.mock( './layers/CTALayer', () => () => null );
jest.mock( './layers/HotspotLayer', () => () => null );
jest.mock( './layers/FormLayer', () => () => null );
jest.mock( './layers/PollLayer', () => () => null );
jest.mock( './layers/AdsLayer', () => () => null );
jest.mock( '../utils/formUtils', () => ( { getFormIdFromLayer: () => null } ) );

// Plain stand-ins for the menu primitives, so menu items are ordinary buttons
// and the dropdown content is always rendered.
jest.mock( '@wordpress/components', () => {
	const { createElement: h, Fragment } = require( 'react' );
	const passthrough = ( { children } ) => h( Fragment, null, children );
	const button = ( { children, onClick, disabled, id, 'data-test-id': testId } ) =>
		h( 'button', { type: 'button', id, onClick, disabled, 'data-test-id': testId }, children );
	return {
		Button: button,
		MenuItem: button,
		Icon: () => null,
		Tooltip: passthrough,
		MenuGroup: passthrough,
		NavigableMenu: passthrough,
		Popover: passthrough,
		DropdownMenu: () => null,
		Dropdown: ( { renderToggle, renderContent } ) =>
			h( Fragment, null, renderToggle( { isOpen: true, onToggle: () => {} } ), renderContent( { onClose: () => {} } ) ),
	};
} );

registerEditorLayerTypes();

const baseState = {
	loading: false,
	addLayerModalTime: null,
	layers: [],
	currentLayer: null,
	videoConfig: {},
	mediaType: 'video',
};

const makeStore = ( state = {} ) =>
	configureStore( {
		reducer: {
			videoReducer: ( current = { ...baseState, ...state }, action ) => {
				if ( action.type === 'addLayer' ) {
					return { ...current, layers: [ ...current.layers, action.payload ] };
				}
				return current;
			},
		},
		middleware: ( getDefault ) => getDefault( { serializableCheck: false } ),
	} );

describe( 'Layer API contract: SidebarLayers', () => {
	let container, root, store;

	const render = ( { state, currentTime = 12 } = {} ) => {
		store = makeStore( state );
		act( () => {
			root.render(
				<Provider store={ store }>
					<SidebarLayers currentTime={ currentTime } onSelectLayer={ () => {} } onPauseVideo={ () => {} } duration={ 120 } />
				</Provider>,
			);
		} );
	};

	const control = ( key ) => container.querySelector( `[data-test-id="godam-video-editor-control-add-${ key }"]` );
	const click = ( el ) => act( () => el.click() );
	const addedLayers = () => store.getState().videoReducer.layers;
	const menuKeys = () =>
		[ ...container.querySelectorAll( '[data-test-id^="godam-video-editor-control-add-"]' ) ]
			.map( ( el ) => el.dataset.testId.replace( 'godam-video-editor-control-add-', '' ) );

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		window.godamLayerCreators = undefined;
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	describe( 'core layer defaults', () => {
		it( 'adds a CTA layer with these fields', () => {
			render();
			click( control( 'cta' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'cta',
				name: 'CTA Layer',
				cta_type: 'image',
				cardLayout: 'card-layout--imagecover-text',
				trigger: 'timestamp',
				watchDepth: 50,
				html: '',
				link: '',
				allow_skip: true,
			} ] );
		} );

		it( 'adds a Hotspot layer with these fields', () => {
			render();
			click( control( 'hotspot' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'hotspot',
				name: 'Hotspot Layer',
				duration: 5,
				pauseOnHover: false,
				hotspots: [],
				styleType: 'pulse',
				icon: '',
				customIconUrl: null,
				customIconId: null,
				isNew: true,
			} ] );
		} );

		it( 'adds a Form layer for the chosen form plugin', () => {
			render();
			// Two form plugins are active, so "Form" opens a submenu.
			click( control( 'form' ) );
			click( control( 'form-wpforms' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'form',
				name: 'WPForms Layer',
				form_type: 'wpforms',
				submitted: false,
				allow_skip: true,
				custom_css: '',
				theme: '',
			} ] );
		} );

		it( 'adds a Poll layer with these fields', () => {
			render();
			click( control( 'poll' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'poll',
				name: 'Poll Layer',
				poll_id: '',
				allow_skip: true,
				custom_css: '',
			} ] );
		} );

		it( 'adds an Ad layer with these fields', () => {
			render();
			click( control( 'ad' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'ad',
				name: 'Ad Layer',
				adTagUrl: '',
				ad_url: '',
				skippable: false,
				skip_offset: 5,
			} ] );
		} );

		it( 'adds at the time requested from the timeline, not the playhead', () => {
			render( { state: { addLayerModalTime: 30 } } );
			click( control( 'cta' ) );
			expect( addedLayers()[ 0 ].displayTime ).toBe( 30 );
		} );

		it( 'disables the Ad entry when an ad server is configured', () => {
			render( { state: { videoConfig: { adServer: 'ad-server' } } } );
			expect( control( 'ad' ).disabled ).toBe( true );
		} );
	} );

	describe( 'add-on layer types', () => {
		it( 'lists add-on types from layerOptions after the core types', () => {
			render();
			expect( menuKeys() ).toEqual( [
				'cta', 'hotspot', 'form', 'poll', 'ad',
				'acme', 'woo', 'acme-inactive', 'acme-no-creator',
			] );
		} );

		it( 'asks the add-on creator for the new layer and seeds a default name', () => {
			const creator = jest.fn( ( { currentTime } ) => ( { type: 'acme', displayTime: currentTime, color: 'red' } ) );
			window.godamLayerCreators = { acme: creator };
			render();

			click( control( 'acme' ) );

			expect( creator ).toHaveBeenCalledWith( { layers: [], currentTime: 12, type: 'acme' } );
			expect( addedLayers() ).toEqual( [ {
				name: 'Acme Layer',
				type: 'acme',
				displayTime: 12,
				color: 'red',
				id: 'test-uuid',
			} ] );
			expect( console ).toHaveWarnedWith( 'GoDAM: window.godamLayerCreators is deprecated since version 2.7.0 and will be removed in version 2.9.0. Use the `create` setting of registerLayerType() instead.' );
		} );

		it( 'lets the creator override the name but never the id', () => {
			window.godamLayerCreators = {
				acme: () => ( { type: 'acme', displayTime: 12, name: 'Custom name', id: 'creator-id' } ),
			};
			render();
			click( control( 'acme' ) );
			expect( addedLayers()[ 0 ] ).toMatchObject( { name: 'Custom name', id: 'test-uuid' } );
		} );

		it( 'adds nothing when the creator returns nothing', () => {
			window.godamLayerCreators = { acme: () => null };
			render();
			click( control( 'acme' ) );
			expect( addedLayers() ).toEqual( [] );
		} );

		// Current behaviour: an option without a creator is clickable but does nothing.
		it( 'adds nothing when an add-on option has no creator', () => {
			render();
			click( control( 'acme-no-creator' ) );
			expect( addedLayers() ).toEqual( [] );
		} );

		it( 'disables an add-on entry that reports isActive: false', () => {
			render();
			expect( control( 'acme-inactive' ).disabled ).toBe( true );
		} );
	} );

	describe( 'add-on form providers', () => {
		beforeAll( () => {
			registerLayerVariation( 'form', { name: 'acme-forms', title: 'Acme Forms', isAvailable: () => true } );
		} );

		afterAll( () => unregisterLayerVariation( 'form', 'acme-forms' ) );

		it( 'lists a provider registered through the Layer API in the Form submenu', () => {
			render();
			click( control( 'form' ) );
			click( control( 'form-acme-forms' ) );
			expect( addedLayers() ).toEqual( [ {
				id: 'test-uuid',
				displayTime: 12,
				type: 'form',
				name: 'Acme Forms Layer',
				form_type: 'acme-forms',
				submitted: false,
				allow_skip: true,
				custom_css: '',
				theme: '',
			} ] );
		} );

		it( 'leaves out a provider whose plugin is unavailable', () => {
			registerLayerVariation( 'form', { name: 'acme-off', title: 'Acme Off', isAvailable: () => false } );
			render();
			click( control( 'form' ) );
			expect( control( 'form-acme-off' ) ).toBeNull();
			// The menu is still mounted and re-renders when the registry changes.
			act( () => {
				unregisterLayerVariation( 'form', 'acme-off' );
			} );
		} );
	} );

	describe( 'media-type gating', () => {
		it( 'disables "Add layer" on video until the playhead has moved', () => {
			render( { currentTime: 0 } );
			expect( container.querySelector( '#add-layer-btn' ).disabled ).toBe( true );
		} );

		it( 'disables "Add layer" on video when a layer already sits at the playhead', () => {
			render( { state: { layers: [ { id: 'a', type: 'cta', displayTime: 12 } ] } } );
			expect( container.querySelector( '#add-layer-btn' ).disabled ).toBe( true );
		} );

		// Current behaviour: the Woo add-on supports images because the old-hooks
		// bridge says so (layers/legacy.js); #2296 moves that into the add-on.
		it( 'offers only the types that support images, with no playhead needed', () => {
			render( { currentTime: 0, state: { mediaType: 'image' } } );
			expect( container.querySelector( '#add-layer-btn' ).disabled ).toBe( false );
			expect( menuKeys() ).toEqual( [ 'hotspot', 'woo' ] );
		} );
	} );

	describe( 'saved layers', () => {
		// RFC D2: a layer whose type nothing registers stays listed with a
		// warning, and stays in the editor state, so saving does not drop it.
		it( 'lists a layer of an unregistered type with a warning and keeps it in state', () => {
			const ghost = { id: 'ghost', type: 'ghost', displayTime: 3 };
			render( { state: { layers: [ ghost ] } } );
			const rows = container.querySelectorAll( '.godam-ve-layer-row' );
			expect( rows ).toHaveLength( 1 );
			expect( rows[ 0 ].classList.contains( 'has-warning' ) ).toBe( true );
			expect( rows[ 0 ].querySelector( 'button' ).disabled ).toBe( false );
			expect( container.textContent ).toContain( 'Layers (1)' );
			expect( addedLayers() ).toEqual( [ ghost ] );
		} );

		it( 'hides a layer whose registered type does not support this media', () => {
			render( { state: { mediaType: 'image', layers: [ { id: 'c1', type: 'cta', displayTime: 0 } ] } } );
			expect( container.querySelectorAll( '.godam-ve-layer-row' ) ).toHaveLength( 0 );
		} );

		it( 'lists a layer of a registered add-on type', () => {
			render( { state: { layers: [ { id: 'a1', type: 'acme', displayTime: 3, name: 'Acme Layer' } ] } } );
			expect( container.querySelectorAll( '.godam-ve-layer-row' ) ).toHaveLength( 1 );
		} );
	} );
} );

describe( 'Layer API contract: getDefaultLayerName', () => {
	it.each( [
		[ 'cta', undefined, 'CTA Layer' ],
		[ 'hotspot', undefined, 'Hotspot Layer' ],
		[ 'poll', undefined, 'Poll Layer' ],
		[ 'ad', undefined, 'Ad Layer' ],
		[ 'form', undefined, 'Gravity Forms Layer' ],
		[ 'form', 'hubspot', 'HubSpot Layer' ],
		[ 'acme', undefined, 'Acme Layer' ],
		[ 'ghost', undefined, '' ],
	] )( '%s / %s → "%s"', ( type, formType, expected ) => {
		expect( getDefaultLayerName( type, formType ) ).toBe( expected );
	} );
} );

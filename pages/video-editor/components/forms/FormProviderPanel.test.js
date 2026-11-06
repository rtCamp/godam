/**
 * Layer API (#2293): the shared panel for a form provider without its own.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import FormProviderPanel from './FormProviderPanel';

// Capture what the shared form controls are given; their own behaviour is covered elsewhere.
jest.mock( './FormFields', () => jest.fn( () => null ) );
jest.mock( './FormPreview', () => jest.fn( () => null ) );
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );
jest.mock( '../../utils/formUtils', () => ( {
	...jest.requireActual( '../../utils/formUtils' ),
	buildSettingsUrl: ( formType, formId ) => `settings:${ formType }:${ formId }`,
} ) );

const FormFields = require( './FormFields' );
const FormPreview = require( './FormPreview' );

describe( 'Layer API: FormProviderPanel', () => {
	let container, root, dispatched;

	const lastProps = ( mock ) => mock.mock.calls.at( -1 )[ 0 ];
	const flush = () => act( async () => {
		await Promise.resolve();
		await Promise.resolve();
	} );

	const render = async ( layer, provider ) => {
		const store = configureStore( {
			reducer: {
				videoReducer: ( state = { layers: [ layer ] }, action ) => {
					dispatched.push( action );
					return state;
				},
			},
		} );
		act( () => {
			root.render(
				<Provider store={ store }>
					<FormProviderPanel layerID={ layer.id } provider={ provider } />
				</Provider>,
			);
		} );
		await flush();
	};

	const provider = ( overrides = {} ) => ( {
		name: `acme-forms-${ Math.random() }`,
		title: 'Acme Forms',
		idField: 'acme_form_id',
		isAvailable: () => true,
		settingsUrl: 'admin.php?page=acme&form={formId}',
		getForms: jest.fn( async () => [ { id: 'f1', title: 'Contact' }, { id: 'f2', title: 'Newsletter' } ] ),
		getFormHtml: jest.fn( async ( id ) => `<form data-id="${ id }"></form>` ),
		...overrides,
	} );

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		root = createRoot( container );
		dispatched = [];
		FormFields.mockClear();
		FormPreview.mockClear();
	} );

	afterEach( () => act( () => root.unmount() ) );

	it( 'fills the form picker from getForms()', async () => {
		const acme = provider();
		await render( { id: 'l1', type: 'form', form_type: acme.name }, acme );

		expect( acme.getForms ).toHaveBeenCalledTimes( 1 );
		expect( lastProps( FormFields ) ).toMatchObject( {
			isActive: true,
			pluginLabel: 'Acme Forms',
			forms: [ { value: 'f1', label: 'Contact' }, { value: 'f2', label: 'Newsletter' } ],
		} );
	} );

	it( 'stores the chosen form under the provider\'s idField', async () => {
		const acme = provider();
		await render( { id: 'l1', type: 'form', form_type: acme.name }, acme );

		act( () => lastProps( FormFields ).onSelectForm( 'f2' ) );

		expect( dispatched ).toContainEqual( { type: 'updateLayerField', payload: { id: 'l1', field: 'acme_form_id', value: 'f2' } } );
	} );

	it( 'previews the chosen form from getFormHtml() and links to its settings', async () => {
		const acme = provider();
		await render( { id: 'l1', type: 'form', form_type: acme.name, acme_form_id: 'f1', allow_skip: true }, acme );

		expect( acme.getFormHtml ).toHaveBeenCalledWith( 'f1' );
		expect( lastProps( FormPreview ) ).toMatchObject( { html: '<form data-id="f1"></form>', isFetching: false, allowSkip: true } );
		expect( lastProps( FormFields ) ).toMatchObject( {
			formID: 'f1',
			editUrl: `settings:${ acme.name }:f1`,
			showEditButton: true,
		} );
	} );

	it( 'shows an error when the form can\'t be loaded', async () => {
		const acme = provider( { getFormHtml: jest.fn( async () => {
			throw new Error( 'nope' );
		} ) } );
		await render( { id: 'l1', type: 'form', form_type: acme.name, acme_form_id: 'f1' }, acme );

		expect( lastProps( FormPreview ) ).toMatchObject( { html: '', error: 'The form could not be loaded.' } );
	} );

	it( 'does not fetch forms while the provider is unavailable', async () => {
		const acme = provider( { isAvailable: () => false } );
		await render( { id: 'l1', type: 'form', form_type: acme.name }, acme );

		expect( acme.getForms ).not.toHaveBeenCalled();
		expect( lastProps( FormFields ) ).toMatchObject( { isActive: false, forms: [] } );
	} );
} );

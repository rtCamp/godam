/**
 * Layer API (#2293): form providers are Form layer variations.
 */

/**
 * Internal dependencies
 */
import '../../../../tests/js/mock-form-provider-panels';

/**
 * External dependencies
 */
import { getLayerType, getLayerVariationByName, getDefaultAttributes, getLayerVariation, registerLayerVariation } from '@godam/layers';

/**
 * Internal dependencies
 */
import { registerEditorLayerTypes } from '../../../../pages/video-editor/layers/index';
import { getFormIdFromLayer, buildSettingsUrl } from '../../../../pages/video-editor/utils/formUtils';

jest.mock( '../cta/edit', () => () => null );
jest.mock( '../hotspot/edit', () => () => null );
jest.mock( './edit', () => () => null );
jest.mock( '../poll/edit', () => () => null );
jest.mock( '../ad/edit', () => () => null );
jest.mock( '../../../../pages/video-editor/redux/slice/videoSlice', () => ( { updateLayerField: jest.fn() } ) );

window.videoData = { adminUrl: 'https://example.com/wp-admin/' };
window.godamVideoEditorConfig = {};
registerEditorLayerTypes();

describe( 'Layer API: core form providers', () => {
	it( 'registers the 12 form plugins as Form variations, in submenu order', () => {
		expect( getLayerType( 'form' ).variations.map( ( { name } ) => name ) ).toEqual( [
			'gravity', 'wpforms', 'cf7', 'jetpack', 'sureforms', 'forminator',
			'fluentforms', 'everestforms', 'ninjaforms', 'metform', 'marketo', 'hubspot',
		] );
	} );

	it.each( [
		[ 'gravity', 'gf_id' ],
		[ 'wpforms', 'wpform_id' ],
		[ 'cf7', 'cf7_id' ],
		[ 'jetpack', 'jp_id' ],
		[ 'sureforms', 'sureform_id' ],
		[ 'forminator', 'forminator_id' ],
		[ 'fluentforms', 'fluent_form_id' ],
		[ 'everestforms', 'everest_form_id' ],
		[ 'ninjaforms', 'ninja_form_id' ],
		[ 'metform', 'metform_id' ],
		[ 'marketo', 'marketo_id' ],
		[ 'hubspot', 'hubspot_id' ],
	] )( '%s keeps its form ID in %s, selected by form_type', ( name, idField ) => {
		const provider = getLayerVariationByName( 'form', name );
		expect( provider.idField ).toBe( idField );
		expect( provider.attributes ).toEqual( { form_type: name } );
		expect( typeof provider.edit ).toBe( 'function' );
		expect( getFormIdFromLayer( { form_type: name, [ idField ]: '7' }, name ) ).toBe( '7' );
	} );

	it( 'has no form ID for a layer without one or a provider nobody registered', () => {
		expect( getFormIdFromLayer( { form_type: 'gravity' }, 'gravity' ) ).toBeNull();
		expect( getFormIdFromLayer( { form_type: 'mystery', form_id: '7' }, 'mystery' ) ).toBeNull();
	} );

	it( 'builds each provider\'s settings URL as before', () => {
		expect( buildSettingsUrl( 'gravity', '3' ) ).toBe( 'https://example.com/wp-admin/admin.php?subview=confirmation&page=gf_edit_forms&id=3&view=settings' );
		expect( buildSettingsUrl( 'cf7', '9' ) ).toBe( 'https://example.com/wp-admin/admin.php?page=wpcf7&post=9&action=edit' );
		expect( buildSettingsUrl( 'jetpack', '42-1' ) ).toBe( 'https://example.com/wp-admin/post.php?post=42&action=edit' );
		expect( buildSettingsUrl( 'jetpack', '' ) ).toBe( 'https://example.com/wp-admin/admin.php?page=jetpack-forms-admin#/responses' );
		expect( buildSettingsUrl( 'hubspot', 'abc' ) ).toBe( 'https://example.com/wp-admin/' );
		expect( buildSettingsUrl( 'mystery', '1' ) ).toBe( '#' );
	} );
} );

describe( 'Layer API: an add-on form provider', () => {
	beforeAll( () => {
		registerLayerVariation( 'form', {
			name: 'acme-forms',
			title: 'Acme Forms',
			idField: 'acme_form_id',
			isAvailable: () => true,
			settingsUrl: ( formId ) => `https://acme.example/forms/${ formId }`,
			getForms: async () => [],
			getFormHtml: async () => '',
		} );
	} );

	it( 'joins the Form variations after the core providers', () => {
		expect( getLayerType( 'form' ).variations.at( -1 ).name ).toBe( 'acme-forms' );
	} );

	it( 'gives a new layer its form_type', () => {
		const form = getLayerType( 'form' );
		expect( getDefaultAttributes( form, getLayerVariationByName( 'form', 'acme-forms' ) ) ).toMatchObject( { form_type: 'acme-forms' } );
		expect( getLayerVariation( form, { form_type: 'acme-forms' } ).title ).toBe( 'Acme Forms' );
	} );

	it( 'uses its idField for the save check and its own settings URL', () => {
		const { validate } = getLayerType( 'form' );
		expect( validate( { form_type: 'acme-forms' } ) ).toBe( false );
		expect( validate( { form_type: 'acme-forms', acme_form_id: '5' } ) ).toBe( true );
		expect( buildSettingsUrl( 'acme-forms', '5' ) ).toBe( 'https://acme.example/forms/5' );
	} );
} );

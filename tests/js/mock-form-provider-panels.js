/**
 * Stubs for GoDAM's 12 form provider panels, for tests that register the
 * editor's layer types (#2293). The real panels load their RTK Query API slices,
 * which read page globals when imported. Each stub renders a
 * `data-form-panel` marker naming its provider.
 *
 * Import this before the module under test. It lives under /tests so it stays
 * out of the release package.
 */

jest.mock( '../../pages/video-editor/components/forms/GravityForm', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'gravity' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/WPForm', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'wpforms' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/EverestForm', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'everestforms' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/CF7', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'cf7' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/JetpackForm', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'jetpack' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/Sureform.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'sureforms' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/FluentForm.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'fluentforms' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/MetForm.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'metform' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/forminatorForms.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'forminator' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/NinjaForm.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'ninjaforms' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/Marketo.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'marketo' } ),
} ) );

jest.mock( '../../pages/video-editor/components/forms/HubSpotForm.js', () => ( {
	__esModule: true,
	default: () => require( 'react' ).createElement( 'div', { 'data-form-panel': 'hubspot' } ),
} ) );

/**
 * Layer API contract tests (#2291): what the video editor exposes to add-ons.
 *
 * Add-on layer editors (e.g. godam-for-woo) are built separately and reach the
 * editor's shared controls, actions and helpers through these `window` globals.
 * #2296 turns them into deprecated shims; until then their names must not change.
 */

jest.mock( 'react-dom', () => ( { createRoot: () => ( { render: () => {} } ) } ) );
jest.mock( '@posthog/react', () => ( { PostHogProvider: ( { children } ) => children } ) );
jest.mock( '../utils/posthog', () => ( {} ) );
jest.mock( './redux/store', () => ( {} ) );
jest.mock( './App', () => () => null );
jest.mock( './redux/slice/videoSlice', () => ( { updateLayerField: jest.fn() } ) );
jest.mock( './utils/time', () => ( { formatClock: jest.fn(), parseClock: jest.fn() } ) );

// A function declaration, so it is hoisted along with the jest.mock() calls.
function mockComponent() {
	return { __esModule: true, default: function Stub() {} };
}
jest.mock( './components/LayerControls', () => mockComponent() );
jest.mock( './components/layers/LayersHeader', () => mockComponent() );
jest.mock( './components/hotspot/FontAwesomeIconPicker', () => mockComponent() );
jest.mock( './components/shared/color-picker/ColorPickerButton.jsx', () => mockComponent() );
jest.mock( './components/controls', () => ( {
	VeSection: function VeSection() {},
	VeTextInput: function VeTextInput() {},
	VeSegmented: function VeSegmented() {},
	VeColorList: function VeColorList() {},
	VeRadioGroup: function VeRadioGroup() {},
} ) );

describe( 'Layer API contract: editor globals for add-ons', () => {
	beforeAll( () => {
		// An add-on that loaded first and put its own entries on the same globals.
		window.godamVideoEditorComponents = { AddonControl: 'kept' };
		window.godamVideoEditorActions = { addonAction: 'kept' };
		window.godamVideoEditorUtils = { addonUtil: 'kept' };
		require( './index' );
	} );

	it( 'exposes the shared layer controls on window.godamVideoEditorComponents', () => {
		const components = window.godamVideoEditorComponents;
		[
			'LayerControls',
			'LayersHeader',
			'VeSection',
			'VeTextInput',
			'VeSegmented',
			'VeColorList',
			'VeRadioGroup',
			'FontAwesomeIconPicker',
			'ColorPickerButton',
		].forEach( ( name ) => expect( typeof components[ name ] ).toBe( 'function' ) );
	} );

	it( 'exposes the real updateLayerField action on window.godamVideoEditorActions', () => {
		expect( window.godamVideoEditorActions.updateLayerField ).toBe( require( './redux/slice/videoSlice' ).updateLayerField );
	} );

	it( 'exposes formatClock and parseClock on window.godamVideoEditorUtils', () => {
		const time = require( './utils/time' );
		expect( window.godamVideoEditorUtils.formatClock ).toBe( time.formatClock );
		expect( window.godamVideoEditorUtils.parseClock ).toBe( time.parseClock );
	} );

	it( 'keeps entries an add-on already put on those globals', () => {
		expect( window.godamVideoEditorComponents.AddonControl ).toBe( 'kept' );
		expect( window.godamVideoEditorActions.addonAction ).toBe( 'kept' );
		expect( window.godamVideoEditorUtils.addonUtil ).toBe( 'kept' );
	} );
} );

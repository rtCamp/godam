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
jest.mock( './layers', () => ( { registerEditorLayerTypes: jest.fn() } ) );
jest.mock( './layers/hooks', () => ( { useLayer: jest.fn(), useLayerAttributes: jest.fn() } ) );

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

	it( 'exposes the real updateLayerField action on window.godamVideoEditorActions, with a deprecation notice', () => {
		expect( window.godamVideoEditorActions.updateLayerField ).toBe( require( './redux/slice/videoSlice' ).updateLayerField );
		expect( console ).toHaveWarnedWith( 'GoDAM: window.godamVideoEditorActions is deprecated since version 2.8.0 and will be removed in version 2.10.0. Use useLayerAttributes() from window.godam.layerEditor instead.' );
	} );

	it( 'exposes formatClock and parseClock on window.godamVideoEditorUtils', () => {
		const time = require( './utils/time' );
		expect( window.godamVideoEditorUtils.formatClock ).toBe( time.formatClock );
		expect( window.godamVideoEditorUtils.parseClock ).toBe( time.parseClock );
	} );

	it( 'exposes the layer editor hooks and controls on window.godam.layerEditor', () => {
		const hooks = require( './layers/hooks' );
		const { layerEditor } = window.godam;
		expect( layerEditor.useLayer ).toBe( hooks.useLayer );
		expect( layerEditor.useLayerAttributes ).toBe( hooks.useLayerAttributes );
		[ 'LayerCanvas', 'LayersHeader', 'VeSection', 'VeTextInput', 'VeSegmented', 'VeColorList', 'VeRadioGroup', 'FontAwesomeIconPicker', 'ColorPickerButton' ]
			.forEach( ( name ) => expect( typeof layerEditor[ name ] ).toBe( 'function' ) );
	} );

	it( 'registers the editor\'s layer types before rendering', () => {
		expect( require( './layers' ).registerEditorLayerTypes ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps entries an add-on already put on those globals', () => {
		expect( window.godamVideoEditorComponents.AddonControl ).toBe( 'kept' );
		expect( window.godamVideoEditorActions.addonAction ).toBe( 'kept' );
		expect( window.godamVideoEditorUtils.addonUtil ).toBe( 'kept' );
	} );
} );

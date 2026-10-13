/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import renderMoveToFolderField from './move-to-folder-field';
import { isFolderOrgDisabled } from '../../utility';

jest.mock( '@wordpress/api-fetch', () => jest.fn( () => Promise.resolve( [] ) ) );
jest.mock( '@wordpress/i18n', () => ( { __: ( text ) => text } ) );
jest.mock( '../../utility', () => ( { isFolderOrgDisabled: jest.fn( () => false ) } ) );
jest.mock( '../../../../../../pages/media-library/data/move-to-folder-bridge', () => ( {
	requestMoveToFolder: jest.fn(),
	resolveSidebarRoot: jest.fn(),
} ) );

/**
 * A wp.media attachment-details double whose frame content mode is controllable.
 *
 * @param {Object} options      Options.
 * @param {string} options.mode Content mode the frame reports.
 * @param {number} options.id   Attachment id the model carries.
 * @return {{ view: Object, el: HTMLElement }} The view double and its element.
 */
const makeView = ( { mode = 'browse', id = 5 } = {} ) => {
	const el = document.createElement( 'div' );
	el.innerHTML = '<div class="settings"></div>';

	const view = {
		controller: { content: { mode: () => mode } },
		model: { get: ( key ) => ( 'id' === key ? id : undefined ) },
		el,
		$el: { find: () => ( { remove: jest.fn() } ) },
	};

	return { view, el };
};

describe( 'renderMoveToFolderField', () => {
	beforeEach( () => {
		isFolderOrgDisabled.mockReturnValue( false );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'adds the Folder control on a normal tab', () => {
		const { view, el } = makeView( { mode: 'browse' } );

		renderMoveToFolderField( view );

		expect( el.querySelector( '.godam-move-to-folder-setting' ) ).not.toBeNull();
		// Its current-folder lookup fires only when the row is actually rendered.
		expect( apiFetch ).toHaveBeenCalled();
	} );

	it( 'returns early on the GoDAM tab, rendering nothing', () => {
		const { view, el } = makeView( { mode: 'godam' } );

		renderMoveToFolderField( view );

		expect( el.querySelector( '.godam-move-to-folder-setting' ) ).toBeNull();
		expect( apiFetch ).not.toHaveBeenCalled();
	} );

	it( 'returns early when folder organization is disabled', () => {
		isFolderOrgDisabled.mockReturnValue( true );
		const { view, el } = makeView( { mode: 'browse' } );

		renderMoveToFolderField( view );

		expect( el.querySelector( '.godam-move-to-folder-setting' ) ).toBeNull();
	} );
} );

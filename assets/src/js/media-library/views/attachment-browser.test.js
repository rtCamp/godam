/**
 * Internal dependencies
 */
import { isAPIKeyValid, isUploadPage, isFolderOrgDisabled } from '../utility';

// The toolbar filters each read `wp.media.view.*` at module eval and build real
// Backbone views; stub them out and only assert which ones createToolbar registers.
// A factory (not auto-mock) for utility, so requiring the real module — which pulls
// in models/attachments.js and its bare `wp` global — is avoided entirely.
jest.mock( '../utility', () => ( {
	isAPIKeyValid: jest.fn(),
	isUploadPage: jest.fn(),
	isFolderOrgDisabled: jest.fn(),
} ) );
jest.mock( './filters/media-library-taxonomy-filter', () => jest.fn( () => ( { render: () => ( {} ) } ) ) );
jest.mock( './filters/media-date-range-filter', () => jest.fn( () => ( { render: () => ( {} ) } ) ) );
jest.mock( './filters/media-retranscode', () => jest.fn( () => ( { render: () => ( {} ) } ) ) );
jest.mock( './filters/media-move-to-folder', () => jest.fn( () => ( { render: () => ( {} ) } ) ) );

/**
 * Load the extended AttachmentsBrowser against a `wp.media` double.
 *
 * The module reads `wp.media.view.AttachmentsBrowser` and calls `.extend()` at
 * eval time, so `wp` has to be in place before it is required. `extend` here
 * returns the raw methods object, which is all `createToolbar` needs to run.
 *
 * @return {{ createToolbar: Function, parentCreateToolbar: jest.Mock }} The subclass method and the parent's spy.
 */
const loadBrowser = () => {
	const parentCreateToolbar = jest.fn();

	window.wp = {
		media: {
			view: {
				AttachmentsBrowser: {
					prototype: {
						initialize: jest.fn(),
						bindEvents: jest.fn(),
						createToolbar: parentCreateToolbar,
					},
					extend: ( proto ) => proto,
				},
			},
		},
	};

	let methods;
	jest.isolateModules( () => {
		methods = require( './attachment-browser' ).default;
	} );

	return { createToolbar: methods.createToolbar, parentCreateToolbar };
};

/**
 * A minimal `this` for createToolbar: a toolbar whose `set` we can watch, plus the
 * controller/collection the filter constructors are handed.
 *
 * @return {{ ctx: Object, toolbarSet: jest.Mock }} The context and the toolbar spy.
 */
const makeContext = () => {
	const toolbarSet = jest.fn();
	const ctx = {
		toolbar: { set: toolbarSet },
		controller: {},
		collection: { props: {} },
	};

	return { ctx, toolbarSet };
};

describe( 'attachment browser toolbar', () => {
	beforeEach( () => {
		isFolderOrgDisabled.mockReturnValue( false );
		isAPIKeyValid.mockReturnValue( false );
	} );

	afterEach( () => {
		delete window.wp;
		jest.clearAllMocks();
	} );

	it( 'registers the "Move to folder" bulk action on the media grid page', async () => {
		isUploadPage.mockReturnValue( true );

		const { createToolbar, parentCreateToolbar } = loadBrowser();
		const { ctx, toolbarSet } = makeContext();

		await createToolbar.call( ctx );

		expect( parentCreateToolbar ).toHaveBeenCalled();
		expect( toolbarSet ).toHaveBeenCalledWith( 'MediaMoveToFolder', expect.anything() );
	} );

	it( 'omits it in picker frames (off upload.php), leaving the other filters', async () => {
		isUploadPage.mockReturnValue( false );

		const { createToolbar } = loadBrowser();
		const { ctx, toolbarSet } = makeContext();

		await createToolbar.call( ctx );

		expect( toolbarSet ).not.toHaveBeenCalledWith( 'MediaMoveToFolder', expect.anything() );
		// The folder/date filters still belong on the picker toolbar.
		expect( toolbarSet ).toHaveBeenCalledWith( 'MediaLibraryTaxonomyFilter', expect.anything() );
		expect( toolbarSet ).toHaveBeenCalledWith( 'MediaDateRangeFilter', expect.anything() );
	} );
} );

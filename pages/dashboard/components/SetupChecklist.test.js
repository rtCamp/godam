/**
 * Unit tests for the "Get your first video live" checklist.
 *
 * The server says which steps are done; the card labels them, marks the first
 * open step "Next", counts "N of 5 done", and links each open step to where it
 * is done. Rendered to a static HTML string with the RTK query hook mocked, as
 * in GA4ConnectionWidget.test.js.
 *
 * @since n.e.x.t
 *
 * @package
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useFetchSetupChecklistQuery } from '../redux/api/dashboardAnalyticsApi';
import SetupChecklist, { describeStep } from './SetupChecklist';

jest.mock( '../redux/api/dashboardAnalyticsApi', () => ( {
	useFetchSetupChecklistQuery: jest.fn(),
} ) );

// The real Button uses hooks, which renderToString does not run; a plain stand-in
// keeps the href, variant and label the tests read.
jest.mock( '@wordpress/components', () => ( {
	Button: ( { href, variant, children } ) => ( href
		? <a href={ href } data-variant={ variant }>{ children }</a>
		: <button type="button" data-variant={ variant }>{ children }</button> ),
} ) );

const steps = ( done, count = 37 ) => [
	{ id: 'connect_site', done: done.includes( 'connect_site' ) },
	{ id: 'move_videos', done: done.includes( 'move_videos' ), count },
	{ id: 'vimeo', done: done.includes( 'vimeo' ) },
	{ id: 'upload_video', done: done.includes( 'upload_video' ) },
	{ id: 'add_block', done: done.includes( 'add_block' ) },
];

/**
 * The rendered <li> for one step.
 *
 * @param {string} html Rendered card.
 * @param {string} id   Step id.
 * @return {string} That step's markup.
 */
const stepHtml = ( html, id ) => {
	const start = html.lastIndexOf( '<li', html.indexOf( `data-test-id="godam-setup-step-${ id }"` ) );
	return html.slice( start, html.indexOf( '</li>', start ) );
};

describe( 'SetupChecklist', () => {
	const originalUserData = window.userData;

	beforeEach( () => {
		useFetchSetupChecklistQuery.mockReset();
		window.userData = { storageUsed: 0, totalStorage: 20 };
	} );

	afterEach( () => {
		window.userData = originalUserData;
	} );

	it( 'shows a new site with videos to move as 1 of 5 done, moving them next', () => {
		useFetchSetupChecklistQuery.mockReturnValue( { data: { steps: steps( [ 'connect_site' ] ) }, isLoading: false, isError: false } );

		const html = renderToString( <SetupChecklist /> );

		expect( html ).toContain( 'Get your first video live' );
		expect( html ).toContain( '1 of 5 done' );
		expect( html ).toContain( 'aria-valuenow="20"' );
		expect( stepHtml( html, 'connect_site' ) ).toContain( 'is-done' );
		expect( stepHtml( html, 'connect_site' ) ).not.toContain( 'href' );

		const move = stepHtml( html, 'move_videos' );
		expect( move ).toContain( 'is-next' );
		expect( move ).toContain( '37 found in the Media Library' );
		expect( move ).toContain( 'Move 37 videos' );
		expect( move ).toContain( 'page=rtgodam_tools#retranscode-media' );
		expect( move ).toContain( 'data-variant="primary"' );

		expect( stepHtml( html, 'vimeo' ) ).toContain( 'is-todo' );
		expect( stepHtml( html, 'vimeo' ) ).toContain( 'Connect Vimeo' );
		expect( stepHtml( html, 'upload_video' ) ).toContain( 'media-new.php' );
		expect( stepHtml( html, 'add_block' ) ).toContain( 'Show me how' );
	} );

	it( 'moves "Next" to the first open step and hides done steps\' buttons', () => {
		useFetchSetupChecklistQuery.mockReturnValue( {
			data: { steps: steps( [ 'connect_site', 'move_videos', 'upload_video' ], 0 ) },
			isLoading: false,
			isError: false,
		} );

		const html = renderToString( <SetupChecklist /> );

		expect( html ).toContain( '3 of 5 done' );
		expect( stepHtml( html, 'move_videos' ) ).toContain( 'is-done' );
		expect( stepHtml( html, 'move_videos' ) ).not.toContain( 'Move 0' );
		expect( stepHtml( html, 'vimeo' ) ).toContain( 'is-next' );
		expect( stepHtml( html, 'upload_video' ) ).not.toContain( 'media-new.php' );
		expect( stepHtml( html, 'add_block' ) ).toContain( 'is-todo' );
	} );

	it( 'shows the Storage and "Need a hand?" cards beside the checklist', () => {
		useFetchSetupChecklistQuery.mockReturnValue( { data: { steps: steps( [ 'connect_site' ] ) }, isLoading: false, isError: false } );
		window.userData = { storageUsed: 5, totalStorage: 20 };

		const html = renderToString( <SetupChecklist /> );

		expect( html ).toContain( 'godam-setup-storage' );
		expect( html ).toContain( '5 GB of 20 GB' );
		expect( html ).toContain( 'Talk to us' );
	} );

	it( 'leaves out the Storage card when the plan has no quota', () => {
		useFetchSetupChecklistQuery.mockReturnValue( { data: { steps: steps( [] ) }, isLoading: false, isError: false } );
		window.userData = {};

		expect( renderToString( <SetupChecklist /> ) ).not.toContain( 'godam-setup-storage' );
	} );

	it( 'shows an error with a Contact support link when the steps cannot load', () => {
		useFetchSetupChecklistQuery.mockReturnValue( { data: undefined, isLoading: false, isError: true, refetch: jest.fn() } );

		const html = renderToString( <SetupChecklist /> );

		expect( html ).toContain( 'Your setup steps could not load.' );
		expect( html ).toContain( 'Contact support' );
		expect( html ).not.toContain( 'of 5 done' );
	} );

	it( 'says the moving step needs no button once nothing is left to move', () => {
		expect( describeStep( { id: 'move_videos', count: 0 } ).action ).toBeNull();
		expect( describeStep( { id: 'move_videos', count: 1 } ).action.text ).toBe( 'Move 1 video' );
	} );
} );

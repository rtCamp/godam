/**
 * Unit tests for the list-view status poller's failed state: a job Central refused
 * keeps its reason instead of being overwritten by the generic retry hint.
 */

/**
 * Internal dependencies
 */
import ListViewTranscodingStatus from './list-view-transcoding-status';

// The constructor starts polling for any `.transcoding-status` in the DOM; keep it idle.
jest.mock( './transcoding-checker', () => jest.fn().mockImplementation( () => ( { startPolling: jest.fn() } ) ) );

global.transcoderSettings = { restUrl: 'https://example.test/wp-json/godam/v1/transcoding/transcoding-status' };

const render = () => {
	document.body.innerHTML = `
		<div id="list-transcoder-status-55" class="transcoding-status transcoding-status--failed transcoding-status-list" data-id="55">
			<div class="transcoding-status__loader"><svg></svg></div>
			<span class="status-text">GoDAM couldn't download this file from your site.</span>
		</div>
	`;

	return document.querySelector( '#list-transcoder-status-55 .status-text' );
};

describe( 'ListViewTranscodingStatus — failed state', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	it.each( [ 'preflight_failed', 'job_refused' ] )( 'keeps Central\'s reason for %s', ( errorCode ) => {
		const statusText = render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			progress: 0,
			error_code: errorCode,
			error_msg: 'Your GoDAM storage is full. Upgrade your plan or delete unused files.',
		} );

		expect( statusText.textContent ).toBe( 'Your GoDAM storage is full. Upgrade your plan or delete unused files.' );
	} );

	it( 'shows the retry hint for other failures', () => {
		const statusText = render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			progress: 0,
			error_code: 'transcoder_error',
			error_msg: 'ffmpeg exited with code 1',
		} );

		expect( statusText.textContent ).toBe( 'Transcoding failed, please try again.' );
	} );

	it( 'adds one Contact Support link to a failure, however many times it is polled', () => {
		render();
		const status = new ListViewTranscodingStatus();
		const failed = { status: 'failed', progress: 0, error_code: 'transcoder_error' };

		status.updateAttachmentStatus( '55', failed );
		status.updateAttachmentStatus( '55', failed );

		const links = document.querySelectorAll( '#list-transcoder-status-55 .godam-contact-support' );
		expect( links ).toHaveLength( 1 );
		expect( links[ 0 ].getAttribute( 'data-test-id' ) ).toBe( 'godam-media-library-link-contact-support' );
	} );

	it( 'drops the link, including a server-rendered one, once the file is transcoding or done', () => {
		render();
		document.querySelector( '#list-transcoder-status-55' ).insertAdjacentHTML( 'beforeend', '<a class="godam-contact-support" href="#">Contact Support</a>' );
		const status = new ListViewTranscodingStatus();

		status.updateAttachmentStatus( '55', { status: 'in_progress', progress: 40, message: 'Transcoding…' } );
		expect( document.querySelector( '.godam-contact-support' ) ).toBeNull();

		status.updateAttachmentStatus( '55', { status: 'failed', progress: 0 } );
		expect( document.querySelector( '.godam-contact-support' ) ).not.toBeNull();

		status.updateAttachmentStatus( '55', { status: 'transcoded', progress: 100 } );
		expect( document.querySelector( '.godam-contact-support' ) ).toBeNull();
	} );
} );

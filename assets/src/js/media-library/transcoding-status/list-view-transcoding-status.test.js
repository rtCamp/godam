/**
 * Unit tests for the list-view status poller's failed and stuck states: the reason the
 * server sends is shown, with what to do next, instead of a generic retry hint.
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

	it( 'shows the plugin\'s own reason and next step for a failure Central reported', () => {
		render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			progress: 0,
			error_code: 'oom',
			error_msg: 'The file needed more memory than processing allows. Try a smaller or lower-resolution file.',
			failure: { kind: 'failed', code: 'oom', next_step: 'Upload a smaller file.', next_step_url: '', support_url: '' },
		} );

		const element = document.querySelector( '#list-transcoder-status-55' );
		expect( element.querySelector( '.status-text' ).textContent ).toBe( 'The file needed more memory than processing allows. Try a smaller or lower-resolution file.' );
		expect( element.querySelector( '.status-next-step' ).textContent ).toBe( 'Upload a smaller file.' );
		expect( element.querySelector( '.status-next-step a' ) ).toBeNull();
	} );

	it( 'links to support when every retry failed', () => {
		render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			progress: 0,
			error_code: 'retries_exhausted',
			error_msg: 'Failed after 3 retries.',
			failure: {
				kind: 'retries_exhausted',
				next_step: 'Retranscode to try again.',
				next_step_url: '',
				support_url: 'https://app.godam.io/helpdesk/my-tickets',
			},
		} );

		const link = document.querySelector( '#list-transcoder-status-55 .status-next-step a' );
		expect( link.textContent ).toBe( 'Contact support' );
		expect( link.href ).toBe( 'https://app.godam.io/helpdesk/my-tickets' );
	} );

	it( 'shows a stuck job as failed, with its message', () => {
		render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'stalled',
			progress: 0,
			message: 'This is taking longer than expected.',
			failure: { kind: 'stalled', next_step: 'Retranscode to try again.', next_step_url: '', support_url: '' },
		} );

		const element = document.querySelector( '#list-transcoder-status-55' );
		expect( element.classList.contains( 'transcoding-status--failed' ) ).toBe( true );
		expect( element.querySelector( '.status-text' ).textContent ).toBe( 'This is taking longer than expected.' );
	} );

	it( 'never links to anything but http(s)', () => {
		render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			error_msg: 'Something went wrong while processing the file.',
			// eslint-disable-next-line no-script-url
			failure: { next_step: 'Upgrade plan', next_step_url: 'javascript:alert(1)', support_url: 'javascript:alert(1)' },
		} );

		expect( document.querySelector( '#list-transcoder-status-55 a' ) ).toBeNull();
	} );

	it( 'falls back to the retry hint when the server sends no reason', () => {
		const statusText = render();

		new ListViewTranscodingStatus().updateAttachmentStatus( '55', { status: 'failed', progress: 0 } );

		expect( statusText.textContent ).toBe( 'Transcoding failed, please try again.' );
	} );

	it( 'drops the next step once the file transcodes', () => {
		render();
		const status = new ListViewTranscodingStatus();

		status.updateAttachmentStatus( '55', { status: 'failed', error_msg: 'x', failure: { next_step: 'Upload a different file.' } } );
		status.updateAttachmentStatus( '55', { status: 'transcoded', progress: 100 } );

		expect( document.querySelector( '#list-transcoder-status-55 .status-next-step' ) ).toBeNull();
	} );
} );

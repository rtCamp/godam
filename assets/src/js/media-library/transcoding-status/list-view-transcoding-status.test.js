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
} );

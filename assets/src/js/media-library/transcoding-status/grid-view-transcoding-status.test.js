/**
 * Unit tests for the grid status poller's failed state: a job Central refuses while the
 * grid is open gets the same reason, label and accessibility attributes as a fresh render.
 */

/**
 * Internal dependencies
 */
import GridViewTranscodingStatus from './grid-view-transcoding-status';

// The constructor polls in-progress tiles; keep it idle.
jest.mock( './transcoding-checker', () => jest.fn().mockImplementation( () => ( { startPolling: jest.fn() } ) ) );

global.transcoderSettings = { restUrl: 'https://example.test/wp-json/godam/v1/transcoding/transcoding-status' };

const render = () => {
	document.body.innerHTML = `
		<li class="attachment transcoding-status transcoding-status--in-progress" data-id="55">
			<div class="transcoding-status__loader"><svg class="transcoding-status__loader__progress"></svg></div>
		</li>
	`;

	return {
		tile: document.querySelector( 'li.attachment' ),
		loader: document.querySelector( '.transcoding-status__loader' ),
	};
};

describe( 'GridViewTranscodingStatus — failed state', () => {
	it( 'shows why Central refused the job', () => {
		const { tile, loader } = render();

		new GridViewTranscodingStatus().updateAttachmentStatus( '55', {
			status: 'failed',
			progress: 0,
			error_code: 'job_refused',
			error_msg: 'Your GoDAM storage is full. Upgrade your plan or delete unused files.',
			error_detail: 'Storage limit exceeded',
		} );

		expect( tile.classList.contains( 'transcoding-status--failed' ) ).toBe( true );
		expect( tile.classList.contains( 'transcoding-status--job-refused' ) ).toBe( true );
		expect( loader.getAttribute( 'aria-label' ) ).toBe( 'Your GoDAM storage is full. Upgrade your plan or delete unused files.' );
		expect( loader.getAttribute( 'tabindex' ) ).toBe( '0' );
		expect( loader.getAttribute( 'title' ) ).toContain( 'GoDAM said: Storage limit exceeded' );
	} );

	it( 'leaves other failures generic', () => {
		const { tile, loader } = render();

		new GridViewTranscodingStatus().updateAttachmentStatus( '55', { status: 'failed', progress: 0, error_code: 'transcoder_error' } );

		expect( tile.classList.contains( 'transcoding-status--failed' ) ).toBe( true );
		expect( tile.classList.contains( 'transcoding-status--job-refused' ) ).toBe( false );
		expect( loader.hasAttribute( 'aria-label' ) ).toBe( false );
	} );
} );

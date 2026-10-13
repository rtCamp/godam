/**
 * Unit tests for the attachment details panel that says why GoDAM refused a file.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import renderTranscodingRefusalPanel from './transcoding-refusal-panel';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

const view = ( attributes ) => {
	document.body.innerHTML = '<div class="attachment-details"><div class="attachment-info"><div class="details"></div></div></div>';

	return {
		el: document.querySelector( '.attachment-details' ),
		model: { get: ( key ) => ( { id: 55, ...attributes } )[ key ] },
	};
};

const refused = {
	transcoding_status: 'failed',
	transcoding_error_code: 'job_refused',
	transcoding_error_msg: 'Your GoDAM storage is full. Upgrade your plan or delete unused files.',
	transcoding_error_detail: 'Storage limit exceeded',
	transcoding_error_needs_plan: true,
	transcoding_can_retranscode: true,
};

const panel = () => document.querySelector( '.godam-transcoding-refusal' );

describe( 'transcoding refusal panel', () => {
	beforeEach( () => apiFetch.mockReset() );

	it( 'shows the reason, the actions and the support details', () => {
		renderTranscodingRefusalPanel( view( refused ) );

		expect( panel().parentElement.className ).toBe( 'attachment-info' );
		expect( panel().querySelector( '.godam-transcoding-refusal__reason' ).textContent ).toBe( refused.transcoding_error_msg );
		expect( [ ...panel().querySelectorAll( '.button' ) ].map( ( b ) => b.textContent ) ).toEqual( [ 'Upgrade plan', 'Retranscode' ] );
		expect( panel().querySelector( 'a.button' ).href ).toContain( 'app.godam.io/web/billing' );
		expect( panel().querySelector( 'details' ).textContent ).toContain( 'Storage limit exceeded' );
	} );

	it( 'leaves out what the user can\'t use or doesn\'t need', () => {
		renderTranscodingRefusalPanel( view( {
			...refused,
			transcoding_error_code: 'preflight_failed',
			transcoding_error_detail: '',
			transcoding_error_needs_plan: false,
			transcoding_can_retranscode: false,
		} ) );

		expect( panel() ).not.toBeNull();
		expect( panel().querySelector( '.button' ) ).toBeNull();
		expect( panel().querySelector( 'details' ) ).toBeNull();
	} );

	it.each( [
		[ 'a file that isn\'t failed', { transcoding_status: 'transcoded' } ],
		[ 'a failure that isn\'t a refusal', { transcoding_error_code: 'transcoder_error' } ],
	] )( 'renders nothing for %s', ( _label, attributes ) => {
		renderTranscodingRefusalPanel( view( { ...refused, ...attributes } ) );

		expect( panel() ).toBeNull();
	} );

	it( 'does not stack panels when the view re-renders', () => {
		const details = view( refused );
		renderTranscodingRefusalPanel( details );
		renderTranscodingRefusalPanel( details );

		expect( document.querySelectorAll( '.godam-transcoding-refusal' ) ).toHaveLength( 1 );
	} );

	it( 'retranscodes and reports the outcome', async () => {
		apiFetch.mockResolvedValue( { sent: true } );
		renderTranscodingRefusalPanel( view( refused ) );

		panel().querySelector( 'button' ).click();
		await Promise.resolve();
		await Promise.resolve();

		expect( apiFetch ).toHaveBeenCalledWith( { path: '/godam/v1/transcoding/retranscode', method: 'POST', data: { id: 55 } } );
		expect( panel().querySelector( '.godam-transcoding-refusal__status' ).textContent ).toBe( 'Transcoding has started.' );
	} );

	it.each( [
		[
			'refused again',
			( mock ) => mock.mockResolvedValue( { message: 'Sample (ID 55) cannot be transcoded. Your GoDAM storage is full.', skipped: true, reason: 'job_refused', error_msg: 'Your GoDAM storage is full.' } ),
			'Your GoDAM storage is full.',
		],
		[
			'a transient failure',
			( mock ) => mock.mockRejectedValue( { message: 'Sample (ID 55) transcoding request failed. The transcoding request timed out.', error_msg: 'The transcoding request timed out.' } ),
			'The transcoding request timed out.',
		],
		[
			'a localhost site',
			( mock ) => mock.mockResolvedValue( { message: 'Sample (ID 55) transcoding request failed. Transcoding requests are not allowed in the localhost environment.', skipped: true, reason: 'local_environment' } ),
			'Transcoding isn\'t available on a localhost site.',
		],
		[
			'a network error',
			( mock ) => mock.mockRejectedValue( new Error( 'offline' ) ),
			'The request failed. Try again.',
		],
	] )( 'shows only the reason, never the file name and ID, for %s', async ( _label, answer, expected ) => {
		answer( apiFetch );
		renderTranscodingRefusalPanel( view( refused ) );

		const button = panel().querySelector( 'button' );
		button.click();
		await Promise.resolve();
		await Promise.resolve();

		const text = panel().querySelector( '.godam-transcoding-refusal__status' ).textContent;
		expect( text ).toBe( expected );
		expect( text ).not.toContain( '(ID 55)' );
		expect( button.disabled ).toBe( false );
	} );
} );

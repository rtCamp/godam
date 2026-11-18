/**
 * The recorder's fresh upload nonce.
 *
 * A page cache can serve a form page for longer than its printed nonce lives. The
 * recorder asks admin-ajax.php for a fresh nonce before each upload, and keeps the
 * printed one when that request fails.
 */

/**
 * Internal dependencies
 */
import { getRecorderUploadNonce } from './upload-nonce';

/**
 * Make global.fetch answer with this JSON.
 *
 * @param {Object} json Response body.
 */
const answerWith = ( json ) => {
	global.fetch = jest.fn( () => Promise.resolve( { json: () => Promise.resolve( json ) } ) );
};

afterEach( () => {
	delete global.fetch;
} );

describe( 'getRecorderUploadNonce', () => {
	it( 'asks admin-ajax for the nonce of this form and field', async () => {
		answerWith( { success: true, data: { nonce: 'fresh' } } );

		const nonce = await getRecorderUploadNonce( '/wp-admin/admin-ajax.php', 'ninja-forms', 12, 'stale' );

		expect( nonce ).toBe( 'fresh' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );

		const [ url, options ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toBe( '/wp-admin/admin-ajax.php' );
		expect( options.method ).toBe( 'POST' );
		expect( options.credentials ).toBe( 'same-origin' );
		expect( options.body.get( 'action' ) ).toBe( 'godam_recorder_upload_nonce' );
		expect( options.body.get( 'form' ) ).toBe( 'ninja-forms' );
		expect( options.body.get( 'field_id' ) ).toBe( '12' );
	} );

	it( 'keeps the printed nonce when the server refuses', async () => {
		answerWith( { success: false, data: 'Unknown recorder field.' } );

		await expect( getRecorderUploadNonce( '/ajax', 'fluentforms', 0, 'printed' ) ).resolves.toBe( 'printed' );
	} );

	it( 'keeps the printed nonce when the request fails', async () => {
		global.fetch = jest.fn( () => Promise.reject( new Error( 'offline' ) ) );

		await expect( getRecorderUploadNonce( '/ajax', 'fluentforms', 0, 'printed' ) ).resolves.toBe( 'printed' );
	} );

	it( 'keeps the printed nonce when the answer is not JSON', async () => {
		global.fetch = jest.fn( () => Promise.resolve( { json: () => Promise.reject( new SyntaxError( '-1' ) ) } ) );

		await expect( getRecorderUploadNonce( '/ajax', 'fluentforms', 0, 'printed' ) ).resolves.toBe( 'printed' );
	} );

	it( 'sends nothing without an admin-ajax URL', async () => {
		global.fetch = jest.fn();

		await expect( getRecorderUploadNonce( '', 'fluentforms', 0, 'printed' ) ).resolves.toBe( 'printed' );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );
} );

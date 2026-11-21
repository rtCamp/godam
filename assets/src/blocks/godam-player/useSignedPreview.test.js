/**
 * External dependencies
 */
import { createRoot } from 'react-dom/client';
import { act } from 'react';

/**
 * Internal dependencies
 */
import useSignedPreview, { previewMedia } from './useSignedPreview';

/**
 * WordPress dependencies
 */
const apiFetch = require( '@wordpress/api-fetch' );
const { useSelect } = require( '@wordpress/data' );

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
jest.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );
jest.mock( '@wordpress/data', () => ( { useSelect: jest.fn() } ) );

const signedAnswer = {
	sources: [ { src: 'https://cdn.test/private/p/index.m3u8?token=a', type: 'application/x-mpegURL' } ],
	poster: 'https://cdn.test/private/p/thumb.jpg?token=b',
};

/**
 * Render the hook for an attachment, returning a getter for its latest value.
 *
 * @param {number}      attachmentId The block's attachment id.
 * @param {Object|null} media        What the media store returns for it.
 * @return {Object} `get`, `rerender` and the React `root`.
 */
function renderPreview( attachmentId, media ) {
	useSelect.mockImplementation( ( selector ) => selector( () => ( { getMedia: () => media } ) ) );
	let value;
	function Probe( { id } ) {
		value = useSignedPreview( id );
		return null;
	}
	const root = createRoot( document.createElement( 'div' ) );
	act( () => root.render( <Probe id={ attachmentId } /> ) );
	return { get: () => value, rerender: ( id ) => act( () => root.render( <Probe id={ id } /> ) ), root };
}

const settle = () => act( () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) ) );

describe( 'useSignedPreview', () => {
	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'asks the playback route for the attachment\'s job and returns its signed sources', async () => {
		apiFetch.mockResolvedValue( signedAnswer );
		const preview = renderPreview( 7, { meta: { rtgodam_transcoding_job_id: 'job/a b' } } );
		await settle();
		expect( apiFetch ).toHaveBeenCalledWith( { path: '/godam/v1/playback/job%2Fa%20b' } );
		expect( preview.get() ).toEqual( { sources: signedAnswer.sources, poster: signedAnswer.poster } );
	} );

	it( 'returns null and asks nothing without an attachment or a GoDAM job', async () => {
		expect( renderPreview( 0, null ).get() ).toBeNull();
		expect( renderPreview( 7, { meta: {} } ).get() ).toBeNull();
		await settle();
		expect( apiFetch ).not.toHaveBeenCalled();
	} );

	it( 'keeps the saved sources when the route has none or fails', async () => {
		apiFetch.mockResolvedValueOnce( { sources: [] } );
		const empty = renderPreview( 7, { meta: { rtgodam_transcoding_job_id: 'job-b' } } );
		await settle();
		expect( empty.get() ).toBeNull();

		apiFetch.mockRejectedValueOnce( new Error( 'offline' ) );
		const failed = renderPreview( 8, { meta: { rtgodam_transcoding_job_id: 'job-c' } } );
		await settle();
		expect( failed.get() ).toBeNull();
	} );

	it( 'defaults the poster to empty when the route sends none', async () => {
		apiFetch.mockResolvedValue( { sources: signedAnswer.sources } );
		const preview = renderPreview( 7, { meta: { rtgodam_transcoding_job_id: 'job-d' } } );
		await settle();
		expect( preview.get().poster ).toBe( '' );
	} );

	it( 'ignores an answer that arrives after the block moved to another file', async () => {
		let answer;
		apiFetch.mockImplementation( () => new Promise( ( resolve ) => {
			answer = resolve;
		} ) );
		const preview = renderPreview( 7, { meta: { rtgodam_transcoding_job_id: 'job-e' } } );
		act( () => preview.root.unmount() );
		await act( async () => answer( signedAnswer ) );
		expect( preview.get() ).toBeNull();
	} );
} );

describe( 'previewMedia', () => {
	const saved = { poster: 'https://cdn.test/job/thumb.jpg', sources: [ { src: 'saved.m3u8' } ], defaultPoster: 'default.jpg' };

	it( 'previews the signed sources and the signed copy of GoDAM\'s own poster', () => {
		expect( previewMedia( signedAnswer, saved ) ).toEqual( { poster: signedAnswer.poster, sources: signedAnswer.sources } );
	} );

	it( 'keeps a custom poster from another host', () => {
		const custom = { ...saved, poster: 'https://site.test/uploads/cover.jpg' };
		expect( previewMedia( signedAnswer, custom ).poster ).toBe( custom.poster );
	} );

	it( 'uses the signed poster when nothing is saved, and keeps a poster it can\'t parse', () => {
		expect( previewMedia( signedAnswer, { ...saved, poster: '' } ).poster ).toBe( signedAnswer.poster );
		expect( previewMedia( signedAnswer, { ...saved, poster: 'not a url' } ).poster ).toBe( 'not a url' );
	} );

	it( 'falls back to the saved sources and the default poster without a signed preview', () => {
		expect( previewMedia( null, { ...saved, poster: '' } ) ).toEqual( { poster: 'default.jpg', sources: saved.sources } );
		expect( previewMedia( { sources: signedAnswer.sources, poster: '' }, saved ).poster ).toBe( saved.poster );
	} );
} );

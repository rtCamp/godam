/**
 * Internal dependencies
 */
import TranscriptManager from './transcriptManager';

const UPLOAD = 'https://site.example/wp-content/uploads/fixed.vtt';
const CACHED = 'https://cdn.example/job/en.vtt';

const CAPTION_TRACKS = [
	{ caption_id: 'es1', language: 'es', label: 'Español', vtt_path: 'https://cdn.example/job/es.vtt', is_default: false },
	{ caption_id: 'en1', language: 'en', label: 'English', vtt_path: CACHED, is_default: true },
	// Still generating: nothing to play yet.
	{ caption_id: 'hi1', language: 'hi', label: 'Hindi', vtt_path: null, is_default: false },
];

/**
 * A manager for a video printed with the given data attributes, whose SaaS
 * request returns `response` (or fails when it is an Error).
 *
 * @param {Object}       dataset  The video's data attributes.
 * @param {Object|Error} response What fetchTranscriptPath resolves or rejects with.
 * @return {{manager: TranscriptManager, added: Array<Object>}} The manager and the tracks it adds.
 */
const setup = ( dataset, response ) => {
	const added = [];
	const player = {
		remoteTextTrackEls: () => added.map( ( track ) => ( { src: track.src } ) ),
		addRemoteTextTrack: ( track ) => added.push( track ),
	};
	const video = { dataset: { job_id: 'job-1', ...dataset } };
	const manager = new TranscriptManager( player, video, {} );
	manager.fetchTranscriptPath = jest.fn( () => (
		response instanceof Error ? Promise.reject( response ) : Promise.resolve( response )
	) );
	return { manager, added };
};

describe( 'TranscriptManager.initialize', () => {
	it( 'adds every ready caption track, default first, and skips ones still generating', async () => {
		const { manager, added } = setup( { transcriptUrl: CACHED }, { exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS } );

		await manager.initialize();

		expect( added.map( ( track ) => [ track.srclang, track.label, track.src ] ) ).toEqual( [
			[ 'en', 'English', CACHED ],
			[ 'es', 'Español', 'https://cdn.example/job/es.vtt' ],
		] );
		expect( manager.transcriptUrl ).toBe( CACHED );
	} );

	it( 'puts a transcript uploaded in WordPress first, then the GoDAM tracks', async () => {
		const { manager, added } = setup(
			{ transcriptUrl: UPLOAD, transcriptSource: 'upload' },
			{ exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS },
		);

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [ UPLOAD, CACHED, 'https://cdn.example/job/es.vtt' ] );
		expect( manager.transcriptUrl ).toBe( UPLOAD );
	} );

	it( 'does not play a stale cached copy when GoDAM has no ready caption', async () => {
		const { manager, added } = setup(
			{ transcriptUrl: CACHED },
			{ exists: false, caption_tracks: [ { caption_id: 'en1', vtt_path: null, is_default: true } ] },
		);

		await manager.initialize();

		expect( added ).toEqual( [] );
	} );

	it( 'falls back to the cached transcript when the GoDAM request fails', async () => {
		const { manager, added } = setup( { transcriptUrl: CACHED }, new Error( 'HTTP 503' ) );

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [ CACHED ] );
	} );

	it( 'uses the single legacy transcript from an older GoDAM response', async () => {
		const { manager, added } = setup( {}, { exists: true, url: CACHED } );

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [ CACHED ] );
	} );

	it( 'shows nothing after the transcript was deleted in the editor', async () => {
		const { manager, added } = setup( { transcriptDeleted: 'true' }, { exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS } );

		await manager.initialize();

		expect( added ).toEqual( [] );
		expect( manager.fetchTranscriptPath ).not.toHaveBeenCalled();
	} );
} );

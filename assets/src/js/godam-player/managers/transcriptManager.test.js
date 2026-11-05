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
 * @param {Object}       dataset        The video's data attributes.
 * @param {Object|Error} response       What fetchTranscriptPath resolves or rejects with.
 * @param {Object}       configManager  The player config (showCaption turns the default on).
 * @param {Array|null}   signedCaptions Signed caption tracks from the site's playback route.
 * @return {{manager: TranscriptManager, added: Array<Object>}} The manager and the tracks it adds.
 */
const setup = ( dataset, response, configManager = {}, signedCaptions = null ) => {
	const added = [];
	const player = {
		remoteTextTrackEls: () => added.map( ( track ) => ( { src: track.src, track } ) ),
		// Like video.js's auto-enable, the first track added starts out showing.
		addRemoteTextTrack: ( track ) => added.push( { ...track, mode: added.length ? 'disabled' : 'showing' } ),
		textTracks: () => added,
	};
	const video = { dataset: { job_id: 'job-1', ...dataset } };
	const manager = new TranscriptManager( player, video, configManager, signedCaptions );
	manager.fetchTranscriptPath = jest.fn( () => (
		response instanceof Error ? Promise.reject( response ) : Promise.resolve( response )
	) );
	return { manager, added };
};

describe( 'TranscriptManager.trackSrc', () => {
	const manager = new TranscriptManager( {}, { dataset: {} }, {} );

	it( 'adds the revision to an unsigned URL so an edit reaches visitors', () => {
		expect( manager.trackSrc( { vtt_path: 'https://cdn.example/job/en.vtt', revision: '3' } ) ).toBe( 'https://cdn.example/job/en.vtt?rev=3' );
	} );

	it( 'leaves a signed URL as it is: the CDN refuses a parameter its token does not cover', () => {
		const signed = 'https://cdn.example/private/p/en.vtt?token=abc&expires=1';
		expect( manager.trackSrc( { vtt_path: signed, revision: '3' } ) ).toBe( signed );
	} );
} );

describe( 'TranscriptManager.initialize', () => {
	it( 'uses the signed caption tracks of a file served signed, without asking the public endpoint', async () => {
		const signed = CAPTION_TRACKS.map( ( track ) => ( track.vtt_path ? { ...track, vtt_path: `${ track.vtt_path }?token=t` } : track ) );
		const { manager, added } = setup( { transcriptUrl: CACHED }, new Error( 'refused' ), {}, signed );

		await manager.initialize();

		expect( manager.fetchTranscriptPath ).not.toHaveBeenCalled();
		expect( added.map( ( track ) => track.src ) ).toEqual( [ `${ CACHED }?token=t`, 'https://cdn.example/job/es.vtt?token=t' ] );
		expect( manager.transcriptUrl ).toBe( `${ CACHED }?token=t` );
	} );

	it( 'adds every ready caption track A to Z and skips ones still generating', async () => {
		const { manager, added } = setup( { transcriptUrl: CACHED }, { exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS } );

		await manager.initialize();

		expect( added.map( ( track ) => [ track.srclang, track.label, track.src ] ) ).toEqual( [
			[ 'en', 'English', CACHED ],
			[ 'es', 'Español', 'https://cdn.example/job/es.vtt' ],
		] );
		expect( manager.transcriptUrl ).toBe( CACHED );
	} );

	it( 'keeps the menu A to Z and switches on the default track, wherever it sorts', async () => {
		const { manager, added } = setup(
			{},
			{
				exists: true,
				caption_tracks: [
					{ caption_id: 's', language: 'es', label: 'Spanish', vtt_path: 'https://cdn.example/job/es.vtt', is_default: true },
					{ caption_id: 'h', language: 'hi', label: 'hindi', vtt_path: 'https://cdn.example/job/hi.vtt', is_default: false },
					{ caption_id: 'e', language: 'en', label: 'English', vtt_path: CACHED, is_default: false },
				],
			},
			{ videoSetupOptions: { showCaption: true } },
		);

		await manager.initialize();

		expect( added.map( ( track ) => [ track.label, track.mode ] ) ).toEqual( [
			[ 'English', 'disabled' ],
			[ 'hindi', 'disabled' ],
			[ 'Spanish', 'showing' ],
		] );
		expect( manager.transcriptUrl ).toBe( 'https://cdn.example/job/es.vtt' );
	} );

	it( 'gives each edit of a track its own address, so browsers do not replay old text', async () => {
		const { manager, added } = setup(
			{},
			{
				exists: true,
				caption_tracks: [
					{ caption_id: 'e', language: 'en', label: 'English', vtt_path: CACHED, is_default: true, revision: '2026-11-05 13:53:38.730957' },
					{ caption_id: 's', language: 'es', label: 'Spanish', vtt_path: 'https://cdn.example/job/es.vtt?token=a', is_default: false, revision: 'r 2' },
				],
			},
		);

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [
			`${ CACHED }?rev=2026-11-05%2013%3A53%3A38.730957`,
			// Signed: already unique per signature, and the CDN refuses an extra parameter.
			'https://cdn.example/job/es.vtt?token=a',
		] );
		expect( manager.transcriptUrl ).toBe( `${ CACHED }?rev=2026-11-05%2013%3A53%3A38.730957` );
	} );

	it( 'puts a transcript uploaded in WordPress first, then the GoDAM tracks', async () => {
		const { manager, added } = setup(
			{ transcriptUrl: UPLOAD, transcriptSource: 'upload' },
			{ exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS },
		);

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [ UPLOAD, CACHED, 'https://cdn.example/job/es.vtt' ] );
		expect( added.find( ( track ) => track.mode === 'showing' )?.src ).toBe( UPLOAD );
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

	it( 'drops only the deleted WordPress copy: Central\'s caption tracks still play', async () => {
		const { manager, added } = setup(
			{ transcriptDeleted: 'true', transcriptUrl: UPLOAD, transcriptSource: 'upload' },
			{ exists: true, url: CACHED, caption_tracks: CAPTION_TRACKS },
		);

		await manager.initialize();

		expect( added.map( ( track ) => track.src ) ).toEqual( [ CACHED, 'https://cdn.example/job/es.vtt' ] );
	} );

	it( 'falls back to nothing after a delete when Central cannot be reached', async () => {
		const { manager, added } = setup( { transcriptDeleted: 'true', transcriptUrl: CACHED }, new Error( 'offline' ) );

		await manager.initialize();

		expect( added ).toEqual( [] );
	} );

	it( 'does not bring back the single legacy transcript after a delete', async () => {
		const { manager, added } = setup( { transcriptDeleted: 'true' }, { exists: true, url: CACHED } );

		await manager.initialize();

		expect( added ).toEqual( [] );
	} );
} );

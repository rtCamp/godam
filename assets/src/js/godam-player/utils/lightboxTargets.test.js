/**
 * Internal dependencies
 */
import {
	buildEmbedUrl,
	buildLightboxHash,
	findVideoById,
	getLightboxId,
	getLightboxRoot,
	isLightboxVideo,
	parseLightboxHash,
	parseStartTime,
} from './lightboxTargets';

describe( 'parseLightboxHash', () => {
	it( 'reads the ID out of a lightbox hash', () => {
		expect( parseLightboxHash( '#godam-video-4595' ) ).toBe( '4595' );
	} );

	it( 'accepts a hash without the leading #', () => {
		expect( parseLightboxHash( 'godam-video-4595' ) ).toBe( '4595' );
	} );

	it( 'handles non-numeric job IDs', () => {
		expect( parseLightboxHash( '#godam-video-abc-123-def' ) ).toBe( 'abc-123-def' );
	} );

	it( 'ignores hashes that are not lightbox links', () => {
		expect( parseLightboxHash( '#comments' ) ).toBeNull();
		expect( parseLightboxHash( '#godam-gallery-3' ) ).toBeNull();
	} );

	it( 'rejects an empty ID', () => {
		expect( parseLightboxHash( '#godam-video-' ) ).toBeNull();
		expect( parseLightboxHash( '#godam-video-   ' ) ).toBeNull();
	} );

	it( 'tolerates missing and non-string input', () => {
		expect( parseLightboxHash( '' ) ).toBeNull();
		expect( parseLightboxHash( null ) ).toBeNull();
		expect( parseLightboxHash( undefined ) ).toBeNull();
		expect( parseLightboxHash( 42 ) ).toBeNull();
	} );

	it( 'round-trips with buildLightboxHash', () => {
		expect( parseLightboxHash( buildLightboxHash( 4595 ) ) ).toBe( '4595' );
	} );
} );

describe( 'parseStartTime', () => {
	it( 'parses positive seconds', () => {
		expect( parseStartTime( '42' ) ).toBe( 42 );
		expect( parseStartTime( 42 ) ).toBe( 42 );
		expect( parseStartTime( '12.5' ) ).toBe( 12.5 );
	} );

	it( 'rejects zero and negative values', () => {
		// A `?t=0` carries no information, so it is treated as absent.
		expect( parseStartTime( '0' ) ).toBeNull();
		expect( parseStartTime( '-5' ) ).toBeNull();
	} );

	it( 'rejects unparseable values', () => {
		expect( parseStartTime( 'abc' ) ).toBeNull();
		expect( parseStartTime( '' ) ).toBeNull();
		expect( parseStartTime( null ) ).toBeNull();
		expect( parseStartTime( undefined ) ).toBeNull();
	} );
} );

describe( 'buildEmbedUrl', () => {
	it( 'builds the embed URL with attribution params', () => {
		const url = new URL(
			buildEmbedUrl( {
				embedBaseUrl: 'https://example.com/',
				id: 4595,
				hostPostId: 12,
			} ),
		);

		expect( url.origin + url.pathname ).toBe( 'https://example.com/' );
		expect( url.searchParams.get( 'godam_page' ) ).toBe( 'video-embed' );
		expect( url.searchParams.get( 'id' ) ).toBe( '4595' );
		expect( url.searchParams.get( 'host_post_id' ) ).toBe( '12' );
		expect( url.searchParams.get( 'block_source' ) ).toBe( 'lightbox-trigger' );
		expect( url.searchParams.get( 't' ) ).toBeNull();
	} );

	it( 'includes a start time when one is given', () => {
		const url = new URL( buildEmbedUrl( { embedBaseUrl: 'https://example.com/', id: 1, startTime: 42 } ) );
		expect( url.searchParams.get( 't' ) ).toBe( '42' );
	} );

	it( 'omits host_post_id when there is no host post', () => {
		const url = new URL( buildEmbedUrl( { embedBaseUrl: 'https://example.com/', id: 1, hostPostId: '' } ) );
		expect( url.searchParams.has( 'host_post_id' ) ).toBe( false );
	} );

	it( 'appends to a base URL that already has a query string', () => {
		// Sites without pretty permalinks have base URLs like /?page_id=2.
		const url = buildEmbedUrl( { embedBaseUrl: 'https://example.com/?lang=fr', id: 7 } );
		expect( url ).toContain( '?lang=fr&' );
		expect( new URL( url ).searchParams.get( 'lang' ) ).toBe( 'fr' );
		expect( new URL( url ).searchParams.get( 'id' ) ).toBe( '7' );
	} );

	it( 'allows overriding the attribution source', () => {
		const url = new URL( buildEmbedUrl( { embedBaseUrl: '/', id: 1, blockSource: 'custom' } ), 'https://e.com' );
		expect( url.searchParams.get( 'block_source' ) ).toBe( 'custom' );
	} );
} );

describe( 'findVideoById', () => {
	const render = ( html ) => {
		document.body.innerHTML = html;
		return document;
	};

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'resolves the job ID in preference to the attachment ID', () => {
		// A share link carries the job ID, so it must win when both exist and the
		// same value appears as another video's attachment ID.
		const doc = render( `
			<video id="by-attachment" data-id="777"></video>
			<video id="by-job" data-job_id="777"></video>
		` );

		expect( findVideoById( '777', doc ).id ).toBe( 'by-job' );
	} );

	it( 'falls back to the attachment ID', () => {
		const doc = render( '<video id="only-attachment" data-id="4595"></video>' );
		expect( findVideoById( '4595', doc ).id ).toBe( 'only-attachment' );
	} );

	it( 'accepts a numeric ID', () => {
		const doc = render( '<video id="v" data-id="4595"></video>' );
		expect( findVideoById( 4595, doc ).id ).toBe( 'v' );
	} );

	it( 'returns null when the video is not on the page', () => {
		const doc = render( '<video data-id="1"></video>' );
		expect( findVideoById( '4595', doc ) ).toBeNull();
	} );

	it( 'returns null for a missing ID rather than matching the first video', () => {
		const doc = render( '<video data-id="1"></video>' );
		expect( findVideoById( '', doc ) ).toBeNull();
		expect( findVideoById( null, doc ) ).toBeNull();
		expect( findVideoById( undefined, doc ) ).toBeNull();
	} );

	it( 'does not break on an ID containing CSS-special characters', () => {
		const doc = render( '<video id="v" data-job_id="job.with:weird[chars]"></video>' );
		expect( findVideoById( 'job.with:weird[chars]', doc ).id ).toBe( 'v' );
	} );

	it( 'prefers a lightbox player over an inline copy of the same video', () => {
		// The inline copy comes first in document order, but only the lightbox one
		// can be re-used by a trigger.
		const doc = render( `
			<video id="inline" data-id="4595" data-show-in-lightbox="false"></video>
			<video id="lightbox" data-id="4595" data-show-in-lightbox="true"></video>
		` );

		expect( findVideoById( '4595', doc ).id ).toBe( 'lightbox' );
	} );

	it( 'prefers the lightbox player even after it has been moved to the end of the document', () => {
		// This is the state during an open: the overlay is appended to <body>, so
		// the lightbox player sits after the inline copy. Relying on document order
		// here would resolve to the inline copy and drop to an iframe.
		const doc = render( `
			<div id="content"><video id="inline" data-id="4595" data-show-in-lightbox="false"></video></div>
			<div class="godam-player-modal-video">
				<video id="lightbox" data-id="4595" data-show-in-lightbox="true"></video>
			</div>
		` );

		expect( findVideoById( '4595', doc ).id ).toBe( 'lightbox' );
	} );

	it( 'falls back to the first match when none is a lightbox player', () => {
		const doc = render( `
			<video id="first" data-id="4595" data-show-in-lightbox="false"></video>
			<video id="second" data-id="4595" data-show-in-lightbox="false"></video>
		` );

		expect( findVideoById( '4595', doc ).id ).toBe( 'first' );
	} );

	it( 'still prefers the job ID over the attachment ID across both passes', () => {
		const doc = render( `
			<video id="by-attachment" data-id="777" data-show-in-lightbox="true"></video>
			<video id="by-job" data-job_id="777" data-show-in-lightbox="false"></video>
		` );

		// The job-ID pass wins outright, even though its match is not a lightbox
		// player and the attachment-ID match is.
		expect( findVideoById( '777', doc ).id ).toBe( 'by-job' );
	} );
} );

describe( 'getLightboxRoot', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'returns the div above the figure, which carries the CSS custom properties', () => {
		// The real template nesting: div > figure > div.godam-video-wrapper > video.
		document.body.innerHTML = `
			<div id="outer">
				<figure>
					<div class="godam-video-wrapper"><video id="v"></video></div>
				</figure>
			</div>
		`;

		expect( getLightboxRoot( document.getElementById( 'v' ) ).id ).toBe( 'outer' );
	} );

	it( 'falls back to the wrapper when there is no figure', () => {
		document.body.innerHTML = '<div class="godam-video-wrapper" id="wrapper"><video id="v"></video></div>';
		expect( getLightboxRoot( document.getElementById( 'v' ) ).id ).toBe( 'wrapper' );
	} );

	it( 'returns null for a video with neither', () => {
		document.body.innerHTML = '<video id="v"></video>';
		expect( getLightboxRoot( document.getElementById( 'v' ) ) ).toBeNull();
	} );

	it( 'returns null for a missing video', () => {
		expect( getLightboxRoot( null ) ).toBeNull();
	} );
} );

describe( 'getLightboxId', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	const videoWith = ( attrs ) => {
		document.body.innerHTML = `<video id="v" ${ attrs }></video>`;
		return document.getElementById( 'v' );
	};

	it( 'prefers the WordPress attachment ID over the job ID', () => {
		expect( getLightboxId( videoWith( 'data-id="4595" data-job_id="7hq7u3oht1"' ) ) ).toBe( '4595' );
	} );

	it( 'falls back to the job ID for virtual media, which has no local attachment', () => {
		expect( getLightboxId( videoWith( 'data-id="" data-job_id="7hq7u3oht1"' ) ) ).toBe( '7hq7u3oht1' );
		expect( getLightboxId( videoWith( 'data-job_id="7hq7u3oht1"' ) ) ).toBe( '7hq7u3oht1' );
	} );

	it( 'returns null when the video carries neither', () => {
		expect( getLightboxId( videoWith( '' ) ) ).toBeNull();
		expect( getLightboxId( null ) ).toBeNull();
	} );

	it( 'produces an ID that findVideoById can resolve back', () => {
		const video = videoWith( 'data-id="4595" data-job_id="7hq7u3oht1"' );
		expect( findVideoById( getLightboxId( video ), document ) ).toBe( video );
	} );
} );

describe( 'isLightboxVideo', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	const videoWith = ( attrs ) => {
		document.body.innerHTML = `<video id="v" ${ attrs }></video>`;
		return document.getElementById( 'v' );
	};

	it( 'is true only for an opted-in lightbox player', () => {
		expect( isLightboxVideo( videoWith( 'data-show-in-lightbox="true"' ) ) ).toBe( true );
	} );

	it( 'is false for an ordinary inline player', () => {
		// The template always renders the attribute, as "false" when off.
		expect( isLightboxVideo( videoWith( 'data-show-in-lightbox="false"' ) ) ).toBe( false );
		expect( isLightboxVideo( videoWith( '' ) ) ).toBe( false );
	} );

	it( 'is false for a missing video', () => {
		expect( isLightboxVideo( null ) ).toBe( false );
		expect( isLightboxVideo( undefined ) ).toBe( false );
	} );
} );

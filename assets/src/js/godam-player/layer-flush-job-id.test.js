/**
 * Both buffered layer-event flushes (the video player bundle's and the image-page
 * runtime's) send the job id WordPress already has for the media, read from the
 * element that carries its `data-id`. A layer event stored without it is later
 * rewritten by the job-id backfill, and every summary keyed on job_id has to follow.
 */
/**
 * Internal dependencies
 */
import { initLayerAnalytics } from './layer-analytics-runtime';

// Same reason as layer-analytics-runtime.test.js: point jest at the client build of
// @analytics/core, the one webpack bundles.
jest.mock( '@analytics/core', () => jest.requireActual( '@analytics/core/client' ) );

const hotspotClick = {
	layer_id: 'layer-1',
	layer_type: 'hotspot',
	action_type: 'clicked',
	layer_timestamp: 0,
};

// A new page load: the window globals are gone, browser storage survives.
const reloadPage = () => {
	delete window.analytics;
	delete window.GoDAM;
	delete window.godamLayerFlushBound;
};

// Run the real video-player analytics module (the godam-player-analytics bundle)
// from a fresh module registry, like its own <script> on the page.
const loadPlayerBundle = () => {
	jest.isolateModules( () => {
		require( './analytics' );
	} );
};

const sentBodies = () => global.fetch.mock.calls.map( ( call ) => JSON.parse( call[ 1 ].body ) );

beforeEach( () => {
	reloadPage();
	localStorage.clear();
	sessionStorage.clear();
	window.videoAnalyticsParams = { endpoint: 'https://analytics.test', token: 'acct-token' };
	global.fetch = jest.fn( () => Promise.resolve( { ok: true } ) );
} );

afterEach( () => {
	document.body.innerHTML = '';
	delete window.videoAnalyticsParams;
} );

describe( 'image-page runtime flush', () => {
	it( "sends the image frame's job id with its hotspot events", () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="31" data-job_id="img31job" data-block-source="godam-image"></div>';
		initLayerAnalytics();

		window.GoDAM.addLayerInteraction( '31', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies() ).toHaveLength( 1 );
		expect( sentBodies()[ 0 ] ).toMatchObject( { type: 3, video_id: 31, job_id: 'img31job' } );
	} );

	it( 'sends no job id when the frame has none', () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="31" data-job_id="" data-block-source="godam-image"></div>';
		initLayerAnalytics();

		window.GoDAM.addLayerInteraction( '31', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies()[ 0 ].video_id ).toBe( 31 );
		expect( sentBodies()[ 0 ] ).not.toHaveProperty( 'job_id' );
	} );

	it( "sends a video's job id when the runtime flushes a video's events", () => {
		document.body.innerHTML = '<div class="video-js" data-id="7" data-job_id="vid7job"></div>';
		initLayerAnalytics();

		window.GoDAM.addLayerInteraction( '7', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies()[ 0 ] ).toMatchObject( { video_id: 7, job_id: 'vid7job' } );
	} );
} );

describe( 'video player bundle flush', () => {
	it( "sends the video's job id with its layer events", () => {
		document.body.innerHTML =
			'<div class="easydam-player video-js" data-id="7" data-job_id="vid7job" data-block-source="video-block"></div>';
		loadPlayerBundle();

		window.GoDAM.addLayerInteraction( '7', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies() ).toHaveLength( 1 );
		expect( sentBodies()[ 0 ] ).toMatchObject( { type: 3, video_id: 7, job_id: 'vid7job' } );
	} );

	it( 'sends no job id when the video has none', () => {
		document.body.innerHTML = '<div class="easydam-player video-js" data-id="7" data-job_id=""></div>';
		loadPlayerBundle();

		window.GoDAM.addLayerInteraction( '7', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies()[ 0 ].video_id ).toBe( 7 );
		expect( sentBodies()[ 0 ] ).not.toHaveProperty( 'job_id' );
	} );

	it( "sends an image frame's job id on a page that also has a video", () => {
		document.body.innerHTML =
			'<div class="easydam-player video-js" data-id="7" data-job_id="vid7job"></div>' +
			'<div class="godam-image__frame" data-id="31" data-job_id="img31job" data-block-source="godam-image"></div>';
		loadPlayerBundle();

		window.GoDAM.addLayerInteraction( '31', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies()[ 0 ] ).toMatchObject( { video_id: 31, job_id: 'img31job', block_source: 'godam-image' } );
	} );

	it( 'keeps sending a job-id key as the job id (Central-hosted media)', () => {
		document.body.innerHTML = '<div class="easydam-player video-js" data-job_id="centraljob1"></div>';
		loadPlayerBundle();

		window.GoDAM.addLayerInteraction( 'centraljob1', hotspotClick );
		window.GoDAM.flushLayerInteractions();

		expect( sentBodies()[ 0 ] ).toMatchObject( { video_id: 0, job_id: 'centraljob1' } );
	} );
} );

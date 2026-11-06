/**
 * Internal dependencies
 */
import TranscriptPanelManager from './transcriptPanelManager';
import { computeTranscriptLayout } from '../utils/transcriptPanelLayout';

// measureLayout() only reads the DOM; Video.js is not needed for it.
jest.mock( 'video.js', () => ( {
	__esModule: true,
	default: { getComponent: jest.fn() },
} ) );

/**
 * Give a jsdom element the layout sizes a browser would report.
 *
 * @param {HTMLElement} el      Element.
 * @param {Object}      sizes   Sizes in px.
 * @param {number}      sizes.w Width (offsetWidth and clientWidth).
 * @param {number}      sizes.h Height (offsetHeight).
 */
const setSize = ( el, { w = 0, h = 0 } ) => {
	Object.defineProperty( el, 'offsetWidth', { configurable: true, get: () => w } );
	Object.defineProperty( el, 'clientWidth', { configurable: true, get: () => w } );
	Object.defineProperty( el, 'offsetHeight', { configurable: true, get: () => h } );
};

/**
 * A 9:16 block (338x600, Player Height 600px) in a 1140px parent with the
 * given inline style, and a manager pointed at it. Markup mirrors
 * inc/templates/godam-player.php: root > figure > wrapper > container > player.
 *
 * @param {string} parentStyle Inline style for the block's parent.
 * @return {TranscriptPanelManager} A manager with only its DOM fields set.
 */
const setup = ( parentStyle ) => {
	document.body.innerHTML = `
		<div class="parent" style="${ parentStyle }">
			<div class="wp-block-godam-video">
				<figure>
					<div class="godam-video-wrapper">
						<div class="easydam-video-container"><div class="video-js"></div></div>
					</div>
				</figure>
			</div>
			<p>Text sharing the row with the video.</p>
		</div>`;
	setSize( document.querySelector( '.parent' ), { w: 1140 } );
	setSize( document.querySelector( '.wp-block-godam-video' ), { w: 338 } );
	setSize( document.querySelector( '.easydam-video-container' ), { w: 338, h: 600 } );
	setSize( document.querySelector( '.video-js' ), { w: 338, h: 600 } );

	const manager = Object.create( TranscriptPanelManager.prototype );
	manager.wrapper = document.querySelector( '.godam-video-wrapper' );
	manager.container = document.querySelector( '.easydam-video-container' );
	manager.player = { el: () => document.querySelector( '.video-js' ) };
	return manager;
};

describe( 'TranscriptPanelManager.measureLayout', () => {
	it( 'lets the block widen into the free width of a normal column', () => {
		const geometry = setup( '' ).measureLayout();

		expect( geometry ).toMatchObject( { stageWidth: 338, stageHeight: 600, room: 1140 } );
		expect( computeTranscriptLayout( geometry ).mode ).toBe( 'side' );
	} );

	it.each( [ 'flex', 'inline-flex', 'grid', 'inline-grid' ] )(
		'gives no room to widen in a %s parent, so the panel stacks beneath the video',
		( display ) => {
			// A Row or Grid group: widening the root there only gets it squeezed
			// by its siblings, which collapsed the video and put the panel over
			// the text beside it.
			const geometry = setup( `display: ${ display }` ).measureLayout();

			expect( geometry.room ).toBe( 338 );
			expect( computeTranscriptLayout( geometry ).mode ).toBe( 'below' );
		},
	);
} );

/**
 * A manager with a toggle button and a panel that has a close button. The
 * layout work open() and close() trigger is stubbed out.
 *
 * @return {TranscriptPanelManager} A manager with only its DOM fields set.
 */
const setupToggle = () => {
	document.body.innerHTML = `
		<div class="godam-video-wrapper">
			<div class="easydam-video-container">
				<button class="godam-transcript-button" aria-expanded="false"></button>
			</div>
			<div class="godam-transcript-panel" hidden>
				<input type="search" />
				<button class="godam-transcript-panel__close"></button>
			</div>
		</div>`;
	const manager = Object.create( TranscriptPanelManager.prototype );
	manager.wrapper = document.querySelector( '.godam-video-wrapper' );
	manager.container = document.querySelector( '.easydam-video-container' );
	manager.button = document.querySelector( '.godam-transcript-button' );
	manager.panel = document.querySelector( '.godam-transcript-panel' );
	manager.closeButton = document.querySelector( '.godam-transcript-panel__close' );
	manager.player = { el: () => null };
	[ 'applyLayout', 'observeLayout', 'handleTimeUpdate', 'unobserveLayout', 'clearLayout', 'notifyPlayerResize' ].forEach( ( name ) => {
		manager[ name ] = jest.fn();
	} );
	return manager;
};

describe( 'TranscriptPanelManager toggle button', () => {
	it( 'is hidden while the panel is open and shown again when it closes', () => {
		const manager = setupToggle();

		manager.open();
		expect( manager.panel.hidden ).toBe( false );
		expect( manager.button.hidden ).toBe( true );

		manager.close();
		expect( manager.panel.hidden ).toBe( true );
		expect( manager.button.hidden ).toBe( false );
	} );

	it( 'hands focus to the close button when the toggle had it, and back when closed', () => {
		const manager = setupToggle();

		manager.button.focus();
		manager.open();
		expect( document.activeElement ).toBe( manager.closeButton );

		manager.close();
		expect( manager.button.hidden ).toBe( false );
		expect( document.activeElement ).toBe( manager.button );
	} );

	it( 'leaves focus alone when the toggle did not have it', () => {
		const manager = setupToggle();
		const search = manager.panel.querySelector( 'input' );

		manager.open();
		expect( document.activeElement ).toBe( document.body );

		search.focus();
		manager.close();
		expect( document.activeElement ).toBe( manager.button );
	} );
} );

describe( 'TranscriptPanelManager.resolveTranscriptUrl', () => {
	// Only the fields resolveTranscriptUrl reads, as the constructor sets them.
	const manager = ( dataset, signedCaptions ) => {
		const m = Object.create( TranscriptPanelManager.prototype );
		m.jobId = 'job-1';
		m.localTranscriptUrl = dataset.transcriptUrl || '';
		m.signedCaptions = signedCaptions;
		return m;
	};

	afterEach( () => {
		delete global.fetch;
	} );

	it( 'uses the default signed track of a file served signed, without asking the public endpoint', async () => {
		global.fetch = jest.fn();
		const signed = [
			{ language: 'es', label: 'Español', vtt_path: 'https://cdn.test/private/p/es.vtt?token=a', is_default: false },
			{ language: 'en', label: 'English', vtt_path: 'https://cdn.test/private/p/en.vtt?token=b', is_default: true },
		];
		expect( await manager( {}, signed ).resolveTranscriptUrl() ).toBe( 'https://cdn.test/private/p/en.vtt?token=b' );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'still prefers the transcript stored on the attachment', async () => {
		global.fetch = jest.fn();
		const url = await manager( { transcriptUrl: 'https://site.test/uploads/t.vtt' }, [ { vtt_path: 'x', is_default: true } ] ).resolveTranscriptUrl();
		expect( url ).toBe( 'https://site.test/uploads/t.vtt' );
	} );

	it( 'shows no transcript, and asks nothing, while a signed file\'s tracks aren\'t ready', async () => {
		global.fetch = jest.fn();
		expect( await manager( {}, [ { vtt_path: '', is_default: true } ] ).resolveTranscriptUrl() ).toBeNull();
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'keeps the signed tracks the player hands it, and none by default', () => {
		const video = document.createElement( 'video' );
		const tracks = [ { vtt_path: 'https://cdn.test/private/p/en.vtt?token=b' } ];
		expect( new TranscriptPanelManager( {}, video, {}, tracks ).signedCaptions ).toBe( tracks );
		expect( new TranscriptPanelManager( {}, video ).signedCaptions ).toBeNull();
	} );

	it( 'asks the public endpoint when the route sent no tracks', async () => {
		global.fetch = jest.fn( () => Promise.resolve( { ok: true, json: () => Promise.resolve( { message: { exists: true, url: 'https://cdn.test/job/t.vtt' } } ) } ) );
		expect( await manager( {}, null ).resolveTranscriptUrl() ).toBe( 'https://cdn.test/job/t.vtt' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );
} );

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

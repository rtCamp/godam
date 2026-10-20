/**
 * Internal dependencies
 */
import ControlsManager from './controlsManager';

// Only moveVideoControls() is exercised here; it reads the DOM and needs no
// real Video.js. Modules imported alongside it extend Video.js components at
// load time, so hand them a plain class.
jest.mock( 'video.js', () => ( {
	__esModule: true,
	default: {
		getComponent: jest.fn( () => class {} ),
		registerComponent: jest.fn(),
		getPlayer: jest.fn( () => null ),
	},
} ) );

// The settings menu pulls in a dependency jest cannot load; it is not used here.
jest.mock( '../masterSettings.js', () => ( { __esModule: true, default: class {} } ) );

/**
 * Give a jsdom element the layout size a browser would report.
 *
 * @param {HTMLElement} el      Element.
 * @param {Object}      sizes   Sizes in px.
 * @param {number}      sizes.w Width.
 * @param {number}      sizes.h Height.
 */
const setSize = ( el, { w, h } ) => {
	Object.defineProperty( el, 'offsetWidth', { configurable: true, get: () => w } );
	Object.defineProperty( el, 'offsetHeight', { configurable: true, get: () => h } );
};

/**
 * A narrow player (390x844, a phone in portrait fullscreen) whose video is
 * `videoHeight` tall, and a manager pointed at it.
 *
 * @param {string} skin        Player skin.
 * @param {number} videoHeight Height of the video element.
 * @return {Object} The manager and the player element.
 */
const setup = ( skin, videoHeight ) => {
	document.body.innerHTML = `
		<div class="video-js">
			<video class="vjs-tech"></video>
			<div class="vjs-control-bar">
				<button class="vjs-skip-backward-10"></button>
				<button class="vjs-play-control"></button>
				<button class="vjs-skip-forward-10"></button>
			</div>
		</div>`;
	const playerEl = document.querySelector( '.video-js' );
	setSize( playerEl, { w: 390, h: 844 } );
	setSize( playerEl.querySelector( '.vjs-tech' ), { w: 390, h: videoHeight } );

	const manager = Object.create( ControlsManager.prototype );
	manager.player = { el_: playerEl };
	manager.config = { videoSetupOptions: { playerSkin: skin } };
	return { manager, playerEl };
};

const skipBottoms = ( playerEl ) =>
	[ ...playerEl.querySelectorAll( '.vjs-skip-backward-10, .vjs-skip-forward-10' ) ].map( ( b ) => b.style.bottom );

describe( 'ControlsManager.moveVideoControls', () => {
	it( 'centres the skip buttons on a video that fills the player', () => {
		const { manager, playerEl } = setup( 'Default', 844 );
		manager.moveVideoControls();

		// 844 / 2 - 20, the same as before this change.
		expect( skipBottoms( playerEl ) ).toEqual( [ '402px', '402px' ] );
	} );

	it( 'centres the skip buttons on the video above an open transcript panel', () => {
		// Portrait fullscreen with the transcript open: the panel takes the
		// bottom 45% of the screen, so the video is 464px of the 844px player.
		const { manager, playerEl } = setup( 'Default', 464 );
		manager.moveVideoControls();

		// 464 / 2 - 20, measured from the control bar, which sits on the video's
		// bottom edge; centring on the full player put them at the top.
		expect( skipBottoms( playerEl ) ).toEqual( [ '212px', '212px' ] );
	} );

	it( 'centres the Pills skin controls on the video above an open transcript panel', () => {
		const { manager, playerEl } = setup( 'Pills', 464 );
		manager.moveVideoControls();

		const wrapper = playerEl.querySelector( '.godam-central-controls' );
		expect( wrapper.style.bottom ).toBe( '217px' );
		expect( wrapper.style.left ).toBe( '97.5px' );
	} );
} );

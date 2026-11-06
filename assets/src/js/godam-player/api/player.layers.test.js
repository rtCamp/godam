/**
 * Layer API (#2294, RFC D5): layers created with `GoDAMAPI.createLayer()` run
 * on the same lifecycle as saved layers, so hover-preview suppression applies.
 */

/**
 * Internal dependencies
 */
import Player from './player.js';
import { createLayerHost } from '../../godam-layers/runtime/host.js';

/**
 * A Video.js stand-in that lets the test fire `timeupdate`.
 *
 * @return {Object} Fake player with `emit( event )`.
 */
const fakeVideoJs = () => {
	const handlers = {};
	let time = 0;
	return {
		on: ( event, cb ) => ( handlers[ event ] = handlers[ event ] || [] ).push( cb ),
		off: jest.fn(),
		emit: ( event ) => ( handlers[ event ] || [] ).forEach( ( cb ) => cb() ),
		currentTime: ( value ) => {
			if ( value !== undefined ) {
				time = value;
			}
			return time;
		},
		duration: () => 60,
		paused: () => true,
		pause: jest.fn(),
		el: () => document.body,
	};
};

describe( 'GoDAMAPI.createLayer() on the layer lifecycle', () => {
	let videoJs, api, suppressed, host;

	// What videoPlayer.js does on each `timeupdate`: the saved layers' host dispatch.
	const tick = ( time ) => {
		videoJs.currentTime( time );
		videoJs.emit( 'timeupdate' );
		host?.dispatch( 'onTimeUpdate', time );
	};

	beforeEach( () => {
		document.body.innerHTML = '<div class="easydam-video-container"><video data-instance-id="v1"></video></div>';
		videoJs = fakeVideoJs();
		suppressed = false;
		api = new Player( videoJs, document.querySelector( 'video' ) );
	} );

	afterEach( () => {
		host = null;
	} );

	it( 'is driven by the player\'s layer host, and stays hidden while layers are suppressed', () => {
		host = createLayerHost( { player: videoJs, media: { type: 'video' }, isSuppressed: () => suppressed } );
		videoJs.godamLayers = host;
		const layer = api.createLayer( { html: '<p>Hi</p>', displayTime: 2 } );

		suppressed = true;
		tick( 3 );
		tick( 4 );
		expect( layer.classList.contains( 'hidden' ) ).toBe( true );

		suppressed = false;
		tick( 5 );
		expect( layer.classList.contains( 'hidden' ) ).toBe( false );
	} );

	it( 'unmounts from the host when removed', () => {
		host = createLayerHost( { player: videoJs, media: { type: 'video' } } );
		videoJs.godamLayers = host;
		api.createLayer( { html: '<p>Hi</p>', displayTime: 2 } );
		tick( 1 );
		expect( host.getMountedLayers() ).toHaveLength( 1 );

		expect( api.removeAllCustomLayers() ).toBe( 1 );
		expect( host.getMountedLayers() ).toEqual( [] );
	} );

	it( 'still shows on time on a player without a layer host', () => {
		const layer = api.createLayer( { html: '<p>Hi</p>', displayTime: 2 } );
		tick( 1 );
		expect( layer.classList.contains( 'hidden' ) ).toBe( true );
		tick( 2.5 );
		expect( layer.classList.contains( 'hidden' ) ).toBe( false );
	} );
} );

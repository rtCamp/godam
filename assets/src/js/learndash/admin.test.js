/**
 * Tests for the "Use GoDAM Video" switch in the LearnDash settings.
 */

/**
 * Internal dependencies
 */
import { setupUseGoDAMSwitch } from './admin';

const KEY = 'learndash-lesson-display-content-settings';
const CONFIG = {
	field: 'lesson_video_godam',
	blockMarker: '[video_godam]',
	metaboxKeys: [ KEY, 'learndash-topic-display-content-settings' ],
};

/**
 * Render the two LearnDash fields the switch works with.
 *
 * @param {boolean} checked  Whether the switch is on.
 * @param {string}  videoUrl Video URL field value.
 */
function render( checked, videoUrl ) {
	document.body.innerHTML = `
		<input type="checkbox" id="${ KEY }_lesson_video_godam" ${ checked ? 'checked' : '' }>
		<div id="${ KEY }_lesson_video_url_field"><textarea id="${ KEY }_lesson_video_url"></textarea></div>
	`;
	document.getElementById( `${ KEY }_lesson_video_url` ).value = videoUrl;
}

const toggle = () => document.getElementById( `${ KEY }_lesson_video_godam` );
const urlRow = () => document.getElementById( `${ KEY }_lesson_video_url_field` );
const urlInput = () => document.getElementById( `${ KEY }_lesson_video_url` );

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'setupUseGoDAMSwitch', () => {
	it( 'hides the Video URL field while the switch is on', () => {
		render( true, CONFIG.blockMarker );

		expect( setupUseGoDAMSwitch( document, CONFIG ) ).toBe( 1 );
		expect( urlRow().style.display ).toBe( 'none' );
	} );

	it( 'shows the field and clears the GoDAM marker when the switch is turned off', () => {
		render( true, ' [video_godam]\n' );
		setupUseGoDAMSwitch( document, CONFIG );

		toggle().checked = false;
		toggle().dispatchEvent( new Event( 'change' ) );

		expect( urlRow().style.display ).toBe( '' );
		expect( urlInput().value ).toBe( '' );
	} );

	it( 'keeps a real video URL when the switch is off', () => {
		render( false, 'https://www.youtube.com/watch?v=abc' );
		setupUseGoDAMSwitch( document, CONFIG );

		expect( urlRow().style.display ).toBe( '' );
		expect( urlInput().value ).toBe( 'https://www.youtube.com/watch?v=abc' );
	} );

	it( 'does nothing on a screen without the switch', () => {
		document.body.innerHTML = '<div></div>';

		expect( setupUseGoDAMSwitch( document, CONFIG ) ).toBe( 0 );
		expect( setupUseGoDAMSwitch( document, undefined ) ).toBe( 0 );
	} );
} );

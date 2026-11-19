/**
 * Tests for the "Use GoDAM Video" switch and video picker in the LearnDash settings.
 */

/**
 * Internal dependencies
 */
import { isMarker, setupUseGoDAMSwitch, setupVideoPicker } from './admin';

const KEY = 'learndash-lesson-display-content-settings';
const CONFIG = {
	field: 'lesson_video_godam',
	videoField: 'lesson_video_godam_id',
	markerTag: 'video_godam',
	metaboxKeys: [ KEY, 'learndash-topic-display-content-settings' ],
	i18n: { frameTitle: 'Pick', frameButton: 'Use', select: 'Select video', replace: 'Replace' },
};

/**
 * Render the LearnDash fields the switch and picker work with, as the server does.
 *
 * @param {boolean} checked  Whether the switch is on.
 * @param {string}  videoUrl Video URL field value.
 * @param {string}  videoId  Picked attachment ID.
 */
function render( checked, videoUrl, videoId = '' ) {
	document.body.innerHTML = `
		<input type="checkbox" id="${ KEY }_lesson_video_godam" ${ checked ? 'checked' : '' }>
		<div id="${ KEY }_lesson_video_godam_id_field">
			<div class="rtgodam-ld-video-picker${ videoId ? ' is-picked' : '' }" id="${ KEY }_lesson_video_godam_id_picker">
				<input type="hidden" id="${ KEY }_lesson_video_godam_id" name="${ KEY }[lesson_video_godam_id]" value="${ videoId }">
				<div class="rtgodam-ld-video-picker__preview"></div>
				<p class="rtgodam-ld-video-picker__title" ${ videoId ? '' : 'hidden' }>Saved title</p>
				<div class="rtgodam-ld-video-picker__actions">
					<button type="button" class="button rtgodam-ld-video-picker__select">${ videoId ? 'Replace' : 'Select video' }</button>
					<button type="button" class="button rtgodam-ld-video-picker__remove" ${ videoId ? '' : 'hidden' }>Remove</button>
				</div>
			</div>
		</div>
		<div id="${ KEY }_lesson_video_url_field"><textarea id="${ KEY }_lesson_video_url"></textarea></div>
	`;
	document.getElementById( `${ KEY }_lesson_video_url` ).value = videoUrl;
}

const $ = ( suffix ) => document.getElementById( `${ KEY }_${ suffix }` );
const picker = () => $( 'lesson_video_godam_id_picker' );
const pickerPart = ( name ) => picker().querySelector( `.rtgodam-ld-video-picker__${ name }` );

/**
 * A `wp.media` double: the frame it opens and the attachment the test selects.
 *
 * @param {Object} [saved] Attachment the media library returns for a saved ID.
 * @return {Object} `wp`, the frame options and `select()`.
 */
function mediaDouble( saved ) {
	const handlers = {};
	let selected = null;
	const frame = {
		on: ( event, callback ) => {
			handlers[ event ] = callback;
		},
		open: jest.fn(),
		state: () => ( { get: () => ( { first: () => ( { toJSON: () => selected } ) } ) } ),
	};
	const media = jest.fn( () => frame );
	media.attachment = jest.fn( ( id ) => ( {
		fetch: () => Promise.resolve(),
		get: () => saved?.id ?? Number( id ),
		toJSON: () => saved,
	} ) );

	return {
		wp: { media },
		frame,
		select: ( attachment ) => {
			selected = attachment;
			handlers.select();
		},
	};
}

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'isMarker', () => {
	it( 'matches the marker with or without a picked video', () => {
		expect( isMarker( '[video_godam]', 'video_godam' ) ).toBe( true );
		expect( isMarker( ' [video_godam id="12"]\n', 'video_godam' ) ).toBe( true );
		expect( isMarker( '[video_godam id=12]', 'video_godam' ) ).toBe( true );
		expect( isMarker( 'https://www.youtube.com/watch?v=abc', 'video_godam' ) ).toBe( false );
		expect( isMarker( '[video_godam id="a"]', 'video_godam' ) ).toBe( false );
	} );
} );

describe( 'setupUseGoDAMSwitch', () => {
	it( 'shows the picker and hides the Video URL field while the switch is on', () => {
		render( true, '[video_godam]' );

		expect( setupUseGoDAMSwitch( document, CONFIG ) ).toBe( 1 );
		expect( $( 'lesson_video_url_field' ).style.display ).toBe( 'none' );
		expect( $( 'lesson_video_godam_id_field' ).style.display ).toBe( '' );
		expect( $( 'lesson_video_godam' ).getAttribute( 'data-test-id' ) ).toBe( 'godam-learndash-use-godam-switch' );
	} );

	it( 'hides the picker, shows the field and clears the marker when the switch is turned off', () => {
		render( true, '[video_godam id=&quot;12&quot;]', '12' );
		setupUseGoDAMSwitch( document, CONFIG );

		$( 'lesson_video_godam' ).checked = false;
		$( 'lesson_video_godam' ).dispatchEvent( new Event( 'change' ) );

		expect( $( 'lesson_video_url_field' ).style.display ).toBe( '' );
		expect( $( 'lesson_video_godam_id_field' ).style.display ).toBe( 'none' );
		expect( $( 'lesson_video_url' ).value ).toBe( '' );
	} );

	it( 'keeps a real video URL when the switch is off', () => {
		render( false, 'https://www.youtube.com/watch?v=abc' );
		setupUseGoDAMSwitch( document, CONFIG );

		expect( $( 'lesson_video_url' ).value ).toBe( 'https://www.youtube.com/watch?v=abc' );
		expect( $( 'lesson_video_godam_id_field' ).style.display ).toBe( 'none' );
	} );

	it( 'does nothing on a screen without the switch', () => {
		document.body.innerHTML = '<div></div>';

		expect( setupUseGoDAMSwitch( document, CONFIG ) ).toBe( 0 );
		expect( setupUseGoDAMSwitch( document, undefined ) ).toBe( 0 );
	} );
} );

describe( 'setupVideoPicker', () => {
	const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

	it( 'opens the media library limited to videos', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();

		expect( setupVideoPicker( document, CONFIG, media.wp ) ).toBe( 1 );
		pickerPart( 'select' ).click();

		expect( media.wp.media ).toHaveBeenCalledWith( expect.objectContaining( { library: { type: 'video' }, multiple: false } ) );
		expect( media.frame.open ).toHaveBeenCalled();
	} );

	it( 'stores and previews the selected video', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'select' ).click();
		media.select( { id: 55, title: 'Lesson intro', url: 'https://cdn.test/intro.mp4', mime: 'video/mp4' } );

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '55' );
		expect( pickerPart( 'title' ).textContent ).toBe( 'Lesson intro' );
		expect( pickerPart( 'title' ).hidden ).toBe( false );
		expect( pickerPart( 'preview' ).querySelector( 'video' ).getAttribute( 'src' ) ).toBe( 'https://cdn.test/intro.mp4' );
		expect( pickerPart( 'preview' ).querySelector( 'video' ).getAttribute( 'data-test-id' ) ).toBe( 'godam-learndash-video-preview-player' );
		expect( pickerPart( 'select' ).textContent ).toBe( 'Replace' );
		expect( picker().classList.contains( 'is-picked' ) ).toBe( true );
		expect( pickerPart( 'remove' ).hidden ).toBe( false );
	} );

	it( 'ignores an attachment that is not a video', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'select' ).click();
		media.select( { id: 56, title: 'Slides', url: 'https://cdn.test/a.pdf', mime: 'application/pdf' } );

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '' );
	} );

	it( 'removes the selected video', () => {
		render( true, '[video_godam id="55"]', '55' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'remove' ).click();

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '' );
		expect( pickerPart( 'title' ).hidden ).toBe( true );
		expect( pickerPart( 'select' ).textContent ).toBe( 'Select video' );
		expect( pickerPart( 'remove' ).hidden ).toBe( true );
		expect( picker().classList.contains( 'is-picked' ) ).toBe( false );
	} );

	it( 'loads a preview for the saved video', async () => {
		render( true, '[video_godam id="55"]', '55' );
		const media = mediaDouble( { id: 55, title: 'Lesson intro', url: 'https://cdn.test/intro.mp4' } );
		setupVideoPicker( document, CONFIG, media.wp );

		await flush();

		expect( media.wp.media.attachment ).toHaveBeenCalledWith( '55' );
		expect( pickerPart( 'preview' ).querySelector( 'video' ).getAttribute( 'src' ) ).toBe( 'https://cdn.test/intro.mp4' );
	} );

	it( 'swaps a GoDAM tab ID for the WordPress attachment ID once it exists', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'select' ).click();
		media.select( { id: 'qvbgt6hd9u', title: 'From GoDAM', url: 'https://cdn.test/g.m3u8', mime: 'video/mp4' } );

		// Until then the form holds no ID, so a save cannot store the GoDAM ID.
		expect( $( 'lesson_video_godam_id' ).value ).toBe( '' );
		expect( pickerPart( 'title' ).textContent ).toBe( 'From GoDAM' );

		document.dispatchEvent( new CustomEvent( 'godam-virtual-attachment-created', {
			detail: { virtualMediaId: 'qvbgt6hd9u', attachment: { id: 901, title: 'From GoDAM', url: 'https://cdn.test/g.mp4' } },
		} ) );

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '901' );
	} );

	it( 'never puts a GoDAM ID that starts with digits in the form', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'select' ).click();
		media.select( { id: '88o035h31e', title: 'From GoDAM', url: 'https://cdn.test/g.m3u8', mime: 'video/mp4' } );

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '' );
	} );

	it( 'ignores the attachment event for a pick that was replaced', () => {
		render( true, '[video_godam]' );
		const media = mediaDouble();
		setupVideoPicker( document, CONFIG, media.wp );

		pickerPart( 'select' ).click();
		media.select( { id: 'qvbgt6hd9u', title: 'From GoDAM', url: 'https://cdn.test/g.m3u8', mime: 'video/mp4' } );
		media.select( { id: 55, title: 'Lesson intro', url: 'https://cdn.test/intro.mp4', mime: 'video/mp4' } );
		document.dispatchEvent( new CustomEvent( 'godam-virtual-attachment-created', {
			detail: { virtualMediaId: 'qvbgt6hd9u', attachment: { id: 901, title: 'From GoDAM', url: 'https://cdn.test/g.mp4' } },
		} ) );

		expect( $( 'lesson_video_godam_id' ).value ).toBe( '55' );
	} );

	it( 'does nothing without the media library', () => {
		render( true, '[video_godam]' );

		expect( setupVideoPicker( document, CONFIG, {} ) ).toBe( 0 );
	} );
} );

/**
 * Internal dependencies
 */
import isAudioMedia from './is-audio-media';

describe( 'isAudioMedia', () => {
	it( 'accepts audio picked from the library', () => {
		expect( isAudioMedia( { mime: 'audio/mpeg' } ) ).toBe( true );
		expect( isAudioMedia( { mime: 'audio/webm' } ) ).toBe( true );
	} );

	it( 'accepts a video/webm with no picture size: an audio-only .webm uploaded before it was stored as audio', () => {
		expect( isAudioMedia( { mime: 'video/webm' } ) ).toBe( true );
		// A fresh upload carries `mime_type` and `media_details` instead of `mime` and `width`.
		expect( isAudioMedia( { mime_type: 'video/webm', type: 'attachment', media_details: {} } ) ).toBe( true );
	} );

	it( 'rejects a video/webm with a picture, such as a screen recording', () => {
		expect( isAudioMedia( { mime: 'video/webm', width: 1280, height: 720 } ) ).toBe( false );
		expect( isAudioMedia( { mime_type: 'video/webm', type: 'attachment', media_details: { width: 640, height: 360 } } ) ).toBe( false );
	} );

	it( 'accepts the audio types this PR stores audio-only uploads as', () => {
		expect( isAudioMedia( { mime: 'audio/mp4' } ) ).toBe( true );
		expect( isAudioMedia( { mime_type: 'audio/webm', type: 'attachment' } ) ).toBe( true );
	} );

	it( 'rejects other video, image and document types', () => {
		expect( isAudioMedia( { mime: 'video/mp4' } ) ).toBe( false );
		expect( isAudioMedia( { mime: 'video/quicktime' } ) ).toBe( false );
		expect( isAudioMedia( { mime: 'image/png' } ) ).toBe( false );
		expect( isAudioMedia( { mime_type: 'application/pdf' } ) ).toBe( false );
	} );

	it( 'does not block a selection that names no MIME type', () => {
		expect( isAudioMedia( { url: 'https://example.com/a.mp3' } ) ).toBe( true );
	} );
} );

/**
 * Internal dependencies
 */
import isAudioMedia from './is-audio-media';

describe( 'isAudioMedia', () => {
	it( 'accepts audio picked from the library', () => {
		expect( isAudioMedia( { mime: 'audio/mpeg' } ) ).toBe( true );
		expect( isAudioMedia( { mime: 'audio/webm' } ) ).toBe( true );
	} );

	it( 'accepts a .webm, which WordPress types video/webm even when it holds only audio', () => {
		expect( isAudioMedia( { mime: 'video/webm' } ) ).toBe( true );
		// A fresh upload carries `mime_type` instead of `mime`.
		expect( isAudioMedia( { mime_type: 'video/webm', type: 'attachment' } ) ).toBe( true );
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

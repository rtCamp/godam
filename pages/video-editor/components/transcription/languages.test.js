/**
 * Internal dependencies
 */
import { TRANSCRIBE_LANGUAGES, CAPTION_LANGUAGES, languageLabel, isLanguageCode } from './languages';
import { cuesToVTT, isCaptionFileTooLarge, MAX_CAPTION_BYTES } from './utils';

// SUPPORTED_TRANSCRIPTION_LANGUAGES in godam-core godam_core/utils/transcription.py.
const CENTRAL_SUPPORTED = [ 'auto', 'multi', 'en', 'es', 'fr', 'de', 'hi', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'ru', 'tr', 'uk', 'id', 'sv', 'pl', 'ta' ];

describe( 'transcription languages', () => {
	it( 'starts Generate on the account default, which sends no language', () => {
		expect( TRANSCRIBE_LANGUAGES[ 0 ].value ).toBe( '' );
	} );

	it( 'offers Generate only languages GoDAM Central accepts', () => {
		const codes = TRANSCRIBE_LANGUAGES.map( ( { value } ) => value ).filter( Boolean );

		expect( codes.filter( ( code ) => ! CENTRAL_SUPPORTED.includes( code ) ) ).toEqual( [] );
		expect( codes ).toContain( 'ta' );
	} );

	it( 'still offers other languages for uploaded captions', () => {
		const codes = CAPTION_LANGUAGES.map( ( { value } ) => value );

		expect( codes ).toEqual( expect.arrayContaining( [ 'ar', 'cy', 'pt-BR' ] ) );
	} );

	it( 'labels known codes and falls back to the code itself', () => {
		expect( languageLabel( 'cy' ) ).toBe( 'Welsh' );
		expect( languageLabel( 'gd' ) ).toBe( 'gd' );
	} );
} );

describe( 'cuesToVTT', () => {
	it( 'carries a rounded millisecond into the next second', () => {
		expect( cuesToVTT( [ { start: 1.9996, end: 3, text: 'Hi' } ] ) ).toContain( '00:00:02.000 --> 00:00:03.000' );
	} );
} );

describe( 'caption checks before upload', () => {
	it.each( [ 'en', 'cy', 'pt-BR', 'zh-Hant-TW', 'fil' ] )( 'accepts the language code %s', ( code ) => {
		expect( isLanguageCode( code ) ).toBe( true );
	} );

	it.each( [ 'English', 'e', 'pt_BR', 'en-', 'en US', '', `en-${ 'a'.repeat( 8 ) }-${ 'b'.repeat( 8 ) }-${ 'c'.repeat( 8 ) }-${ 'd'.repeat( 8 ) }` ] )(
		'refuses %p, as Central does',
		( code ) => {
			expect( isLanguageCode( code ) ).toBe( false );
		},
	);

	it( 'refuses a file over Central\'s 1 MB limit before reading it', () => {
		expect( isCaptionFileTooLarge( { size: MAX_CAPTION_BYTES } ) ).toBe( false );
		expect( isCaptionFileTooLarge( { size: MAX_CAPTION_BYTES + 1 } ) ).toBe( true );
	} );
} );

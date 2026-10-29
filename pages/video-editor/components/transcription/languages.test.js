/**
 * Internal dependencies
 */
import { TRANSCRIBE_LANGUAGES, CAPTION_LANGUAGES, languageLabel } from './languages';
import { cuesToVTT } from './utils';

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

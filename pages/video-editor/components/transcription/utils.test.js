/**
 * Internal dependencies
 */
import { getGenerateRefusal } from './utils';

describe( 'getGenerateRefusal', () => {
	it( 'reads the reason from `message` when Central leaves `error` empty', () => {
		// Central's answer on an account with no transcription quota left (e2e, 9 Nov 2026).
		const result = {
			success: false,
			status: '',
			current_status: '',
			transcript_path: '',
			error: '',
			message: 'Transcription limit exceeded. Cannot process transcription.',
		};

		expect( getGenerateRefusal( result ) ).toBe( 'Transcription limit exceeded. Cannot process transcription.' );
	} );

	it( 'prefers `error` when both are set', () => {
		expect( getGenerateRefusal( { success: false, error: 'No audio track.', message: 'Failed.' } ) ).toBe( 'No audio track.' );
	} );

	it( 'still counts a refusal with no reason, so the caller can show its own', () => {
		expect( getGenerateRefusal( { success: false, error: '', message: '' } ) ).toBe( '' );
	} );

	it.each( [
		[ 'a job already in progress', { success: false, current_status: 'Transcribing', message: 'Already transcribing.' } ],
		[ 'a job still being prepared', { success: false, status: 'Transcoding' } ],
		[ 'a job that started', { success: true, transcript_path: '' } ],
		[ 'a transcript that already exists', { success: false, transcript_path: 'https://cdn.example/job/en.vtt' } ],
		[ 'no answer at all', undefined ],
	] )( 'is not a refusal for %s', ( label, result ) => {
		expect( getGenerateRefusal( result ) ).toBeNull();
	} );
} );

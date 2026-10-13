/**
 * Internal dependencies
 */
import { forgetGravityFormsSavedFile, hasGravityFormsSavedFile } from './gravity-forms-saved-file';

/**
 * Renders a form with the recorder's file input and, optionally, Gravity Forms' saved-files list.
 *
 * @param {string|null} savedFiles Value of `gform_uploaded_files`, or null to leave the input out.
 * @return {Object} The file input and the saved-files input.
 */
const renderForm = ( savedFiles ) => {
	document.body.innerHTML = `
		<form>
			<input type="file" name="input_3" />
			${ null === savedFiles ? '' : '<input type="hidden" name="gform_uploaded_files" />' }
		</form>`;

	const savedFilesInput = document.querySelector( 'input[name="gform_uploaded_files"]' );
	if ( savedFilesInput ) {
		savedFilesInput.value = savedFiles;
	}

	return { fileInput: document.querySelector( 'input[name="input_3"]' ), savedFilesInput };
};

const savedRecording = [ { uploaded_filename: 'audio-1.webm', temp_filename: 'abc_input_3_audio-1.webm' } ];

describe( 'hasGravityFormsSavedFile', () => {
	it( 'is true when Gravity Forms saved a recording for this input', () => {
		const { fileInput } = renderForm( JSON.stringify( { input_3: savedRecording } ) );
		expect( hasGravityFormsSavedFile( fileInput ) ).toBe( true );
	} );

	it( 'is false when only another field has a saved file', () => {
		const { fileInput } = renderForm( JSON.stringify( { input_7: savedRecording } ) );
		expect( hasGravityFormsSavedFile( fileInput ) ).toBe( false );
	} );

	it( 'is false when the saved list for this input is empty', () => {
		const { fileInput } = renderForm( JSON.stringify( { input_3: [] } ) );
		expect( hasGravityFormsSavedFile( fileInput ) ).toBe( false );
	} );

	it( 'accepts the older single-filename format', () => {
		const { fileInput } = renderForm( JSON.stringify( { input_3: 'audio-1.webm' } ) );
		expect( hasGravityFormsSavedFile( fileInput ) ).toBe( true );
	} );

	it( 'is false outside Gravity Forms, with an empty list, or with unreadable JSON', () => {
		expect( hasGravityFormsSavedFile( renderForm( null ).fileInput ) ).toBe( false );
		expect( hasGravityFormsSavedFile( renderForm( '' ).fileInput ) ).toBe( false );
		expect( hasGravityFormsSavedFile( renderForm( '{not json' ).fileInput ) ).toBe( false );
	} );
} );

describe( 'forgetGravityFormsSavedFile', () => {
	it( 'removes only this input from the saved list', () => {
		const { fileInput, savedFilesInput } = renderForm( JSON.stringify( { input_3: savedRecording, input_7: savedRecording } ) );

		forgetGravityFormsSavedFile( fileInput );

		expect( JSON.parse( savedFilesInput.value ) ).toEqual( { input_7: savedRecording } );
		expect( hasGravityFormsSavedFile( fileInput ) ).toBe( false );
	} );

	it( 'leaves the list untouched when this input has nothing saved', () => {
		const original = JSON.stringify( { input_7: savedRecording } );
		const { fileInput, savedFilesInput } = renderForm( original );

		forgetGravityFormsSavedFile( fileInput );

		expect( savedFilesInput.value ).toBe( original );
	} );

	it( 'does nothing outside Gravity Forms', () => {
		const { fileInput } = renderForm( null );
		expect( () => forgetGravityFormsSavedFile( fileInput ) ).not.toThrow();
	} );
} );

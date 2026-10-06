/**
 * Helpers for the recording Gravity Forms has already saved on the server.
 *
 * Gravity Forms 2.9.18+ saves a file upload field's file to its temp folder when the visitor
 * moves to another page or a submit fails validation, and lists it in the form's hidden
 * `gform_uploaded_files` input. On the next submit it counts that saved copy together with any
 * file sent again, so the recorder must not send a restored recording a second time.
 */

/**
 * Finds the form's hidden list of files Gravity Forms already saved.
 *
 * @param {HTMLInputElement} fileInput The recorder's file input.
 * @return {HTMLInputElement|null} The `gform_uploaded_files` input, or null outside Gravity Forms.
 */
const getSavedFilesInput = ( fileInput ) =>
	fileInput?.form?.querySelector( 'input[name="gform_uploaded_files"]' ) ?? null;

/**
 * Reads the saved-files list, keyed by input name.
 *
 * @param {HTMLInputElement|null} savedFilesInput The `gform_uploaded_files` input.
 * @return {Object} The saved files, or an empty object.
 */
const readSavedFiles = ( savedFilesInput ) => {
	if ( ! savedFilesInput?.value ) {
		return {};
	}

	try {
		const savedFiles = JSON.parse( savedFilesInput.value );
		return savedFiles && 'object' === typeof savedFiles && ! Array.isArray( savedFiles ) ? savedFiles : {};
	} catch ( e ) {
		return {};
	}
};

/**
 * Whether Gravity Forms already saved a file for this input.
 *
 * @param {HTMLInputElement} fileInput The recorder's file input.
 * @return {boolean} True when the form holds a saved file for the input.
 */
export const hasGravityFormsSavedFile = ( fileInput ) => {
	const saved = readSavedFiles( getSavedFilesInput( fileInput ) )[ fileInput?.name ];

	return Array.isArray( saved ) ? saved.length > 0 : Boolean( saved );
};

/**
 * Removes this input's saved file from the list, so Gravity Forms does not submit it.
 *
 * @param {HTMLInputElement} fileInput The recorder's file input.
 */
export const forgetGravityFormsSavedFile = ( fileInput ) => {
	const savedFilesInput = getSavedFilesInput( fileInput );
	const savedFiles = readSavedFiles( savedFilesInput );

	if ( ! savedFilesInput || ! Object.prototype.hasOwnProperty.call( savedFiles, fileInput.name ) ) {
		return;
	}

	delete savedFiles[ fileInput.name ];
	savedFilesInput.value = JSON.stringify( savedFiles );
};

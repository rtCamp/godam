/**
 * Fresh upload nonce for the Fluent Forms and Ninja Forms recorder fields.
 *
 * The nonce printed into the page goes stale when a page cache serves the page
 * for longer than a nonce lives (one to two days), and the upload then fails.
 * So the recorder asks admin-ajax.php, which is never page cached, for a fresh
 * one right before each upload (Recorder_Upload_Nonce on the server).
 */

/**
 * Ask the server for a fresh recorder upload nonce.
 *
 * @param {string}        ajaxUrl  admin-ajax.php URL.
 * @param {string}        form     'fluentforms' or 'ninja-forms'.
 * @param {number|string} fieldId  Ninja Forms field ID. Not used for Fluent Forms.
 * @param {string}        fallback Nonce printed into the page, used when the request fails.
 *
 * @return {Promise<string>} The fresh nonce, or the fallback.
 */
export async function getRecorderUploadNonce( ajaxUrl, form, fieldId, fallback = '' ) {
	if ( ! ajaxUrl ) {
		return fallback;
	}

	const body = new FormData();
	body.append( 'action', 'godam_recorder_upload_nonce' );
	body.append( 'form', form );
	body.append( 'field_id', fieldId || 0 );

	try {
		const response = await fetch( ajaxUrl, {
			method: 'POST',
			body,
			credentials: 'same-origin',
		} );
		const responseData = await response.json();

		return responseData?.success && responseData?.data?.nonce ? responseData.data.nonce : fallback;
	} catch {
		return fallback;
	}
}

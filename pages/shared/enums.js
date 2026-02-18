/**
 * API Key Status enum.
 *
 * Mirrors the PHP Api_Key_Status enum class values.
 *
 * @package GoDAM
 */

/**
 * API key status values.
 *
 * @readonly
 * @enum {string}
 */
export const API_KEY_STATUS = Object.freeze( {
	VALID: 'valid',
	EXPIRED: 'expired',
	VERIFICATION_FAILED: 'verification_failed',
} );

/**
 * Error types returned from the server or determined locally.
 *
 * @readonly
 * @enum {string}
 */
export const ERROR_TYPE = Object.freeze( {
	INVALID_KEY: 'invalid_key',
	MISSING_KEY: 'missing_key',
	MICROSERVICE_ERROR: 'microservice_error',
} );
